import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { ArrowDown, ArrowUp } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/relatorios/")({
  component: RelatoriosPage,
});

const periods = [
  { value: 7, label: "Últimos 7 dias" },
  { value: 30, label: "Últimos 30 dias" },
  { value: 90, label: "Últimos 90 dias" },
];

function seriesFor(days: number, base: number, amplitude: number, seed: number) {
  const points = Math.min(days, 14);
  const step = Math.max(1, Math.floor(days / points));
  return Array.from({ length: points }).map((_, i) => {
    const dayOffset = (points - i) * step;
    const noise = Math.sin(seed + i * 1.3) * amplitude;
    const value = Math.max(0, base + noise + i * (amplitude / points) * 0.4);
    const d = new Date(2026, 8, 1);
    d.setDate(d.getDate() - dayOffset);
    return {
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value: Math.round(value * 10) / 10,
    };
  });
}

function trendOf(data: { value: number }[]) {
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
  data: { label: string; value: number }[];
  goodDirection: "up" | "down";
  chartType?: "line" | "bar";
  color: string;
}) {
  const current = data[data.length - 1]?.value ?? 0;
  const trend = trendOf(data);
  const improved = goodDirection === "up" ? trend >= 0 : trend <= 0;

  const config: ChartConfig = { value: { label: title, color } };

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
  const [period, setPeriod] = useState(30);

  const tempoResposta = useMemo(() => seriesFor(period, 4.2, 1.2, 1), [period]);
  const resolvidoIA = useMemo(() => seriesFor(period, 58, 8, 2), [period]);
  const documentosPrazo = useMemo(() => seriesFor(period, 74, 10, 3), [period]);
  const csat = useMemo(() => seriesFor(period, 4.4, 0.3, 4), [period]);
  const conversaoLeads = useMemo(() => seriesFor(period, 22, 6, 5), [period]);

  const poucosPontos = period <= 7;

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

      {poucosPontos && (
        <p className="mb-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Ainda há poucos dados neste período — os números tendem a ficar mais representativos com o
          tempo de uso do sistema.
        </p>
      )}

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
        <MetricChart
          title="CSAT médio"
          unit=" / 5"
          data={csat}
          goodDirection="up"
          color="var(--color-chart-4)"
        />
        <MetricChart
          title="Conversão de leads em reuniões"
          unit="%"
          data={conversaoLeads}
          goodDirection="up"
          chartType="bar"
          color="var(--color-chart-5)"
        />
      </div>
    </AppShell>
  );
}
