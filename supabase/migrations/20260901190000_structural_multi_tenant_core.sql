-- Camada estrutural multi-tenant (PRD seção 13.3, passo 1):
-- tenants, staff, departments, staff_departments, clients — todas com
-- tenant_id e RLS habilitada desde a criação, antes de expandir para o
-- restante do schema (conversas, agenda, leads, base de conhecimento etc.).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Função utilitária: timestamp de atualização automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- tenants — cada escritório de contabilidade cliente do sistema
-- ---------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial',
  whatsapp_number text,
  meta_verification_status text not null default 'pending'
    check (meta_verification_status in ('pending', 'in_review', 'verified', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- staff — usuários internos do painel, um por auth.users, vinculados a
-- um tenant. Vínculo com departamentos vem via staff_departments.
-- ---------------------------------------------------------------------
create table public.staff (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  email text not null,
  is_admin boolean not null default false,
  status text not null default 'convite_pendente'
    check (status in ('ativo', 'convite_pendente')),
  invited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create index staff_tenant_id_idx on public.staff (tenant_id);

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Função utilitária: tenant do usuário autenticado.
-- SECURITY DEFINER para evitar recursão de RLS ao ser usada dentro das
-- próprias policies de `staff` (padrão recomendado pela Supabase).
-- ---------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.staff where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- departments — as 5 áreas do escritório, por tenant (permite tenants
-- futuros customizarem, mas todo tenant novo nasce com as 5 padrão)
-- ---------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index departments_tenant_id_idx on public.departments (tenant_id);

create or replace function public.seed_default_departments()
returns trigger
language plpgsql
as $$
begin
  insert into public.departments (tenant_id, slug, name) values
    (new.id, 'fiscal', 'Fiscal/Contábil'),
    (new.id, 'societario', 'Societário'),
    (new.id, 'financeiro', 'Financeiro'),
    (new.id, 'dp_rh', 'DP/RH'),
    (new.id, 'sdr', 'SDR/Closer');
  return new;
end;
$$;

create trigger tenants_seed_departments
  after insert on public.tenants
  for each row execute function public.seed_default_departments();

-- ---------------------------------------------------------------------
-- staff_departments — vínculo N:N entre staff e departments (RF01: um
-- usuário pode pertencer a um ou mais departamentos)
-- ---------------------------------------------------------------------
create table public.staff_departments (
  staff_id uuid not null references public.staff (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  primary key (staff_id, department_id)
);

create index staff_departments_staff_id_idx on public.staff_departments (staff_id);
create index staff_departments_department_id_idx on public.staff_departments (department_id);

-- Garante que staff e department pertencem ao mesmo tenant.
create or replace function public.check_staff_department_same_tenant()
returns trigger
language plpgsql
as $$
declare
  staff_tenant uuid;
  dept_tenant uuid;
begin
  select tenant_id into staff_tenant from public.staff where id = new.staff_id;
  select tenant_id into dept_tenant from public.departments where id = new.department_id;
  if staff_tenant is null or dept_tenant is null or staff_tenant <> dept_tenant then
    raise exception 'staff and department must belong to the same tenant';
  end if;
  return new;
end;
$$;

create trigger staff_departments_same_tenant
  before insert or update on public.staff_departments
  for each row execute function public.check_staff_department_same_tenant();

-- ---------------------------------------------------------------------
-- clients — empresas clientes de um tenant (RF02)
-- ---------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  cnpj text not null,
  tax_regime text not null
    check (tax_regime in ('Simples Nacional', 'Lucro Presumido', 'Lucro Real')),
  whatsapp_number text not null,
  responsible_staff_id uuid references public.staff (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, cnpj)
);

create index clients_tenant_id_idx on public.clients (tenant_id);
create index clients_responsible_staff_id_idx on public.clients (responsible_staff_id);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security — isolamento total entre tenants
-- ---------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.staff enable row level security;
alter table public.departments enable row level security;
alter table public.staff_departments enable row level security;
alter table public.clients enable row level security;

create policy tenants_select_own on public.tenants
  for select to authenticated
  using (id = public.current_tenant_id());

create policy staff_select_same_tenant on public.staff
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy staff_update_self on public.staff
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy departments_select_same_tenant on public.departments
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy staff_departments_select_same_tenant on public.staff_departments
  for select to authenticated
  using (
    exists (
      select 1 from public.staff
      where staff.id = staff_departments.staff_id
        and staff.tenant_id = public.current_tenant_id()
    )
  );

create policy clients_select_same_tenant on public.clients
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy clients_insert_same_tenant on public.clients
  for insert to authenticated
  with check (tenant_id = public.current_tenant_id());

create policy clients_update_same_tenant on public.clients
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy clients_delete_same_tenant on public.clients
  for delete to authenticated
  using (tenant_id = public.current_tenant_id());
