-- Séries históricas para a Tela 9 (Relatórios e Métricas). Cada function
-- resolve o tenant via current_tenant_id() (não recebe tenant_id como
-- parâmetro) — diferente de match_knowledge_base_chunks, aqui não há como
-- um caller autenticado escapar do próprio tenant, então não precisa da
-- revogação explícita de EXECUTE de anon/authenticated.
--
-- CSAT não entra aqui: não existe nenhuma coleta de satisfação no schema
-- ainda (é trabalho de Fase 3, "check-in de satisfação" via agente
-- proativo, PRD seção 11/12) — mostrar um número fabricado seria pior que
-- não mostrar nada.

-- RF03: tempo até a primeira resposta (IA ou humana) depois da primeira
-- mensagem do cliente em cada conversa, em minutos, por dia.
create or replace function public.report_first_response_time(p_period_days int default 30)
returns table (day date, avg_minutes numeric)
language sql
stable
security definer
set search_path = public
as $$
  with first_client as (
    select conversation_id, min(created_at) as first_client_at
    from public.messages
    where tenant_id = public.current_tenant_id() and sender = 'cliente'
    group by conversation_id
  ),
  first_response as (
    select m.conversation_id, min(m.created_at) as first_response_at
    from public.messages m
    join first_client fc on fc.conversation_id = m.conversation_id
    where m.tenant_id = public.current_tenant_id()
      and m.sender in ('ia', 'humano')
      and m.created_at > fc.first_client_at
    group by m.conversation_id
  )
  select
    date_trunc('day', fc.first_client_at)::date as day,
    avg(extract(epoch from (fr.first_response_at - fc.first_client_at)) / 60) as avg_minutes
  from first_client fc
  join first_response fr on fr.conversation_id = fc.conversation_id
  where fc.first_client_at >= current_date - (p_period_days - 1)
  group by 1
  order by 1;
$$;

-- RF05: % de conversas resolvidas sem nenhum escalonamento, por dia de
-- criação da conversa.
create or replace function public.report_ia_resolution_rate(p_period_days int default 30)
returns table (day date, pct_ia numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc('day', c.created_at)::date as day,
    100.0 * count(*) filter (where e.conversation_id is null) / count(*) as pct_ia
  from public.conversations c
  left join (select distinct conversation_id from public.escalations) e on e.conversation_id = c.id
  where c.tenant_id = public.current_tenant_id()
    and c.created_at >= current_date - (p_period_days - 1)
  group by 1
  order by 1;
$$;

-- RF04: % de envios de documento dentro do prazo vigente na hora do envio
-- (due_date_at_submission), por dia do envio. Configs "sob_demanda" nunca
-- têm prazo, então ficam de fora (due_date_at_submission nulo).
create or replace function public.report_document_on_time_rate(p_period_days int default 30)
returns table (day date, pct_on_time numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc('day', ds.submitted_at)::date as day,
    100.0 * count(*) filter (where ds.submitted_at::date <= ds.due_date_at_submission)
      / count(*) as pct_on_time
  from public.document_submissions ds
  where ds.tenant_id = public.current_tenant_id()
    and ds.due_date_at_submission is not null
    and ds.submitted_at >= current_date - (p_period_days - 1)
  group by 1
  order by 1;
$$;

-- RF08/09: % de leads que chegaram a ter uma reunião marcada (appointments
-- vinculado ao lead), por dia de criação do lead.
create or replace function public.report_lead_conversion_rate(p_period_days int default 30)
returns table (day date, pct_conversion numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc('day', l.created_at)::date as day,
    100.0 * count(*) filter (where a.lead_id is not null) / count(*) as pct_conversion
  from public.leads l
  left join (select distinct lead_id from public.appointments where lead_id is not null) a
    on a.lead_id = l.id
  where l.tenant_id = public.current_tenant_id()
    and l.created_at >= current_date - (p_period_days - 1)
  group by 1
  order by 1;
$$;
