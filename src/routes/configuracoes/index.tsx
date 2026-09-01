import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { BookOpen, Bot, FileText, Plus, ScrollText, Sparkles, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  documentCatalog,
  faqs as faqsSeed,
  kbDocuments,
  messageTemplates,
  type DocumentCatalogItem,
  type TemplateStatus,
} from "@/lib/mock-data";

export const Route = createFileRoute("/configuracoes/")({
  component: ConfiguracoesPage,
});

const sections = [
  { key: "documentos", label: "Catálogo de Documentos", icon: FileText },
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

function ConfiguracoesPage() {
  const [active, setActive] = useState<SectionKey>("documentos");
  const [catalog, setCatalog] = useState<DocumentCatalogItem[]>(documentCatalog);
  const [agentName, setAgentName] = useState("Nara");
  const [agentTone, setAgentTone] = useState(
    "Amigável, direto e profissional. Evita jargão técnico sem necessidade e sempre confirma antes de agir.",
  );
  const [consentText, setConsentText] = useState(consentVersions[0]!.texto);
  const [faqs, setFaqs] = useState(faqsSeed);

  function addCatalogItem() {
    setCatalog((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nome: "Novo tipo de documento", periodicidadePadrao: "mensal" },
    ]);
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
              <ul className="divide-y divide-border rounded-lg border border-border">
                {catalog.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 p-3">
                    <Input
                      defaultValue={item.nome}
                      className="h-8 flex-1 text-sm"
                      onBlur={(e) => {
                        const nome = e.target.value;
                        setCatalog((prev) =>
                          prev.map((c) => (c.id === item.id ? { ...c, nome } : c)),
                        );
                      }}
                    />
                    <Select
                      defaultValue={item.periodicidadePadrao}
                      onValueChange={(v) =>
                        setCatalog((prev) =>
                          prev.map((c) =>
                            c.id === item.id
                              ? { ...c, periodicidadePadrao: v as typeof c.periodicidadePadrao }
                              : c,
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setCatalog((prev) => prev.filter((c) => c.id !== item.id))}
                      aria-label="Remover"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
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
