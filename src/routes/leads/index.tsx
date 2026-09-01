import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Inbox } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { leadsSeed, type Lead } from "@/lib/mock-data";

export const Route = createFileRoute("/leads/")({
  component: LeadsPage,
});

const columns: { key: Lead["coluna"]; label: string; accent: string }[] = [
  { key: "novo", label: "Novo lead", accent: "border-t-muted-foreground" },
  { key: "qualificado", label: "Qualificado pela IA", accent: "border-t-primary" },
  { key: "call_agendada", label: "Call agendada", accent: "border-t-warning" },
  { key: "convertido", label: "Convertido", accent: "border-t-success" },
  { key: "perdido", label: "Perdido", accent: "border-t-destructive" },
];

function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>(leadsSeed);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Lead["coluna"] | null>(null);

  function drop(coluna: Lead["coluna"]) {
    if (!dragId) return;
    setLeads((prev) => prev.map((l) => (l.id === dragId ? { ...l, coluna } : l)));
    setDragId(null);
    setOverCol(null);
  }

  return (
    <AppShell
      title="Funil de leads"
      description="Leads qualificados pela IA, da fila de SDR/Closer"
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((col) => {
          const items = leads.filter((l) => l.coluna === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.key);
              }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={() => drop(col.key)}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border border-t-4 bg-muted/30",
                col.accent,
                overCol === col.key && "bg-accent/60",
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className="flex-1 space-y-2 px-2 pb-3">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
                    <Inbox className="size-5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Nenhum lead nesta etapa</p>
                  </div>
                ) : (
                  items.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDragId(lead.id)}
                      onDragEnd={() => setDragId(null)}
                      className={cn(
                        "cursor-grab space-y-1.5 rounded-lg border border-border bg-card p-3 shadow-sm active:cursor-grabbing",
                        dragId === lead.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{lead.nome}</p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {lead.data}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {lead.segmento}
                      </Badge>
                      <p className="text-xs text-muted-foreground">{lead.motivo}</p>
                      {lead.tentouAgendarIA && (
                        <div className="flex items-center gap-1 pt-0.5 text-[10px] font-medium text-primary">
                          <Bot className="size-3" /> IA tentou agendar automaticamente
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
