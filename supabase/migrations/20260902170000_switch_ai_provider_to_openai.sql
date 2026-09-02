-- Troca do provedor de IA principal: Anthropic -> OpenAI (PRD v1.5, seção
-- 10.1), motivada por custo por token. Viável sem redesenho porque
-- tenant_integrations/tenant_integration_secrets e a interface AiProvider
-- já tratavam o provedor de IA como plugável desde a v1.3/v1.4 — esta
-- migration só troca o valor aceito de "provider" e adiciona a seleção de
-- modelo curada (RF11/RF03, requisito novo da v1.5), sem alterar o desenho
-- de segurança das duas tabelas em si.

-- Preserva o status/segredo de qualquer tenant que já tivesse configurado
-- 'anthropic', em vez de simplesmente invalidar a linha.
update public.tenant_integrations set provider = 'openai' where provider = 'anthropic';
update public.tenant_integration_secrets set provider = 'openai' where provider = 'anthropic';

alter table public.tenant_integrations
  drop constraint tenant_integrations_provider_check;
alter table public.tenant_integrations
  add constraint tenant_integrations_provider_check
  check (provider in ('whatsapp', 'openai', 'resend'));

alter table public.tenant_integration_secrets
  drop constraint tenant_integration_secrets_provider_check;
alter table public.tenant_integration_secrets
  add constraint tenant_integration_secrets_provider_check
  check (provider in ('whatsapp', 'whatsapp_app_secret', 'openai', 'resend'));

-- Lista curada, não catálogo aberto (PRD 10.1): evita o tenant escolher,
-- sem saber, um modelo incompatível com as tools da seção 10.2, e evita
-- que o produto vire um catálogo que precisa ser atualizado a cada mudança
-- de preço da OpenAI. gpt-5-mini é o padrão recomendado, pré-selecionado
-- na Tela 8 para reduzir fricção de configuração.
alter table public.tenant_integrations
  add column ai_selected_model text not null default 'gpt-5-mini'
  check (ai_selected_model in ('gpt-5-mini', 'gpt-5', 'gpt-5-nano'));
