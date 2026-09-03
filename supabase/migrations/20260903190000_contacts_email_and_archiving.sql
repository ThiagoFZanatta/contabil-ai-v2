-- Tela de Contatos / RF13 (Gestão Unificada de Contatos):
-- 1. E-mail do contato, opcional — usado só como exibição/contato
--    alternativo, o WhatsApp continua sendo o canal exigido (not null) e o
--    único que a IA de fato usa.
-- 2. Arquivamento em vez de exclusão física quando o contato já tem
--    histórico de conversas: `archived_at` marca o contato como inativo
--    sem apagar `conversations`/`consent_log` associados (que têm
--    `on delete cascade` a partir de `contacts`).
alter table public.contacts
  add column if not exists email text,
  add column if not exists archived_at timestamptz;
