-- Agenda e Funil de Leads (Telas 6 e 7 / RF06, RF08) — parte operada pela
-- equipe. O agendamento/qualificação automáticos pela IA (RF06/RF08) ficam
-- para quando o motor conversacional (WhatsApp + IA) existir; por ora
-- `origin`/`created_by` já preparam o campo para isso sem bloquear o uso
-- manual imediato.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- leads — contatos novos e sua qualificação (RF08)
-- ---------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  segment text not null default '',
  reason text not null default '',
  whatsapp_number text,
  stage text not null default 'novo'
    check (stage in ('novo', 'qualificado', 'call_agendada', 'convertido', 'perdido')),
  created_by uuid references public.staff (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_tenant_id_idx on public.leads (tenant_id);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create or replace function public.check_lead_staff_tenant()
returns trigger
language plpgsql
as $$
declare
  staff_tenant uuid;
begin
  if new.created_by is not null then
    select tenant_id into staff_tenant from public.staff where id = new.created_by;
    if staff_tenant is null or staff_tenant <> new.tenant_id then
      raise exception 'leads.created_by must belong to the same tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger leads_same_tenant
  before insert or update on public.leads
  for each row execute function public.check_lead_staff_tenant();

-- ---------------------------------------------------------------------
-- appointments — compromissos da agenda (RF06)
-- ---------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  title text not null,
  client_id uuid references public.clients (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  staff_id uuid not null references public.staff (id) on delete cascade,
  appointment_type text not null default 'ligacao'
    check (appointment_type in ('ligacao', 'video', 'presencial')),
  start_at timestamptz not null,
  duration_min integer not null default 30 check (duration_min > 0),
  origin text not null default 'manual' check (origin in ('ia', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- timestamptz + interval não é IMMUTABLE em Postgres (depende do fuso
  -- da sessão), então não pode ser um generated column — é preenchido
  -- por trigger em vez disso.
  time_range tstzrange
);

create index appointments_tenant_id_idx on public.appointments (tenant_id);
create index appointments_staff_id_idx on public.appointments (staff_id);
create index appointments_client_id_idx on public.appointments (client_id);
create index appointments_lead_id_idx on public.appointments (lead_id);

create or replace function public.set_appointment_time_range()
returns trigger
language plpgsql
as $$
begin
  new.time_range := tstzrange(new.start_at, new.start_at + make_interval(mins => new.duration_min), '[)');
  return new;
end;
$$;

create trigger appointments_set_time_range
  before insert or update on public.appointments
  for each row execute function public.set_appointment_time_range();

-- RF06 (critério de aceite): não deve ser possível agendar dois
-- compromissos conflitantes para o mesmo membro da equipe.
alter table public.appointments
  add constraint appointments_no_overlap_per_staff
  exclude using gist (staff_id with =, time_range with &&);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create or replace function public.check_appointment_tenant()
returns trigger
language plpgsql
as $$
declare
  staff_tenant uuid;
  client_tenant uuid;
  lead_tenant uuid;
begin
  select tenant_id into staff_tenant from public.staff where id = new.staff_id;
  if staff_tenant is null or staff_tenant <> new.tenant_id then
    raise exception 'appointments.staff_id must belong to the same tenant';
  end if;

  if new.client_id is not null then
    select tenant_id into client_tenant from public.clients where id = new.client_id;
    if client_tenant is null or client_tenant <> new.tenant_id then
      raise exception 'appointments.client_id must belong to the same tenant';
    end if;
  end if;

  if new.lead_id is not null then
    select tenant_id into lead_tenant from public.leads where id = new.lead_id;
    if lead_tenant is null or lead_tenant <> new.tenant_id then
      raise exception 'appointments.lead_id must belong to the same tenant';
    end if;
  end if;

  return new;
end;
$$;

create trigger appointments_same_tenant
  before insert or update on public.appointments
  for each row execute function public.check_appointment_tenant();

-- ---------------------------------------------------------------------
-- staff_time_blocks — horários bloqueados manualmente pela equipe
-- ---------------------------------------------------------------------
create table public.staff_time_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index staff_time_blocks_tenant_id_idx on public.staff_time_blocks (tenant_id);
create index staff_time_blocks_staff_id_idx on public.staff_time_blocks (staff_id);

create or replace function public.check_staff_time_block_tenant()
returns trigger
language plpgsql
as $$
declare
  staff_tenant uuid;
begin
  select tenant_id into staff_tenant from public.staff where id = new.staff_id;
  if staff_tenant is null or staff_tenant <> new.tenant_id then
    raise exception 'staff_time_blocks.staff_id must belong to the same tenant';
  end if;
  return new;
end;
$$;

create trigger staff_time_blocks_same_tenant
  before insert or update on public.staff_time_blocks
  for each row execute function public.check_staff_time_block_tenant();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.leads enable row level security;
alter table public.appointments enable row level security;
alter table public.staff_time_blocks enable row level security;

create policy leads_all_same_tenant on public.leads
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy appointments_all_same_tenant on public.appointments
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy staff_time_blocks_all_same_tenant on public.staff_time_blocks
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
