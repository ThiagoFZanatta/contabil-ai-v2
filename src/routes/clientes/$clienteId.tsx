import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Brain,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  FileUp,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Users,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

interface SubmissionRow {
  id: string;
  documentName: string;
  submittedAt: string;
  note: string;
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

function overallDocStatus(configs: { enabled: boolean; nextDueDate: string | null }[]): DocStatus {
  const today = new Date();
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 7);
  const active = configs.filter((c) => c.enabled && c.nextDueDate);
  if (active.some((c) => new Date(c.nextDueDate as string) < today)) return "atrasado";
  if (active.some((c) => new Date(c.nextDueDate as string) <= soon)) return "pendente";
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
  const [submissionHistory, setSubmissionHistory] = useState<SubmissionRow[]>([]);
  const [contexto, setContexto] = useState("");
  const [savingDocs, setSavingDocs] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const [addDocOpen, setAddDocOpen] = useState(false);
  const [newDocCatalogId, setNewDocCatalogId] = useState<string>("custom");
  const [newDocName, setNewDocName] = useState("");
  const [newDocPeriodicity, setNewDocPeriodicity] = useState<Periodicity>("mensal");

  const overallStatus = useMemo(() => overallDocStatus(configs), [configs]);

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
        .select("contact_id, role_label, contacts(id, name, whatsapp_number, archived_at)")
        .eq("client_id", clienteId),
    ]);

    const configIds = (configRows ?? []).map((c) => c.id);
    const configNameById = new Map((configRows ?? []).map((c) => [c.id, c.name]));
    const submissionsByConfig = new Map<string, string>();
    const historyRows: SubmissionRow[] = [];
    if (configIds.length > 0) {
      const { data: submissions } = await supabase
        .from("document_submissions")
        .select("id, client_document_config_id, submitted_at, note")
        .in("client_document_config_id", configIds)
        .order("submitted_at", { ascending: false });
      for (const s of submissions ?? []) {
        if (!submissionsByConfig.has(s.client_document_config_id)) {
          submissionsByConfig.set(s.client_document_config_id, s.submitted_at);
        }
        historyRows.push({
          id: s.id,
          documentName: configNameById.get(s.client_document_config_id) ?? "—",
          submittedAt: s.submitted_at,
          note: s.note,
        });
      }
    }
    setSubmissionHistory(historyRows);

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
      (linkRows ?? [])
        .filter((l) => {
          const contact = l.contacts as unknown as { archived_at: string | null } | null;
          return !contact?.archived_at;
        })
        .map((l) => {
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
        <Avatar className="size-12 rounded-lg">
          <AvatarFallback className="rounded-lg bg-primary/10 text-base font-semibold text-primary">
            {client.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{client.name}</h2>
            <StatusBadge status={overallStatus} />
            <Badge variant="secondary" className="font-normal">
              {client.taxRegime}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            CNPJ: <span className="font-mono text-foreground/80">{client.cnpj}</span>
            {" · "}
            WhatsApp: {client.whatsappNumber}
          </p>
        </div>
      </div>

      <Tabs defaultValue="documentos">
        <TabsList>
          <TabsTrigger value="documentos" className="gap-1.5">
            <FileText className="size-3.5" />
            Documentos ({configs.length})
          </TabsTrigger>
          <TabsTrigger value="contatos" className="gap-1.5">
            <Users className="size-3.5" />
            Contatos ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="contexto" className="gap-1.5">
            <Brain className="size-3.5" />
            Contexto & Notas (IA)
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <Clock className="size-3.5" />
            Envios recebidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documentos" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              A IA cobra automaticamente cada documento no WhatsApp de acordo com o prazo
              configurado.
            </p>
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

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {configs.length === 0 ? (
              <EmptyState
                icon={FileUp}
                title="Nenhum documento configurado"
                description="Adicione os documentos que este cliente precisa enviar periodicamente."
                className="m-4 border-0"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Periodicidade</TableHead>
                    <TableHead>Próxima cobrança</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Checkbox
                            id={doc.id}
                            checked={doc.enabled}
                            onCheckedChange={(v) =>
                              setConfigs((prev) =>
                                prev.map((c) =>
                                  c.id === doc.id ? { ...c, enabled: v === true } : c,
                                ),
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
                        {doc.lastSubmittedAt && (
                          <p className="mt-1 pl-6 text-xs text-muted-foreground">
                            recebido em {new Date(doc.lastSubmittedAt).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={docConfigStatus(doc)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => marcarRecebido(doc.id)}
                          >
                            <CheckCircle2 className="size-3.5" /> Marcar recebido
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button size="sm" variant="ghost" className="h-8 text-xs" disabled>
                                  <Send className="size-3.5" /> Cobrar no WhatsApp
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Disparo imediato pelo WhatsApp — em breve.
                            </TooltipContent>
                          </Tooltip>
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Vínculos, edição e exclusão de contatos agora são feitos na tela de Contatos.
            </p>
            <Button variant="outline" asChild>
              <Link to="/contatos" search={{ clientId: clienteId }}>
                <ArrowUpRight /> Gerenciar contatos deste cliente
              </Link>
            </Button>
          </div>

          {contacts.length === 0 ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <EmptyState
                icon={UserPlus}
                title="Nenhum contato vinculado"
                className="m-4 border-0"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {contacts.map((contato) => (
                <div
                  key={contato.contactId}
                  className="space-y-2.5 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-secondary text-xs font-semibold">
                          {contato.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{contato.name}</p>
                        <p className="text-xs text-muted-foreground">{contato.roleLabel}</p>
                      </div>
                    </div>
                  </div>

                  <p className="font-mono text-xs text-muted-foreground">{contato.whatsapp}</p>

                  {contato.otherClients.length > 0 && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs text-foreground">
                      <p className="flex items-center gap-1 font-medium text-primary">
                        <Building2 className="size-3" />
                        Também atende outro(s) CNPJ(s):
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        {contato.otherClients.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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

        <TabsContent value="historico" className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Registros de documentos marcados como recebidos para este cliente.
          </p>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {submissionHistory.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Nenhum documento recebido ainda"
                description="Assim que um documento for marcado como recebido, ele aparece aqui."
                className="m-4 border-0"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Recebido em</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissionHistory.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="flex items-center gap-2 font-medium text-foreground">
                        <FileText className="size-4 text-primary" />
                        {sub.documentName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(sub.submittedAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{sub.note || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <CopilotWidget context={`Cliente ${client.name}, regime ${client.taxRegime}.`} />
    </AppShell>
  );
}
