import { createFileRoute, Link } from "@tanstack/react-router";
import { MessagesSquare, FileWarning, CalendarClock, UserPlus2, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  appointments,
  clients,
  conversations,
  currentStaff,
  departmentLabel,
  docStatusFromClient,
  leadsSeed,
  staffMembers,
} from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  component: Index,
});

const hoje = new Date(2026, 8, 1);
const saudacao =
  hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

const tipoLabel: Record<"ligacao" | "video" | "presencial", string> = {
  ligacao: "Ligação",
  video: "Vídeo",
  presencial: "Presencial",
};

function Index() {
  const filaDoMeuDepartamento = conversations.filter((c) =>
    currentStaff.departamentos.includes(c.departamento),
  );
  const documentosPendentes = clients.filter((c) => docStatusFromClient(c) !== "em_dia").length;
  const compromissosHoje = appointments.filter((a) => a.data === "2026-09-01");
  const leadsNovos = leadsSeed.filter((l) => l.coluna === "novo").length;

  return (
    <AppShell title="Dashboard" description="Visão geral do dia">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {saudacao}, {currentStaff.nome.split(" ")[0]}
        </h2>
        <p className="text-sm text-muted-foreground">
          {hoje.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/conversas">
          <StatCard
            label="Conversas na fila"
            value={filaDoMeuDepartamento.length}
            icon={MessagesSquare}
            tone="primary"
          />
        </Link>
        <Link to="/clientes">
          <StatCard
            label="Documentos pendentes"
            value={documentosPendentes}
            icon={FileWarning}
            tone="warning"
          />
        </Link>
        <Link to="/agenda">
          <StatCard
            label="Compromissos hoje"
            value={compromissosHoje.length}
            icon={CalendarClock}
            tone="success"
          />
        </Link>
        <Link to="/leads">
          <StatCard label="Leads novos" value={leadsNovos} icon={UserPlus2} tone="primary" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Conversas aguardando você</h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/conversas">
                Ver todas <ArrowRight />
              </Link>
            </Button>
          </div>
          {filaDoMeuDepartamento.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="Nenhuma conversa pendente"
              description="Bom trabalho! Sua fila está em dia."
            />
          ) : (
            <ul className="space-y-1">
              {filaDoMeuDepartamento.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    to="/conversas"
                    className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {c.nomeContato
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.nomeContato}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{c.ultimaMensagem}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge
                        variant="outline"
                        className={
                          c.overflow
                            ? "border-destructive/40 text-destructive"
                            : "border-warning/40 text-warning-foreground"
                        }
                      >
                        há {c.esperaMin} min
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Próximos compromissos de hoje</h3>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/agenda">
                Ver agenda <ArrowRight />
              </Link>
            </Button>
          </div>
          {compromissosHoje.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhum compromisso hoje"
              description="Sua agenda está livre por enquanto."
            />
          ) : (
            <ul className="space-y-1">
              {compromissosHoje.map((a) => {
                const staff = staffMembers.find((s) => s.id === a.staffId);
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent"
                  >
                    <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-muted py-1.5 text-center">
                      <span className="text-sm font-bold text-foreground">{a.horaInicio}</span>
                      <span className="text-[10px] text-muted-foreground">{a.duracaoMin}min</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{a.titulo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.cliente} · {staff?.nome}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {tipoLabel[a.tipo]}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Fila exibida para os departamentos:{" "}
        {currentStaff.departamentos.map(departmentLabel).join(", ")}.
      </p>
    </AppShell>
  );
}
