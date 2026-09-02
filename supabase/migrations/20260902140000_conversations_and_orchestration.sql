-- Conversas (Inbox, Tela 5) e camada de orquestração/auditoria do agente
-- de IA (seção 9, RF03/RF04/RF05/RF08/RF09/RF11). Ainda é só schema — o
-- motor de IA em si (que escreve nessas tabelas via webhook/orquestração)
-- é o próximo passo, depois que WhatsApp/Anthropic estiverem configurados
-- de verdade. Sem esse motor ainda, quase tudo aqui é escrito pelo service
-- role (mesma régua de segurança de `messages`: um insert direto pelo
-- cliente criaria um registro falso sem de fato enviar nada pelo
-- WhatsApp) — só "assumir conversa" e marcar o resultado do copiloto são
-- ações simples o bastante para ficar liberadas direto pela equipe.

-- ---------------------------------------------------------------------
-- consent_log — aceite do consentimento LGPD por contato/lead (seção 8.1)
-- ---------------------------------------------------------------------
create table public.consent_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  policy_version_id uuid not null references public.consent_policy_versions (id) on delete restrict,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  accepted_at timestamptz not null default now(),
  constraint consent_log_contact_xor_lead check ((contact_id is null) <> (lead_id is null))
);

create index consent_log_tenant_id_idx on public.consent_log (tenant_id);
create index consent_log_contact_id_idx on public.consent_log (contact_id);
create index consent_log_lead_id_idx on public.consent_log (lead_id);

create or replace function public.check_consent_log_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.contact_id is not null then
    if not exists (
      select 1 from public.contacts where id = new.contact_id and tenant_id = new.tenant_id
    ) then
      raise exception 'consent_log.contact_id must belong to the same tenant';
    end if;
  end if;
  if new.lead_id is not null then
    if not exists (
      select 1 from public.leads where id = new.lead_id and tenant_id = new.tenant_id
    ) then
      raise exception 'consent_log.lead_id must belong to the same tenant';
    end if;
  end if;
  if not exists (
    select 1 from public.consent_policy_versions
    where id = new.policy_version_id and tenant_id = new.tenant_id
  ) then
    raise exception 'consent_log.policy_version_id must belong to the same tenant';
  end if;
  return new;
end;
$$;

create trigger consent_log_same_tenant
  before insert or update on public.consent_log
  for each row execute function public.check_consent_log_tenant();

-- ---------------------------------------------------------------------
-- conversations — thread por contato/lead (RF03/RF05, Tela 5)
-- ---------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  status text not null default 'ia'
    check (status in ('ia', 'fila_departamento', 'em_atendimento', 'resolvida')),
  department_id uuid references public.departments (id) on delete set null,
  assigned_to uuid references public.staff (id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_contact_xor_lead check ((contact_id is null) <> (lead_id is null))
);

create index conversations_tenant_queue_idx on public.conversations (tenant_id, department_id, status);
create index conversations_contact_id_idx on public.conversations (contact_id);
create index conversations_lead_id_idx on public.conversations (lead_id);

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create or replace function public.check_conversation_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.contact_id is not null then
    if not exists (
      select 1 from public.contacts where id = new.contact_id and tenant_id = new.tenant_id
    ) then
      raise exception 'conversations.contact_id must belong to the same tenant';
    end if;
  end if;
  if new.lead_id is not null then
    if not exists (
      select 1 from public.leads where id = new.lead_id and tenant_id = new.tenant_id
    ) then
      raise exception 'conversations.lead_id must belong to the same tenant';
    end if;
  end if;
  if new.department_id is not null then
    if not exists (
      select 1 from public.departments where id = new.department_id and tenant_id = new.tenant_id
    ) then
      raise exception 'conversations.department_id must belong to the same tenant';
    end if;
  end if;
  if new.assigned_to is not null then
    if not exists (
      select 1 from public.staff where id = new.assigned_to and tenant_id = new.tenant_id
    ) then
      raise exception 'conversations.assigned_to must belong to the same tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger conversations_same_tenant
  before insert or update on public.conversations
  for each row execute function public.check_conversation_tenant();

