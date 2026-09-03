-- RF13: defesa em profundidade — a regra "só exclui fisicamente um contato
-- sem nenhuma conversa registrada" hoje só existe na UI (src/routes/contatos).
-- RLS (contacts_all_same_tenant) permite a qualquer staff do tenant excluir
-- qualquer contato, então nada no banco impedia reproduzir o mesmo problema
-- do PR #16 (perda de histórico + prova de consentimento LGPD) por uma
-- chamada direta à API, um bug futuro, ou uma tela nova que esqueça de
-- checar `hasHistory`. Este trigger garante a invariante no próprio banco,
-- no mesmo padrão já usado para outras checagens de integridade do schema
-- (check_conversation_tenant, check_document_submission_tenant,
-- check_client_contact_link_same_tenant).
create or replace function public.block_contact_delete_with_history()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.conversations where contact_id = old.id) then
    raise exception 'não é possível excluir um contato com conversas registradas — arquive em vez de excluir';
  end if;
  return old;
end;
$$;

create trigger contacts_block_delete_with_history
  before delete on public.contacts
  for each row execute function public.block_contact_delete_with_history();
