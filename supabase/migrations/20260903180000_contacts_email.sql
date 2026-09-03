-- Tela de Contatos (nova, fora das 12 telas originais do PRD): permite
-- cadastrar e-mail do contato, opcional — usado só como exibição/contato
-- alternativo, o WhatsApp continua sendo o canal exigido (not null) e o
-- único que a IA de fato usa.
alter table public.contacts
  add column email text;
