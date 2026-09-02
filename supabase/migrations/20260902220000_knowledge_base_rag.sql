-- RAG semântico sobre a Base de Conhecimento (RF07): pipeline de
-- embeddings/pgvector para os PDFs enviados em knowledge_base_documents.
-- Até aqui, search_knowledge_base (tools.server.ts) só buscava no FAQ
-- manual, lexicalmente — esta migration cria onde guardar os pedaços de
-- texto extraídos dos PDFs e seus vetores, para busca por similaridade.

create extension if not exists vector;

-- Acompanha o processamento de cada documento: o upload em si (Tela 8)
-- continua imediato, a extração/embedding acontece depois, de forma
-- assíncrona o bastante para não travar o upload, mas síncrona o bastante
-- para não precisar de fila (não existe infra de fila neste MVP).
alter table public.knowledge_base_documents
  add column embedding_status text not null default 'pendente'
    check (embedding_status in ('pendente', 'processando', 'pronto', 'erro', 'nao_suportado')),
  add column embedding_error text;

-- text-embedding-3-small (1536 dimensões) — modelo fixo, não selecionável
-- por tenant (diferente do modelo de chat): é uma escolha de custo/
-- infraestrutura, não uma preferência de produto por tenant.
create table public.knowledge_base_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  document_id uuid not null references public.knowledge_base_documents (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index knowledge_base_chunks_tenant_id_idx on public.knowledge_base_chunks (tenant_id);
create index knowledge_base_chunks_document_id_idx on public.knowledge_base_chunks (document_id);

-- HNSW: sem parâmetro de "lists" pra calibrar (diferente de ivfflat), bom
-- default para o volume esperado de um único escritório. Cosine ops porque
-- é a métrica de similaridade recomendada pela OpenAI para embeddings.
create index knowledge_base_chunks_embedding_idx
  on public.knowledge_base_chunks
  using hnsw (embedding vector_cosine_ops);

create or replace function public.check_knowledge_base_chunk_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.knowledge_base_documents
    where id = new.document_id and tenant_id = new.tenant_id
  ) then
    raise exception 'knowledge_base_chunks.document_id must belong to the same tenant';
  end if;
  return new;
end;
$$;

create trigger knowledge_base_chunks_same_tenant
  before insert or update on public.knowledge_base_chunks
  for each row execute function public.check_knowledge_base_chunk_tenant();

-- Conteúdo derivado (extraído/gerado pelo pipeline), não dado de entrada do
-- usuário — mesmo padrão de messages/agent_tool_calls: leitura para a
-- equipe, escrita só pelo service role (o pipeline de ingestão).
alter table public.knowledge_base_chunks enable row level security;

create policy knowledge_base_chunks_select_same_tenant on public.knowledge_base_chunks
  for select to authenticated
  using (tenant_id = public.current_tenant_id());
