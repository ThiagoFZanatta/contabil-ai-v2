import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { AiMessage, AiProvider } from "@/lib/integrations/ai/types";
import { resolveAiProvider, resolveWhatsAppProvider } from "@/lib/integrations/resolve.server";
import type { WhatsAppProvider } from "@/lib/integrations/whatsapp/types";
import { AGENT_TOOL_DEFINITIONS, escalateToDepartment, executeAgentTool } from "./tools.server";
import { buildSystemPrompt } from "./system-prompt.server";
import { toBusinessHoursWallClock, type ToolContext } from "./types";

// Motor de atendimento (RF03/10.2): a partir de uma mensagem já ingerida
// pelo webhook (meta-cloud-webhook.server.ts), decide o que fazer —
// consentimento LGPD, identificação de empresa (RF09), chamada ao AiProvider
// com as 9 tools, e envio da resposta de volta pelo WhatsAppProvider. Cada
// passo de ferramenta é auditado em agent_tool_calls (seção 8/9).

const MAX_TOOL_ROUNDS = 4;
const MAX_HISTORY_MESSAGES = 20;

// Mesmo rascunho de consentimento da seção 8.1 do PRD — não revisado
// juridicamente. Usado só como fallback quando o tenant ainda não publicou
// uma versão própria em consent_policy_versions (Tela 8).
const DEFAULT_CONSENT_TEXT =
  "Olá! Este atendimento é feito com apoio de inteligência artificial. Para te ajudar, podemos processar as informações que você compartilhar aqui (dúvidas, documentos enviados, dados da sua empresa) e, quando necessário, encaminhar sua conversa para um de nossos especialistas humanos. Você pode falar com uma pessoa da nossa equipe a qualquer momento — é só pedir. Podemos seguir?";

const FALLBACK_ESCALATION_DEPARTMENT = "fiscal";

export async function runAgentTurn(params: {
  tenantId: string;
  conversationId: string;
}): Promise<void> {
  const { tenantId, conversationId } = params;

  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, status, contact_id, lead_id")
    .eq("id", conversationId)
    .single();
  if (!conversation) return;

  // Uma vez escalada, a conversa pertence à fila humana (RF05) — a IA para
  // de responder automaticamente até ela ser reaberta/resolvida.
  if (conversation.status !== "ia") return;

  const ctx: ToolContext = {
    tenantId,
    conversationId,
    contactId: conversation.contact_id,
    leadId: conversation.lead_id,
  };

  const whatsapp = await resolveWhatsAppProvider(tenantId);
  if (!whatsapp.isConfigured()) return; // sem canal de envio, nada a fazer

  const consentOutcome = await handleConsentGate(ctx, whatsapp);
  if (consentOutcome === "sent_consent_prompt") return;

  if (ctx.contactId) {
    await autoResolveSingleClient(ctx);
  }

  const ai = await resolveAiProvider(tenantId);
  if (!ai.isConfigured()) {
    // Guardrail da seção 9.1: nunca simular resposta / falhar silenciosamente
    // quando uma integração não está configurada — aqui isso significa
    // escalar direto para humano em vez de fingir que a IA respondeu.
    await escalateToDepartment(ctx, {
      departmentSlug: FALLBACK_ESCALATION_DEPARTMENT,
      reason: "Provedor de IA não configurado para este tenant",
    });
    await sendAndLog(
      ctx,
      whatsapp,
      "No momento nosso atendimento automático está indisponível — já encaminhei você para nossa equipe, que vai te responder em breve.",
    );
    return;
  }

  const history = await loadRecentMessages(conversationId);
  const systemPrompt = await buildSystemPrompt(ctx);
  const { text, escalatedNow } = await runToolLoop(ai, systemPrompt, history, ctx);

  const finalText =
    escalatedNow && !(await isWithinBusinessHours(tenantId))
      ? `${text}\n\nComo estamos fora do horário comercial, um especialista vai te responder no próximo horário útil.`
      : text;

  await sendAndLog(ctx, whatsapp, finalText);
}

