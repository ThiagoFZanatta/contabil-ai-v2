import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Building2,
  Contact as ContactIcon,
  Eye,
  Info,
  LayoutGrid,
  List,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contatos/")({
  validateSearch: (search: Record<string, unknown>): { clientId?: string } => {
    const clientId = search["clientId"];
    return typeof clientId === "string" ? { clientId } : {};
  },
  component: ContatosPage,
});

const roleFilterOptions: { value: string; label: string; regex: RegExp }[] = [
  { value: "socio", label: "Sócio / proprietário", regex: /s[óo]cio|propriet|titular|ceo/i },
  { value: "financeiro", label: "Financeiro", regex: /financ|pagar/i },
  { value: "rh", label: "RH / Pessoal", regex: /\brh\b|pessoal|\bdp\b/i },
];

interface LinkedClient {
  id: string;
  name: string;
  cnpj: string;
  taxRegime: string;
  roleLabel: string;
}

interface ContactRow {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  archivedAt: string | null;
  hasHistory: boolean;
  linkedClients: LinkedClient[];
  consentAccepted: boolean;
  consentAcceptedAt: string | null;
}

interface ClientOption {
  id: string;
  name: string;
  cnpj: string;
  taxRegime: string;
  responsibleStaffName: string | null;
}

function whatsappDigits(value: string) {
  return value.replace(/\D/g, "");
}

function primaryRole(contact: ContactRow) {
  return contact.linkedClients[0]?.roleLabel || "Sem função definida";
}

async function loadAll(): Promise<{ contacts: ContactRow[]; clientOptions: ClientOption[] }> {
  const [
    { data: contactRows },
    { data: linkRows },
    { data: clientRows },
    { data: staffRows },
    { data: policyRows },
    { data: convRows },
  ] = await Promise.all([
    supabase.from("contacts").select("id, name, whatsapp_number, email, archived_at").order("name"),
    supabase
      .from("client_contact_links")
      .select("contact_id, role_label, clients(id, name, cnpj, tax_regime)"),
    supabase
      .from("clients")
      .select("id, name, cnpj, tax_regime, responsible_staff_id")
      .order("name"),
    supabase.from("staff").select("id, name"),
    supabase
      .from("consent_policy_versions")
      .select("id")
      .order("version_number", { ascending: false })
      .limit(1),
    supabase.from("conversations").select("contact_id").not("contact_id", "is", null),
  ]);

  const staffNames = new Map((staffRows ?? []).map((s) => [s.id, s.name]));
  const clientOptions: ClientOption[] = (clientRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    cnpj: c.cnpj,
    taxRegime: c.tax_regime,
    responsibleStaffName: c.responsible_staff_id
      ? (staffNames.get(c.responsible_staff_id) ?? null)
      : null,
  }));

  const linksByContact = new Map<string, LinkedClient[]>();
  for (const l of linkRows ?? []) {
    const client = l.clients as unknown as {
      id: string;
      name: string;
      cnpj: string;
      tax_regime: string;
    } | null;
    if (!client) continue;
    const list = linksByContact.get(l.contact_id) ?? [];
    list.push({
      id: client.id,
      name: client.name,
      cnpj: client.cnpj,
      taxRegime: client.tax_regime,
      roleLabel: l.role_label,
    });
    linksByContact.set(l.contact_id, list);
  }

  const historyContactIds = new Set((convRows ?? []).map((c) => c.contact_id as string));

  const latestPolicyId = policyRows?.[0]?.id ?? null;
  const consentByContact = new Map<string, string>();
  if (latestPolicyId) {
    const { data: consentRows } = await supabase
      .from("consent_log")
      .select("contact_id, accepted_at, policy_version_id")
      .not("contact_id", "is", null)
      .eq("policy_version_id", latestPolicyId);
    for (const c of consentRows ?? []) {
      if (c.contact_id && !consentByContact.has(c.contact_id)) {
        consentByContact.set(c.contact_id, c.accepted_at);
      }
    }
  }

  const contacts: ContactRow[] = (contactRows ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    whatsapp: c.whatsapp_number,
    email: c.email,
    archivedAt: c.archived_at,
    hasHistory: historyContactIds.has(c.id),
    linkedClients: linksByContact.get(c.id) ?? [],
    consentAccepted: consentByContact.has(c.id),
    consentAcceptedAt: consentByContact.get(c.id) ?? null,
  }));

  return { contacts, clientOptions };
}

