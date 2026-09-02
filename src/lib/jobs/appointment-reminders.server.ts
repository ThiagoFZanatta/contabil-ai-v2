import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveWhatsAppProvider } from "@/lib/integrations/resolve.server";
import { findOrCreateConversation } from "@/lib/integrations/whatsapp/meta-cloud-webhook.server";
import type { WhatsAppProvider } from "@/lib/integrations/whatsapp/types";
import { toBusinessHoursWallClock } from "@/lib/agent/types";

// RF06: lembrete automático de compromisso via WhatsApp, disparado por
// /api/cron/appointment-reminders (ver src/server.ts) num agendamento
// externo autenticado via authenticateCronRequest — não é um job pg_cron
// como o overflow do RF05 porque enviar a mensagem depende do
// WhatsAppProvider e dos segredos do tenant, algo que só o runtime da
// aplicação resolve (ver src/lib/integrations/resolve.server.ts).
const REMINDER_WINDOW_HOURS = 24;

const APPOINTMENT_TYPE_LABEL: Record<string, string> = {
  ligacao: "uma ligação",
  video: "uma chamada de vídeo",
  presencial: "um atendimento presencial",
};

// Sem uso de Intl/toLocaleDateString aqui de propósito — o runtime que
// executa este job (edge/worker) não tem garantia de dados de locale
// completos, então a formatação é manual sobre o mesmo truque de fuso fixo
// já usado no resto do motor de agenda (ver comentário em agent/types.ts).
function formatWallClock(startAtIso: string): string {
  const wall = toBusinessHoursWallClock(new Date(startAtIso));
  const dd = String(wall.getUTCDate()).padStart(2, "0");
  const mm = String(wall.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(wall.getUTCHours()).padStart(2, "0");
  const min = String(wall.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm} às ${hh}:${min}`;
}

interface DueAppointment {
  id: string;
  tenant_id: string;
  title: string;
  client_id: string | null;
  lead_id: string | null;
  appointment_type: string;
  start_at: string;
}

interface Recipient {
  contactId: string | null;
  leadId: string | null;
}

// Um compromisso de cliente pode ter mais de um contato autorizado (RF09) —
// todos têm a mesma permissão, então todos recebem o lembrete.
async function resolveRecipients(appt: DueAppointment): Promise<Recipient[]> {
  if (appt.lead_id) return [{ contactId: null, leadId: appt.lead_id }];
  if (!appt.client_id) return [];

  const { data: links } = await supabaseAdmin
    .from("client_contact_links")
    .select("contact_id")
    .eq("client_id", appt.client_id);
  return (links ?? []).map((link) => ({ contactId: link.contact_id, leadId: null }));
}

async function resolvePhoneNumber(recipient: Recipient): Promise<string | null> {
  if (recipient.contactId) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("whatsapp_number")
      .eq("id", recipient.contactId)
      .single();
    return data?.whatsapp_number ?? null;
  }
  if (recipient.leadId) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("whatsapp_number")
      .eq("id", recipient.leadId)
      .single();
    return data?.whatsapp_number ?? null;
  }
  return null;
}

async function sendReminder(
  appt: DueAppointment,
  recipient: Recipient,
  whatsapp: WhatsAppProvider,
): Promise<void> {
  const to = await resolvePhoneNumber(recipient);
  if (!to) return;

  const label = APPOINTMENT_TYPE_LABEL[appt.appointment_type] ?? "um compromisso";
  const text =
    `Lembrete: você tem ${label} agendado(a) para ${formatWallClock(appt.start_at)}` +
    `${appt.title ? ` — ${appt.title}` : ""}. Se precisar remarcar, é só nos avisar por aqui.`;

  const conversationId = await findOrCreateConversation(appt.tenant_id, recipient);
  const result = await whatsapp.sendMessage({ to, text });
  await supabaseAdmin.from("messages").insert({
    tenant_id: appt.tenant_id,
    conversation_id: conversationId,
    sender: "ia",
    body: text,
    provider_message_id: result.ok ? result.providerMessageId : null,
  });
}

export async function runAppointmentReminders(): Promise<{ processed: number }> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60_000);

  const { data: dueAppointments } = await supabaseAdmin
    .from("appointments")
    .select("id, tenant_id, title, client_id, lead_id, appointment_type, start_at")
    .is("reminder_sent_at", null)
    .gt("start_at", now.toISOString())
    .lte("start_at", windowEnd.toISOString());

  const providerCache = new Map<string, WhatsAppProvider>();
  async function providerFor(tenantId: string): Promise<WhatsAppProvider> {
    const cached = providerCache.get(tenantId);
    if (cached) return cached;
    const provider = await resolveWhatsAppProvider(tenantId);
    providerCache.set(tenantId, provider);
    return provider;
  }

  let processed = 0;
  for (const appt of dueAppointments ?? []) {
    const whatsapp = await providerFor(appt.tenant_id);
    if (whatsapp.isConfigured()) {
      const recipients = await resolveRecipients(appt);
      for (const recipient of recipients) {
        await sendReminder(appt, recipient, whatsapp);
      }
    }

    // Marcado como processado mesmo sem provider configurado ou sem
    // destinatário (compromisso puramente interno, sem client_id/lead_id) —
    // evita reprocessar o mesmo compromisso a cada execução do job até ele
    // sair da janela de 24h. Um tenant que configura o WhatsApp depois disso
    // só perde o lembrete dos compromissos já dentro da janela nesse meio-tempo.
    await supabaseAdmin
      .from("appointments")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", appt.id);
    processed++;
  }

  return { processed };
}
