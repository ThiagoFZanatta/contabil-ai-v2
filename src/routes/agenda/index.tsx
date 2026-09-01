import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ptBR } from "date-fns/locale";
import { Bot, CalendarDays, Phone, User, Video } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { appointments, staffMembers, type Appointment } from "@/lib/mock-data";

export const Route = createFileRoute("/agenda/")({
  component: AgendaPage,
});

const tipoConfig = {
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

function toISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function AgendaPage() {
  const [date, setDate] = useState<Date>(new Date(2026, 8, 1));
  const [staffFilter, setStaffFilter] = useState<string>("todos");
  const [bloqueado, setBloqueado] = useState(false);
  const [detalhe, setDetalhe] = useState<Appointment | null>(null);

  const iso = toISO(date);

  const doDia = useMemo(() => {
    return appointments
      .filter((a) => a.data === iso)
      .filter((a) => staffFilter === "todos" || a.staffId === staffFilter)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [iso, staffFilter]);

  const diasComCompromisso = useMemo(() => new Set(appointments.map((a) => a.data)), []);

  return (
    <AppShell title="Agenda" description="Compromissos confirmados pela IA e pela equipe">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr]">
        <div className="space-y-4">
          <div className="w-fit rounded-xl border border-border bg-card">
            <Calendar
              mode="single"
              locale={ptBR}
              selected={date}
              onSelect={(d) => d && setDate(d)}
              modifiers={{ hasEvent: (d) => diasComCompromisso.has(toISO(d)) }}
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
                {staffMembers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
              <Label htmlFor="bloquear" className="text-sm">
                Bloquear este horário
              </Label>
              <Switch id="bloquear" checked={bloqueado} onCheckedChange={setBloqueado} />
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
          <h3 className="mb-4 text-sm font-semibold text-foreground">
            {date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </h3>
          {doDia.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nenhum compromisso neste dia"
              className="border-0"
            />
          ) : (
            <ul className="space-y-2">
              {doDia.map((a) => {
                const cfg = tipoConfig[a.tipo];
                const staff = staffMembers.find((s) => s.id === a.staffId);
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
                        <p className="truncate text-sm font-semibold">{a.titulo}</p>
                        <p className="truncate text-xs opacity-80">
                          {a.horaInicio} · {a.duracaoMin}min · {a.cliente} · {staff?.nome}
                        </p>
                      </div>
                      {a.origem === "ia" && (
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
                <DialogTitle>{detalhe.titulo}</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Cliente:</span> {detalhe.cliente}
                </p>
                <p>
                  <span className="text-muted-foreground">Tipo:</span>{" "}
                  {tipoConfig[detalhe.tipo].label}
                </p>
                <p>
                  <span className="text-muted-foreground">Horário:</span> {detalhe.horaInicio} (
                  {detalhe.duracaoMin} min)
                </p>
                <p>
                  <span className="text-muted-foreground">Responsável:</span>{" "}
                  {staffMembers.find((s) => s.id === detalhe.staffId)?.nome}
                </p>
                <p className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Origem:</span>
                  {detalhe.origem === "ia" ? (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Bot className="size-3" /> Agendado pela IA
                    </Badge>
                  ) : (
                    "Agendado manualmente"
                  )}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
