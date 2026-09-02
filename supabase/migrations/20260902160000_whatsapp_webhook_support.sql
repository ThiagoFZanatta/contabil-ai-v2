-- Suporte ao webhook que recebe mensagens do WhatsApp (RF03): guarda o App
-- Secret da Meta (necessário para validar a assinatura de cada entrega do
-- webhook) e garante idempotência quando a Meta reenvia a mesma mensagem.

-- O App Secret é um segundo segredo por tenant, além do token de acesso já
-- guardado sob provider = 'whatsapp'. Não é um "provider" de verdade — é só
-- uma chave adicional na mesma tabela de segredos, por tenant, seguindo a
-- mesma proteção de RLS (zero policy para authenticated/anon) já validada
-- para tenant_integration_secrets.
alter table public.tenant_integration_secrets
  drop constraint tenant_integration_secrets_provider_check;

alter table public.tenant_integration_secrets
  add constraint tenant_integration_secrets_provider_check
  check (provider in ('whatsapp', 'whatsapp_app_secret', 'anthropic', 'resend'));

-- Idempotência: a Meta pode reentregar o mesmo webhook mais de uma vez.
-- provider_message_id é o wamid, globalmente único quando presente (mensagens
-- geradas pela própria IA, sem correspondente na Meta, continuam null).
create unique index messages_provider_message_id_idx
  on public.messages (provider_message_id)
  where provider_message_id is not null;
