import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Building,
  Contact as ContactIcon,
  Edit2,
  FileText,
  Info,
  LayoutGrid,
  Layers,
  List,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
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
  DialogDescription,
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
  component: ContatosPage,
});

// Papéis mais comuns — role_label continua sendo texto livre no banco
// (client_contact_links.role_label), esta lista é só um atalho de UI.
const roleOptions = [
  "Sócio-Administrador",
  "Gerente Financeiro",
  "Gestor de DP/RH",
  "Procurador/Advogado",
  "Titular/Proprietário",
  "Lead/Prospect",
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

function ContatosPage() {
  const session = useCurrentStaff();
  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  const [contacts, setContacts] = useState<ContactRow[] | null>(null);
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "socio" | "financeiro" | "dp">("all");
  const [multiCnpjOnly, setMultiCnpjOnly] = useState(false);
  const [consentFilter, setConsentFilter] = useState<"all" | "accepted" | "pending">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null);
  const [viewingContact, setViewingContact] = useState<ContactRow | null>(null);
  const [deletingContact, setDeletingContact] = useState<ContactRow | null>(null);

  const [formName, setFormName] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState(roleOptions[0]!);
  const [formClientIds, setFormClientIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    if (!tenantId) return;

    const [{ data: contactRows }, { data: linkRows }, { data: clientRows }, { data: staffRows }] =
      await Promise.all([
        supabase.from("contacts").select("id, name, whatsapp_number, email").order("name"),
        supabase
          .from("client_contact_links")
          .select("contact_id, role_label, clients(id, name, cnpj, tax_regime)"),
        supabase
          .from("clients")
          .select("id, name, cnpj, tax_regime, responsible_staff_id")
          .order("name"),
        supabase.from("staff").select("id, name"),
      ]);

    const staffNames = new Map((staffRows ?? []).map((s) => [s.id, s.name]));
    setClientOptions(
      (clientRows ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
        taxRegime: c.tax_regime,
        responsibleStaffName: c.responsible_staff_id
          ? (staffNames.get(c.responsible_staff_id) ?? null)
          : null,
      })),
    );

    const linksByContact = new Map<string, LinkedClient[]>();
    for (const link of linkRows ?? []) {
      const client = link.clients as unknown as {
        id: string;
        name: string;
        cnpj: string;
        tax_regime: string;
      } | null;
      if (!client) continue;
      const list = linksByContact.get(link.contact_id) ?? [];
      list.push({
        id: client.id,
        name: client.name,
        cnpj: client.cnpj,
        taxRegime: client.tax_regime,
        roleLabel: link.role_label,
      });
      linksByContact.set(link.contact_id, list);
    }

    const contactIds = (contactRows ?? []).map((c) => c.id);
    const consentByContact = new Map<string, { policyVersionId: string; acceptedAt: string }>();
    let currentPolicyId: string | null = null;
    if (contactIds.length > 0) {
      const [{ data: policyRows }, { data: consentRows }] = await Promise.all([
        supabase
          .from("consent_policy_versions")
          .select("id, version_number")
          .order("version_number", { ascending: false })
          .limit(1),
        supabase
          .from("consent_log")
          .select("contact_id, policy_version_id, accepted_at")
          .in("contact_id", contactIds)
          .order("accepted_at", { ascending: false }),
      ]);
      currentPolicyId = policyRows?.[0]?.id ?? null;
      for (const row of consentRows ?? []) {
        if (!row.contact_id || consentByContact.has(row.contact_id)) continue;
        consentByContact.set(row.contact_id, {
          policyVersionId: row.policy_version_id,
          acceptedAt: row.accepted_at,
        });
      }
    }

    setContacts(
      (contactRows ?? []).map((c) => {
        const latestConsent = consentByContact.get(c.id);
        const consentAccepted = Boolean(
          latestConsent && currentPolicyId && latestConsent.policyVersionId === currentPolicyId,
        );
        return {
          id: c.id,
          name: c.name,
          whatsapp: c.whatsapp_number,
          email: c.email,
          linkedClients: linksByContact.get(c.id) ?? [],
          consentAccepted,
          consentAcceptedAt: consentAccepted ? (latestConsent?.acceptedAt ?? null) : null,
        };
      }),
    );
  }

  useEffect(() => {
    if (tenantId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  function resetForm() {
    setFormName("");
    setFormWhatsapp("");
    setFormEmail("");
    setFormRole(roleOptions[0]!);
    setFormClientIds([]);
    setEditingContact(null);
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(contact: ContactRow) {
    setEditingContact(contact);
    setFormName(contact.name);
    setFormWhatsapp(contact.whatsapp);
    setFormEmail(contact.email ?? "");
    setFormRole(contact.linkedClients[0]?.roleLabel || roleOptions[0]!);
    setFormClientIds(contact.linkedClients.map((c) => c.id));
    setFormOpen(true);
  }

  function toggleClient(clientId: string) {
    setFormClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId || !formName.trim() || !formWhatsapp.trim()) return;
    setSaving(true);
    try {
      if (editingContact) {
        const { error } = await supabase
          .from("contacts")
          .update({
            name: formName.trim(),
            whatsapp_number: formWhatsapp.trim(),
            email: formEmail.trim() || null,
          })
          .eq("id", editingContact.id);
        if (error) {
          toast.error(
            error.code === "23505"
              ? "Já existe um contato com esse WhatsApp."
              : "Não foi possível salvar o contato.",
          );
          return;
        }

        const currentIds = new Set(editingContact.linkedClients.map((c) => c.id));
        const desiredIds = new Set(formClientIds);
        const toAdd = formClientIds.filter((id) => !currentIds.has(id));
        const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));

        if (toAdd.length > 0) {
          await supabase.from("client_contact_links").insert(
            toAdd.map((clientId) => ({
              client_id: clientId,
              contact_id: editingContact.id,
              role_label: formRole,
            })),
          );
        }
        if (toRemove.length > 0) {
          await supabase
            .from("client_contact_links")
            .delete()
            .eq("contact_id", editingContact.id)
            .in("client_id", toRemove);
        }
        toast.success("Contato atualizado.");
      } else {
        const { data: newContact, error } = await supabase
          .from("contacts")
          .insert({
            tenant_id: tenantId,
            name: formName.trim(),
            whatsapp_number: formWhatsapp.trim(),
            email: formEmail.trim() || null,
          })
          .select("id")
          .single();
        if (error || !newContact) {
          toast.error(
            error?.code === "23505"
              ? "Já existe um contato com esse WhatsApp."
              : "Não foi possível criar o contato.",
          );
          return;
        }
        if (formClientIds.length > 0) {
          await supabase.from("client_contact_links").insert(
            formClientIds.map((clientId) => ({
              client_id: clientId,
              contact_id: newContact.id,
              role_label: formRole,
            })),
          );
        }
        toast.success("Contato criado.");
      }
      setFormOpen(false);
      resetForm();
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingContact) return;
    const { error } = await supabase.from("contacts").delete().eq("id", deletingContact.id);
    if (error) {
      toast.error("Não foi possível remover o contato.");
      return;
    }
    toast.success("Contato removido.");
    setDeletingContact(null);
    if (viewingContact?.id === deletingContact.id) setViewingContact(null);
    await loadAll();
  }

  function openWhatsapp(contact: ContactRow) {
    const digits = whatsappDigits(contact.whatsapp);
    window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
  }

  // Métricas
  const totalContacts = contacts?.length ?? 0;
  const multiCnpjContacts = useMemo(
    () => (contacts ?? []).filter((c) => c.linkedClients.length > 1),
    [contacts],
  );
  const acceptedConsentCount = (contacts ?? []).filter((c) => c.consentAccepted).length;
  const consentPercentage =
    totalContacts > 0 ? Math.round((acceptedConsentCount / totalContacts) * 100) : 100;

  const filteredContacts = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (contacts ?? []).filter((c) => {
      const matchesQuery =
        q === "" ||
        c.name.toLowerCase().includes(q) ||
        c.whatsapp.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        c.linkedClients.some((cli) => cli.name.toLowerCase().includes(q) || cli.cnpj.includes(q));
      if (!matchesQuery) return false;

      if (roleFilter !== "all") {
        const role = primaryRole(c).toLowerCase();
        if (roleFilter === "socio" && !/(sócio|proprietário|titular|ceo)/.test(role)) return false;
        if (roleFilter === "financeiro" && !/(finan|pagar)/.test(role)) return false;
        if (roleFilter === "dp" && !/(rh|pessoal|dp)/.test(role)) return false;
      }

      if (multiCnpjOnly && c.linkedClients.length <= 1) return false;
      if (consentFilter !== "all") {
        const status = c.consentAccepted ? "accepted" : "pending";
        if (status !== consentFilter) return false;
      }
      return true;
    });
  }, [contacts, query, roleFilter, multiCnpjOnly, consentFilter]);

  return (
    <AppShell
      title="Sócios & Contatos"
      description="Gestão unificada de titulares, sócios e gestores, com vínculo multi-CNPJ e status de consentimento LGPD"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Sócios & Contatos</h2>
          <Badge variant="outline" className="gap-1">
            <Users className="size-3.5" />
            {totalContacts} contatos
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              className="h-8 gap-1.5 text-xs"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="size-3.5" /> Cards
            </Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="h-8 gap-1.5 text-xs"
              onClick={() => setViewMode("list")}
            >
              <List className="size-3.5" /> Lista
            </Button>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus /> Novo contato
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total de contatos" value={totalContacts} icon={Users} tone="primary" />
        <StatCard
          label="Multi-CNPJ"
          value={multiCnpjContacts.length}
          icon={Layers}
          tone="primary"
          hint="Contatos com mais de 1 empresa vinculada"
        />
        <StatCard
          label="Conformidade LGPD"
          value={`${consentPercentage}%`}
          icon={ShieldCheck}
          tone="success"
          hint={`${acceptedConsentCount} consentimentos aceitos`}
        />
        <StatCard
          label="Canal WhatsApp"
          value="100%"
          icon={Phone}
          tone="success"
          hint="Todo contato tem WhatsApp"
        />
      </div>

      <div className="mb-4 flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-3.5 md:flex-row md:justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, WhatsApp, e-mail ou empresa..."
            className="h-9 pl-9"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-2.5 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
            <SelectTrigger className="h-8 w-auto text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as funções</SelectItem>
              <SelectItem value="socio">Sócios/Administradores</SelectItem>
              <SelectItem value="financeiro">Financeiro/Contas a pagar</SelectItem>
              <SelectItem value="dp">RH/DP</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={consentFilter}
            onValueChange={(v) => setConsentFilter(v as typeof consentFilter)}
          >
            <SelectTrigger className="h-8 w-auto text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status LGPD</SelectItem>
              <SelectItem value="accepted">LGPD autorizado</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={multiCnpjOnly ? "default" : "outline"}
            className="h-8 gap-1.5 text-xs"
            onClick={() => setMultiCnpjOnly((v) => !v)}
          >
            <Layers className="size-3.5" /> Apenas multi-CNPJ ({multiCnpjContacts.length})
          </Button>
        </div>
      </div>

      {contacts === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      ) : filteredContacts.length === 0 ? (
        <EmptyState
          icon={ContactIcon}
          title="Nenhum contato encontrado"
          description="Tente ajustar os filtros ou os termos da pesquisa."
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex flex-col justify-between gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                        {contact.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">{contact.name}</p>
                      <Badge variant="outline" className="mt-0.5 text-[11px] font-normal">
                        {primaryRole(contact)}
                      </Badge>
                    </div>
                  </div>
                  {contact.linkedClients.length > 1 && (
                    <Badge className="gap-1 border border-primary/20 bg-primary/10 text-[10px] text-primary">
                      <Layers className="size-3" /> {contact.linkedClients.length} CNPJs
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 font-mono text-foreground">
                    <Phone className="size-3.5 shrink-0 text-success" />
                    {contact.whatsapp}
                  </div>
                  {contact.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="size-3.5 shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-border pt-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Empresas vinculadas ({contact.linkedClients.length})
                  </p>
                  {contact.linkedClients.length === 0 ? (
                    <div className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning-foreground">
                      <Info className="size-3.5 shrink-0" />
                      Sem empresa vinculada ainda.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {contact.linkedClients.map((cli) => (
                        <div
                          key={cli.id}
                          className="rounded-lg border border-border bg-muted/40 p-2 text-xs"
                        >
                          <p className="flex items-center gap-1 truncate font-medium text-foreground">
                            <Building className="size-3 shrink-0 text-primary" />
                            {cli.name}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {cli.cnpj} · {cli.taxRegime}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-2 text-[11px]",
                    contact.consentAccepted
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-warning/30 bg-warning/10 text-warning-foreground",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5" />
                    LGPD: {contact.consentAccepted ? "Conforme" : "Pendente"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 border-t border-border pt-3">
                <Button
                  size="sm"
                  className="h-8 flex-1 gap-1.5 bg-[#00a884] text-xs text-white hover:bg-[#008f6f]"
                  onClick={() => openWhatsapp(contact)}
                >
                  <MessageSquare className="size-3.5" /> Abrir no chat
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Ver ficha"
                  onClick={() => setViewingContact(contact)}
                >
                  <FileText className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Editar"
                  onClick={() => openEdit(contact)}
                >
                  <Edit2 className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  aria-label="Excluir"
                  onClick={() => setDeletingContact(contact)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>WhatsApp / E-mail</TableHead>
                  <TableHead>Empresas vinculadas</TableHead>
                  <TableHead>Status LGPD</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <button
                        className="flex items-center gap-3 text-left"
                        onClick={() => setViewingContact(contact)}
                      >
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {contact.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-foreground hover:text-primary">
                          {contact.name}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] font-normal">
                        {primaryRole(contact)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 font-mono text-foreground">
                          <Phone className="size-3 shrink-0 text-success" />
                          {contact.whatsapp}
                        </div>
                        {contact.email && (
                          <div className="truncate text-muted-foreground">{contact.email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.linkedClients.length === 0 ? (
                        <span className="text-xs italic text-muted-foreground">Sem vínculo</span>
                      ) : (
                        <div className="max-w-[240px] space-y-1">
                          {contact.linkedClients.slice(0, 2).map((cli) => (
                            <p key={cli.id} className="truncate text-xs text-foreground">
                              {cli.name}
                            </p>
                          ))}
                          {contact.linkedClients.length > 2 && (
                            <button
                              className="text-[11px] font-medium text-primary hover:underline"
                              onClick={() => setViewingContact(contact)}
                            >
                              +{contact.linkedClients.length - 2} empresas
                            </button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-[11px] font-normal",
                          contact.consentAccepted
                            ? "border border-success/30 bg-success/15 text-success"
                            : "border border-warning/40 bg-warning/20 text-warning-foreground",
                        )}
                      >
                        {contact.consentAccepted ? "LGPD autorizado" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-success"
                          aria-label="Abrir no chat"
                          onClick={() => openWhatsapp(contact)}
                        >
                          <MessageSquare className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label="Editar"
                          onClick={() => openEdit(contact)}
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label="Excluir"
                          onClick={() => setDeletingContact(contact)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Modal: criar/editar contato */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? "Editar contato" : "Cadastrar novo contato"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Carlos Eduardo Silva"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>WhatsApp (com DDD)</Label>
                <Input
                  required
                  value={formWhatsapp}
                  onChange={(e) => setFormWhatsapp(e.target.value)}
                  placeholder="+55 41 99123-4567"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Função/cargo principal</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>E-mail (opcional)</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="carlos@empresa.com.br"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3.5">
              <Label>Vincular empresas (multi-CNPJ)</Label>
              <p className="text-xs text-muted-foreground">
                Selecione as empresas que este contato pode representar.
              </p>
              <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                {clientOptions.map((client) => {
                  const checked = formClientIds.includes(client.id);
                  return (
                    <label
                      key={client.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 text-xs transition-colors",
                        checked
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleClient(client.id)} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{client.name}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {client.cnpj} · {client.taxRegime}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />O consentimento LGPD é registrado
              automaticamente quando o próprio contato aceita pelo WhatsApp — não é possível
              marcá-lo manualmente aqui.
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {editingContact ? "Salvar alterações" : "Criar contato"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: ficha completa do contato */}
      <Dialog open={!!viewingContact} onOpenChange={(open) => !open && setViewingContact(null)}>
        {viewingContact && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
                    {viewingContact.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle>{viewingContact.name}</DialogTitle>
                  <DialogDescription>{primaryRole(viewingContact)}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="space-y-1.5 rounded-xl bg-muted/30 p-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WhatsApp:</span>
                  <span className="font-mono font-medium text-foreground">
                    {viewingContact.whatsapp}
                  </span>
                </div>
                {viewingContact.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">E-mail:</span>
                    <span className="font-medium text-foreground">{viewingContact.email}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status LGPD:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      viewingContact.consentAccepted ? "text-success" : "text-warning-foreground",
                    )}
                  >
                    {viewingContact.consentAccepted
                      ? `Aceito em ${new Date(viewingContact.consentAcceptedAt!).toLocaleDateString("pt-BR")}`
                      : "Pendente"}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-1.5 font-semibold text-foreground">
                  <Building className="size-4 text-primary" />
                  Empresas vinculadas ({viewingContact.linkedClients.length})
                </h4>
                <div className="space-y-2">
                  {viewingContact.linkedClients.map((cli) => {
                    const clientOption = clientOptions.find((c) => c.id === cli.id);
                    return (
                      <div
                        key={cli.id}
                        className="rounded-xl border border-primary/20 bg-primary/5 p-2.5"
                      >
                        <div className="font-semibold text-foreground">{cli.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          CNPJ: {cli.cnpj}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Regime: <strong className="text-foreground">{cli.taxRegime}</strong>
                          </span>
                          {clientOption?.responsibleStaffName && (
                            <span>
                              Responsável:{" "}
                              <strong className="text-foreground">
                                {clientOption.responsibleStaffName}
                              </strong>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {viewingContact.linkedClients.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma empresa vinculada ainda.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingContact(null)}>
                Fechar
              </Button>
              <Button
                className="gap-1.5 bg-[#00a884] text-white hover:bg-[#008f6f]"
                onClick={() => openWhatsapp(viewingContact)}
              >
                <MessageSquare className="size-3.5" /> Conversar no chat
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={!!deletingContact}
        onOpenChange={(open) => !open && setDeletingContact(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {deletingContact?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove o contato e todos os vínculos com empresas dele. Essa ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
