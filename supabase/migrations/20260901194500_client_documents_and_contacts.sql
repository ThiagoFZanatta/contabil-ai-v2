-- Módulo de Clientes completo (Telas 3 e 4 / RF02, RF04, RF09):
-- catálogo de documentos, configuração de documentos por cliente com
-- histórico de envios, e contatos multi-CNPJ.

-- ---------------------------------------------------------------------
-- document_catalog — catálogo global/padrão de tipos de documento
-- (Tela 8, aba "Catálogo de Documentos")
-- ---------------------------------------------------------------------
create table public.document_catalog (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  default_periodicity text not null default 'mensal'
    check (default_periodicity in ('mensal', 'trimestral', 'anual', 'sob_demanda')),
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index document_catalog_tenant_id_idx on public.document_catalog (tenant_id);

-- ---------------------------------------------------------------------
-- client_document_config — documentos exigidos por cliente (RF02)
-- ---------------------------------------------------------------------
create table public.client_document_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  catalog_id uuid references public.document_catalog (id) on delete set null,
  name text not null,
  periodicity text not null default 'mensal'
    check (periodicity in ('mensal', 'trimestral', 'anual', 'sob_demanda')),
  enabled boolean not null default true,
  next_due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_document_config_tenant_id_idx on public.client_document_config (tenant_id);
create index client_document_config_client_id_idx on public.client_document_config (client_id);

create trigger client_document_config_set_updated_at
  before update on public.client_document_config
  for each row execute function public.set_updated_at();

-- RF02 (critério de aceite): ao configurar um documento com prazo, gerar
-- automaticamente a próxima data de cobrança quando não informada.
create or replace function public.default_next_due_date()
returns trigger
language plpgsql
as $$
begin
  if new.next_due_date is null and new.periodicity <> 'sob_demanda' then
    new.next_due_date := case new.periodicity
      when 'mensal' then (current_date + interval '1 month')::date
      when 'trimestral' then (current_date + interval '3 months')::date
      when 'anual' then (current_date + interval '1 year')::date
      else null
    end;
  end if;
  return new;
end;
$$;

create trigger client_document_config_default_due_date
  before insert on public.client_document_config
  for each row execute function public.default_next_due_date();

create or replace function public.check_client_document_config_tenant()
returns trigger
language plpgsql
as $$
declare
  client_tenant uuid;
  catalog_tenant uuid;
begin
  select tenant_id into client_tenant from public.clients where id = new.client_id;
  if client_tenant is null or client_tenant <> new.tenant_id then
    raise exception 'client_document_config.client_id must belong to the same tenant';
  end if;

  if new.catalog_id is not null then
    select tenant_id into catalog_tenant from public.document_catalog where id = new.catalog_id;
    if catalog_tenant is null or catalog_tenant <> new.tenant_id then
      raise exception 'client_document_config.catalog_id must belong to the same tenant';
    end if;
  end if;

  return new;
end;
$$;

create trigger client_document_config_same_tenant
  before insert or update on public.client_document_config
  for each row execute function public.check_client_document_config_tenant();

-- ---------------------------------------------------------------------
-- document_submissions — histórico de envios (RF04)
-- ---------------------------------------------------------------------
create table public.document_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  client_document_config_id uuid not null references public.client_document_config (id) on delete cascade,
  submitted_at timestamptz not null default now(),
  note text not null default ''
);

create index document_submissions_tenant_id_idx on public.document_submissions (tenant_id);
create index document_submissions_config_id_idx on public.document_submissions (client_document_config_id);

create or replace function public.check_document_submission_tenant()
returns trigger
language plpgsql
as $$
declare
  config_tenant uuid;
begin
  select tenant_id into config_tenant
  from public.client_document_config
  where id = new.client_document_config_id;

  if config_tenant is null or config_tenant <> new.tenant_id then
    raise exception 'document_submissions.client_document_config_id must belong to the same tenant';
  end if;
  return new;
end;
$$;

create trigger document_submissions_same_tenant
  before insert on public.document_submissions
  for each row execute function public.check_document_submission_tenant();

