import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BookOpen,
  Bot,
  CheckCircle2,
  Download,
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
  saveAiSelectedModel,
  saveOpenAiCredential,
  saveWhatsAppCredential,
  testOpenAiConnection,
  testWhatsAppConnection,
} from "@/lib/integration-actions";
import {
  OPENAI_CURATED_MODELS,
  type OpenAiCuratedModel,
} from "@/lib/integrations/ai/openai-provider";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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

type TemplateStatus = "aprovado" | "pendente" | "rejeitado";
type TemplateCategory = "utilidade" | "marketing" | "autenticacao";

const templateStatusStyle: Record<TemplateStatus, string> = {
  aprovado: "bg-success/15 text-success border-success/30",
  pendente: "bg-warning/20 text-warning-foreground border-warning/40",
  rejeitado: "bg-destructive/10 text-destructive border-destructive/30",
};

const templateCategoryLabel: Record<TemplateCategory, string> = {
  utilidade: "Utilidade",
  marketing: "Marketing",
  autenticacao: "Autenticação",
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

interface FaqRow {
  id: string;
  question: string;
  answer: string;
}

interface KbDocumentRow {
  id: string;
  file_name: string;
  file_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
}

interface ConsentVersionRow {
  id: string;
  version_number: number;
  text: string;
  published_at: string;
}

interface TemplateRow {
  id: string;
  name: string;
  category: TemplateCategory;
  status: TemplateStatus;
  body: string;
}

function ConfiguracoesPage() {
  const session = useCurrentStaff();
  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  const [active, setActive] = useState<SectionKey>("documentos");
  const [catalog, setCatalog] = useState<CatalogItem[] | null>(null);

  const [tenantWhatsappNumber, setTenantWhatsappNumber] = useState<string | null>(null);
  const [tenantMetaStatus, setTenantMetaStatus] = useState<string>("pending");
  const [integrations, setIntegrations] = useState<Record<
    "whatsapp" | "openai",
    IntegrationStatus
  > | null>(null);

  const [whatsappForm, setWhatsappForm] = useState({
    phoneNumberId: "",
    wabaId: "",
    phoneNumber: "",
    accessToken: "",
    appSecret: "",
  });
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [aiSelectedModel, setAiSelectedModel] = useState<OpenAiCuratedModel>("gpt-5-mini");

  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [savingOpenAi, setSavingOpenAi] = useState(false);
  const [savingAiModel, setSavingAiModel] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [testingOpenAi, setTestingOpenAi] = useState(false);
  const [whatsappTestResult, setWhatsappTestResult] = useState<ConnectionTestResult | null>(null);
  const [openAiTestResult, setOpenAiTestResult] = useState<ConnectionTestResult | null>(null);

  const [agentName, setAgentName] = useState("Nara");
  const [agentTone, setAgentTone] = useState("");
  const [savingAgent, setSavingAgent] = useState(false);

  const [faqs, setFaqs] = useState<FaqRow[] | null>(null);

  const [kbDocs, setKbDocs] = useState<KbDocumentRow[] | null>(null);
  const [uploadingKb, setUploadingKb] = useState(false);

  const [consentVersions, setConsentVersions] = useState<ConsentVersionRow[] | null>(null);
  const [consentDraft, setConsentDraft] = useState("");
  const [publishingConsent, setPublishingConsent] = useState(false);

  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState<TemplateCategory>("utilidade");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

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
        .select("provider, is_configured, metadata, ai_selected_model")
        .eq("tenant_id", id),
    ]);

    if (tenantRow) {
      setTenantWhatsappNumber(tenantRow.whatsapp_number);
      setTenantMetaStatus(tenantRow.meta_verification_status);
    }

    const next: Record<"whatsapp" | "openai", IntegrationStatus> = {
      whatsapp: { isConfigured: false, metadata: {} },
      openai: { isConfigured: false, metadata: {} },
    };
    for (const row of integrationRows ?? []) {
      if (row.provider === "whatsapp" || row.provider === "openai") {
        next[row.provider] = {
          isConfigured: row.is_configured,
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
        };
      }
      if (row.provider === "openai") {
        setAiSelectedModel(row.ai_selected_model as OpenAiCuratedModel);
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
      setWhatsappForm((prev) => ({ ...prev, accessToken: "", appSecret: "" }));
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

  async function handleSaveOpenAi() {
    setSavingOpenAi(true);
    setOpenAiTestResult(null);
    try {
      await saveOpenAiCredential({ data: { apiKey: openAiApiKey } });
      toast.success("Integração com a OpenAI salva.");
      setOpenAiApiKey("");
      if (tenantId) await loadIntegrations(tenantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a integração.");
    } finally {
      setSavingOpenAi(false);
    }
  }

  async function handleRemoveOpenAi() {
    setSavingOpenAi(true);
    try {
      await removeIntegrationCredential({ data: { provider: "openai" } });
      toast.success("Integração com a OpenAI desativada.");
      setOpenAiTestResult(null);
      if (tenantId) await loadIntegrations(tenantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível desativar a integração.");
    } finally {
      setSavingOpenAi(false);
    }
  }

  async function handleTestOpenAi() {
    setTestingOpenAi(true);
    setOpenAiTestResult(null);
    try {
      const result = await testOpenAiConnection();
      setOpenAiTestResult(result);
    } catch (err) {
      setOpenAiTestResult({
        ok: false,
        error: err instanceof Error ? err.message : "Falha ao testar a conexão.",
      });
    } finally {
      setTestingOpenAi(false);
    }
  }

  async function handleSaveAiModel(model: OpenAiCuratedModel) {
    setAiSelectedModel(model);
    setSavingAiModel(true);
    try {
      await saveAiSelectedModel({ data: { model } });
      toast.success("Modelo de IA atualizado.");
      if (tenantId) await loadIntegrations(tenantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o modelo.");
    } finally {
      setSavingAiModel(false);
    }
  }

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("ai_agent_config")
      .select("agent_name, persona_tone")
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then(({ data }) => {
        setAgentName(data?.agent_name ?? "Nara");
        setAgentTone(data?.persona_tone ?? "");
      });
  }, [tenantId]);

  async function handleSaveAgentConfig() {
    if (!tenantId) return;
    setSavingAgent(true);
    try {
      const { error } = await supabase.from("ai_agent_config").upsert(
        {
          tenant_id: tenantId,
          agent_name: agentName || "Nara",
          persona_tone: agentTone,
          updated_by: session.status === "ready" ? session.staff.id : null,
        },
        { onConflict: "tenant_id" },
      );
      if (error) {
        toast.error("Não foi possível salvar a configuração do agente.");
        return;
      }
      toast.success("Configuração do agente salva.");
    } finally {
      setSavingAgent(false);
    }
  }

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("knowledge_base_faq")
      .select("id, question, answer")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setFaqs(data ?? []));
  }, [tenantId]);

  async function addFaq() {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from("knowledge_base_faq")
      .insert({ tenant_id: tenantId, question: "Nova pergunta", answer: "Resposta padrão." })
      .select("id, question, answer")
      .single();
    if (error || !data) {
      toast.error("Não foi possível adicionar a FAQ.");
      return;
    }
    setFaqs((prev) => [data, ...(prev ?? [])]);
  }

  async function updateFaqQuestion(id: string, question: string) {
    setFaqs((prev) => (prev ?? []).map((f) => (f.id === id ? { ...f, question } : f)));
    const { error } = await supabase.from("knowledge_base_faq").update({ question }).eq("id", id);
    if (error) toast.error("Não foi possível salvar a pergunta.");
  }

  async function updateFaqAnswer(id: string, answer: string) {
    setFaqs((prev) => (prev ?? []).map((f) => (f.id === id ? { ...f, answer } : f)));
    const { error } = await supabase.from("knowledge_base_faq").update({ answer }).eq("id", id);
    if (error) toast.error("Não foi possível salvar a resposta.");
  }

  async function removeFaq(id: string) {
    const { error } = await supabase.from("knowledge_base_faq").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover a FAQ.");
      return;
    }
    setFaqs((prev) => (prev ?? []).filter((f) => f.id !== id));
  }

  async function loadKbDocuments(id: string) {
    const { data } = await supabase
      .from("knowledge_base_documents")
      .select("id, file_name, file_type, size_bytes, storage_path, created_at")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false });
    setKbDocs(data ?? []);
  }

  useEffect(() => {
    if (!tenantId) return;
    loadKbDocuments(tenantId);
  }, [tenantId]);

  async function handleUploadKbFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !tenantId || session.status !== "ready") return;
    setUploadingKb(true);
    try {
      for (const file of Array.from(fileList)) {
        const path = `${tenantId}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("knowledge-base")
          .upload(path, file);
        if (uploadError) {
          toast.error(`Não foi possível enviar ${file.name}: ${uploadError.message}`);
          continue;
        }
        const { error: insertError } = await supabase.from("knowledge_base_documents").insert({
          tenant_id: tenantId,
          file_name: file.name,
          file_type: file.type || (file.name.split(".").pop() ?? "arquivo"),
          size_bytes: file.size,
          storage_path: path,
          uploaded_by: session.staff.id,
        });
        if (insertError) {
          toast.error(`${file.name} foi enviado, mas houve um erro ao registrar o documento.`);
        }
      }
      toast.success("Upload concluído.");
      await loadKbDocuments(tenantId);
    } finally {
      setUploadingKb(false);
    }
  }

  async function removeKbDocument(doc: KbDocumentRow) {
    const { error: storageError } = await supabase.storage
      .from("knowledge-base")
      .remove([doc.storage_path]);
    if (storageError) {
      toast.error("Não foi possível remover o arquivo do armazenamento.");
      return;
    }
    const { error } = await supabase.from("knowledge_base_documents").delete().eq("id", doc.id);
    if (error) {
      toast.error("Arquivo removido do armazenamento, mas houve um erro ao atualizar a lista.");
      return;
    }
    setKbDocs((prev) => (prev ?? []).filter((d) => d.id !== doc.id));
  }

  async function downloadKbDocument(doc: KbDocumentRow) {
    const { data, error } = await supabase.storage
      .from("knowledge-base")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      toast.error("Não foi possível gerar o link de download.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function loadConsentVersions(id: string) {
    const { data } = await supabase
      .from("consent_policy_versions")
      .select("id, version_number, text, published_at")
      .eq("tenant_id", id)
      .order("version_number", { ascending: false });
    setConsentVersions(data ?? []);
    if (data && data.length > 0) setConsentDraft(data[0]!.text);
  }

  useEffect(() => {
    if (!tenantId) return;
    loadConsentVersions(tenantId);
  }, [tenantId]);

  async function publishConsentVersion() {
    if (!tenantId || session.status !== "ready" || !consentDraft.trim()) return;
    setPublishingConsent(true);
    try {
      const { error } = await supabase.from("consent_policy_versions").insert({
        tenant_id: tenantId,
        text: consentDraft,
        published_by: session.staff.id,
      });
      if (error) {
        toast.error("Não foi possível publicar a nova versão.");
        return;
      }
      toast.success("Nova versão do consentimento publicada.");
      await loadConsentVersions(tenantId);
    } finally {
      setPublishingConsent(false);
    }
  }

  async function loadTemplates(id: string) {
    const { data } = await supabase
      .from("whatsapp_message_templates")
      .select("id, name, category, status, body")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false });
    setTemplates(
      (data ?? []).map((t) => ({
        ...t,
        category: t.category as TemplateCategory,
        status: t.status as TemplateStatus,
      })),
    );
  }

  useEffect(() => {
    if (!tenantId) return;
    loadTemplates(tenantId);
  }, [tenantId]);

  async function addTemplate() {
    if (!tenantId || !newTemplateName.trim() || !newTemplateBody.trim()) return;
    setSavingTemplate(true);
    try {
      const { error } = await supabase.from("whatsapp_message_templates").insert({
        tenant_id: tenantId,
        name: newTemplateName.trim(),
        category: newTemplateCategory,
        body: newTemplateBody.trim(),
      });
      if (error) {
        toast.error("Não foi possível adicionar o template.");
        return;
      }
      toast.success("Template adicionado.");
      setNewTemplateOpen(false);
      setNewTemplateName("");
      setNewTemplateBody("");
      setNewTemplateCategory("utilidade");
      await loadTemplates(tenantId);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function changeTemplateStatus(id: string, status: TemplateStatus) {
    setTemplates((prev) => (prev ?? []).map((t) => (t.id === id ? { ...t, status } : t)));
    const { error } = await supabase
      .from("whatsapp_message_templates")
      .update({ status })
      .eq("id", id);
    if (error) toast.error("Não foi possível atualizar o status.");
  }

  async function removeTemplate(id: string) {
    const { error } = await supabase.from("whatsapp_message_templates").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível remover o template.");
      return;
    }
    setTemplates((prev) => (prev ?? []).filter((t) => t.id !== id));
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
                  <div>
                    <Label htmlFor="wa-app-secret" className="mb-1.5 block text-xs">
                      App Secret
                    </Label>
                    <Input
                      id="wa-app-secret"
                      type="password"
                      placeholder={
                        integrations?.whatsapp.isConfigured
                          ? "•••••••• (salvo)"
                          : "Da aba Configurações Básicas do seu app Meta"
                      }
                      value={whatsappForm.appSecret}
                      disabled={!session.staff.isAdmin}
                      onChange={(e) =>
                        setWhatsappForm((prev) => ({ ...prev, appSecret: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Webhook</p>
                  <p className="mt-1">
                    No painel do seu app Meta (WhatsApp → Configuração), cadastre esta URL de
                    callback:
                  </p>
                  <code className="mt-1 block break-all rounded bg-background px-2 py-1 text-foreground">
                    {typeof window !== "undefined" ? window.location.origin : ""}
                    /api/webhooks/whatsapp
                  </code>
                  <p className="mt-1">
                    O token de verificação foi combinado por fora do painel (não é exibido aqui por
                    segurança). O App Secret acima é o que autentica cada mensagem recebida.
                  </p>
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
                        !whatsappForm.accessToken ||
                        !whatsappForm.appSecret
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

              {/* OpenAI (v1.5 — substitui a Anthropic, PRD seção 10.1) */}
              <div className="rounded-xl border border-border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <KeyRound className="size-4.5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">OpenAI</h2>
                      <p className="text-xs text-muted-foreground">
                        Motor de IA do atendimento (RF03) e do copiloto interno (RF11)
                      </p>
                    </div>
                  </div>
                  {integrations?.openai.isConfigured ? (
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
                  <Label htmlFor="openai-key" className="mb-1.5 block text-xs">
                    Chave de API
                  </Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder={integrations?.openai.isConfigured ? "•••••••• (salva)" : "sk-..."}
                    value={openAiApiKey}
                    disabled={!session.staff.isAdmin}
                    onChange={(e) => setOpenAiApiKey(e.target.value)}
                    className="max-w-md"
                  />
                </div>

                <div className="mt-4">
                  <Label htmlFor="openai-model" className="mb-1.5 block text-xs">
                    Modelo
                  </Label>
                  <Select
                    value={aiSelectedModel}
                    disabled={!session.staff.isAdmin || savingAiModel}
                    onValueChange={(v) => handleSaveAiModel(v as OpenAiCuratedModel)}
                  >
                    <SelectTrigger id="openai-model" className="max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPENAI_CURATED_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                          {model === "gpt-5-mini" ? " (padrão recomendado)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Lista curada — não é possível usar outros modelos da OpenAI fora desta lista.
                  </p>
                </div>

                {openAiTestResult && (
                  <p
                    className={cn(
                      "mt-3 flex items-start gap-1.5 text-xs",
                      openAiTestResult.ok ? "text-success" : "text-destructive",
                    )}
                  >
                    {openAiTestResult.ok ? (
                      <CheckCircle2 className="size-3.5 shrink-0 translate-y-px" />
                    ) : (
                      <XCircle className="size-3.5 shrink-0 translate-y-px" />
                    )}
                    {openAiTestResult.ok ? openAiTestResult.detail : openAiTestResult.error}
                  </p>
                )}

                {session.staff.isAdmin && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      disabled={savingOpenAi || !openAiApiKey}
                      onClick={handleSaveOpenAi}
                    >
                      {savingOpenAi && <Loader2 className="size-3.5 animate-spin" />} Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!integrations?.openai.isConfigured || testingOpenAi}
                      onClick={handleTestOpenAi}
                    >
                      {testingOpenAi && <Loader2 className="size-3.5 animate-spin" />} Testar
                      conexão
                    </Button>
                    {integrations?.openai.isConfigured && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={savingOpenAi}
                        onClick={handleRemoveOpenAi}
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
                <Button onClick={handleSaveAgentConfig} disabled={savingAgent}>
                  {savingAgent && <Loader2 className="size-3.5 animate-spin" />} Salvar
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
                  <Button size="sm" variant="outline" onClick={addFaq}>
                    <Plus /> Adicionar FAQ
                  </Button>
                </div>
                {faqs === null ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : faqs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma FAQ cadastrada ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {faqs.map((f) => (
                      <li key={f.id} className="space-y-1.5 rounded-lg border border-border p-3">
                        <div className="flex items-start gap-2">
                          <Input
                            defaultValue={f.question}
                            className="h-8 flex-1 text-sm font-medium"
                            onBlur={(e) => updateFaqQuestion(f.id, e.target.value)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFaq(f.id)}
                            aria-label="Remover"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <Textarea
                          defaultValue={f.answer}
                          className="min-h-16 text-xs"
                          onBlur={(e) => updateFaqAnswer(f.id, e.target.value)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  Documentos para RAG (busca semântica)
                </h2>
                <label className="mb-3 block cursor-pointer rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                  {uploadingKb ? (
                    <Loader2 className="mx-auto mb-2 size-6 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="mx-auto mb-2 size-6 text-muted-foreground" />
                  )}
                  <p className="text-sm font-medium text-foreground">
                    {uploadingKb ? "Enviando..." : "Arraste PDFs ou manuais aqui"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A IA prioriza esses documentos antes de responder de forma genérica
                  </p>
                  <input
                    type="file"
                    className="sr-only"
                    multiple
                    disabled={uploadingKb}
                    onChange={(e) => {
                      handleUploadKbFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {kbDocs === null ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : kbDocs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum documento enviado ainda.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {kbDocs.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-3 p-3">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{doc.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {Math.round(doc.size_bytes / 1024)}KB · enviado em{" "}
                            {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground"
                          onClick={() => downloadKbDocument(doc)}
                          aria-label="Baixar"
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeKbDocument(doc)}
                          aria-label="Remover"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
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
                  value={consentDraft}
                  onChange={(e) => setConsentDraft(e.target.value)}
                  className="min-h-40"
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={!consentDraft.trim() || publishingConsent}>
                      {publishingConsent && <Loader2 className="size-3.5 animate-spin" />} Salvar
                      nova versão
                    </Button>
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
                      <AlertDialogAction onClick={publishConsentVersion}>
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
                {consentVersions === null ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : consentVersions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma versão publicada ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {consentVersions.map((v) => (
                      <li key={v.id} className="rounded-lg border border-border p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">v{v.version_number}</span>
                          <span className="text-muted-foreground">
                            {new Date(v.published_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-muted-foreground">{v.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {active === "templates" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Templates aprovados pela Meta
                </h2>
                <Dialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus /> Adicionar template
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Novo template de mensagem</DialogTitle>
                      <DialogDescription>
                        Registre um template já submetido para aprovação da Meta. O status pode ser
                        atualizado depois, conforme o retorno da revisão.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="new-tpl-name" className="mb-1.5 block text-xs">
                          Nome (snake_case, como na Meta)
                        </Label>
                        <Input
                          id="new-tpl-name"
                          value={newTemplateName}
                          onChange={(e) => setNewTemplateName(e.target.value)}
                          placeholder="cobranca_documento_mensal"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-tpl-category" className="mb-1.5 block text-xs">
                          Categoria
                        </Label>
                        <Select
                          value={newTemplateCategory}
                          onValueChange={(v) => setNewTemplateCategory(v as TemplateCategory)}
                        >
                          <SelectTrigger id="new-tpl-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="utilidade">Utilidade</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="autenticacao">Autenticação</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="new-tpl-body" className="mb-1.5 block text-xs">
                          Corpo da mensagem
                        </Label>
                        <Textarea
                          id="new-tpl-body"
                          value={newTemplateBody}
                          onChange={(e) => setNewTemplateBody(e.target.value)}
                          placeholder="Olá {{1}}! ..."
                          className="min-h-24"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={addTemplate}
                        disabled={
                          savingTemplate || !newTemplateName.trim() || !newTemplateBody.trim()
                        }
                      >
                        {savingTemplate && <Loader2 className="size-3.5 animate-spin" />} Adicionar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Corpo</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(templates ?? []).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs font-medium">{t.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {templateCategoryLabel[t.category]}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={t.status}
                            onValueChange={(v) => changeTemplateStatus(t.id, v as TemplateStatus)}
                          >
                            <SelectTrigger
                              className={cn(
                                "h-7 w-auto border text-xs",
                                templateStatusStyle[t.status],
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aprovado">Aprovado</SelectItem>
                              <SelectItem value="pendente">
                                Pendente de aprovação da Meta
                              </SelectItem>
                              <SelectItem value="rejeitado">Rejeitado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {t.body}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeTemplate(t.id)}
                            aria-label="Remover"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {templates !== null && templates.length === 0 && (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    Nenhum template cadastrado ainda.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
