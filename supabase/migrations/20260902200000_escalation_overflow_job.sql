-- Job agendado que preenche escalations.is_overflow (RF05): "Se a conversa
-- ficar sem ninguém assumir por um período configurável (sugestão inicial:
-- 15-30 min), ela deve ficar visível para qualquer departamento". A coluna
-- já existia desde o schema de conversas/orquestração (PR #8) — só faltava
-- quem a preenchesse.
--
-- Nota de simplificação: o período (20 min) é um valor fixo aqui, dentro da
-- faixa sugerida pelo próprio RF05, e não uma configuração por tenant ainda
-- — não existe tela para isso. Documentado para virar coluna em
-- tenant_integrations/config futura se precisar ser ajustável.
create extension if not exists pg_cron;

create or replace function public.mark_overflow_escalations()
returns void
language sql
security definer
set search_path = public
as $$
  update public.escalations
  set is_overflow = true
  where claimed_at is null
    and resolved_at is null
    and is_overflow = false
    and escalated_at < now() - interval '20 minutes';
$$;

-- Só o job agendado (que roda como o dono da função, independente de GRANT)
-- deve poder chamar isso — não é uma ação que um staff comum deveria
-- disparar via RPC do PostgREST. O Supabase concede EXECUTE a anon/
-- authenticated por padrão em funções novas (default privileges do
-- schema), separado de PUBLIC — os três precisam ser revogados
-- explicitamente, senão o RPC continua acessível (checado direto contra o
-- banco: revogar só de PUBLIC não bastou).
revoke execute on function public.mark_overflow_escalations() from public, anon, authenticated;

select cron.schedule(
  'mark-overflow-escalations',
  '*/5 * * * *',
  $$select public.mark_overflow_escalations();$$
);
