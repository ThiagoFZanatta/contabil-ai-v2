import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  FileText,
  KeyRound,
  Loader2,
  Mail,
  MessageCircle,
  Plug,
  Plus,
  ScrollText,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { supabase } from "@/integrations/supabase/client";
import {
  removeIntegrationCredential,
  saveAnthropicCredential,
  saveWhatsAppCredential,
  testAnthropicConnection,
  testWhatsAppConnection,
} from "@/lib/integration-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  consentVersions,
  faqs as faqsSeed,
  kbDocuments,
  messageTemplates,
  type TemplateStatus,
} from "@/lib/mock-data";

type Periodicity = "mensal" | "trimestral" | "anual" | "sob_demanda";

interface CatalogItem {
  id: string;
  name: string;
  periodicity: Periodicity;
}

export const Route = createFileRoute("/configuracoes/")({
  component: ConfiguracoesPage,
});

const sections = [
  { key: "documentos", label: "Catálogo de Documentos", icon: FileText },
  { key: "integracoes", label: "Integrações", icon: Plug },
  { key: "agente", label: "Agente de IA", icon: Bot },
  { key: "conhecimento", label: "Base de Conhecimento", icon: BookOpen },
  { key: "consentimento", label: "Consentimento e Privacidade", icon: ScrollText },
  { key: "templates", label: "Templates de Mensagem", icon: Sparkles },
] as const;

type SectionKey = (typeof sections)[number]["key"];

const templateStatusStyle: Record<TemplateStatus, string> = {
  aprovado: "bg-success/15 text-success border-success/30",
  pendente: "bg-warning/20 text-warning-foreground border-warning/40",
  rejeitado: "bg-destructive/10 text-destructive border-destructive/30",
};

const metaVerificationLabel: Record<string, string> = {
  pending: "Pendente",
  in_review: "Em análise pela Meta",
  verified: "Verificado",
  rejected: "Rejeitado",
};

