import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Dispara o pipeline de RAG semântico (RF07) para um documento recém-
// enviado. Aberto a qualquer staff do tenant, igual ao próprio upload
// (não é uma configuração sensível como as credenciais de integração) —
// só carrega o service role dinamicamente porque o pipeline baixa o
// arquivo do Storage e chama a OpenAI, o que exige o segredo do tenant.

const processDocumentInput = z.object({
  documentId: z.string().uuid(),
});

export const processKnowledgeBaseDocumentAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => processDocumentInput.parse(input))
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

    const { processKnowledgeBaseDocument } = await import("@/lib/knowledge-base/ingest.server");
    await processKnowledgeBaseDocument(caller.tenant_id, data.documentId);

    return { ok: true as const };
  });