function ContatosPage() {
  const session = useCurrentStaff();
  const tenantId = session.status === "ready" ? session.staff.tenantId : null;
  const { clientId } = Route.useSearch();

  const [contacts, setContacts] = useState<ContactRow[] | null>(null);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [multiCnpjOnly, setMultiCnpjOnly] = useState(false);
  const [consentFilter, setConsentFilter] = useState<"todos" | "aceito" | "pendente">("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [roleByClient, setRoleByClient] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [viewTarget, setViewTarget] = useState<ContactRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh() {
    const result = await loadAll();
    setContacts(result.contacts);
    setClientOptions(result.clientOptions);
  }

  useEffect(() => {
    if (tenantId) refresh();
  }, [tenantId]);

  const linkedClientName = clientId
    ? (clientOptions.find((c) => c.id === clientId)?.name ?? null)
    : null;

  const activeContacts = useMemo(() => (contacts ?? []).filter((c) => !c.archivedAt), [contacts]);
  const archivedContacts = useMemo(() => (contacts ?? []).filter((c) => c.archivedAt), [contacts]);

  const totalContacts = activeContacts.length;
  const multiCnpjContacts = activeContacts.filter((c) => c.linkedClients.length > 1).length;
  const acceptedConsentCount = activeContacts.filter((c) => c.consentAccepted).length;
  const consentPercentage =
    totalContacts === 0 ? 0 : Math.round((acceptedConsentCount / totalContacts) * 100);

  const filteredContacts = useMemo(() => {
    const base = showArchived ? archivedContacts : activeContacts;
    const roleRegex = roleFilterOptions.find((r) => r.value === roleFilter)?.regex;
    return base.filter((c) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.whatsapp.includes(query.trim()) ||
        (c.email ?? "").toLowerCase().includes(q);
      const matchesClient = !clientId || c.linkedClients.some((l) => l.id === clientId);
      const matchesRole = !roleRegex || c.linkedClients.some((l) => roleRegex.test(l.roleLabel));
      const matchesMultiCnpj = !multiCnpjOnly || c.linkedClients.length > 1;
      const matchesConsent =
        consentFilter === "todos" ||
        (consentFilter === "aceito" && c.consentAccepted) ||
        (consentFilter === "pendente" && !c.consentAccepted);
      return matchesQuery && matchesClient && matchesRole && matchesMultiCnpj && matchesConsent;
    });
  }, [
    showArchived,
    archivedContacts,
    activeContacts,
    query,
    clientId,
    roleFilter,
    multiCnpjOnly,
    consentFilter,
  ]);

  function toggleClient(id: string, checked: boolean) {
    setSelectedClients((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openCreateDialog() {
    setEditingContact(null);
    setName("");
    setWhatsapp("");
    setEmail("");
    setSelectedClients(new Set(clientId ? [clientId] : []));
    setRoleByClient({});
    setDialogOpen(true);
  }

  function openEditDialog(contact: ContactRow) {
    setEditingContact(contact);
    setName(contact.name);
    setWhatsapp(contact.whatsapp);
    setEmail(contact.email ?? "");
    setSelectedClients(new Set(contact.linkedClients.map((l) => l.id)));
    setRoleByClient(Object.fromEntries(contact.linkedClients.map((l) => [l.id, l.roleLabel])));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!tenantId || !name.trim() || !whatsapp.trim()) return;
    setSaving(true);
    try {
      let contactId = editingContact?.id ?? null;

      if (contactId) {
        const { error } = await supabase
          .from("contacts")
          .update({
            name: name.trim(),
            whatsapp_number: whatsapp.trim(),
            email: email.trim() || null,
          })
          .eq("id", contactId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("contacts")
          .insert({
            tenant_id: tenantId,
            name: name.trim(),
            whatsapp_number: whatsapp.trim(),
            email: email.trim() || null,
          })
          .select("id")
          .single();
        if (error || !data) throw error;
        contactId = data.id;
      }

      const existingLinks = editingContact?.linkedClients ?? [];
      const existingIds = new Set(existingLinks.map((l) => l.id));
      const toRemove = existingLinks.filter((l) => !selectedClients.has(l.id));
      const toAdd = [...selectedClients].filter((id) => !existingIds.has(id));
      const toUpdate = existingLinks.filter(
        (l) => selectedClients.has(l.id) && (roleByClient[l.id] ?? "") !== l.roleLabel,
      );

      const cid = contactId;
      await Promise.all([
        ...toRemove.map((l) =>
          supabase
            .from("client_contact_links")
            .delete()
            .eq("client_id", l.id)
            .eq("contact_id", cid),
        ),
        ...toAdd.map((id) =>
          supabase
            .from("client_contact_links")
            .insert({ client_id: id, contact_id: cid, role_label: roleByClient[id] ?? "" }),
        ),
        ...toUpdate.map((l) =>
          supabase
            .from("client_contact_links")
            .update({ role_label: roleByClient[l.id] ?? "" })
            .eq("client_id", l.id)
            .eq("contact_id", cid),
        ),
      ]);

      toast.success(editingContact ? "Contato atualizado." : "Contato criado.");
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      toast.error(
        code === "23505"
          ? "Já existe um contato com esse WhatsApp."
          : "Não foi possível salvar o contato.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(contact: ContactRow) {
    setDeleting(true);
    const { error } = await supabase
      .from("contacts")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", contact.id);
    setDeleting(false);
    if (error) {
      toast.error("Não foi possível arquivar o contato.");
      return;
    }
    toast.success("Contato arquivado. Histórico de conversas e consentimento foram preservados.");
    setDeleteTarget(null);
    await refresh();
  }

  async function handleDelete(contact: ContactRow) {
    setDeleting(true);
    const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
    setDeleting(false);
    if (error) {
      toast.error("Não foi possível excluir o contato.");
      return;
    }
    toast.success("Contato excluído.");
    setDeleteTarget(null);
    await refresh();
  }

  async function handleReactivate(contact: ContactRow) {
    const { error } = await supabase
      .from("contacts")
      .update({ archived_at: null })
      .eq("id", contact.id);
    if (error) {
      toast.error("Não foi possível reativar o contato.");
      return;
    }
    toast.success("Contato reativado.");
    await refresh();
  }

  function openWhatsapp(contact: ContactRow) {
    window.open(
      `https://wa.me/${whatsappDigits(contact.whatsapp)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const isLoading = contacts === null;

  return (
    <AppShell
      title="Contatos"
      description={isLoading ? undefined : `${totalContacts} contatos ativos na base`}
    >
      {clientId && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link
            to="/clientes/$clienteId"
            params={{ clienteId: clientId }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Voltar para {linkedClientName ?? "o cliente"}
          </Link>
          <Badge variant="secondary" className="gap-1 font-normal">
            Filtrando por {linkedClientName ?? "cliente"}
            <Link to="/contatos" aria-label="Limpar filtro de cliente">
              <X className="size-3" />
            </Link>
          </Badge>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <Button
            size="icon"
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            className="size-8"
            aria-label="Visualização em grade"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            className="size-8"
            aria-label="Visualização em lista"
            onClick={() => setViewMode("list")}
          >
            <List className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showArchived ? "secondary" : "outline"}
            onClick={() => setShowArchived((v) => !v)}
          >
            <Archive /> {showArchived ? "Ver ativos" : "Ver arquivados"}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus /> Novo contato
          </Button>
        </div>
      </div>

      {!showArchived && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Total de contatos" value={totalContacts} icon={Users} />
          <StatCard
            label="Vinculados a mais de um CNPJ"
            value={multiCnpjContacts}
            icon={Building2}
            tone="warning"
          />
          <StatCard
            label="Consentimento LGPD aceito"
            value={`${consentPercentage}%`}
            hint={`${acceptedConsentCount} de ${totalContacts} contatos`}
            icon={ShieldCheck}
            tone="success"
          />
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, WhatsApp ou e-mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
              <SelectValue placeholder="Função" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as funções</SelectItem>
              {roleFilterOptions.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={consentFilter}
            onValueChange={(v) => setConsentFilter(v as "todos" | "aceito" | "pendente")}
          >
            <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
              <SelectValue placeholder="Consentimento LGPD" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Consentimento: todos</SelectItem>
              <SelectItem value="aceito">Consentimento aceito</SelectItem>
              <SelectItem value="pendente">Consentimento pendente</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() => setMultiCnpjOnly((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              multiCnpjOnly
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-foreground hover:bg-accent",
            )}
          >
            Multi-CNPJ apenas
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <EmptyState
          icon={ContactIcon}
          title={showArchived ? "Nenhum contato arquivado" : "Nenhum contato encontrado"}
          description={
            showArchived
              ? "Contatos arquivados aparecem aqui e podem ser reativados a qualquer momento."
              : "Tente ajustar a busca ou os filtros, ou cadastre um novo contato."
          }
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => (
            <div key={contact.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-secondary text-xs font-semibold">
                      {contact.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{primaryRole(contact)}</p>
                  </div>
                </div>
                {contact.linkedClients.length > 1 && (
                  <Badge variant="secondary" className="shrink-0 font-normal">
                    {contact.linkedClients.length} CNPJs
                  </Badge>
                )}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-mono">{contact.whatsapp}</p>
                {contact.email && (
                  <p className="flex items-center gap-1">
                    <Mail className="size-3" /> {contact.email}
                  </p>
                )}
              </div>

              {contact.linkedClients.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-2 text-xs">
                  <p className="font-medium text-foreground">Vínculos:</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {contact.linkedClients.map((l) => l.name).join(", ")}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs">
                {contact.consentAccepted ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <ShieldCheck className="size-3.5" /> LGPD aceito
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <ShieldAlert className="size-3.5" /> LGPD pendente
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => openWhatsapp(contact)}
                >
                  <MessageSquare className="size-3.5" /> Abrir no chat
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setViewTarget(contact)}
                >
                  <Eye className="size-3.5" /> Ver ficha
                </Button>
                {!contact.archivedAt ? (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground"
                      aria-label="Editar contato"
                      onClick={() => openEditDialog(contact)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label="Arquivar ou excluir contato"
                      onClick={() => setDeleteTarget(contact)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => handleReactivate(contact)}
                  >
                    <ArchiveRestore className="size-3.5" /> Reativar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Vínculos</TableHead>
                <TableHead>LGPD</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{primaryRole(contact)}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {contact.whatsapp}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {contact.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    {contact.linkedClients.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary" className="font-normal">
                          {contact.linkedClients.length === 1
                            ? contact.linkedClients[0]?.name
                            : `${contact.linkedClients.length} CNPJs`}
                        </Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.consentAccepted ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success">
                        <ShieldCheck className="size-3.5" /> Aceito
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldAlert className="size-3.5" /> Pendente
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label="Abrir no WhatsApp"
                        onClick={() => openWhatsapp(contact)}
                      >
                        <MessageSquare className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label="Ver ficha"
                        onClick={() => setViewTarget(contact)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      {!contact.archivedAt ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="Editar contato"
                            onClick={() => openEditDialog(contact)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label="Arquivar ou excluir contato"
                            onClick={() => setDeleteTarget(contact)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label="Reativar contato"
                          onClick={() => handleReactivate(contact)}
                        >
                          <ArchiveRestore className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Criar / editar contato */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar contato" : "Novo contato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block text-sm">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">WhatsApp</Label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+55 11 90000-0000"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">E-mail (opcional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Vinculado às empresas</Label>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {clientOptions.map((opt) => {
                  const checked = selectedClients.has(opt.id);
                  return (
                    <div key={opt.id} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`client-${opt.id}`}
                          checked={checked}
                          onCheckedChange={(v) => toggleClient(opt.id, v === true)}
                        />
                        <Label
                          htmlFor={`client-${opt.id}`}
                          className="cursor-pointer text-sm font-normal"
                        >
                          {opt.name}{" "}
                          <span className="text-xs text-muted-foreground">({opt.cnpj})</span>
                        </Label>
                      </div>
                      {checked && (
                        <Input
                          className="ml-6 h-8 text-xs"
                          placeholder="Papel (ex: Sócio, Financeiro)"
                          value={roleByClient[opt.id] ?? ""}
                          onChange={(e) =>
                            setRoleByClient((prev) => ({ ...prev, [opt.id]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>
                O consentimento LGPD é somente leitura aqui — é registrado automaticamente quando o
                contato aceita pelo WhatsApp, o único canal válido para essa confirmação.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!name.trim() || !whatsapp.trim() || saving} onClick={handleSave}>
              {saving ? "Salvando…" : editingContact ? "Salvar alterações" : "Criar contato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ver ficha do contato */}
      <Dialog open={viewTarget !== null} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewTarget?.name}</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4 py-2 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">WhatsApp</p>
                <p className="font-mono text-foreground">{viewTarget.whatsapp}</p>
              </div>
              {viewTarget.email && (
                <div className="space-y-1">
                  <p className="text-muted-foreground">E-mail</p>
                  <p className="text-foreground">{viewTarget.email}</p>
                </div>
              )}
              <div className="space-y-1">
                <p className="text-muted-foreground">Consentimento LGPD</p>
                {viewTarget.consentAccepted ? (
                  <p className="inline-flex items-center gap-1.5 text-success">
                    <ShieldCheck className="size-4" /> Aceito
                    {viewTarget.consentAcceptedAt &&
                      ` em ${new Date(viewTarget.consentAcceptedAt).toLocaleDateString("pt-BR")}`}
                  </p>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <ShieldAlert className="size-4" /> Pendente
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-muted-foreground">Empresas vinculadas</p>
                {viewTarget.linkedClients.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum vínculo ativo.</p>
                ) : (
                  <ul className="space-y-2">
                    {viewTarget.linkedClients.map((l) => (
                      <li key={l.id} className="rounded-lg border border-border p-2.5">
                        <p className="font-medium text-foreground">{l.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.cnpj} · {l.roleLabel || "Sem função definida"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Arquivar / excluir contato */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.hasHistory ? "Arquivar contato" : "Excluir contato"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.hasHistory
                ? "Este contato já tem conversas registradas, então não pode ser excluído — apenas arquivado. O histórico de conversas e o consentimento LGPD ficam preservados, e o contato deixa de aparecer nas listagens e vínculos ativos."
                : "Este contato ainda não tem nenhuma conversa registrada. A exclusão é definitiva e remove todos os vínculos com empresas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={() =>
                deleteTarget &&
                (deleteTarget.hasHistory ? handleArchive(deleteTarget) : handleDelete(deleteTarget))
              }
            >
              {deleteTarget?.hasHistory ? "Arquivar" : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