const metaVerificationStyle: Record<string, string> = {
  pending: "bg-warning/20 text-warning-foreground border-warning/40",
  in_review: "bg-warning/20 text-warning-foreground border-warning/40",
  verified: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

interface IntegrationStatus {
  isConfigured: boolean;
  metadata: Record<string, unknown>;
}

type ConnectionTestResult = { ok: true; detail: string } | { ok: false; error: string };

function ConfiguracoesPage() {
  const session = useCurrentStaff();
  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  const [active, setActive] = useState<SectionKey>("documentos");
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);

  const [tenantWhatsappNumber, setTenantWhatsappNumber] = useState<string | null>(null);
  const [tenantMetaStatus, setTenantMetaStatus] = useState<string>("pending");
  const [integrations, setIntegrations] = useState<Record<
    "whatsapp" | "anthropic",
    IntegrationStatus
  > | null>(null);

  const [whatsappForm, setWhatsappForm] = useState({
    phoneNumberId: "",
    wabaId: "",
    phoneNumber: "",
    accessToken: "",
  });
  const [anthropicApiKey, setAnthropicApiKey] = useState("");

  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [savingAnthropic, setSavingAnthropic] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [whatsappTestResult, setWhatsappTestResult] = useState<ConnectionTestResult | null>(null);
  const [anthropicTestResult, setAnthropicTestResult] = useState<ConnectionTestResult | null>(null);

  const [agentName, setAgentName] = useState("Nara");
  const [agentTone, setAgentTone] = useState(
    "Amigável, direto e profissional. Evita jargão técnico sem necessidade e sempre confirma antes de agir.",
  );
  const [consentText, setConsentText] = useState(consentVersions[0]!.texto);
  const [faqs, setFaqs] = useState(faqsSeed);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("document_catalog")
      .select("id, name, default_periodicity")
      .eq("tenant_id", tenantId)
      .order("name")
      .then(({ data }) => {
        setCatalog(
          (data ?? []).map((d) => ({
            id: d.id,
            name: d.name,
            periodicity: d.default_periodicity as Periodicity,
          })),
        );
      });
  }, [tenantId]);

  async function loadIntegrations(id: string) {
    const [{ data: tenantRow }, { data: integrationRows }] = await Promise.all([
      supabase
        .from("tenants")
        .select("whatsapp_number, meta_verification_status")
        .eq("id", id)
        .single(),
      supabase
        .from("tenant_integrations")
        .select("provider, is_configured, metadata")
        .eq("tenant_id", id),
    ]);

    if (tenantRow) {
      setTenantWhatsappNumber(tenantRow.whatsapp_number);
      setTenantMetaStatus(tenantRow.meta_verification_status);
    }

    const next: Record<"whatsapp" | "anthropic", IntegrationStatus> = {
      whatsapp: { isConfigured: false, metadata: {} },
      anthropic: { isConfigured: false, metadata: {} },
    };
    for (const row of integrationRows ?? []) {
      if (row.provider === "whatsapp" || row.provider === "anthropic") {
        next[row.provider] = {
          isConfigured: row.is_configured,
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
        };
      }
    }
    setIntegrations(next);
    setWhatsappForm((prev) => ({
      ...prev,
      phoneNumberId: (next.whatsapp.metadata["phone_number_id"] as string) ?? "",
      wabaId: (next.whatsapp.metadata["waba_id"] as string) ?? "",
      phoneNumber: tenantRow?.whatsapp_number ?? "",
    }));
  }

  useEffect(() => {
    if (!tenantId) return;
    loadIntegrations(tenantId);
  }, [tenantId]);

  async function handleSaveWhatsapp() {
    setSavingWhatsapp(true);
    setWhatsappTestResult(null);
    try {
      await saveWhatsAppCredential({ data: whatsappForm });
      toast.success("Integração com o WhatsApp salva.");
      setWhatsappForm((prev) => ({ ...prev, accessToken: "" }));
      if (tenantId) await loadIntegrations(tenantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a integração.");
    } finally {
      setSavingWhatsapp(false);
    }
  }

  async function handleRemoveWhatsapp() {
    setSavingWhatsapp(true);
    try {
      await removeIntegrationCredential({ data: { provider: "whatsapp" } });
      toast.success("Integração com o WhatsApp desativada.");
      setWhatsappTestResult(null);
      if (tenantId) await loadIntegrations(tenantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível desativar a integração.");
    } finally {
      setSavingWhatsapp(false);
    }
  }

  async function handleTestWhatsapp() {
    setTestingWhatsapp(true);
    setWhatsappTestResult(null);
    try {
      const result = await testWhatsAppConnection();
      setWhatsappTestResult(result);
    } catch (err) {
      setWhatsappTestResult({
        ok: false,
        error: err instanceof Error ? err.message : "Falha ao testar a conexão.",
      });
    } finally {
      setTestingWhatsapp(false);
    }
  }

  async function handleSaveAnthropic() {
    setSavingAnthropic(true);
    setAnthropicTestResult(null);
    try {
      await saveAnthropicCredential({ data: { apiKey: anthropicApiKey } });
      toast.success("Integração com a Anthropic salva.");
      setAnthropicApiKey("");
      if (tenantId) await loadIntegrations(tenantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a integração.");
    } finally {
      setSavingAnthropic(false);
    }
  }

  async function handleRemoveAnthropic() {
    setSavingAnthropic(true);
    try {
      await removeIntegrationCredential({ data: { provider: "anthropic" } });
      toast.success("Integração com a Anthropic desativada.");
      setAnthropicTestResult(null);
      if (tenantId) await loadIntegrations(tenantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível desativar a integração.");
    } finally {
      setSavingAnthropic(false);
    }
  }

  async function handleTestAnthropic() {
    setTestingAnthropic(true);
    setAnthropicTestResult(null);
    try {
      const result = await testAnthropicConnection();
      setAnthropicTestResult(result);
    } catch (err) {
      setAnthropicTestResult({
        ok: false,
        error: err instanceof Error ? err.message : "Falha ao testar a conexão.",
      });
    } finally {
      setTestingAnthropic(false);
    }
  }

  async function addCatalogItem() {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from("document_catalog")
      .insert({
        tenant_id: tenantId,
        name: "Novo tipo de documento",
        default_periodicity: "mensal",
      })
      .select("id, name, default_periodicity")
      .single();
    if (error || !data) {
      toast.error("Não foi possível adicionar o item.");
      return;
    }
    setCatalog((prev) => [
      ...(prev ?? []),
      { id: data.id, name: data.name, periodicity: data.default_periodicity as Periodicity },
    ]);
  }

  async function renameCatalogItem(id: string, name: string) {
    setCatalog((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, name } : c)));
    const { error } = await supabase.from("document_catalog").update({ name }).eq("id", id);
    if (error) toast.error("Não foi possível renomear o item.");
  }

  async function changeCatalogPeriodicity(id: string, periodicity: Periodicity) {
    setCatalog((prev) => (prev ?? []).map((c) => (c.id === id ? { ...c, periodicity } : c)));
    const { error } = await supabase
      .from("document_catalog")
      .update({ default_periodicity: periodicity })
      .eq("id", id);
    if (error) toast.error("Não foi possível salvar a periodicidade.");
  }

  async function removeCatalogItem(id: string) {
    const { error } = await supabase.from("document_catalog").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover o item.");
      return;
    }
    setCatalog((prev) => (prev ?? []).filter((c) => c.id !== id));
  }

  if (session.status !== "ready") {
    return (
      <AppShell title="Configurações">
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Configurações"
      description="Comportamento geral do sistema (não específico de um cliente)"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[16rem_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors cursor-pointer",
                active === s.key
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent",
              )}
            >
              <s.icon className="size-4 shrink-0" />
              <span className="whitespace-nowrap md:whitespace-normal">{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 rounded-xl border border-border bg-card p-5">
          {active === "documentos" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Catálogo global de documentos
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Tipos disponíveis ao configurar um cliente (Tela 4).
                  </p>
                </div>
                <Button size="sm" onClick={addCatalogItem}>
                  <Plus /> Adicionar item
                </Button>
              </div>
              {catalog === null ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {catalog.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 p-3">
                      <Input
                        defaultValue={item.name}
                        className="h-8 flex-1 text-sm"
                        onBlur={(e) => renameCatalogItem(item.id, e.target.value)}
                      />
                      <Select
                        value={item.periodicity}
                        onValueChange={(v) => changeCatalogPeriodicity(item.id, v as Periodicity)}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeCatalogItem(item.id)}
                        aria-label="Remover"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {active === "integracoes" && (
            <div className="space-y-6">
              {!session.staff.isAdmin && (
                <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
                  Apenas administradores podem alterar integrações. Você pode visualizar o status
                  abaixo.
                </p>
              )}

              {/* WhatsApp Business API (Meta Cloud API) */}
              <div className="rounded-xl border border-border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MessageCircle className="size-4.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        WhatsApp Business API
                      </h2>
                      <p className="text-xs text-muted-foreground">Meta Cloud API</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "border capitalize",
                        metaVerificationStyle[tenantMetaStatus] ?? metaVerificationStyle["pending"],
                      )}
                    >
                      {metaVerificationLabel[tenantMetaStatus] ?? tenantMetaStatus}
                    </Badge>
                    {integrations?.whatsapp.isConfigured ? (
                      <Badge className="border border-success/30 bg-success/15 text-success">
                        <CheckCircle2 className="size-3" /> Configurado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Não configurado
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="wa-phone-number" className="mb-1.5 block text-xs">
                      Número (com DDI)
                    </Label>
                    <Input
                      id="wa-phone-number"
                      placeholder="+55 11 90000-0000"
                      value={whatsappForm.phoneNumber}
                      disabled={!session.staff.isAdmin}
                      onChange={(e) =>
                        setWhatsappForm((prev) => ({ ...prev, phoneNumber: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="wa-phone-number-id" className="mb-1.5 block text-xs">
                      Phone Number ID
                    </Label>
                    <Input
                      id="wa-phone-number-id"
                      value={whatsappForm.phoneNumberId}
                      disabled={!session.staff.isAdmin}
                      onChange={(e) =>
                        setWhatsappForm((prev) => ({ ...prev, phoneNumberId: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="wa-waba-id" className="mb-1.5 block text-xs">
                      WABA ID
                    </Label>
                    <Input
                      id="wa-waba-id"
                      value={whatsappForm.wabaId}
                      disabled={!session.staff.isAdmin}
                      onChange={(e) =>
                        setWhatsappForm((prev) => ({ ...prev, wabaId: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="wa-token" className="mb-1.5 block text-xs">
                      Token de acesso
                    </Label>
                    <Input
                      id="wa-token"
                      type="password"
                      placeholder={
                        integrations?.whatsapp.isConfigured
                          ? "•••••••• (salvo)"
                          : "Cole o token aqui"
                      }
                      value={whatsappForm.accessToken}
                      disabled={!session.staff.isAdmin}
                      onChange={(e) =>
                        setWhatsappForm((prev) => ({ ...prev, accessToken: e.target.value }))
                      }
                    />
                  </div>
                </div>

                {whatsappTestResult && (
                  <p
                    className={cn(
                      "mt-3 flex items-start gap-1.5 text-xs",
                      whatsappTestResult.ok ? "text-success" : "text-destructive",
                    )}
                  >
                    {whatsappTestResult.ok ? (
                      <CheckCircle2 className="size-3.5 shrink-0 translate-y-px" />
                    ) : (
                      <XCircle className="size-3.5 shrink-0 translate-y-px" />
                    )}
                    {whatsappTestResult.ok ? whatsappTestResult.detail : whatsappTestResult.error}
                  </p>
                )}

                {session.staff.isAdmin && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      disabled={
                        savingWhatsapp ||
                        !whatsappForm.phoneNumberId ||
                        !whatsappForm.wabaId ||
                        !whatsappForm.phoneNumber ||
                        !whatsappForm.accessToken
                      }
                      onClick={handleSaveWhatsapp}
                    >
                      {savingWhatsapp && <Loader2 className="size-3.5 animate-spin" />} Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!integrations?.whatsapp.isConfigured || testingWhatsapp}
                      onClick={handleTestWhatsapp}
                    >
                      {testingWhatsapp && <Loader2 className="size-3.5 animate-spin" />} Testar
                      conexão
                    </Button>
                    {integrations?.whatsapp.isConfigured && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={savingWhatsapp}
                        onClick={handleRemoveWhatsapp}
                      >
                        <Trash2 className="size-3.5" /> Desativar
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Anthropic */}
              <div className="rounded-xl border border-border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <KeyRound className="size-4.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Anthropic</h2>
                      <p className="text-xs text-muted-foreground">
                        Motor de IA do atendimento (RF03) e do copiloto interno (RF11)
                      </p>
                    </div>
                  </div>
                  {integrations?.anthropic.isConfigured ? (
                    <Badge className="border border-success/30 bg-success/15 text-success">
                      <CheckCircle2 className="size-3" /> Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Não configurado
                    </Badge>
                  )}
                </div>

                <div>
                  <Label htmlFor="anthropic-key" className="mb-1.5 block text-xs">
                    Chave de API
                  </Label>
                  <Input
                    id="anthropic-key"
                    type="password"
                    placeholder={
                      integrations?.anthropic.isConfigured ? "•••••••• (salva)" : "sk-ant-..."
                    }
                    value={anthropicApiKey}
                    disabled={!session.staff.isAdmin}
                    onChange={(e) => setAnthropicApiKey(e.target.value)}
                    className="max-w-md"
                  />
                </div>

                {anthropicTestResult && (
                  <p
                    className={cn(
                      "mt-3 flex items-start gap-1.5 text-xs",
                      anthropicTestResult.ok ? "text-success" : "text-destructive",
                    )}
                  >
                    {anthropicTestResult.ok ? (
                      <CheckCircle2 className="size-3.5 shrink-0 translate-y-px" />
                    ) : (
                      <XCircle className="size-3.5 shrink-0 translate-y-px" />
                    )}
                    {anthropicTestResult.ok
                      ? anthropicTestResult.detail
                      : anthropicTestResult.error}
                  </p>
                )}

                {session.staff.isAdmin && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      disabled={savingAnthropic || !anthropicApiKey}
                      onClick={handleSaveAnthropic}
                    >
                      {savingAnthropic && <Loader2 className="size-3.5 animate-spin" />} Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!integrations?.anthropic.isConfigured || testingAnthropic}
                      onClick={handleTestAnthropic}
                    >
                      {testingAnthropic && <Loader2 className="size-3.5 animate-spin" />} Testar
                      conexão
                    </Button>
                    {integrations?.anthropic.isConfigured && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={savingAnthropic}
                        onClick={handleRemoveAnthropic}
                      >
                        <Trash2 className="size-3.5" /> Desativar
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Resend — fora do MVP (RF12), campos presentes mas desligados */}
              <div className="rounded-xl border border-dashed border-border p-4 opacity-60">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Mail className="size-4.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Resend</h2>
                      <p className="text-xs text-muted-foreground">Canal de e-mail (RF12)</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">
                    Disponível na Fase 4 (RF12)
                  </Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block text-xs">Domínio remetente</Label>
                    <Input disabled placeholder="contato@seudominio.com.br" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Chave de API</Label>
                    <Input disabled type="password" placeholder="re_..." />
                  </div>
                </div>
              </div>
            </div>
          )}

          {active === "agente" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Identidade do agente de IA
                </h2>
                <div>
                  <Label htmlFor="agent-name" className="mb-1.5 block text-xs">
                    Nome do agente
                  </Label>
                  <Input
                    id="agent-name"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="agent-tone" className="mb-1.5 block text-xs">
                    Tom de voz / persona
                  </Label>
                  <Textarea
                    id="agent-tone"
                    value={agentTone}
                    onChange={(e) => setAgentTone(e.target.value)}
                    className="min-h-28"
                  />
                </div>
                <Button onClick={() => toast.success("Configuração do agente salva.")}>
                  Salvar
                </Button>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Prévia ao vivo</p>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Sparkles className="size-4" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {agentName || "Assistente"}
                    </p>
                  </div>
                  <div className="mt-3 rounded-2xl rounded-bl-sm bg-accent px-3.5 py-2.5 text-sm text-accent-foreground">
                    Olá! Eu sou {agentName || "a assistente"} do seu escritório de contabilidade.{" "}
                    {agentTone.split(".")[0] ?? ""}. Como posso te ajudar hoje?
                  </div>
                </div>
              </div>
            </div>
          )}

          {active === "conhecimento" && (
            <div className="space-y-8">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">
                    Perguntas frequentes (FAQ)
                  </h2>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setFaqs((prev) => [
                        {
                          id: crypto.randomUUID(),
                          pergunta: "Nova pergunta",
                          resposta: "Resposta padrão.",
                        },
                        ...prev,
                      ])
                    }
                  >
                    <Plus /> Adicionar FAQ
                  </Button>
                </div>
                <ul className="space-y-2">
                  {faqs.map((f) => (
                    <li key={f.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium text-foreground">{f.pergunta}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{f.resposta}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  Documentos para RAG (busca semântica)
                </h2>
                <div className="mb-3 rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                  <Upload className="mx-auto mb-2 size-6 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Arraste PDFs ou manuais aqui
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A IA prioriza esses documentos antes de responder de forma genérica
                  </p>
                  <input type="file" className="mt-3 w-full cursor-pointer text-xs" multiple />
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {kbDocuments.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 p-3">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{doc.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.tipo} · {doc.tamanhoKb}KB · enviado em {doc.dataUpload}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {active === "consentimento" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_16rem]">
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Texto de consentimento vigente
                </h2>
                <Textarea
                  value={consentText}
                  onChange={(e) => setConsentText(e.target.value)}
                  className="min-h-40"
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button>Salvar nova versão</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Publicar nova versão do consentimento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta é uma alteração crítica: a nova versão passará a ser apresentada a todo
                        novo contato, e contatos existentes poderão precisar reconfirmar o
                        consentimento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => toast.success("Nova versão do consentimento publicada.")}
                      >
                        Confirmar publicação
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  Histórico de versões
                </p>
                <ul className="space-y-2">
                  {consentVersions.map((v) => (
                    <li key={v.versao} className="rounded-lg border border-border p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{v.versao}</span>
                        <span className="text-muted-foreground">{v.dataPublicacao}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{v.texto}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {active === "templates" && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">
                Templates aprovados pela Meta
              </h2>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Corpo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messageTemplates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs font-medium">{t.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{t.categoria}</TableCell>
                        <TableCell>
                          <Badge className={cn("border capitalize", templateStatusStyle[t.status])}>
                            {t.status === "pendente" ? "Pendente de aprovação da Meta" : t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {t.corpo}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
