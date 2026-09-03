import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertCircle, ChevronRight, Plus, Search, Users, Users2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { supabase } from "@/integrations/supabase/client";
import type { DocStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/clientes/")({
  component: ClientesPage,
});

const filters: { value: DocStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "em_dia", label: "Em dia" },
  { value: "pendente", label: "Pendente" },
  { value: "atrasado", label: "Atrasado" },
];

const taxRegimes = ["Simples Nacional", "Lucro Presumido", "Lucro Real"] as const;

interface ClientRow {
  id: string;
  name: string;
  cnpj: string;
  taxRegime: string;
  whatsappNumber: string;
  responsibleStaffId: string | null;
  status: DocStatus;
  contactsCount: number;
  clientSince: string;
}

function computeStatus(configs: { enabled: boolean; next_due_date: string | null }[]): DocStatus {
  const today = new Date();
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 7);

  const active = configs.filter((c) => c.enabled && c.next_due_date);
  if (active.some((c) => new Date(c.next_due_date as string) < today)) return "atrasado";
  if (active.some((c) => new Date(c.next_due_date as string) <= soon)) return "pendente";
  return "em_dia";
}

function ClientesPage() {
  const session = useCurrentStaff();
  const navigate = useNavigate();

  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "todos">("todos");
  const [regimeFilter, setRegimeFilter] = useState<(typeof taxRegimes)[number] | "todos">("todos");

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [taxRegime, setTaxRegime] = useState<(typeof taxRegimes)[number]>("Simples Nacional");
  const [whatsapp, setWhatsapp] = useState("");

  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  async function loadClients() {
    const [{ data: clientRows, error: clientsError }, { data: staffRows }] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, cnpj, tax_regime, whatsapp_number, responsible_staff_id, created_at")
        .order("name"),
      supabase.from("staff").select("id, name"),
    ]);

    if (clientsError) {
      setLoadError("Não foi possível carregar os clientes agora. Tente recarregar a página.");
      return;
    }

    const [{ data: configRows }, { data: linkRows }] = await Promise.all([
      supabase.from("client_document_config").select("client_id, enabled, next_due_date"),
      supabase.from("client_contact_links").select("client_id"),
    ]);

    const byClient = new Map<string, { enabled: boolean; next_due_date: string | null }[]>();
    for (const c of configRows ?? []) {
      const list = byClient.get(c.client_id) ?? [];
      list.push({ enabled: c.enabled, next_due_date: c.next_due_date });
      byClient.set(c.client_id, list);
    }

    const contactsByClient = new Map<string, number>();
    for (const l of linkRows ?? []) {
      contactsByClient.set(l.client_id, (contactsByClient.get(l.client_id) ?? 0) + 1);
    }

    setStaffNames(Object.fromEntries((staffRows ?? []).map((s) => [s.id, s.name])));
    setClients(
      (clientRows ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
        taxRegime: c.tax_regime,
        whatsappNumber: c.whatsapp_number,
        responsibleStaffId: c.responsible_staff_id,
        status: computeStatus(byClient.get(c.id) ?? []),
        contactsCount: contactsByClient.get(c.id) ?? 0,
        clientSince: c.created_at,
      })),
    );
  }

  useEffect(() => {
    if (tenantId) loadClients();
  }, [tenantId]);

  const filtered = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => {
      const matchesQuery =
        !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.cnpj.includes(query);
      const matchesStatus = statusFilter === "todos" || c.status === statusFilter;
      const matchesRegime = regimeFilter === "todos" || c.taxRegime === regimeFilter;
      return matchesQuery && matchesStatus && matchesRegime;
    });
  }, [clients, query, statusFilter, regimeFilter]);

  async function handleCreate() {
    if (!tenantId || !name || !cnpj || !whatsapp) return;
    setCreating(true);
    setCreateError(null);
    const { data, error } = await supabase
      .from("clients")
      .insert({ tenant_id: tenantId, name, cnpj, tax_regime: taxRegime, whatsapp_number: whatsapp })
      .select("id")
      .single();
    setCreating(false);

    if (error || !data) {
      setCreateError(
        error?.code === "23505"
          ? "Já existe um cliente com esse CNPJ."
          : "Não foi possível criar o cliente.",
      );
      return;
    }

    toast.success("Cliente criado com sucesso.");
    setOpen(false);
    setName("");
    setCnpj("");
    setWhatsapp("");
    setTaxRegime("Simples Nacional");
    navigate({ to: "/clientes/$clienteId", params: { clienteId: data.id } });
  }

  return (
    <AppShell
      title="Clientes"
      description={clients ? `${clients.length} clientes ativos na carteira` : undefined}
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CNPJ…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                statusFilter === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-foreground hover:bg-accent",
              )}
            >
              {f.label}
            </button>
          ))}
          <Select
            value={regimeFilter}
            onValueChange={(v) => setRegimeFilter(v as (typeof taxRegimes)[number] | "todos")}
          >
            <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
              <SelectValue placeholder="Regime tributário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os regimes</SelectItem>
              {taxRegimes.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="ml-2">
                <Plus /> Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo cliente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {createError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}
                <div>
                  <Label className="mb-1.5 block text-sm">Nome da empresa</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">CNPJ</Label>
                  <Input
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">Regime tributário</Label>
                  <Select
                    value={taxRegime}
                    onValueChange={(v) => setTaxRegime(v as (typeof taxRegimes)[number])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taxRegimes.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">WhatsApp vinculado</Label>
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
                <Button disabled={!name || !cnpj || !whatsapp || creating} onClick={handleCreate}>
                  {creating ? "Criando…" : "Criar cliente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {clients === null ? (
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0"
              >
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              clients.length === 0 ? "Nenhum cliente cadastrado ainda" : "Nenhum cliente encontrado"
            }
            description={
              clients.length === 0
                ? "Cadastre o primeiro cliente da carteira para começar."
                : "Tente ajustar a busca ou os filtros aplicados."
            }
            className="m-4 border-0"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Regime tributário</TableHead>
                <TableHead>Responsável interno</TableHead>
                <TableHead>Contatos</TableHead>
                <TableHead>Status de documentos</TableHead>
                <TableHead>Cliente desde</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      to="/clientes/$clienteId"
                      params={{ clienteId: c.id }}
                      className="flex items-center gap-2.5"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {c.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="truncate font-medium text-foreground">{c.name}</p>
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.cnpj}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {c.taxRegime}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.responsibleStaffId ? (staffNames[c.responsibleStaffId] ?? "—") : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users2 className="size-3.5" />
                      {c.contactsCount}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(c.clientSince).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to="/clientes/$clienteId"
                      params={{ clienteId: c.id }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Configurar <ChevronRight className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {clients !== null && (
        <p className="mt-3 text-xs text-muted-foreground">
          Mostrando {filtered.length} de {clients.length} clientes.
        </p>
      )}
    </AppShell>
  );
}
