-- A policy staff_update_self (migration anterior) permite UPDATE em
-- qualquer coluna da própria linha, o que deixaria is_admin/status/
-- tenant_id alteráveis pelo próprio usuário via API — restringe a coluna
-- editável a "name" e move a aceitação de convite para uma função
-- SECURITY DEFINER que só altera exatamente o que deveria.

revoke update on public.staff from authenticated;
grant update (name) on public.staff to authenticated;

create or replace function public.accept_staff_invite(p_name text default null)
returns public.staff
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.staff;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.staff
  set status = 'ativo',
      name = coalesce(nullif(trim(p_name), ''), name)
  where id = auth.uid()
  returning * into result;

  if not found then
    raise exception 'staff record not found for current user';
  end if;

  return result;
end;
$$;

grant execute on function public.accept_staff_invite(text) to authenticated;
