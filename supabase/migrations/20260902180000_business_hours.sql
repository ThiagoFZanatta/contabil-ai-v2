-- Horário comercial de atendimento humano por tenant (seção 8, RF10):
-- usado pelo motor de IA para saber quando avisar o cliente que a resposta
-- humana só vem no próximo horário útil. Cada tenant nasce com um padrão
-- razoável (seg-sex, 8h-18h) igual ao sugerido no RF10, editável depois.
--
-- Nota de simplificação: start_time/end_time guardam horário LOCAL (ex:
-- "08:00" é 8h da manhã no Brasil, não 8h UTC) — não existe ainda uma
-- coluna de fuso horário por tenant, então o código (orchestrator.server.ts
-- / tools.server.ts, via BUSINESS_HOURS_UTC_OFFSET_MS em types.ts) assume
-- fuso fixo America/Sao_Paulo (UTC-3, sem horário de verão desde 2019) ao
-- comparar contra o relógio real. Como o MVP é de um único escritório no
-- Brasil, isso é uma simplificação aceita por ora; vira um problema real só
-- na fase de revenda multi-fuso (seção 11).
create table public.business_hours (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  primary key (tenant_id, day_of_week)
);

create or replace function public.seed_default_business_hours()
returns trigger
language plpgsql
as $$
begin
  insert into public.business_hours (tenant_id, day_of_week, start_time, end_time)
  select new.id, dow, time '08:00', time '18:00'
  from generate_series(1, 5) as dow; -- 1=segunda .. 5=sexta (0=domingo, 6=sábado)
  return new;
end;
$$;

create trigger tenants_seed_business_hours
  after insert on public.tenants
  for each row execute function public.seed_default_business_hours();

-- Backfill para tenants criados antes desta migration (o trigger acima só
-- vale para inserts futuros).
insert into public.business_hours (tenant_id, day_of_week, start_time, end_time)
select t.id, dow, time '08:00', time '18:00'
from public.tenants t
cross join generate_series(1, 5) as dow
on conflict (tenant_id, day_of_week) do nothing;

alter table public.business_hours enable row level security;

create policy business_hours_all_same_tenant on public.business_hours
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
