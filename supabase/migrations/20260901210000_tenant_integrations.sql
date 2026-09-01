-- Configuração de integrações externas (WhatsApp Business API / Meta
-- Cloud API, Anthropic, Resend — PRD seções 10.1, 10.3, 10.4). Separado
-- em duas tabelas por desenho de segurança, não por conveniência:
--
-- tenant_integrations       -> metadados NÃO sensíveis (status, número,
--                              verificação Meta). RLS permite leitura
--                              para a própria equipe; nenhuma escrita
--                              direta do cliente — só via server function.
-- tenant_integration_secrets -> só o segredo (token/API key). RLS
--                              habilitada SEM NENHUMA policy para
--                              authenticated/anon: nem SELECT. Mesmo um
--                              admin do tenant não consegue ler de volta
--                              pelo client SDK — só o service role, a
--                              partir de uma server function, consegue
--                              tocar essa tabela. GRANT também revogado
--                              explicitamente, em cima da RLS, como
--                              camada extra.

create table public.tenant_integrations (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null check (provider in ('whatsapp', 'anthropic', 'resend')),
  is_configured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references public.staff (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, provider)
);

create trigger tenant_integrations_set_updated_at
  before update on public.tenant_integrations
  for each row execute function public.set_updated_at();

alter table public.tenant_integrations enable row level security;

create policy tenant_integrations_select_same_tenant on public.tenant_integrations
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

-- Nenhuma policy de insert/update/delete para "authenticated" — toda
-- escrita é feita pelo service role, via server function que já valida
-- is_admin. O client nunca grava aqui diretamente.

create table public.tenant_integration_secrets (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null check (provider in ('whatsapp', 'anthropic', 'resend')),
  secret_value text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, provider)
);

create trigger tenant_integration_secrets_set_updated_at
  before update on public.tenant_integration_secrets
  for each row execute function public.set_updated_at();

alter table public.tenant_integration_secrets enable row level security;
-- Propositalmente nenhuma policy criada aqui: RLS habilitada + zero
-- policies = acesso negado por padrão para qualquer role sujeito a RLS.
-- Revoga também os privilégios de tabela, como camada redundante.
revoke all on public.tenant_integration_secrets from authenticated, anon;

-- Garante que is_configured só fica true quando existe de fato um
-- segredo salvo (defesa extra, além da disciplina da server function).
create or replace function public.check_integration_configured_has_secret()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_configured then
    if not exists (
      select 1 from public.tenant_integration_secrets s
      where s.tenant_id = new.tenant_id and s.provider = new.provider
    ) then
      raise exception 'cannot mark % as configured without a stored secret', new.provider;
    end if;
  end if;
  return new;
end;
$$;

create trigger tenant_integrations_require_secret
  before insert or update on public.tenant_integrations
  for each row execute function public.check_integration_configured_has_secret();
