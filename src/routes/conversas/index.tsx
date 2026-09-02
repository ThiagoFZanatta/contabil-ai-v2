import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bot, MessagesSquare, Send, Sparkles, User, UserCog } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CopilotWidget } from "@/components/common/copilot-widget";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import { supabase } from "@/integrations/supabase/client";
import { sendConversationReply } from "@/lib/conversation-actions";

export const Route = createFileRoute("/conversas/")({
  component: ConversasPage,
});

interface DepartmentRow {
  id: string;
  slug: string;
  name: string;
}

interface QueueItem {
  escalationId: string;
  conversationId: string;
  contactName: string;
  companyName: string | null;
  isLead: boolean;
  departmentSlug: string;
  departmentName: string;
  waitMin: number;
  isOverflow: boolean;
  claimedByName: string | null;
  lastMessage: string;
}

interface MessageRow {
  id: string;
  sender: string;
  body: string;
  created_at: string;
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function ConversasPage() {
  const session = useCurrentStaff();
  const tenantId = session.status === "ready" ? session.staff.tenantId : null;

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [depFilter, setDepFilter] = useState<string>("meus");
  const [queueItems, setQueueItems] = useState<QueueItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("departments")
      .select("id, slug, name")
      .eq("tenant_id", tenantId)
      .order("name")
      .then(({ data }) => setDepartments(data ?? []));
  }, [tenantId]);

  function departmentLabel(slug: string) {
    return departments.find((d) => d.slug === slug)?.name ?? slug;
  }

  async function loadQueue() {
    if (!tenantId) return;

    const { data: escalationRows } = await supabase
      .from("escalations")
      .select(
        `id, conversation_id, escalated_at, is_overflow,
         departments ( slug, name ),
         claimed_staff:staff!escalations_claimed_by_fkey ( name ),
         conversations (
           id, contact_id, lead_id,
           contacts ( id, name ),
           leads ( id, name )
         )`,
      )
      .eq("tenant_id", tenantId)
      .is("resolved_at", null)
      .order("escalated_at", { ascending: true });

    const rows = escalationRows ?? [];

    const contactIds = Array.from(
      new Set(
        rows
          .map(
            (e) => (e.conversations as unknown as { contact_id: string | null } | null)?.contact_id,
          )
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const companyByContact = new Map<string, string>();
    if (contactIds.length > 0) {
      const { data: links } = await supabase
        .from("client_contact_links")
        .select("contact_id, clients(name)")
        .in("contact_id", contactIds);
      for (const link of links ?? []) {
        const clientRel = link.clients as unknown as { name: string } | null;
        if (clientRel?.name && !companyByContact.has(link.contact_id)) {
          companyByContact.set(link.contact_id, clientRel.name);
        }
      }
    }

    const now = Date.now();
    const seenConversations = new Set<string>();
    const items: QueueItem[] = [];
    for (const e of rows) {
      const conv = e.conversations as unknown as {
        id: string;
        contact_id: string | null;
        lead_id: string | null;
        contacts: { id: string; name: string } | null;
        leads: { id: string; name: string } | null;
      } | null;
      if (!conv || seenConversations.has(conv.id)) continue;
      seenConversations.add(conv.id);

      const dept = e.departments as unknown as { slug: string; name: string } | null;
      const claimedStaff = e.claimed_staff as unknown as { name: string } | null;

      items.push({
        escalationId: e.id,
        conversationId: conv.id,
        contactName: conv.contacts?.name ?? conv.leads?.name ?? "Contato",
        companyName: conv.contact_id ? (companyByContact.get(conv.contact_id) ?? null) : null,
        isLead: Boolean(conv.lead_id),
        departmentSlug: dept?.slug ?? "",
        departmentName: dept?.name ?? "",
        waitMin: Math.max(0, Math.round((now - new Date(e.escalated_at).getTime()) / 60000)),
        isOverflow: e.is_overflow,
        claimedByName: claimedStaff?.name ?? null,
        lastMessage: "",
      });
    }

    const conversationIds = items.map((i) => i.conversationId);
    if (conversationIds.length > 0) {
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("conversation_id, body")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });
      const lastByConversation = new Map<string, string>();
      for (const m of recentMessages ?? []) {
        if (!lastByConversation.has(m.conversation_id)) {
          lastByConversation.set(m.conversation_id, m.body);
        }
      }
      for (const item of items) {
        item.lastMessage = lastByConversation.get(item.conversationId) ?? "";
      }
    }

    setQueueItems(items);
  }

  useEffect(() => {
    if (tenantId) loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (queueItems && queueItems.length > 0 && !selectedId) {
      setSelectedId(queueItems[0]!.conversationId);
    }
  }, [queueItems, selectedId]);

  async function loadMessages(conversationId: string) {
    const { data } = await supabase
      .from("messages")
      .select("id, sender, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
  }

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId]);

  const visible = useMemo(() => {
    if (!queueItems) return [];
    return queueItems.filter((c) => {
      if (depFilter === "meus")
        return (
          (session.status === "ready" &&
            session.staff.departmentSlugs.includes(c.departmentSlug)) ||
          c.isOverflow
        );
      if (depFilter === "todos") return true;
      return c.departmentSlug === depFilter;
    });
  }, [queueItems, depFilter, session]);

  const selected = (queueItems ?? []).find((c) => c.conversationId === selectedId) ?? null;

  async function assumir(item: QueueItem) {
    if (session.status !== "ready") return;
    const [escResult, convResult] = await Promise.all([
      supabase
        .from("escalations")
        .update({ claimed_by: session.staff.id, claimed_at: new Date().toISOString() })
        .eq("id", item.escalationId),
      supabase
        .from("conversations")
        .update({ assigned_to: session.staff.id, status: "em_atendimento" })
        .eq("id", item.conversationId),
    ]);
    if (escResult.error || convResult.error) {
      toast.error("Não foi possível assumir a conversa.");
      return;
    }
    toast.success("Você assumiu esta conversa.");
    await loadQueue();
  }

  async function enviar() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      await sendConversationReply({
        data: { conversationId: selected.conversationId, text: reply.trim() },
      });
      setReply("");
      await Promise.all([loadMessages(selected.conversationId), loadQueue()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
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
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {queueItems === null ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="Fila vazia, bom trabalho!"
                description="Nenhuma conversa aguardando neste filtro."
                className="m-4 border-0"
              />
            ) : (
              <ul className="divide-y divide-border">
                {visible.map((c) => (
                  <li key={c.conversationId}>
                    <button
                      onClick={() => setSelectedId(c.conversationId)}
                      className={cn(
                        "flex w-full items-start gap-3 p-3 text-left transition-colors cursor-pointer hover:bg-accent",
                        selectedId === c.conversationId && "bg-accent",
                      )}
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {c.contactName
                            .split(" ")
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {c.contactName}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            há {c.waitMin} min
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.lastMessage || "Sem mensagens ainda"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={c.isLead ? "outline" : "secondary"}
                            className="text-[10px]"
                          >
                            {c.isLead ? "Lead" : "Cliente"}
                          </Badge>
                          {c.isOverflow ? (
                            <Badge className="border border-destructive/40 bg-destructive/10 text-[10px] text-destructive">
                              Aberta para qualquer área
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {c.departmentName}
                            </Badge>
                          )}
                          {c.claimedByName && (
                            <Badge className="border border-success/40 bg-success/10 text-[10px] text-success">
                              com {c.claimedByName.split(" ")[0]}
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
                  <p className="font-semibold text-foreground">{selected.contactName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.companyName ?? "Lead — ainda não é cliente"} ·{" "}
                    {departmentLabel(selected.departmentSlug)}
                  </p>
                </div>
                {!selected.claimedByName ? (
                  <Button size="sm" onClick={() => assumir(selected)}>
                    <UserCog /> Assumir conversa
                  </Button>
                ) : (
                  <Badge className="border border-success/40 bg-success/10 text-success">
                    Em atendimento por {selected.claimedByName}
                  </Badge>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messages === null ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-2/3" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Nenhuma mensagem nesta conversa ainda.
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex items-end gap-2",
                        m.sender === "cliente" ? "justify-start" : "justify-end",
                      )}
                    >
                      {m.sender === "cliente" && (
                        <Avatar className="size-6 shrink-0">
                          <AvatarFallback className="bg-secondary text-[10px]">
                            <User className="size-3" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-md rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                          m.sender === "cliente" && "rounded-bl-sm bg-muted text-foreground",
                          m.sender === "ia" && "rounded-br-sm bg-accent text-accent-foreground",
                          m.sender === "humano" &&
                            "rounded-br-sm bg-primary text-primary-foreground",
                        )}
                      >
                        <p>{m.body}</p>
                        <div
                          className={cn(
                            "mt-1 flex items-center gap-1 text-[10px] opacity-70",
                            m.sender === "cliente" ? "text-muted-foreground" : "",
                          )}
                        >
                          {m.sender === "ia" && (
                            <>
                              <Bot className="size-3" /> IA
                            </>
                          )}
                          {m.sender === "humano" && (
                            <>
                              <UserCog className="size-3" /> Equipe
                            </>
                          )}
                          <span>· {formatHora(m.created_at)}</span>
                        </div>
                      </div>
                      {m.sender !== "cliente" && (
                        <Avatar className="size-6 shrink-0">
                          <AvatarFallback
                            className={cn(
                              "text-[10px]",
                              m.sender === "ia"
                                ? "bg-accent text-accent-foreground"
                                : "bg-primary text-primary-foreground",
                            )}
                          >
                            {m.sender === "ia" ? (
                              <Sparkles className="size-3" />
                            ) : (
                              <UserCog className="size-3" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-end gap-2 border-t border-border p-3">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escreva uma resposta…"
                  className="min-h-11 flex-1 resize-none"
                  disabled={sending}
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
                  disabled={!reply.trim() || sending}
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
          context={`Conversa com ${selected.contactName}${selected.companyName ? ` (${selected.companyName})` : ""}, departamento ${departmentLabel(selected.departmentSlug)}.`}
          conversationId={selected.conversationId}
          onInsertDraft={(text) => setReply(text)}
        />
      )}
    </AppShell>
  );
}