-- ---------------------------------------------------------------------
-- messages — histórico de mensagens (RF03)
-- ---------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender text not null check (sender in ('ia', 'humano', 'cliente')),
  sender_staff_id uuid references public.staff (id) on delete set null,
  body text not null,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_idx on public.messages (conversation_id, created_at);

create or replace function public.check_message_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.conversations where id = new.conversation_id and tenant_id = new.tenant_id
  ) then
    raise exception 'messages.conversation_id must belong to the same tenant';
  end if;
  if new.sender_staff_id is not null then
    if not exists (
      select 1 from public.staff where id = new.sender_staff_id and tenant_id = new.tenant_id
    ) then
      raise exception 'messages.sender_staff_id must belong to the same tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger messages_same_tenant
  before insert on public.messages
  for each row execute function public.check_message_tenant();

-- Mantém conversations.last_message_at correto para ordenar a fila (Tela 5)
-- sem depender de recalcular no cliente a cada mensagem nova.
create or replace function public.bump_conversation_last_message_at()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
    set last_message_at = new.created_at, updated_at = now()
    where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_last_message_at();

-- ---------------------------------------------------------------------
-- escalations — handoff da IA para a fila de departamento (RF05)
-- ---------------------------------------------------------------------
create table public.escalations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete restrict,
  escalated_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by uuid references public.staff (id) on delete set null,
  -- fica true quando o tempo configurável sem resposta (RF05) se esgota;
  -- quem atualiza esse campo é um job futuro (RF10/agendador), não existe
  -- ainda — a coluna já está pronta para isso.
  is_overflow boolean not null default false,
  resolved_at timestamptz
);

create index escalations_conversation_id_idx on public.escalations (conversation_id);
create index escalations_tenant_queue_idx on public.escalations (tenant_id, department_id, is_overflow);

create or replace function public.check_escalation_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.conversations where id = new.conversation_id and tenant_id = new.tenant_id
  ) then
    raise exception 'escalations.conversation_id must belong to the same tenant';
  end if;
  if not exists (
    select 1 from public.departments where id = new.department_id and tenant_id = new.tenant_id
  ) then
    raise exception 'escalations.department_id must belong to the same tenant';
  end if;
  if new.claimed_by is not null then
    if not exists (
      select 1 from public.staff where id = new.claimed_by and tenant_id = new.tenant_id
    ) then
      raise exception 'escalations.claimed_by must belong to the same tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger escalations_same_tenant
  before insert or update on public.escalations
  for each row execute function public.check_escalation_tenant();

-- ---------------------------------------------------------------------
-- agent_conversation_state — estado corrente do agente por conversa
-- ---------------------------------------------------------------------
create table public.agent_conversation_state (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- RF09: qual CNPJ/cliente está "ativo" na sessão, quando o contato tem
  -- mais de uma empresa vinculada.
  active_client_id uuid references public.clients (id) on delete set null,
  active_intent text,
  context jsonb not null default '{}'::jsonb,
  is_escalated boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger agent_conversation_state_set_updated_at
  before update on public.agent_conversation_state
  for each row execute function public.set_updated_at();

create or replace function public.check_agent_conversation_state_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.conversations where id = new.conversation_id and tenant_id = new.tenant_id
  ) then
    raise exception 'agent_conversation_state.conversation_id must belong to the same tenant';
  end if;
  if new.active_client_id is not null then
    if not exists (
      select 1 from public.clients where id = new.active_client_id and tenant_id = new.tenant_id
    ) then
      raise exception 'agent_conversation_state.active_client_id must belong to the same tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger agent_conversation_state_same_tenant
  before insert or update on public.agent_conversation_state
  for each row execute function public.check_agent_conversation_state_tenant();

