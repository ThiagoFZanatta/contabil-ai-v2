import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runAgentTurn } from "@/lib/agent/orchestrator.server";

// Recebe as entregas do webhook da Meta Cloud API (RF03) — o outro lado da
// integração já escrita em meta-cloud-provider.ts (que só envia). Identifica
// o tenant pelo phone_number_id, valida a assinatura, encontra ou cria o
// contato/lead e a conversa, grava a mensagem, e então aciona o motor de IA
// (orchestrator.server.ts) para decidir e enviar a resposta.

interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

interface MetaWebhookValue {
  metadata?: { phone_number_id?: string };
  messages?: MetaWebhookMessage[];
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id: string;
    changes?: Array<{ field: string; value: MetaWebhookValue }>;
  }>;
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const providedHex = signatureHeader.slice("sha256=".length);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computedHex = [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computedHex, providedHex);
}

function handleVerification(url: URL): Response {
  const verifyToken = process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"];
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (!verifyToken || mode !== "subscribe" || token !== verifyToken || !challenge) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge, { status: 200 });
}

async function findOrCreateParty(
  tenantId: string,
  fromNumber: string,
): Promise<{ contactId: string | null; leadId: string | null }> {
  const digits = normalizeDigits(fromNumber);

  const { data: contacts } = await supabaseAdmin
    .from("contacts")
    .select("id, whatsapp_number")
    .eq("tenant_id", tenantId);
  const matchedContact = (contacts ?? []).find(
    (c) => normalizeDigits(c.whatsapp_number) === digits,
  );
  if (matchedContact) return { contactId: matchedContact.id, leadId: null };

  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("id, whatsapp_number")
    .eq("tenant_id", tenantId)
    .not("whatsapp_number", "is", null);
  const matchedLead = (leads ?? []).find(
    (l) => l.whatsapp_number && normalizeDigits(l.whatsapp_number) === digits,
  );
  if (matchedLead) return { contactId: null, leadId: matchedLead.id };

  // Número desconhecido: RF03 pede para identificar cliente ativo vs. lead —
  // sem correspondência em contacts/leads, é um lead novo.
  const { data: newLead, error } = await supabaseAdmin
    .from("leads")
    .insert({ tenant_id: tenantId, name: `Novo contato +${digits}`, whatsapp_number: `+${digits}` })
    .select("id")
    .single();
  if (error || !newLead) {
    throw new Error(`Não foi possível criar lead para +${digits}: ${error?.message}`);
  }
  return { contactId: null, leadId: newLead.id };
}

async function findOrCreateConversation(
  tenantId: string,
  party: { contactId: string | null; leadId: string | null },
): Promise<string> {
  const baseQuery = supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .neq("status", "resolvida")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: existing } = party.contactId
    ? await baseQuery.eq("contact_id", party.contactId).maybeSingle()
    : await baseQuery.eq("lead_id", party.leadId as string).maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from("conversations")
    .insert(
      party.contactId
        ? { tenant_id: tenantId, contact_id: party.contactId }
        : { tenant_id: tenantId, lead_id: party.leadId },
    )
    .select("id")
    .single();
  if (error || !created) {
    throw new Error(`Não foi possível criar conversa: ${error?.message}`);
  }
  return created.id;
}

async function ingestInboundMessage(
  tenantId: string,
  message: MetaWebhookMessage,
): Promise<string | null> {
  const body =
    message.type === "text" && message.text
      ? message.text.body
      : `[mensagem do tipo ${message.type} recebida]`;

  const party = await findOrCreateParty(tenantId, message.from);
  const conversationId = await findOrCreateConversation(tenantId, party);

  const { error } = await supabaseAdmin.from("messages").insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    sender: "cliente",
    body,
    provider_message_id: message.id,
  });

  // 23505 = reentrega da Meta do mesmo wamid (unique parcial em
  // provider_message_id) — idempotência esperada, não aciona o agente de
  // novo para a mesma mensagem.
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(`Não foi possível gravar a mensagem ${message.id}: ${error.message}`);
  }

  return conversationId;
}

async function handleIncoming(request: Request): Promise<Response> {
  const rawBody = await request.text();

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value.metadata?.phone_number_id;
  if (!phoneNumberId) {
    // Payload sem mensagem reconhecível (ex: só status de entrega) — nada a
    // processar, mas a Meta espera 200 mesmo assim.
    return new Response("OK", { status: 200 });
  }

  const { data: integration } = await supabaseAdmin
    .from("tenant_integrations")
    .select("tenant_id")
    .eq("provider", "whatsapp")
    .eq("is_configured", true)
    .contains("metadata", { phone_number_id: phoneNumberId })
    .maybeSingle();

  if (!integration) {
    // Número não corresponde a nenhum tenant configurado — ack e ignora.
    return new Response("OK", { status: 200 });
  }

  const { data: appSecretRow } = await supabaseAdmin
    .from("tenant_integration_secrets")
    .select("secret_value")
    .eq("tenant_id", integration.tenant_id)
    .eq("provider", "whatsapp_app_secret")
    .maybeSingle();

  if (!appSecretRow) {
    return new Response("OK", { status: 200 });
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");
  const validSignature = await verifySignature(rawBody, signatureHeader, appSecretRow.secret_value);
  if (!validSignature) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tenantId = integration.tenant_id;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value.messages ?? []) {
        const conversationId = await ingestInboundMessage(tenantId, message);
        if (!conversationId) continue;

        // O agente nunca deve derrubar o ack do webhook — se a IA ou o
        // envio de WhatsApp falhar, a mensagem já está gravada e a Meta não
        // deve reentregar por causa disso. Falha aqui fica só no log do
        // runtime; a conversa segue visível na Inbox (Tela 5) mesmo sem
        // resposta automática.
        try {
          await runAgentTurn({ tenantId, conversationId });
        } catch (err) {
          console.error(`runAgentTurn falhou para a conversa ${conversationId}:`, err);
        }
      }
    }
  }

  return new Response("OK", { status: 200 });
}

export async function handleMetaCloudWebhook(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET") {
    return handleVerification(url);
  }
  if (request.method === "POST") {
    return handleIncoming(request);
  }
  return new Response("Method Not Allowed", { status: 405 });
}
