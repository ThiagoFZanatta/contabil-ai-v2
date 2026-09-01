import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bot, MessagesSquare, Send, Sparkles, User, UserCog } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CopilotWidget } from "@/components/common/copilot-widget";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  conversations as seedConversations,
  currentStaff,
  departmentLabel,
  departments,
  type Conversation,
} from "@/lib/mock-data";

export const Route = createFileRoute("/conversas/")({
  component: ConversasPage,
});

function ConversasPage() {
  const [depFilter, setDepFilter] = useState<string>("meus");
  const [convs, setConvs] = useState<Conversation[]>(seedConversations);
  const [selectedId, setSelectedId] = useState<string | null>(seedConversations[0]?.id ?? null);
  const [reply, setReply] = useState("");

  const visible = useMemo(() => {
    return convs.filter((c) => {
      if (depFilter === "meus")
        return currentStaff.departamentos.includes(c.departamento) || c.overflow;
      if (depFilter === "todos") return true;
      return c.departamento === depFilter;
    });
  }, [convs, depFilter]);

  const selected = convs.find((c) => c.id === selectedId) ?? null;

  function assumir(id: string) {
    setConvs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, emAtendimentoPor: currentStaff.nome } : c)),
    );
    toast.success("Você assumiu esta conversa.");
  }

  function enviar() {
    if (!selected || !reply.trim()) return;
    setConvs((prev) =>
      prev.map((c) =>
        c.id === selected.id
          ? {
              ...c,
              mensagens: [
                ...c.mensagens,
                {
                  id: crypto.randomUUID(),
                  remetente: "humano",
                  texto: reply.trim(),
                  hora: "agora",
                },
              ],
            }
          : c,
      ),
    );
    setReply("");
  }

  return (
    <AppShell title="Conversas" description="Fila de atendimento por departamento">
      <div className="grid h-[calc(100vh-8.5rem)] grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
        {/* Sidebar de fila */}
        <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          <div className="border-b border-border p-3">
            <Select value={depFilter} onValueChange={setDepFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meus">Meus departamentos</SelectItem>
                <SelectItem value="todos">Todos os departamentos</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.slug} value={d.slug}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visible.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="Fila vazia, bom trabalho!"
                description="Nenhuma conversa aguardando neste filtro."
                className="m-4 border-0"
              />
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "flex w-full items-start gap-3 p-3 text-left transition-colors cursor-pointer hover:bg-accent",
                        selectedId === c.id && "bg-accent",
                      )}
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {c.nomeContato
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {c.nomeContato}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            há {c.esperaMin} min
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{c.ultimaMensagem}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={c.tipo === "lead" ? "outline" : "secondary"}
                            className="text-[10px]"
                          >
                            {c.tipo === "lead" ? "Lead" : "Cliente"}
                          </Badge>
                          {c.overflow ? (
                            <Badge className="border border-destructive/40 bg-destructive/10 text-[10px] text-destructive">
                              Aberta para qualquer área
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {departmentLabel(c.departamento)}
                            </Badge>
                          )}
                          {c.emAtendimentoPor && (
                            <Badge className="border border-success/40 bg-success/10 text-[10px] text-success">
                              com {c.emAtendimentoPor.split(" ")[0]}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Painel da conversa */}
        <div className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
          {!selected ? (
            <EmptyState
              icon={MessagesSquare}
              title="Selecione uma conversa"
              className="m-auto border-0"
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <p className="font-semibold text-foreground">{selected.nomeContato}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.empresa ?? "Lead — ainda não é cliente"} ·{" "}
                    {departmentLabel(selected.departamento)}
                  </p>
                </div>
                {!selected.emAtendimentoPor ? (
                  <Button size="sm" onClick={() => assumir(selected.id)}>
                    <UserCog /> Assumir conversa
                  </Button>
                ) : (
                  <Badge className="border border-success/40 bg-success/10 text-success">
                    Em atendimento por {selected.emAtendimentoPor}
                  </Badge>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {selected.mensagens.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-end gap-2",
                      m.remetente === "cliente" ? "justify-start" : "justify-end",
                    )}
                  >
                    {m.remetente === "cliente" && (
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback className="bg-secondary text-[10px]">
                          <User className="size-3" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-md rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                        m.remetente === "cliente" && "rounded-bl-sm bg-muted text-foreground",
                        m.remetente === "ia" && "rounded-br-sm bg-accent text-accent-foreground",
                        m.remetente === "humano" &&
                          "rounded-br-sm bg-primary text-primary-foreground",
                      )}
                    >
                      <p>{m.texto}</p>
                      <div
                        className={cn(
                          "mt-1 flex items-center gap-1 text-[10px] opacity-70",
                          m.remetente === "cliente" ? "text-muted-foreground" : "",
                        )}
                      >
                        {m.remetente === "ia" && (
                          <>
                            <Bot className="size-3" /> IA
                          </>
                        )}
                        {m.remetente === "humano" && (
                          <>
                            <UserCog className="size-3" /> Equipe
                          </>
                        )}
                        <span>· {m.hora}</span>
                      </div>
                    </div>
                    {m.remetente !== "cliente" && (
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback
                          className={cn(
                            "text-[10px]",
                            m.remetente === "ia"
                              ? "bg-accent text-accent-foreground"
                              : "bg-primary text-primary-foreground",
                          )}
                        >
                          {m.remetente === "ia" ? (
                            <Sparkles className="size-3" />
                          ) : (
                            <UserCog className="size-3" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                <p className="text-center text-[11px] italic text-muted-foreground">
                  Nara está digitando…
                </p>
              </div>

              <div className="flex items-end gap-2 border-t border-border p-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escreva uma resposta…"
                  className="min-h-11 flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={enviar}
                  disabled={!reply.trim()}
                  aria-label="Enviar mensagem"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {selected && (
        <CopilotWidget
          context={`Conversa com ${selected.nomeContato}${selected.empresa ? ` (${selected.empresa})` : ""}, departamento ${departmentLabel(selected.departamento)}.`}
          onInsertDraft={(text) => setReply(text)}
        />
      )}
    </AppShell>
  );
}
