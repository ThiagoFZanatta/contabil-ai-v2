-- Ordenar por distância vetorial (embedding <=> query) não é algo que o
-- query builder do PostgREST expressa (só ordena por coluna) — precisa de
-- uma function. p_tenant_id vem como parâmetro (não current_tenant_id())
-- porque quem chama é sempre o service role, a partir de searchKnowledgeBase
-- (tools.server.ts); por isso o EXECUTE é revogado de anon/authenticated
-- explicitamente abaixo, não só de PUBLIC — mesma lição do job de overflow
-- (revogar só de PUBLIC não basta, o Supabase concede EXECUTE a anon/
-- authenticated por padrão em funções novas) e pelo mesmo motivo: sem essa
-- revogação, qualquer staff autenticado poderia chamar isso via RPC do
-- PostgREST passando o tenant_id de outro escritório e ler o conteúdo dos
-- documentos dele.
create or replace function public.match_knowledge_base_chunks(
  p_tenant_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 5
)
returns table (
  document_id uuid,
  content text,
  file_name text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.document_id,
    c.content,
    d.file_name,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.knowledge_base_chunks c
  join public.knowledge_base_documents d on d.id = c.document_id
  where c.tenant_id = p_tenant_id
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$$;

revoke execute on function public.match_knowledge_base_chunks(uuid, vector, int)
  from public, anon, authenticated;
