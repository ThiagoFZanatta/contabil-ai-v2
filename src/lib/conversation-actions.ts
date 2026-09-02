import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Enviar uma resposta manual numa conversa (Tela 5) precisa do segredo do
// WhatsApp do tenant, então é a única ação desta tela que não pode ser um
// update direto por RLS (diferente de "assumir conversa", que é só uma
// transição de estado — ver comentário da policy conversations_update_same_tenant).

const replyInput = z.object({
  conversationId: z.string().uuid(),
  text: z.string().trim().min(1),
});

export const sendConversationReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => replyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: caller, error: callerError } = await supabase
      .from("staff")
      .select("tenant_id")
      .eq("id", userId)
      .single();
    if (callerError || !caller) {
      throw new Error("Não foi possível confirmar seu cadastro de equipe.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: conversation, error: convError } = await supabaseAdmin
      .from("conversations")
      .select("id, contact_id, lead_id")
      .eq("id", data.conversationId)
      .eq("tenant_id", caller.tenant_id)
      .single();
    if (convError || !conversation) {
      throw new Error("Conversa não encontrada.");
    }

    let whatsappNumber: string | null = null;
    if (conversation.contact_id) {
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("whatsapp_number")
        .eq("id", conversation.contact_id)
        .single();
      whatsappNumber = contact?.whatsapp_number ?? null;
    } else if (conversation.lead_id) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("whatsapp_number")
        .eq("id", conversation.lead_id)
        .single();
      whatsappNumber = lead?.whatsapp_number ?? null;
    }
    if (!whatsappNumber) {
      throw new Error("Este contato não tem um número de WhatsApp cadastrado.");
    }

    const { resolveWhatsAppProvider } = await import("@/lib/integrations/resolve.server");
    const whatsapp = await resolveWhatsAppProvider(caller.tenant_id);
    if (!whatsapp.isConfigured()) {
      throw new Error("O WhatsApp ainda não está configurado para este escritório.");
    }

    const sendResult = await whatsapp.sendMessage({ to: whatsappNumber, text: data.text });
    if (!sendResult.ok) {
      throw new Error(sendResult.error);
    }

    const { error: insertError } = await supabaseAdmin.from("messages").insert({
      tenant_id: caller.tenant_id,
      conversation_id: data.conversationId,
      sender: "humano",
      body: data.text,
      sender_staff_id: userId,
      provider_message_id: sendResult.providerMessageId,
    });
    if (insertError) {
      throw new Error("Mensagem enviada, mas houve um erro ao registrar no histórico.");
    }

    await supabaseAdmin
      .from("conversations")
      .update({ status: "em_atendimento" })
      .eq("id", data.conversationId);

    return { ok: true as const };
  });
