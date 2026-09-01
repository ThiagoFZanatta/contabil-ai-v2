import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Bot, CalendarDays, Phone, Plus, Trash2, User, Video } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/agenda/")({
  component: AgendaPage,
});

type AppointmentType = "ligacao" | "video" | "presencial";

const tipoConfig: Record<
  AppointmentType,
  { label: string; icon: typeof Phone; className: string }
> = {
  ligacao: {
    label: "Ligação",
    icon: Phone,
    className: "bg-primary/10 text-primary border-primary/30",
  },
  video: { label: "Vídeo", icon: Video, className: "bg-success/15 text-success border-success/30" },
  presencial: {
    label: "Presencial",
    icon: User,
    className: "bg-warning/20 text-warning-foreground border-warning/40",
  },
};

const durations = [15, 30, 45, 60, 90];

interface Appointment {
  id: string;
  title: string;
  staffId: string;
  type: AppointmentType;
  startAt: string;
  durationMin: number;
  origin: "ia" | "manual";
  clientId: string | null;
  leadId: string | null;
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayBounds(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0);
  return { start, end };
}

function AgendaPage() {
  const session = useCurrentStaff();
  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  const [date, setDate] = useState<Date>(new Date());
  const [staffFilter, setStaffFilter] = useState<string>("todos");
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; name: string }[]>([]);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [timeBlocks, setTimeBlocks] = useState<{ id: string; staffId: string; startAt: string }[]>(
    [],
  );
  const [detalhe, setDetalhe] = useState<Appointment | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<AppointmentType>("ligacao");
  const [newStaffId, setNewStaffId] = useState("");
  const [newClientId, setNewClientId] = useState("none");
  const [newLeadId, setNewLeadId] = useState("none");
  const [newTime, setNewTime] = useState("09:00");
  const [newDuration, setNewDuration] = useState(30);

  async function loadAll() {
    const [
      { data: staffRows },
      { data: clientRows },
      { data: leadRows },
      { data: apptRows, error: apptError },
      { data: blockRows },
    ] = await Promise.all([
      supabase.from("staff").select("id, name").order("name"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("leads").select("id, name").order("name"),
      supabase
        .from("appointments")
        .select(
          "id, title, staff_id, appointment_type, start_at, duration_min, origin, client_id, lead_id",
        )
        .order("start_at"),
      supabase.from("staff_time_blocks").select("id, staff_id, start_at"),
    ]);

    if (apptError) {
      setLoadError("Não foi possível carregar a agenda agora. Tente recarregar a página.");
      return;
    }

    setStaffList(staffRows ?? []);
    setClients(clientRows ?? []);
    setLeads(leadRows ?? []);
    setAppointments(
      (apptRows ?? []).map((a) => ({
        id: a.id,
        title: a.title,
        staffId: a.staff_id,
        type: a.appointment_type as AppointmentType,
        startAt: a.start_at,
        durationMin: a.duration_min,
        origin: a.origin as "ia" | "manual",
        clientId: a.client_id,
        leadId: a.lead_id,
      })),
    );
    setTimeBlocks(
      (blockRows ?? []).map((b) => ({ id: b.id, staffId: b.staff_id, startAt: b.start_at })),
    );
  }

  useEffect(() => {
    if (tenantId) loadAll();
  }, [tenantId]);

  useEffect(() => {
    if (session.status === "ready" && !newStaffId) setNewStaffId(session.staff.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status]);

  const iso = toISODate(date);

  const doDia = useMemo(() => {
    if (!appointments) return [];
    return appointments
      .filter((a) => toISODate(new Date(a.startAt)) === iso)
      .filter((a) => staffFilter === "todos" || a.staffId === staffFilter)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [appointments, iso, staffFilter]);

  const diasComCompromisso = useMemo(
    () => new Set((appointments ?? []).map((a) => toISODate(new Date(a.startAt)))),
    [appointments],
  );

  const bloqueadoHoje =
    session.status === "ready" &&
    timeBlocks.some(
      (b) => b.staffId === session.staff.id && toISODate(new Date(b.startAt)) === iso,
    );

  async function toggleBloqueio(checked: boolean) {
    if (session.status !== "ready") return;
    const { start, end } = dayBounds(date);
    if (checked) {
      const { error } = await supabase.from("staff_time_blocks").insert({
        tenant_id: session.staff.tenantId,
        staff_id: session.staff.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        reason: "Bloqueado manualmente",
      });
      if (error) {
        toast.error("Não foi possível bloquear o dia.");
        return;
      }
    } else {
      const toRemove = timeBlocks.filter(
        (b) => b.staffId === session.staff.id && toISODate(new Date(b.startAt)) === iso,
      );
      const { error } = await supabase
        .from("staff_time_blocks")
        .delete()
        .in(
          "id",
          toRemove.map((b) => b.id),
        );
      if (error) {
        toast.error("Não foi possível desbloquear o dia.");
        return;
      }
    }
    await loadAll();
  }

  function resetCreateForm() {
    setNewTitle("");
    setNewType("ligacao");
    setNewClientId("none");
    setNewLeadId("none");
    setNewTime("09:00");
    setNewDuration(30);
    setCreateError(null);
  }

  async function handleCreate() {
    if (!tenantId || !newTitle || !newStaffId) return;
    setCreating(true);
    setCreateError(null);

    const [hours, minutes] = newTime.split(":").map(Number);
    const startAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);

    const { error } = await supabase.from("appointments").insert({
      tenant_id: tenantId,
      title: newTitle,
      staff_id: newStaffId,
      appointment_type: newType,
      start_at: startAt.toISOString(),
      duration_min: newDuration,
      client_id: newClientId === "none" ? null : newClientId,
      lead_id: newLeadId === "none" ? null : newLeadId,
    });

    setCreating(false);

    if (error) {
      setCreateError(
        error.code === "23P01"
          ? "Esse horário conflita com outro compromisso da mesma pessoa."
          : "Não foi possível criar o compromisso.",
      );
      return;
    }

    toast.success("Compromisso criado com sucesso.");
    setCreateOpen(false);
    resetCreateForm();
    await loadAll();
  }

  async function excluirCompromisso(id: string) {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir o compromisso.");
      return;
    }
    setDetalhe(null);
    await loadAll();
  }

  return (
    <AppShell title="Agenda" description="Compromissos confirmados pela equipe">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
        <div className="space-y-4">
          <div className="w-fit rounded-xl border border-border bg-card">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={date}
              onSelect={(d) => d && setDate(d)}
              modifiers={{ hasEvent: (d) => diasComCompromisso.has(toISODate(d)) }}
              modifiersClassNames={{
                hasEvent: "font-bold underline decoration-primary decoration-2 underline-offset-4",
              }}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="mb-3 h-9 text-sm">
                <SelectValue placeholder="Filtrar por membro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda a equipe</SelectItem>
                {staffList.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
              <Label htmlFor="bloquear" className="text-sm">
                Bloquear meu dia
              </Label>
              <Switch id="bloquear" checked={bloqueadoHoje} onCheckedChange={toggleBloqueio} />
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              {Object.entries(tipoConfig).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", cfg.className.split(" ")[0])} />
                  {cfg.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </h3>
            <Dialog
              open={createOpen}
              onOpenChange={(o) => {
                setCreateOpen(o);
                if (!o) resetCreateForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus /> Novo compromisso
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo compromisso</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {createError && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{createError}</span>
                    </div>
                  )}
                  <div>
                    <Label className="mb-1.5 block text-sm">Título</Label>
                    <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1.5 block text-sm">Tipo</Label>
                      <Select
                        value={newType}
                        onValueChange={(v) => setNewType(v as AppointmentType)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ligacao">Ligação</SelectItem>
                          <SelectItem value="video">Vídeo</SelectItem>
                          <SelectItem value="presencial">Presencial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-sm">Responsável</Label>
                      <Select value={newStaffId} onValueChange={setNewStaffId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {staffList.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1.5 block text-sm">Horário</Label>
                      <Input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-sm">Duração</Label>
                      <Select
                        value={String(newDuration)}
                        onValueChange={(v) => setNewDuration(Number(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {durations.map((d) => (
                            <SelectItem key={d} value={String(d)}>
                              {d} min
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1.5 block text-sm">Cliente (opcional)</Label>
                      <Select value={newClientId} onValueChange={setNewClientId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-sm">Lead (opcional)</Label>
                      <Select value={newLeadId} onValueChange={setNewLeadId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {leads.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compromisso agendado para {date.toLocaleDateString("pt-BR")}.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button disabled={!newTitle || !newStaffId || creating} onClick={handleCreate}>
                    {creating ? "Criando…" : "Criar compromisso"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loadError && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {appointments === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : doDia.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nenhum compromisso neste dia"
              className="border-0"
            />
          ) : (
            <ul className="space-y-2">
              {doDia.map((a) => {
                const cfg = tipoConfig[a.type];
                const staff = staffList.find((s) => s.id === a.staffId);
                const client = clients.find((c) => c.id === a.clientId);
                const lead = leads.find((l) => l.id === a.leadId);
                const hora = new Date(a.startAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => setDetalhe(a)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors cursor-pointer hover:brightness-95",
                        cfg.className,
                      )}
                    >
                      <cfg.icon className="size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{a.title}</p>
                        <p className="truncate text-xs opacity-80">
                          {hora} · {a.durationMin}min · {client?.name ?? lead?.name ?? "—"} ·{" "}
                          {staff?.name}
                        </p>
                      </div>
                      {a.origin === "ia" && (
                        <Badge
                          variant="outline"
                          className="shrink-0 gap-1 border-current text-[10px]"
                        >
                          <Bot className="size-3" /> IA
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent>
          {detalhe && (
            <>
              <DialogHeader>
                <DialogTitle>{detalhe.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Cliente/Lead:</span>{" "}
                  {clients.find((c) => c.id === detalhe.clientId)?.name ??
                    leads.find((l) => l.id === detalhe.leadId)?.name ??
                    "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Tipo:</span>{" "}
                  {tipoConfig[detalhe.type].label}
                </p>
                <p>
                  <span className="text-muted-foreground">Horário:</span>{" "}
                  {new Date(detalhe.startAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  ({detalhe.durationMin} min)
                </p>
                <p>
                  <span className="text-muted-foreground">Responsável:</span>{" "}
                  {staffList.find((s) => s.id === detalhe.staffId)?.name}
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Origem:</span>
                  {detalhe.origin === "ia" ? (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Bot className="size-3" /> Agendado pela IA
                    </Badge>
                  ) : (
                    "Agendado manualmente"
                  )}
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => excluirCompromisso(detalhe.id)}
                >
                  <Trash2 /> Excluir compromisso
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
