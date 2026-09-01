import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertCircle, Inbox, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/leads/")({
  component: LeadsPage,
});

type Stage = "novo" | "qualificado" | "call_agendada" | "convertido" | "perdido";

interface Lead {
  id: string;
  name: string;
  segment: string;
  reason: string;
  stage: Stage;
  createdAt: string;
}

const columns: { key: Stage; label: string; accent: string }[] = [
  { key: "novo", label: "Novo lead", accent: "border-t-muted-foreground" },
  { key: "qualificado", label: "Qualificado", accent: "border-t-primary" },
  { key: "call_agendada", label: "Call agendada", accent: "border-t-warning" },
  { key: "convertido", label: "Convertido", accent: "border-t-success" },
  { key: "perdido", label: "Perdido", accent: "border-t-destructive" },
];

function LeadsPage() {
  const session = useCurrentStaff();
  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Stage | null>(null);

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [reason, setReason] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  async function loadLeads() {
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, segment, reason, stage, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError("Não foi possível carregar os leads agora. Tente recarregar a página.");
      return;
    }

    setLeads(
      (data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        segment: l.segment,
        reason: l.reason,
        stage: l.stage as Stage,
        createdAt: l.created_at,
      })),
    );
  }

  useEffect(() => {
    if (tenantId) loadLeads();
  }, [tenantId]);

  async function drop(stage: Stage) {
    if (!dragId || !leads) return;
    const previous = leads;
    setLeads((prev) => (prev ?? []).map((l) => (l.id === dragId ? { ...l, stage } : l)));
    setDragId(null);
    setOverCol(null);

    const { error } = await supabase.from("leads").update({ stage }).eq("id", dragId);
    if (error) {
      toast.error("Não foi possível mover o lead.");
      setLeads(previous);
    }
  }

  async function handleCreate() {
    if (!tenantId || !name) return;
    setCreating(true);
    const { error } = await supabase.from("leads").insert({
      tenant_id: tenantId,
      name,
      segment,
      reason,
      whatsapp_number: whatsapp || null,
      created_by: session.status === "ready" ? session.staff.id : null,
    });
    setCreating(false);

    if (error) {
      toast.error("Não foi possível criar o lead.");
      return;
    }

    toast.success("Lead criado com sucesso.");
    setOpen(false);
    setName("");
    setSegment("");
    setReason("");
    setWhatsapp("");
    await loadLeads();
  }

  return (
    <AppShell title="Funil de leads" description="Leads em qualificação pela fila de SDR/Closer">
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus /> Novo lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo lead</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-1.5 block text-sm">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Segmento</Label>
                <Input
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  placeholder="Comércio — Vestuário"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Motivo do contato</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">WhatsApp (opcional)</Label>
                <Input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+55 11 90000-0000"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={!name || creating} onClick={handleCreate}>
                {creating ? "Criando…" : "Criar lead"}
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

      {leads === null ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {columns.map((col) => {
            const items = leads.filter((l) => l.stage === col.key);
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
                          <p className="text-sm font-semibold text-foreground">{lead.name}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {lead.segment && (
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {lead.segment}
                          </Badge>
                        )}
                        {lead.reason && (
                          <p className="text-xs text-muted-foreground">{lead.reason}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