-- ---------------------------------------------------------------------
-- agent_tool_calls — log de auditoria de cada ação da IA (seção 8/9)
-- ---------------------------------------------------------------------
create table public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  tool_name text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status text not null default 'success' check (status in ('success', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

create index agent_tool_calls_conversation_id_idx on public.agent_tool_calls (conversation_id, created_at);

create or replace function public.check_agent_tool_call_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.conversations where id = new.conversation_id and tenant_id = new.tenant_id
  ) then
    raise exception 'agent_tool_calls.conversation_id must belong to the same tenant';
  end if;
  return new;
end;
$$;

create trigger agent_tool_calls_same_tenant
  before insert on public.agent_tool_calls
  for each row execute function public.check_agent_tool_call_tenant();

-- ---------------------------------------------------------------------
-- staff_copilot_interactions — uso do copiloto interno (RF11)
-- ---------------------------------------------------------------------
create table public.staff_copilot_interactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  action_type text not null check (action_type in ('resumir', 'sugerir_resposta')),
  suggestion text not null,
  outcome text not null default 'pendente'
    check (outcome in ('pendente', 'aceita', 'editada', 'descartada')),
  final_text text,
  created_at timestamptz not null default now()
);

create index staff_copilot_interactions_tenant_staff_idx on public.staff_copilot_interactions (tenant_id, staff_id);

create or replace function public.check_staff_copilot_interaction_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.staff where id = new.staff_id and tenant_id = new.tenant_id
  ) then
    raise exception 'staff_copilot_interactions.staff_id must belong to the same tenant';
  end if;
  if new.conversation_id is not null then
    if not exists (
      select 1 from public.conversations where id = new.conversation_id and tenant_id = new.tenant_id
    ) then
      raise exception 'staff_copilot_interactions.conversation_id must belong to the same tenant';
    end if;
  end if;
  return new;
end;
$$;

create trigger staff_copilot_interactions_same_tenant
  before insert or update on public.staff_copilot_interactions
  for each row execute function public.check_staff_copilot_interaction_tenant();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.consent_log enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.escalations enable row level security;
alter table public.agent_conversation_state enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.staff_copilot_interactions enable row level security;

-- consent_log / agent_conversation_state / agent_tool_calls: só leitura
-- para a equipe — quem escreve é sempre o motor de IA/webhook, via
-- service role (a escrita direta pelo cliente criaria estado falso, sem
-- de fato ter acontecido a conversa/consentimento real).
create policy consent_log_select_same_tenant on public.consent_log
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy agent_conversation_state_select_same_tenant on public.agent_conversation_state
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy agent_tool_calls_select_same_tenant on public.agent_tool_calls
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- messages: mesma lógica — inserir uma linha direto não envia nada de
-- verdade pelo WhatsApp, então só leitura pelo cliente.
create policy messages_select_same_tenant on public.messages
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- conversations / escalations: leitura para toda a equipe do tenant, e
-- também UPDATE — "assumir conversa" e marcar overflow como resolvido
-- são transições de estado simples que não dependem de nenhuma API
-- externa, então não precisam de server function. Criação continua
-- reservada ao motor de IA/webhook (service role).
create policy conversations_select_same_tenant on public.conversations
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy conversations_update_same_tenant on public.conversations
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy escalations_select_same_tenant on public.escalations
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy escalations_update_same_tenant on public.escalations
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- staff_copilot_interactions: a sugestão em si só existe depois de chamar
-- a Anthropic (segredo, então via server function/service role), mas
-- marcar o resultado (aceita/editada/descartada) é uma ação simples da
-- equipe, liberada direto por RLS.
create policy staff_copilot_interactions_select_same_tenant on public.staff_copilot_interactions
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy staff_copilot_interactions_update_same_tenant on public.staff_copilot_interactions
  for update to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
