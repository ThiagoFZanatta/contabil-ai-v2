-- RF06 (pendência fechada na v1.6 do PRD): lembrete automático de
-- compromisso via WhatsApp. reminder_sent_at marca que o lembrete já foi
-- disparado para aquele compromisso (uma vez só, nunca duplicado) — o envio
-- em si roda fora do banco, em src/lib/jobs/appointment-reminders.server.ts,
-- porque depende de resolver o WhatsAppProvider e os segredos do tenant
-- (tenant_integration_secrets), algo que só o runtime da aplicação faz.
-- Diferente do job de overflow do RF05 (mark_overflow_escalations), que só
-- precisa atualizar uma coluna e por isso roda inteiramente via pg_cron.
alter table public.appointments
  add column reminder_sent_at timestamptz;

-- Acelera a varredura periódica do job: "compromissos futuros ainda sem
-- lembrete enviado", que é exatamente o filtro usado em runAppointmentReminders.
create index appointments_reminder_pending_idx
  on public.appointments (start_at)
  where reminder_sent_at is null;
