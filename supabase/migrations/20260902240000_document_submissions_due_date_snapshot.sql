-- client_document_config.next_due_date avança para a PRÓXIMA cobrança assim
-- que um envio é registrado (advance_next_due_date, AFTER INSERT) — então o
-- valor atual nunca mais reflete o prazo que aquele envio específico
-- cumpriu, o que impede calcular "entregue no prazo" depois do fato (RF-
-- Relatórios, Tela 9). Este BEFORE INSERT roda antes do advance e grava o
-- prazo vigente no momento do envio, junto no mesmo insert.
alter table public.document_submissions
  add column due_date_at_submission date;

create or replace function public.capture_due_date_at_submission()
returns trigger
language plpgsql
as $$
begin
  select next_due_date into new.due_date_at_submission
  from public.client_document_config
  where id = new.client_document_config_id;
  return new;
end;
$$;

create trigger document_submissions_capture_due_date
  before insert on public.document_submissions
  for each row execute function public.capture_due_date_at_submission();
