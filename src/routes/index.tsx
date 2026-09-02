import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessagesSquare, FileWarning, CalendarClock, UserPlus2, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { supabase } from "@/integrations/supabase/client";

interface QueuePreviewItem {
  conversationId: string;
  contactName: string;
  lastMessage: string;
  waitMin: number;
  isOverflow: boolean;
  departmentSlug: string;
}

export const Route = createFileRoute("/")({
  component: Index,
});

const tipoLabel: Record<"ligacao" | "video" | "presencial", string> = {
  ligacao: "Ligação",
  video: "Vídeo",
  presencial: "Presencial",
};

interface AppointmentToday {
  id: string;
  title: string;
  type: "ligacao" | "video" | "presencial";
  startAt: string;
  durationMin: number;
  staffName: string;
  withName: string;
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function Index() {
  const session = useCurrentStaff();
  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  const [documentosPendentes, setDocumentosPendentes] = useState<number | null>(null);
  const [compromissosHoje, setCompromissosHoje] = useState<AppointmentToday[] | null>(null);
  const [leadsNovos, setLeadsNovos] = useState<number | null>(null);
  const [filaQueue, setFilaQueue] = useState<QueuePreviewItem[] | null>(null);
  const [departmentNames, setDepartmentNames] = useState<Map<string, string>>(new Map());

  const hoje = useMemo(() => new Date(), []);
  const saudacao =
    hoje.getHours() < 12 ? "Bom dia" : hoje.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const filaDoMeuDepartamento = useMemo(() => {
    if (!filaQueue || session.status !== "ready") return [];
    return filaQueue.filter(
      (c) => session.staff.departmentSlugs.includes(c.departmentSlug) || c.isOverflow,
    );
  }, [filaQueue, session]);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("departments")
      .select("slug, name")
      .eq("tenant_id", tenantId)
      .then(({ data }) => setDepartmentNames(new Map((data ?? []).map((d) => [d.slug, d.name]))));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;

    supabase
      .from("escalations")
      .select(
        `id, conversation_id, escalated_at, is_overflow, department_id,
         departments ( slug ),
         conversations ( id, contact_id, lead_id, contacts ( name ), leads ( name ) )`,
      )
      .eq("tenant_id", tenantId)
      .is("resolved_at", null)
      .order("escalated_at", { ascending: true })
      .then(async ({ data: escalationRows }) => {
        const rows = escalationRows ?? [];
        const now = Date.now();
        const seen = new Set<string>();
        const items: QueuePreviewItem[] = [];
        for (const e of rows) {
          const conv = e.conversations as unknown as {
            id: string;
            contacts: { name: string } | null;
            leads: { name: string } | null;
          } | null;
          if (!conv || seen.has(conv.id)) continue;
          seen.add(conv.id);
          const dept = e.departments as unknown as { slug: string } | null;
          items.push({
            conversationId: conv.id,
            contactName: conv.contacts?.name ?? conv.leads?.name ?? "Contato",
            lastMessage: "",
            waitMin: Math.max(0, Math.round((now - new Date(e.escalated_at).getTime()) / 60000)),
            isOverflow: e.is_overflow,
            departmentSlug: dept?.slug ?? "",
          });
        }

        const conversationIds = items.map((i) => i.conversationId);
        if (conversationIds.length > 0) {
          const { data: recentMessages } = await supabase
            .from("messages")
            .select("conversation_id, body")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false });
          const lastByConversation = new Map<string, string>();
          for (const m of recentMessages ?? []) {
            if (!lastByConversation.has(m.conversation_id)) {
              lastByConversation.set(m.conversation_id, m.body);
            }
          }
          for (const item of items) {
            item.lastMessage = lastByConversation.get(item.conversationId) ?? "";
          }
        }

        setFilaQueue(items);
      });
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const today = toISODate(hoje);
    const startOfDay = `${today}T00:00:00`;
    const startOfNextDay = toISODate(new Date(hoje.getTime() + 24 * 60 * 60 * 1000)) + "T00:00:00";

    supabase
      .from("client_document_config")
      .select("id, enabled, next_due_date")
      .eq("enabled", true)
      .not("next_due_date", "is", null)
      .lte("next_due_date", toISODate(new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000)))
      .then(({ data }) => setDocumentosPendentes((data ?? []).length));

    supabase
      .from("appointments")
      .select("id, title, appointment_type, start_at, duration_min, staff_id, client_id, lead_id")
      .gte("start_at", startOfDay)
      .lt("start_at", startOfNextDay)
      .order("start_at")
      .then(async ({ data }) => {
        const rows = data ?? [];
        const staffIds = [...new Set(rows.map((r) => r.staff_id))];
        const clientIds = [
          ...new Set(rows.map((r) => r.client_id).filter((v): v is string => !!v)),
        ];
        const leadIds = [...new Set(rows.map((r) => r.lead_id).filter((v): v is string => !!v))];

        const [{ data: staffRows }, { data: clientRows }, { data: leadRows }] = await Promise.all([
          staffIds.length
            ? supabase.from("staff").select("id, name").in("id", staffIds)
            : Promise.resolve({ data: [] }),
          clientIds.length
            ? supabase.from("clients").select("id, name").in("id", clientIds)
            : Promise.resolve({ data: [] }),
          leadIds.length
            ? supabase.from("leads").select("id, name").in("id", leadIds)
            : Promise.resolve({ data: [] }),
        ]);

        const staffNames = new Map((staffRows ?? []).map((s) => [s.id, s.name]));
        const clientNames = new Map((clientRows ?? []).map((c) => [c.id, c.name]));
        const leadNames = new Map((leadRows ?? []).map((l) => [l.id, l.name]));

        setCompromissosHoje(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            type: r.appointment_type as AppointmentToday["type"],
            startAt: r.start_at,
            durationMin: r.duration_min,
            staffName: staffNames.get(r.staff_id) ?? "—",
            withName:
              (r.client_id && clientNames.get(r.client_id)) ||
              (r.lead_id && leadNames.get(r.lead_id)) ||
              "—",
          })),
        );
      });

    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("stage", "novo")
      .then(({ count }) => setLeadsNovos(count ?? 0));
  }, [tenantId, hoje]);

  if (session.status !== "ready") {
    return (
      <AppShell title="Dashboard" description="Visão geral do dia">
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard" description="Visão geral do dia">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {saudacao}, {session.staff.name.split(" ")[0]}
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
            value={filaQueue === null ? "—" : filaDoMeuDepartamento.length}
            icon={MessagesSquare}
            tone="primary"
          />
        </Link>
        <Link to="/clientes">
          <StatCard
            label="Documentos com prazo em 7 dias"
            value={documentosPendentes ?? "—"}
            icon={FileWarning}
            tone="warning"
          />
        </Link>
        <Link to="/agenda">
          <StatCard
            label="Compromissos hoje"
            value={compromissosHoje?.length ?? "—"}
            icon={CalendarClock}
            tone="success"
          />
        </Link>
        <Link to="/leads">
          <StatCard label="Leads novos" value={leadsNovos ?? "—"} icon={UserPlus2} tone="primary" />
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
          {filaQueue === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filaDoMeuDepartamento.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="Nenhuma conversa pendente"
              description="Bom trabalho! Sua fila está em dia."
            />
          ) : (
            <ul className="space-y-1">
              {filaDoMeuDepartamento.slice(0, 5).map((c) => (
                <li key={c.conversationId}>
                  <Link
                    to="/conversas"
                    className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent"
                  >
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {c.contactName
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.contactName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.lastMessage || "Sem mensagens ainda"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge
                        variant="outline"
                        className={
                          c.isOverflow
                            ? "border-destructive/40 text-destructive"
                            : "border-warning/40 text-warning-foreground"
                        }
                      >
                        há {c.waitMin} min
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
          {compromissosHoje === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : compromissosHoje.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhum compromisso hoje"
              description="Sua agenda está livre por enquanto."
            />
          ) : (
            <ul className="space-y-1">
              {compromissosHoje.map((a) => {
                const hora = new Date(a.startAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-accent"
                  >
                    <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-muted py-1.5 text-center">
                      <span className="text-sm font-bold text-foreground">{hora}</span>
                      <span className="text-[10px] text-muted-foreground">{a.durationMin}min</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.withName} · {a.staffName}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {tipoLabel[a.type]}
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
        {session.staff.departmentSlugs.map((slug) => departmentNames.get(slug) ?? slug).join(", ")}.
      </p>
    </AppShell>
  );
}