-- Ao registrar um envio, avança a próxima data de cobrança pelo período
-- configurado (RF04: reforço/reconhecimento automático do ciclo).
create or replace function public.advance_next_due_date()
returns trigger
language plpgsql
as $$
begin
  update public.client_document_config
  set next_due_date = case periodicity
      when 'mensal' then greatest(coalesce(next_due_date, current_date), current_date) + interval '1 month'
      when 'trimestral' then greatest(coalesce(next_due_date, current_date), current_date) + interval '3 months'
      when 'anual' then greatest(coalesce(next_due_date, current_date), current_date) + interval '1 year'
      else next_due_date
    end
  where id = new.client_document_config_id
    and periodicity <> 'sob_demanda';
  return new;
end;
$$;

create trigger document_submissions_advance_due_date
  after insert on public.document_submissions
  for each row execute function public.advance_next_due_date();

-- ---------------------------------------------------------------------
-- contacts — pessoas com WhatsApp, podem falar por mais de um CNPJ (RF09)
-- ---------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  whatsapp_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, whatsapp_number)
);

create index contacts_tenant_id_idx on public.contacts (tenant_id);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- client_contact_links — vínculo N:N entre contacts e clients (RF09)
-- ---------------------------------------------------------------------
create table public.client_contact_links (
  client_id uuid not null references public.clients (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  role_label text not null default '',
  created_at timestamptz not null default now(),
  primary key (client_id, contact_id)
);

create index client_contact_links_client_id_idx on public.client_contact_links (client_id);
create index client_contact_links_contact_id_idx on public.client_contact_links (contact_id);

create or replace function public.check_client_contact_link_same_tenant()
returns trigger
language plpgsql
as $$
declare
  client_tenant uuid;
  contact_tenant uuid;
begin
  select tenant_id into client_tenant from public.clients where id = new.client_id;
  select tenant_id into contact_tenant from public.contacts where id = new.contact_id;
  if client_tenant is null or contact_tenant is null or client_tenant <> contact_tenant then
    raise exception 'client and contact must belong to the same tenant';
  end if;
  return new;
end;
$$;

create trigger client_contact_links_same_tenant
  before insert or update on public.client_contact_links
  for each row execute function public.check_client_contact_link_same_tenant();

-- ---------------------------------------------------------------------
-- Row Level Security — mesmo padrão "mesmo tenant" das demais tabelas
-- ---------------------------------------------------------------------
alter table public.document_catalog enable row level security;
alter table public.client_document_config enable row level security;
alter table public.document_submissions enable row level security;
alter table public.contacts enable row level security;
alter table public.client_contact_links enable row level security;

create policy document_catalog_all_same_tenant on public.document_catalog
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy client_document_config_all_same_tenant on public.client_document_config
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy document_submissions_all_same_tenant on public.document_submissions
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy contacts_all_same_tenant on public.contacts
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy client_contact_links_select_same_tenant on public.client_contact_links
  for select to authenticated
  using (
    exists (
      select 1 from public.clients where clients.id = client_contact_links.client_id
        and clients.tenant_id = public.current_tenant_id()
    )
  );

create policy client_contact_links_insert_same_tenant on public.client_contact_links
  for insert to authenticated
  with check (
    exists (
      select 1 from public.clients where clients.id = client_contact_links.client_id
        and clients.tenant_id = public.current_tenant_id()
    )
  );

create policy client_contact_links_update_same_tenant on public.client_contact_links
  for update to authenticated
  using (
    exists (
      select 1 from public.clients where clients.id = client_contact_links.client_id
        and clients.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1 from public.clients where clients.id = client_contact_links.client_id
        and clients.tenant_id = public.current_tenant_id()
    )
  );

create policy client_contact_links_delete_same_tenant on public.client_contact_links
  for delete to authenticated
  using (
    exists (
      select 1 from public.clients where clients.id = client_contact_links.client_id
        and clients.tenant_id = public.current_tenant_id()
    )
  );