// Seção 8.1: no primeiro contato de um número novo, a IA não processa
// nenhum conteúdo além do próprio aviso de consentimento. Qualquer
// continuação da conversa depois disso é tratada como aceite.
async function handleConsentGate(
  ctx: ToolContext,
  whatsapp: WhatsAppProvider,
): Promise<"proceed" | "sent_consent_prompt"> {
  const { data: existingConsent } = await supabaseAdmin
    .from("consent_log")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .match(ctx.contactId ? { contact_id: ctx.contactId } : { lead_id: ctx.leadId as string })
    .maybeSingle();
  if (existingConsent) return "proceed";

  const { data: state } = await supabaseAdmin
    .from("agent_conversation_state")
    .select("context")
    .eq("conversation_id", ctx.conversationId)
    .maybeSingle();
  const context = (state?.context ?? {}) as Record<string, unknown>;

  const { data: latestPolicyRow } = await supabaseAdmin
    .from("consent_policy_versions")
    .select("id, text")
    .eq("tenant_id", ctx.tenantId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  // consent_log.policy_version_id é NOT NULL — sem nenhuma versão publicada
  // pelo tenant (Tela 8 → Consentimento), o aceite nunca poderia ser
  // gravado, e o gate voltaria a disparar a cada mensagem par (o contexto é
  // limpo mesmo sem log, então a próxima mensagem cai de novo no "else"
  // abaixo). Semeia o rascunho padrão da seção 8.1 para o aceite ter onde
  // ser registrado; o tenant pode revisar/publicar a versão dele depois.
  const latestPolicy =
    latestPolicyRow ??
    (
      await supabaseAdmin
        .from("consent_policy_versions")
        .insert({ tenant_id: ctx.tenantId, text: DEFAULT_CONSENT_TEXT })
        .select("id, text")
        .single()
    ).data;

  if (context["awaiting_consent"]) {
    if (latestPolicy) {
      await supabaseAdmin.from("consent_log").insert({
        tenant_id: ctx.tenantId,
        contact_id: ctx.contactId,
        lead_id: ctx.leadId,
        policy_version_id: latestPolicy.id,
      });
    }
    await supabaseAdmin
      .from("agent_conversation_state")
      .update({ context: {} as Json })
      .eq("conversation_id", ctx.conversationId);
    return "proceed";
  }

  await supabaseAdmin.from("agent_conversation_state").upsert(
    {
      conversation_id: ctx.conversationId,
      tenant_id: ctx.tenantId,
      context: { awaiting_consent: true } as Json,
    },
    { onConflict: "conversation_id" },
  );

  await sendAndLog(ctx, whatsapp, latestPolicy?.text ?? DEFAULT_CONSENT_TEXT);
  return "sent_consent_prompt";
}

// RF09: se o contato só tiver 1 CNPJ vinculado, a IA segue direto, sem
// perguntar — resolvido aqui de forma determinística, sem depender do
// modelo decidir chamar resolve_active_client para o caso mais comum.
async function autoResolveSingleClient(ctx: ToolContext): Promise<void> {
  const { data: state } = await supabaseAdmin
    .from("agent_conversation_state")
    .select("active_client_id")
    .eq("conversation_id", ctx.conversationId)
    .maybeSingle();
  if (state?.active_client_id) return;

  const { data: links } = await supabaseAdmin
    .from("client_contact_links")
    .select("client_id")
    .eq("contact_id", ctx.contactId as string);

  const onlyLink = links?.length === 1 ? links[0] : undefined;
  if (onlyLink) {
    await supabaseAdmin.from("agent_conversation_state").upsert(
      {
        conversation_id: ctx.conversationId,
        tenant_id: ctx.tenantId,
        active_client_id: onlyLink.client_id,
      },
      { onConflict: "conversation_id" },
    );
  }
}

async function loadRecentMessages(conversationId: string): Promise<AiMessage[]> {
  const { data } = await supabaseAdmin
    .from("messages")
    .select("sender, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_MESSAGES);

  return (data ?? []).map((m) => ({
    role: m.sender === "cliente" ? "user" : "assistant",
    content: m.body,
  }));
}

// O AiProvider genérico (seção 10.1) só conhece mensagens {role, content} —
// para não acoplar a orquestração ao formato nativo de tool-calling de um
// provedor específico (guardrail de arquitetura da seção 10.1), o
// resultado de cada rodada de ferramentas volta ao modelo como uma
// mensagem de texto comum, não como um "tool" role estruturado.
async function runToolLoop(
  ai: AiProvider,
  systemPrompt: string,
  history: AiMessage[],
  ctx: ToolContext,
): Promise<{ text: string; escalatedNow: boolean }> {
  const messages = [...history];
  let escalatedNow = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await ai.callAgent({ systemPrompt, messages, tools: AGENT_TOOL_DEFINITIONS });

    if (!result.ok) {
      await escalateToDepartment(ctx, {
        departmentSlug: FALLBACK_ESCALATION_DEPARTMENT,
        reason: `Falha no motor de IA: ${result.error}`,
      });
      return {
        text: "Tive um problema técnico agora — já chamei um especialista para te ajudar.",
        escalatedNow: true,
      };
    }

    if (result.toolCalls.length === 0) {
      return { text: result.text || "Certo!", escalatedNow };
    }

    const resultLines: string[] = [];
    for (const call of result.toolCalls) {
      const output = await executeAgentTool(call.name, call.input, ctx);
      const isError =
        typeof output === "object" &&
        output !== null &&
        "error" in (output as Record<string, unknown>);

      await supabaseAdmin.from("agent_tool_calls").insert({
        tenant_id: ctx.tenantId,
        conversation_id: ctx.conversationId,
        tool_name: call.name,
        input: (call.input ?? {}) as Json,
        output: output as Json,
        status: isError ? "error" : "success",
        error_message: isError ? String((output as Record<string, unknown>)["error"]) : null,
      });

      if (call.name === "escalate_to_department" && !isError) escalatedNow = true;
      resultLines.push(`${call.name}: ${JSON.stringify(output)}`);
    }

    messages.push({
      role: "assistant",
      content:
        result.text || `[chamando ferramentas: ${result.toolCalls.map((c) => c.name).join(", ")}]`,
    });
    messages.push({
      role: "user",
      content: `[Resultado das ferramentas]\n${resultLines.join("\n")}`,
    });
  }

  await escalateToDepartment(ctx, {
    departmentSlug: FALLBACK_ESCALATION_DEPARTMENT,
    reason: "Limite de passos do agente atingido sem uma resposta final",
  });
  return {
    text: "Deixa eu te conectar com um especialista para continuar te ajudando.",
    escalatedNow: true,
  };
}

async function isWithinBusinessHours(tenantId: string): Promise<boolean> {
  // business_hours guarda horário local (ver types.ts) — compara contra o
  // relógio local, não contra o UTC cru.
  const localNow = toBusinessHoursWallClock(new Date());
  const { data } = await supabaseAdmin
    .from("business_hours")
    .select("start_time, end_time")
    .eq("tenant_id", tenantId)
    .eq("day_of_week", localNow.getUTCDay())
    .maybeSingle();
  if (!data) return false;

  const hhmmss = localNow.toISOString().slice(11, 19);
  return hhmmss >= data.start_time && hhmmss <= data.end_time;
}

async function resolveDestinationNumber(ctx: ToolContext): Promise<string | null> {
  if (ctx.contactId) {
    const { data } = await supabaseAdmin
      .from("contacts")
      .select("whatsapp_number")
      .eq("id", ctx.contactId)
      .single();
    return data?.whatsapp_number ?? null;
  }
  if (ctx.leadId) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("whatsapp_number")
      .eq("id", ctx.leadId)
      .single();
    return data?.whatsapp_number ?? null;
  }
  return null;
}

async function sendAndLog(
  ctx: ToolContext,
  whatsapp: WhatsAppProvider,
  text: string,
): Promise<void> {
  const to = await resolveDestinationNumber(ctx);
  if (!to) return;

  const result = await whatsapp.sendMessage({ to, text });
  await supabaseAdmin.from("messages").insert({
    tenant_id: ctx.tenantId,
    conversation_id: ctx.conversationId,
    sender: "ia",
    body: text,
    provider_message_id: result.ok ? result.providerMessageId : null,
  });
}
