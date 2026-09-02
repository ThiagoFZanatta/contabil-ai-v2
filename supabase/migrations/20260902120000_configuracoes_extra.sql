-- Restante da Tela 8 (Configurações) que não depende de credencial externa
-- (WhatsApp/Anthropic): identidade do agente de IA (ai_agent_config, seção
-- 9), Base de Conhecimento (RF07 — knowledge_base_faq/knowledge_base_documents),
-- consentimento LGPD versionado (seção 8.1/9) e templates de mensagem
-- aprovados pela Meta. Nenhuma dessas tabelas guarda segredo, então seguem
-- o mesmo padrão de RLS "for all to authenticated" já usado em
-- document_catalog/leads/appointments — sem necessidade de server function.

-- ---------------------------------------------------------------------
-- ai_agent_config — identidade do agente (nome, tom de voz). Uma linha
-- por tenant.
-- ---------------------------------------------------------------------
create table public.ai_agent_config (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  agent_name text not null default 'Nara',
  persona_tone text not null default '',
  updated_by uuid references public.staff (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger ai_agent_config_set_updated_at
  before update on public.ai_agent_config
  for each row execute function public.set_updated_at();

create or replace function public.check_ai_agent_config_staff_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.updated_by is not null then
    if not exists (
      select 1 from public.staff where id = new.updated_by and tenant_id = new.tenant_id
    ) then
      raise exception 'ai_agent_config.updated_by must belong to the same tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger ai_agent_config_same_tenant
  before insert or update on public.ai_agent_config
  for each row execute function public.check_ai_agent_config_staff_tenant();

-- ---------------------------------------------------------------------
-- knowledge_base_faq — FAQ cadastrado manualmente (RF07)
-- ---------------------------------------------------------------------
create table public.knowledge_base_faq (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_base_faq_tenant_id_idx on public.knowledge_base_faq (tenant_id);

create trigger knowledge_base_faq_set_updated_at
  before update on public.knowledge_base_faq
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- knowledge_base_documents — metadados de documentos enviados para RAG
-- (RF07). O arquivo em si vai para o bucket de Storage "knowledge-base",
-- em ${tenant_id}/${nome do arquivo}; a busca semântica (embeddings) fica
-- para quando o motor de IA (RF03) existir — por ora, upload e listagem
-- reais.
-- ---------------------------------------------------------------------
create table public.knowledge_base_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  file_name text not null,
  file_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_path text not null,
  uploaded_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now()
);

create index knowledge_base_documents_tenant_id_idx on public.knowledge_base_documents (tenant_id);

create or replace function public.check_kb_document_staff_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.uploaded_by is not null then
    if not exists (
      select 1 from public.staff where id = new.uploaded_by and tenant_id = new.tenant_id
    ) then
      raise exception 'knowledge_base_documents.uploaded_by must belong to the same tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger knowledge_base_documents_same_tenant
  before insert or update on public.knowledge_base_documents
  for each row execute function public.check_kb_document_staff_tenant();

-- ---------------------------------------------------------------------
-- consent_policy_versions — histórico versionado do texto de consentimento
-- LGPD (seção 8.1/9). consent_log (aceite por contato) fica para quando
-- existirem conversas reais (RF03) — aqui é só a gestão do texto vigente.
-- ---------------------------------------------------------------------
create table public.consent_policy_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- default 0 é só para a coluna ficar opcional no Insert (mesma convenção
  -- do codegen do Supabase); o valor real é sempre sobrescrito pelo trigger
  -- consent_policy_versions_set_number abaixo.
  version_number integer not null default 0,
  text text not null,
  published_by uuid references public.staff (id) on delete set null,
  published_at timestamptz not null default now(),
  unique (tenant_id, version_number)
);

create index consent_policy_versions_tenant_id_idx on public.consent_policy_versions (tenant_id);

create or replace function public.set_consent_policy_version_number()
returns trigger
language plpgsql
as $$
begin
  select coalesce(max(version_number), 0) + 1
    into new.version_number
    from public.consent_policy_versions
    where tenant_id = new.tenant_id;
  return new;
end;
$$;

create trigger consent_policy_versions_set_number
  before insert on public.consent_policy_versions
  for each row execute function public.set_consent_policy_version_number();

create or replace function public.check_consent_policy_version_staff_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.published_by is not null then
    if not exists (
      select 1 from public.staff where id = new.published_by and tenant_id = new.tenant_id
    ) then
      raise exception 'consent_policy_versions.published_by must belong to the same tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger consent_policy_versions_same_tenant
  before insert on public.consent_policy_versions
  for each row execute function public.check_consent_policy_version_staff_tenant();

-- ---------------------------------------------------------------------
-- whatsapp_message_templates — biblioteca de templates aprovados pela
-- Meta para mensagens iniciadas pela empresa (seção 9). Sem integração
-- automática com a Meta ainda: status é gerenciado manualmente pela
-- equipe até existir sincronização real.
-- ---------------------------------------------------------------------
create table public.whatsapp_message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  category text not null check (category in ('utilidade', 'marketing', 'autenticacao')),
  status text not null default 'pendente'
    check (status in ('aprovado', 'pendente', 'rejeitado')),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_message_templates_tenant_id_idx on public.whatsapp_message_templates (tenant_id);

create trigger whatsapp_message_templates_set_updated_at
  before update on public.whatsapp_message_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security — mesmo padrão de document_catalog: qualquer membro
-- da equipe do tenant lê e escreve, nenhuma dessas tabelas guarda segredo.
-- ---------------------------------------------------------------------
alter table public.ai_agent_config enable row level security;
alter table public.knowledge_base_faq enable row level security;
alter table public.knowledge_base_documents enable row level security;
alter table public.consent_policy_versions enable row level security;
alter table public.whatsapp_message_templates enable row level security;

create policy ai_agent_config_all_same_tenant on public.ai_agent_config
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy knowledge_base_faq_all_same_tenant on public.knowledge_base_faq
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy knowledge_base_documents_all_same_tenant on public.knowledge_base_documents
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy consent_policy_versions_all_same_tenant on public.consent_policy_versions
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy whatsapp_message_templates_all_same_tenant on public.whatsapp_message_templates
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- ---------------------------------------------------------------------
-- Storage — bucket privado para os arquivos da Base de Conhecimento.
-- Caminho do objeto: "${tenant_id}/${arquivo}" — a policy usa o primeiro
-- segmento do caminho como o tenant, mesma checagem de current_tenant_id()
-- usada nas tabelas.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('knowledge-base', 'knowledge-base', false)
on conflict (id) do nothing;

create policy knowledge_base_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'knowledge-base'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy knowledge_base_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'knowledge-base'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy knowledge_base_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'knowledge-base'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );
