import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileUp,
  Link2,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { CopilotWidget } from "@/components/common/copilot-widget";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { supabase } from "@/integrations/supabase/client";
import type { DocStatus } from "@/lib/mock-data";

export const Route = createFileRoute("/clientes/$clienteId")({
  component: ClienteDetalhePage,
});

type Periodicity = "mensal" | "trimestral" | "anual" | "sob_demanda";

interface ClientInfo {
  id: string;
  name: string;
  cnpj: string;
  taxRegime: string;
  whatsappNumber: string;
  notes: string;
}

interface DocConfigRow {
  id: string;
  name: string;
  periodicity: Periodicity;
  enabled: boolean;
  nextDueDate: string | null;
  lastSubmittedAt: string | null;
}

interface CatalogItem {
  id: string;
  name: string;
  defaultPeriodicity: Periodicity;
}

interface ContactRow {
  contactId: string;
  name: string;
  whatsapp: string;
  roleLabel: string;
  otherClients: string[];
}

function docConfigStatus(config: { enabled: boolean; nextDueDate: string | null }): DocStatus {
  if (!config.enabled || !config.nextDueDate) return "em_dia";
  const today = new Date();
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 7);
  const due = new Date(config.nextDueDate);
  if (due < today) return "atrasado";
  if (due <= soon) return "pendente";
  return "em_dia";
}

