import { getDocumentProxy, extractText } from "unpdf";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveAiProvider } from "@/lib/integrations/resolve.server";

// Pipeline de RAG semântico (RF07): extrai texto do PDF, quebra em pedaços,
// gera embeddings via OpenAI e guarda em knowledge_base_chunks para busca
// por similaridade (search_knowledge_base, em tools.server.ts). Roda
// síncrono dentro de uma server function (sem fila neste MVP) — por isso
// fica em pedaços pequenos o bastante para terminar num tempo razoável.

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;
const EMBED_BATCH_SIZE = 64;

function chunkText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

// pgvector aceita o literal textual "[v1,v2,...]" via cast implícito — é
// assim que o valor precisa ir num insert via PostgREST (não há
// representação JSON nativa pra "vector").
function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export async function processKnowledgeBaseDocument(
  tenantId: string,
  documentId: string,
): Promise<void> {
  const { data: doc } = await supabaseAdmin
    .from("knowledge_base_documents")
    .select("id, file_name, file_type, storage_path")
    .eq("id", documentId)
    .eq("tenant_id", tenantId)
    .single();
  if (!doc) return;

  const isPdf = doc.file_type === "application/pdf" || doc.file_name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    await supabaseAdmin
      .from("knowledge_base_documents")
      .update({
        embedding_status: "nao_suportado",
        embedding_error: "Busca semântica ainda só cobre arquivos PDF.",
      })
      .eq("id", documentId);
    return;
  }

  await supabaseAdmin
    .from("knowledge_base_documents")
    .update({ embedding_status: "processando", embedding_error: null })
    .eq("id", documentId);

  try {
    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from("knowledge-base")
      .download(doc.storage_path);
    if (downloadError || !fileBlob) {
      throw new Error(
        downloadError?.message ?? "Não foi possível baixar o arquivo do armazenamento.",
      );
    }

    const buffer = new Uint8Array(await fileBlob.arrayBuffer());
    const pdf = await getDocumentProxy(buffer);
    const { text } = await extractText(pdf, { mergePages: true });

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      await supabaseAdmin
        .from("knowledge_base_documents")
        .update({
          embedding_status: "erro",
          embedding_error: "Nenhum texto extraído do PDF (pode ser um PDF escaneado, sem OCR).",
        })
        .eq("id", documentId);
      return;
    }

    const ai = await resolveAiProvider(tenantId);
    if (!ai.isConfigured()) {
      throw new Error("OpenAI não configurado para este tenant.");
    }

    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const result = await ai.embed(batch);
      if (!result.ok) throw new Error(result.error);
      vectors.push(...result.vectors);
    }

    // Reprocessamento é idempotente: remove pedaços antigos antes de
    // gravar os novos, em vez de tentar casar índice a índice.
    await supabaseAdmin.from("knowledge_base_chunks").delete().eq("document_id", documentId);

    const rows = chunks.map((content, index) => ({
      tenant_id: tenantId,
      document_id: documentId,
      chunk_index: index,
      content,
      embedding: toVectorLiteral(vectors[index] as number[]),
    }));

    const { error: insertError } = await supabaseAdmin.from("knowledge_base_chunks").insert(rows);
    if (insertError) throw new Error(insertError.message);

    await supabaseAdmin
      .from("knowledge_base_documents")
      .update({ embedding_status: "pronto", embedding_error: null })
      .eq("id", documentId);
  } catch (err) {
    await supabaseAdmin
      .from("knowledge_base_documents")
      .update({
        embedding_status: "erro",
        embedding_error:
          err instanceof Error ? err.message : "Erro desconhecido ao processar o documento.",
      })
      .eq("id", documentId);
  }
}
