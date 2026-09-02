import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEPARTMENT_SLUGS, type ToolContext } from "./types";

// Monta o system prompt de cada turno (PRD 10.2: persona/tom de voz +
// mapeamento de intenção → ferramenta fica documentado aqui, em texto, em
// vez de espalhado/opaco no código). Refeito a cada turno porque persona e
// empresa ativa podem mudar entre mensagens.
export async function buildSystemPrompt(ctx: ToolContext): Promise<string> {
  const [{ data: agentConfig }, { data: state }] = await Promise.all([
    supabaseAdmin
      .from("ai_agent_config")
      .select("agent_name, persona_tone")
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle(),
    supabaseAdmin
      .from("agent_conversation_state")
      .select("active_client_id")
      .eq("conversation_id", ctx.conversationId)
      .maybeSingle(),
  ]);

  const agentName = agentConfig?.agent_name ?? "Nara";
  const toneLine = agentConfig?.persona_tone ? `Tom de voz: ${agentConfig.persona_tone}.` : "";

  let contextLine: string;
  if (ctx.leadId) {
    contextLine =
      "Esta conversa é com um LEAD (contato novo, ainda não é cliente do escritório). Use create_lead para registrar nome/segmento/motivo do contato assim que souber, e qualify_lead quando tiver informação suficiente para tentar agendar uma call com o SDR/Closer.";
  } else if (state?.active_client_id) {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("name")
      .eq("id", state.active_client_id)
      .single();
    contextLine = `Esta conversa é com um contato da empresa cliente "${client?.name ?? ""}". Use get_client_context e check_pending_documents para responder com dados reais dessa empresa, nunca invente.`;
  } else {
    contextLine =
      "Este contato pode estar vinculado a mais de uma empresa cliente. Antes de responder qualquer dúvida específica de empresa, chame resolve_active_client (sem 'choice') para ver as opções, pergunte ao cliente qual empresa, e chame de novo com 'choice' com a resposta dele.";
  }

  return `Você é ${agentName}, o assistente de atendimento via WhatsApp de um escritório de contabilidade brasileiro. ${toneLine}

${contextLine}

Regras obrigatórias:
- Nunca invente informação fiscal, financeira ou de prazos específica de um cliente. Sempre confirme com get_client_context / check_pending_documents / search_knowledge_base antes de responder algo específico. Se não tiver certeza da resposta, chame escalate_to_department em vez de arriscar.
- Para dúvidas gerais (não específicas de um cliente), procure primeiro em search_knowledge_base antes de responder com conhecimento próprio.
- Departamentos disponíveis para escalate_to_department / check_availability: fiscal (Fiscal/Contábil), societario (Societário), financeiro (Financeiro), dp_rh (DP/RH), sdr (SDR/Closer). Use os slugs exatos: ${DEPARTMENT_SLUGS.join(", ")}.
- Para agendar, sempre chame check_availability antes de book_appointment, e use um staffId retornado por ele.
- Você é um assistente de IA — se perguntado, diga isso claramente, nunca finja ser humano.
- Respostas curtas e diretas, em português do Brasil — está respondendo por WhatsApp, não por e-mail.

Data/hora atual (UTC): ${new Date().toISOString()}.`;
}
