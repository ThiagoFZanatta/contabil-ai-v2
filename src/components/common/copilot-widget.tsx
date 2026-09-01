import { useState } from "react";
import { Sparkles, X, FileText, MessageSquareText, Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  tipo: "Resumo" | "Sugestão de resposta";
  status: "aceita" | "editada" | "descartada";
}

/**
 * Widget flutuante do copiloto interno de IA (RF11 / RF12).
 * Nunca envia mensagem diretamente — toda sugestão é um rascunho editável
 * que a equipe revisa antes de usar, e cada decisão é registrada no log.
 */
export function CopilotWidget({
  context,
  onInsertDraft,
}: {
  context: string;
  onInsertDraft?: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<{
    tipo: "Resumo" | "Sugestão de resposta";
    texto: string;
  } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [editing, setEditing] = useState(false);

  function runAction(tipo: "Resumo" | "Sugestão de resposta") {
    setLoading(true);
    setDraft(null);
    window.setTimeout(() => {
      const texto =
        tipo === "Resumo"
          ? `Resumo gerado por IA: ${context} O contato busca uma resposta objetiva sobre o andamento do assunto e ainda não teve a dúvida resolvida.`
          : `Sugestão gerada por IA: Olá! Verifiquei aqui sua situação e já te retorno com os detalhes. Consegue me confirmar mais um dado enquanto isso, para eu adiantar a análise?`;
      setDraft({ tipo, texto });
      setLoading(false);
    }, 700);
  }

  function decide(status: LogEntry["status"], texto?: string) {
    if (!draft) return;
    setLog((prev) => [{ id: crypto.randomUUID(), tipo: draft.tipo, status }, ...prev]);
    if (status !== "descartada" && draft.tipo === "Sugestão de resposta") {
      onInsertDraft?.(texto ?? draft.texto);
    }
    setDraft(null);
    setEditing(false);
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="flex max-h-[32rem] w-96 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" />
              <p className="text-sm font-semibold">Copiloto de IA</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar copiloto"
              className="cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <p className="text-xs text-muted-foreground">
              As sugestões abaixo nunca são enviadas automaticamente — você revisa, edita se
              precisar e envia manualmente.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => runAction("Resumo")}
              >
                <FileText /> Resumir conversa
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => runAction("Sugestão de resposta")}
              >
                <MessageSquareText /> Sugerir resposta
              </Button>
            </div>

            {loading && (
              <div className="animate-pulse rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                Gerando com base no contexto do cliente e na base de conhecimento…
              </div>
            )}

            {draft && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-accent p-3">
                <p className="text-xs font-semibold text-accent-foreground">
                  {draft.tipo} (rascunho)
                </p>
                {editing ? (
                  <Textarea
                    value={draft.texto}
                    onChange={(e) => setDraft({ ...draft, texto: e.target.value })}
                    className="min-h-24 bg-background text-sm"
                  />
                ) : (
                  <p className="text-sm text-foreground">{draft.texto}</p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {draft.tipo === "Sugestão de resposta" && (
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => decide(editing ? "editada" : "aceita")}
                    >
                      <Check /> {editing ? "Usar editado" : "Usar como está"}
                    </Button>
                  )}
                  {draft.tipo === "Sugestão de resposta" && !editing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil /> Editar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => decide("descartada")}
                  >
                    <Trash2 /> Descartar
                  </Button>
                </div>
              </div>
            )}

            {log.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  Histórico desta sessão
                </p>
                <ul className="space-y-1">
                  {log.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-xs"
                    >
                      <span className="text-foreground">{entry.tipo}</span>
                      <span
                        className={cn(
                          "font-medium",
                          entry.status === "aceita" && "text-success",
                          entry.status === "editada" && "text-primary",
                          entry.status === "descartada" && "text-muted-foreground",
                        )}
                      >
                        {entry.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <Button
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="size-12 rounded-full shadow-lg"
        aria-label="Abrir copiloto de IA"
      >
        <Sparkles className="size-5" />
      </Button>
    </div>
  );
}