function ClienteDetalhePage() {
  const { clienteId } = Route.useParams();
  const session = useCurrentStaff();
  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [configs, setConfigs] = useState<DocConfigRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contexto, setContexto] = useState("");
  const [savingDocs, setSavingDocs] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const [addDocOpen, setAddDocOpen] = useState(false);
  const [newDocCatalogId, setNewDocCatalogId] = useState<string>("custom");
  const [newDocName, setNewDocName] = useState("");
  const [newDocPeriodicity, setNewDocPeriodicity] = useState<Periodicity>("mensal");

  const [linkOpen, setLinkOpen] = useState(false);
  const [searchContato, setSearchContato] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; name: string; whatsapp: string }[]
  >([]);
  const [newContactMode, setNewContactMode] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactWhatsapp, setNewContactWhatsapp] = useState("");
  const [roleLabel, setRoleLabel] = useState("");

  async function loadAll() {
    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("id, name, cnpj, tax_regime, whatsapp_number, notes")
      .eq("id", clienteId)
      .maybeSingle();

    if (clientError || !clientRow) {
      setNotFound(true);
      return;
    }

    setClient({
      id: clientRow.id,
      name: clientRow.name,
      cnpj: clientRow.cnpj,
      taxRegime: clientRow.tax_regime,
      whatsappNumber: clientRow.whatsapp_number,
      notes: clientRow.notes,
    });
    setContexto(clientRow.notes);

    const [{ data: configRows }, { data: catalogRows }, { data: linkRows }] = await Promise.all([
      supabase
        .from("client_document_config")
        .select("id, name, periodicity, enabled, next_due_date")
        .eq("client_id", clienteId)
        .order("created_at"),
      tenantId
        ? supabase
            .from("document_catalog")
            .select("id, name, default_periodicity")
            .eq("tenant_id", tenantId)
            .order("name")
        : Promise.resolve({
            data: [] as { id: string; name: string; default_periodicity: string }[],
          }),
      supabase
        .from("client_contact_links")
        .select("contact_id, role_label, contacts(id, name, whatsapp_number)")
        .eq("client_id", clienteId),
    ]);

    const configIds = (configRows ?? []).map((c) => c.id);
    const submissionsByConfig = new Map<string, string>();
    if (configIds.length > 0) {
      const { data: submissions } = await supabase
        .from("document_submissions")
        .select("client_document_config_id, submitted_at")
        .in("client_document_config_id", configIds)
        .order("submitted_at", { ascending: false });
      for (const s of submissions ?? []) {
        if (!submissionsByConfig.has(s.client_document_config_id)) {
          submissionsByConfig.set(s.client_document_config_id, s.submitted_at);
        }
      }
    }

    setConfigs(
      (configRows ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        periodicity: c.periodicity as Periodicity,
        enabled: c.enabled,
        nextDueDate: c.next_due_date,
        lastSubmittedAt: submissionsByConfig.get(c.id) ?? null,
      })),
    );

    setCatalog(
      (catalogRows ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        defaultPeriodicity: c.default_periodicity as Periodicity,
      })),
    );

    const linkedContactIds = (linkRows ?? []).map((l) => l.contact_id);
    const otherLinksByContact = new Map<string, string[]>();
    if (linkedContactIds.length > 0) {
      const { data: otherLinks } = await supabase
        .from("client_contact_links")
        .select("contact_id, clients(id, name)")
        .in("contact_id", linkedContactIds)
        .neq("client_id", clienteId);
      for (const l of otherLinks ?? []) {
        const list = otherLinksByContact.get(l.contact_id) ?? [];
        const clientRel = l.clients as unknown as { name: string } | null;
        if (clientRel?.name) list.push(clientRel.name);
        otherLinksByContact.set(l.contact_id, list);
      }
    }

    setContacts(
      (linkRows ?? []).map((l) => {
        const contact = l.contacts as unknown as {
          id: string;
          name: string;
          whatsapp_number: string;
        } | null;
        return {
          contactId: l.contact_id,
          name: contact?.name ?? "—",
          whatsapp: contact?.whatsapp_number ?? "",
          roleLabel: l.role_label,
          otherClients: otherLinksByContact.get(l.contact_id) ?? [],
        };
      }),
    );
  }

  useEffect(() => {
    if (tenantId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, clienteId]);

  async function salvarDocumentos() {
    setSavingDocs(true);
    const results = await Promise.all(
      configs.map((c) =>
        supabase
          .from("client_document_config")
          .update({ enabled: c.enabled, periodicity: c.periodicity, next_due_date: c.nextDueDate })
          .eq("id", c.id),
      ),
    );
    setSavingDocs(false);
    if (results.some((r) => r.error)) {
      toast.error("Algum documento não foi salvo. Tente novamente.");
      return;
    }
    toast.success("Documentos salvos com sucesso.");
  }

  async function marcarRecebido(configId: string) {
    if (!tenantId) return;
    const { error } = await supabase
      .from("document_submissions")
      .insert({ tenant_id: tenantId, client_document_config_id: configId });
    if (error) {
      toast.error("Não foi possível registrar o recebimento.");
      return;
    }
    toast.success("Documento marcado como recebido.");
    await loadAll();
  }

  async function removerDocumento(configId: string) {
    const { error } = await supabase.from("client_document_config").delete().eq("id", configId);
    if (error) {
      toast.error("Não foi possível remover o documento.");
      return;
    }
    setConfigs((prev) => prev.filter((c) => c.id !== configId));
  }

  async function adicionarDocumento() {
    if (!tenantId) return;
    const catalogItem = catalog.find((c) => c.id === newDocCatalogId);
    const name = catalogItem?.name ?? newDocName.trim();
    if (!name) return;

    const { error } = await supabase.from("client_document_config").insert({
      tenant_id: tenantId,
      client_id: clienteId,
      catalog_id: catalogItem?.id ?? null,
      name,
      periodicity: newDocPeriodicity,
    });
    if (error) {
      toast.error("Não foi possível adicionar o documento.");
      return;
    }
    setAddDocOpen(false);
    setNewDocCatalogId("custom");
    setNewDocName("");
    setNewDocPeriodicity("mensal");
    await loadAll();
  }

  async function salvarContexto() {
    setSavingNotes(true);
    const { error } = await supabase
      .from("clients")
      .update({ notes: contexto })
      .eq("id", clienteId);
    setSavingNotes(false);
    if (error) {
      toast.error("Não foi possível salvar o contexto.");
      return;
    }
    toast.success("Contexto salvo com sucesso.");
  }

  async function buscarContatos(term: string) {
    setSearchContato(term);
    if (!term || !tenantId) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from("contacts")
      .select("id, name, whatsapp_number")
      .or(`name.ilike.%${term}%,whatsapp_number.ilike.%${term}%`)
      .limit(10);
    setSearchResults(
      (data ?? []).map((d) => ({ id: d.id, name: d.name, whatsapp: d.whatsapp_number })),
    );
  }

  async function vincularContatoExistente(contactId: string) {
    const { error } = await supabase
      .from("client_contact_links")
      .insert({ client_id: clienteId, contact_id: contactId, role_label: roleLabel || "Contato" });
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Esse contato já está vinculado."
          : "Não foi possível vincular o contato.",
      );
      return;
    }
    toast.success("Contato vinculado a este cliente.");
    closeLinkDialog();
    await loadAll();
  }

  async function criarENovoContato() {
    if (!tenantId || !newContactName || !newContactWhatsapp) return;
    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({ tenant_id: tenantId, name: newContactName, whatsapp_number: newContactWhatsapp })
      .select("id")
      .single();
    if (error || !contact) {
      toast.error(
        error?.code === "23505"
          ? "Já existe um contato com esse WhatsApp."
          : "Não foi possível criar o contato.",
      );
      return;
    }
    await vincularContatoExistente(contact.id);
  }

  function closeLinkDialog() {
    setLinkOpen(false);
    setSearchContato("");
    setSearchResults([]);
    setNewContactMode(false);
    setNewContactName("");
    setNewContactWhatsapp("");
    setRoleLabel("");
  }

  if (notFound) {
    return (
      <AppShell title="Cliente não encontrado">
        <EmptyState
          icon={Building2}
          title="Cliente não encontrado"
          description="Ele pode ter sido removido."
        />
      </AppShell>
    );
  }

  if (!client) {
    return (
      <AppShell title="Carregando…">
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={client.name} description={client.cnpj}>
      <Link
        to="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para clientes
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-5">
        <Avatar className="size-12">
          <AvatarFallback className="bg-primary/10 text-base font-semibold text-primary">
            {client.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-foreground">{client.name}</h2>
          <p className="text-sm text-muted-foreground">
            {client.cnpj} · {client.taxRegime} · {client.whatsappNumber}
          </p>
        </div>
      </div>

      <Tabs defaultValue="documentos">
        <TabsList>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="contexto">Contexto/Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="documentos" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog open={addDocOpen} onOpenChange={setAddDocOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus /> Adicionar documento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar documento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label className="mb-1.5 block text-sm">Tipo de documento</Label>
                    <Select value={newDocCatalogId} onValueChange={setNewDocCatalogId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Personalizado…</SelectItem>
                        {catalog.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newDocCatalogId === "custom" && (
                    <div>
                      <Label className="mb-1.5 block text-sm">Nome do documento</Label>
                      <Input value={newDocName} onChange={(e) => setNewDocName(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <Label className="mb-1.5 block text-sm">Periodicidade</Label>
                    <Select
                      value={newDocPeriodicity}
                      onValueChange={(v) => setNewDocPeriodicity(v as Periodicity)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                        <SelectItem value="sob_demanda">Sob demanda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDocOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={adicionarDocumento}>Adicionar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-xl border border-border bg-card">
            {configs.length === 0 ? (
              <EmptyState
                icon={FileUp}
                title="Nenhum documento configurado"
                description="Adicione os documentos que este cliente precisa enviar periodicamente."
                className="m-4 border-0"
              />
            ) : (
              <ul className="divide-y divide-border">
                {configs.map((doc) => (
                  <li key={doc.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3 sm:flex-1">
                      <Checkbox
                        id={doc.id}
                        checked={doc.enabled}
                        onCheckedChange={(v) =>
                          setConfigs((prev) =>
                            prev.map((c) => (c.id === doc.id ? { ...c, enabled: v === true } : c)),
                          )
                        }
                      />
                      <Label
                        htmlFor={doc.id}
                        className="cursor-pointer font-medium text-foreground"
                      >
                        {doc.name}
                      </Label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:w-auto">
                      <Select
                        value={doc.periodicity}
                        onValueChange={(v) =>
                          setConfigs((prev) =>
                            prev.map((c) =>
                              c.id === doc.id ? { ...c, periodicity: v as Periodicity } : c,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="trimestral">Trimestral</SelectItem>
                          <SelectItem value="anual">Anual</SelectItem>
                          <SelectItem value="sob_demanda">Sob demanda</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="date"
                        value={doc.nextDueDate ?? ""}
                        onChange={(e) =>
                          setConfigs((prev) =>
                            prev.map((c) =>
                              c.id === doc.id ? { ...c, nextDueDate: e.target.value || null } : c,
                            ),
                          )
                        }
                        className="h-8 w-36 text-xs"
                        aria-label="Próximo prazo"
                      />
                      <StatusBadge status={docConfigStatus(doc)} />
                      {doc.lastSubmittedAt && (
                        <span className="text-xs text-muted-foreground">
                          recebido em {new Date(doc.lastSubmittedAt).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => marcarRecebido(doc.id)}
                      >
                        <CheckCircle2 className="size-3.5" /> Marcar recebido
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removerDocumento(doc.id)}
                        aria-label="Remover documento"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {configs.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={salvarDocumentos} disabled={savingDocs}>
                {savingDocs ? "Salvando…" : "Salvar documentos"}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="contatos" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Dialog
              open={linkOpen}
              onOpenChange={(o) => (o ? setLinkOpen(true) : closeLinkDialog())}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Link2 /> Vincular contato
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Vincular contato</DialogTitle>
                </DialogHeader>
                {!newContactMode ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome ou WhatsApp…"
                        value={searchContato}
                        onChange={(e) => buscarContatos(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Input
                      placeholder="Papel (ex: Dono, Financeiro)"
                      value={roleLabel}
                      onChange={(e) => setRoleLabel(e.target.value)}
                    />
                    {searchResults.length > 0 && (
                      <ul className="max-h-48 space-y-1 overflow-y-auto">
                        {searchResults.map((r) => (
                          <li key={r.id}>
                            <button
                              onClick={() => vincularContatoExistente(r.id)}
                              className="flex w-full items-center justify-between rounded-md p-2 text-left text-sm hover:bg-accent cursor-pointer"
                            >
                              <span>{r.name}</span>
                              <span className="text-xs text-muted-foreground">{r.whatsapp}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Um contato pode falar em nome de mais de um CNPJ. Todos os contatos vinculados
                      têm as mesmas permissões.
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setNewContactMode(true)}>
                      <UserPlus /> Criar novo contato
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      placeholder="Nome do contato"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                    />
                    <Input
                      placeholder="WhatsApp"
                      value={newContactWhatsapp}
                      onChange={(e) => setNewContactWhatsapp(e.target.value)}
                    />
                    <Input
                      placeholder="Papel (ex: Dono, Financeiro)"
                      value={roleLabel}
                      onChange={(e) => setRoleLabel(e.target.value)}
                    />
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={closeLinkDialog}>
                    Cancelar
                  </Button>
                  {newContactMode && (
                    <Button
                      disabled={!newContactName || !newContactWhatsapp}
                      onClick={criarENovoContato}
                    >
                      Criar e vincular
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {contacts.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="Nenhum contato vinculado"
                className="m-4 border-0"
              />
            ) : (
              <ul className="divide-y divide-border">
                {contacts.map((contato) => (
                  <li key={contato.contactId} className="flex flex-wrap items-center gap-3 p-4">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-secondary text-xs font-semibold">
                        {contato.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{contato.name}</p>
                      <p className="text-xs text-muted-foreground">{contato.whatsapp}</p>
                    </div>
                    <Badge variant="secondary">{contato.roleLabel}</Badge>
                    {contato.otherClients.map((nome) => (
                      <Badge key={nome} variant="outline" className="gap-1 text-xs">
                        <Building2 className="size-3" /> também atende: {nome}
                      </Badge>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="contexto" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <Label htmlFor="contexto" className="mb-2 block text-sm font-medium">
              Contexto e observações para a IA
            </Label>
            <Textarea
              id="contexto"
              value={contexto}
              onChange={(e) => setContexto(e.target.value)}
              className="min-h-32"
            />
          </div>
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <FileUp className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Arraste arquivos de contexto aqui</p>
            <p className="text-xs text-muted-foreground">
              ou clique para selecionar (PDF, DOCX, até 10MB)
            </p>
            <input type="file" className="mt-3 w-full cursor-pointer text-xs" multiple disabled />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Upload de arquivos ainda não está disponível — em breve.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={salvarContexto} disabled={savingNotes}>
              {savingNotes ? "Salvando…" : "Salvar contexto"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <CopilotWidget context={`Cliente ${client.name}, regime ${client.taxRegime}.`} />
    </AppShell>
  );
}
