import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Copiloto interno (RF11): "resumir conversa" e "sugerir resposta", cada
// chamada registrada em staff_copilot_interactions (o rascunho nunca é
// enviado sozinho — a equipe decide aceitar/editar/descartar depois,
// direto por RLS, sem precisar de outra server function para isso).

const actionInput = z.object({
  actionType: z.enum(["resumir", "sugerir_resposta"]),
  context: z.string().trim().min(1),
  conversationId: z.string().uuid().optional(),
});

const SYSTEM_PROMPT = `Você é o copiloto interno de IA de um escritório de contabilidade, usado pela própria equipe (não pelo cliente final).
Sua função é só uma destas duas, conforme pedido:
- "Resumir": resuma objetivamente a situação/conversa descrita, em até 3 frases.
- "Sugerir resposta": escreva um rascunho de resposta profissional e cordial em português, pronta para a equipe revisar e enviar manualmente.
Nunca invente dado fiscal, prazo ou valor específico que não esteja no contexto fornecido. Responda só com o texto pedido, sem comentários extras.`;

export const runCopilotAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => actionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: caller, error } = await supabase
      .from("staff")
      .select("tenant_id")
      .eq("id", userId)
      .single();
    if (error || !caller) {
      throw new Error("Não foi possível confirmar seu cadastro de equipe.");
    }

    const { resolveAiProvider } = await import("@/lib/integrations/resolve.server");
    const ai = await resolveAiProvider(caller.tenant_id);
    if (!ai.isConfigured()) {
      throw new Error("A IA (OpenAI) ainda não está configurada para este escritório.");
    }

    const userPrompt =
      data.actionType === "resumir"
        ? `Resuma esta conversa/situação:\n\n${data.context}`
        : `Sugira uma resposta para esta conversa/situação:\n\n${data.context}`;

    const result = await ai.callAgent({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    if (!result.ok) {
      throw new Error(result.error);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: interaction, error: insertError } = await supabaseAdmin
      .from("staff_copilot_interactions")
      .insert({
        tenant_id: caller.tenant_id,
        staff_id: userId,
        conversation_id: data.conversationId ?? null,
        action_type: data.actionType,
        suggestion: result.text,
      })
      .select("id")
      .single();
    if (insertError || !interaction) {
      throw new Error("A sugestão foi gerada, mas houve um erro ao registrar o uso do copiloto.");
    }

    return { ok: true as const, interactionId: interaction.id, suggestion: result.text };
  });
