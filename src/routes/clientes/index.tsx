import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { clients, docStatusFromClient, type DocStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/clientes/")({
  component: ClientesPage,
});

const filters: { value: DocStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "em_dia", label: "Em dia" },
  { value: "pendente", label: "Pendente" },
  { value: "atrasado", label: "Atrasado" },
];

function ClientesPage() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocStatus | "todos">("todos");

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 550);
    return () => window.clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const status = docStatusFromClient(c);
      const matchesQuery =
        !query || c.nome.toLowerCase().includes(query.toLowerCase()) || c.cnpj.includes(query);
      const matchesStatus = statusFilter === "todos" || status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter]);

  return (
    <AppShell title="Clientes" description={`${clients.length} clientes ativos na carteira`}>
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
        <div className="flex flex-wrap gap-1.5">
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
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-border px-4 py-3.5 last:border-0"
              >
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="ml-auto h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente encontrado"
            description="Tente ajustar a busca ou os filtros aplicados."
            className="m-4 border-0"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Responsável interno</TableHead>
                <TableHead>Status de documentos</TableHead>
                <TableHead>Última interação</TableHead>
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
                          {c.nome.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{c.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.cnpj}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.responsavelInterno}</TableCell>
                  <TableCell>
                    <StatusBadge status={docStatusFromClient(c)} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.ultimaInteracao}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      {!loading && (
        <p className="mt-3 text-xs text-muted-foreground">
          Mostrando {filtered.length} de {clients.length} clientes.
        </p>
      )}
    </AppShell>
  );
}
