import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { ArrowDown, ArrowUp, Smile } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/relatorios/")({
  component: RelatoriosPage,
});

const periods = [
  { value: 7, label: "Últimos 7 dias" },
  { value: 30, label: "Últimos 30 dias" },
  { value: 90, label: "Últimos 90 dias" },
];

interface SeriesPoint {
  label: string;
  value: number;
}

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function trendOf(data: SeriesPoint[]) {
  const first = data[0]?.value ?? 0;
  const last = data[data.length - 1]?.value ?? 0;
  const diff = first === 0 ? 0 : ((last - first) / first) * 100;
  return Math.round(diff * 10) / 10;
}

function MetricChart({
  title,
  unit,
  data,
  goodDirection,
  chartType = "line",
  color,
}: {
  title: string;
  unit: string;
  data: SeriesPoint[];
  goodDirection: "up" | "down";
  chartType?: "line" | "bar";
  color: string;
}) {
  const config: ChartConfig = { value: { label: title, color } };

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-sm text-muted-foreground">{title}</p>
        <EmptyState
          icon={goodDirection === "up" ? ArrowUp : ArrowDown}
          title="Sem dados neste período"
          description="Ainda não há atividade suficiente para calcular esta métrica."
        />
      </div>
    );
  }

  const current = data[data.length - 1]?.value ?? 0;
  const trend = trendOf(data);
  const improved = goodDirection === "up" ? trend >= 0 : trend <= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {current}
            {unit}
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
            improved ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
          )}
        >
          {trend >= 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          {Math.abs(trend)}%
        </div>
      </div>
      <ChartContainer config={config} className="aspect-auto h-40 w-full">
        {chartType === "line" ? (
          <LineChart data={data} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={10}
              minTickGap={24}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              fontSize={10}
              minTickGap={24}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={4} />
          </BarChart>
        )}
      </ChartContainer>
    </div>
  );
}

function RelatoriosPage() {
  const session = useCurrentStaff();
  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  const [period, setPeriod] = useState(30);
  const [tempoResposta, setTempoResposta] = useState<SeriesPoint[] | null>(null);
  const [resolvidoIA, setResolvidoIA] = useState<SeriesPoint[] | null>(null);
  const [documentosPrazo, setDocumentosPrazo] = useState<SeriesPoint[] | null>(null);
  const [conversaoLeads, setConversaoLeads] = useState<SeriesPoint[] | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    setTempoResposta(null);
    setResolvidoIA(null);
    setDocumentosPrazo(null);
    setConversaoLeads(null);

    supabase.rpc("report_first_response_time", { p_period_days: period }).then(({ data }) => {
      setTempoResposta(
        (data ?? []).map((r) => ({
          label: formatDay(r.day),
          value: Math.round(r.avg_minutes * 10) / 10,
        })),
      );
    });

    supabase.rpc("report_ia_resolution_rate", { p_period_days: period }).then(({ data }) => {
      setResolvidoIA(
        (data ?? []).map((r) => ({
          label: formatDay(r.day),
          value: Math.round(r.pct_ia * 10) / 10,
        })),
      );
    });

    supabase.rpc("report_document_on_time_rate", { p_period_days: period }).then(({ data }) => {
      setDocumentosPrazo(
        (data ?? []).map((r) => ({
          label: formatDay(r.day),
          value: Math.round(r.pct_on_time * 10) / 10,
        })),
      );
    });

    supabase.rpc("report_lead_conversion_rate", { p_period_days: period }).then(({ data }) => {
      setConversaoLeads(
        (data ?? []).map((r) => ({
          label: formatDay(r.day),
          value: Math.round(r.pct_conversion * 10) / 10,
        })),
      );
    });
  }, [tenantId, period]);

  const loading =
    tempoResposta === null ||
    resolvidoIA === null ||
    documentosPrazo === null ||
    conversaoLeads === null;

  return (
    <AppShell
      title="Relatórios e Métricas"
      description="Evolução ao longo do tempo, não apenas o dia de hoje"
    >
      <div className="mb-5 flex flex-wrap gap-1.5">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              period === p.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricChart
            title="Tempo médio até 1ª resposta"
            unit=" min"
            data={tempoResposta}
            goodDirection="down"
            color="var(--color-chart-1)"
          />
          <MetricChart
            title="Resolvidas 100% pela IA"
            unit="%"
            data={resolvidoIA}
            goodDirection="up"
            chartType="bar"
            color="var(--color-chart-2)"
          />
          <MetricChart
            title="Documentos entregues no prazo"
            unit="%"
            data={documentosPrazo}
            goodDirection="up"
            color="var(--color-chart-3)"
          />
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-3 text-sm text-muted-foreground">CSAT médio</p>
            <EmptyState
              icon={Smile}
              title="Ainda não coletamos CSAT"
              description="A pesquisa de satisfação pós-atendimento via WhatsApp é um agente proativo de uma fase futura do produto."
            />
          </div>
          <MetricChart
            title="Conversão de leads em reuniões"
            unit="%"
            data={conversaoLeads}
            goodDirection="up"
            chartType="bar"
            color="var(--color-chart-5)"
          />
        </div>
      )}
    </AppShell>
  );
}
