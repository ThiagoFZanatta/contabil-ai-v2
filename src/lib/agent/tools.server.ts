import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import type { AiToolDefinition } from "@/lib/integrations/ai/types";
import { DEPARTMENT_SLUGS, fromBusinessHoursWallClock, type ToolContext } from "./types";

// As 9 ferramentas do motor conversacional (PRD seção 10.2, RF03/04/05/06/
// 08/09). Cada uma fala só com o Supabase (via service role, chamada só a
// partir do orquestrador — nunca exposta a um caller autenticado comum) —
// o modelo de IA nunca toca o banco diretamente, só decide qual chamar e
// com quais argumentos, através da interface genérica AiToolDefinition.

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export const AGENT_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    name: "get_client_context",
    description:
      "Busca os dados cadastrais e o contexto (regime tributário, observações) da empresa ativa na conversa, ou os dados de qualificação se o contato for um lead.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "check_pending_documents",
    description:
      "Consulta os documentos configurados para a empresa ativa na conversa, com periodicidade, prazo e status (em dia, vence hoje ou atrasado).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_knowledge_base",
    description:
      "Busca na base de conhecimento (FAQ cadastrado pelo escritório) por perguntas/respostas relacionadas à dúvida do cliente. Use antes de responder qualquer dúvida geral com conhecimento próprio.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Termos de busca, em português." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "check_availability",
    description: "Consulta horários livres da equipe de um departamento em uma data específica.",
    inputSchema: {
      type: "object",
      properties: {
        departmentSlug: { type: "string", enum: [...DEPARTMENT_SLUGS] },
        preferredDate: { type: "string", description: "Data no formato YYYY-MM-DD" },
        durationMin: { type: "number", description: "Duração em minutos (padrão 30)" },
      },
      required: ["departmentSlug", "preferredDate"],
      additionalProperties: false,
    },
  },
  {
    name: "book_appointment",
    description:
      "Confirma um compromisso usando um staffId e horário retornados por check_availability. Nunca chame sem antes checar disponibilidade.",
    inputSchema: {
      type: "object",
      properties: {
        staffId: { type: "string" },
        title: { type: "string" },
        appointmentType: { type: "string", enum: ["ligacao", "video", "presencial"] },
        startAt: { type: "string", description: "Timestamp ISO 8601, ex: 2026-09-03T14:00:00Z" },
        durationMin: { type: "number" },
      },
      required: ["staffId", "startAt"],
      additionalProperties: false,
    },
  },
  {
    name: "escalate_to_department",
    description:
      "Encaminha a conversa para a fila humana de um departamento quando a IA não consegue resolver a dúvida ou não tem certeza da resposta (nunca invente informação fiscal específica de um cliente).",
    inputSchema: {
      type: "object",
      properties: {
        departmentSlug: { type: "string", enum: [...DEPARTMENT_SLUGS] },
        reason: { type: "string" },
      },
      required: ["departmentSlug", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "create_lead",
    description:
      "Registra os dados iniciais de qualificação de um lead novo: nome, segmento do negócio e motivo do contato.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        segment: { type: "string" },
        reason: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "qualify_lead",
    description:
      "Marca o lead como qualificado depois de já ter coletado nome, segmento e motivo do contato, e tenta encaminhar para agendamento com o SDR/Closer.",
    inputSchema: {
      type: "object",
      properties: { segment: { type: "string" }, reason: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "resolve_active_client",
    description:
      "Quando o contato tem mais de uma empresa (CNPJ) vinculada, identifica qual empresa está ativa nesta conversa. Chame sem 'choice' para listar as opções antes de perguntar ao cliente, e de novo com 'choice' depois que ele responder.",
    inputSchema: {
      type: "object",
      properties: { choice: { type: "string" } },
      additionalProperties: false,
    },
  },
];

async function getState(
  ctx: ToolContext,
): Promise<{ active_client_id: string | null; context: Json }> {
  const { data } = await supabaseAdmin
    .from("agent_conversation_state")
    .select("active_client_id, context")
    .eq("conversation_id", ctx.conversationId)
    .maybeSingle();
  return data ?? { active_client_id: null, context: {} };
}

export async function setActiveClient(ctx: ToolContext, clientId: string): Promise<void> {
  await supabaseAdmin
    .from("agent_conversation_state")
    .upsert(
      { conversation_id: ctx.conversationId, tenant_id: ctx.tenantId, active_client_id: clientId },
      { onConflict: "conversation_id" },
    );
}

async function getClientContext(ctx: ToolContext): Promise<unknown> {
  if (ctx.leadId) {
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("name, segment, reason, stage")
      .eq("id", ctx.leadId)
      .single();
    return { type: "lead", ...lead };
  }

  const state = await getState(ctx);
  if (!state.active_client_id) {
    return { error: "Empresa ainda não identificada — chame resolve_active_client primeiro." };
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("name, cnpj, tax_regime, notes")
    .eq("id", state.active_client_id)
    .single();
  return { type: "client", ...client };
}

async function checkPendingDocuments(ctx: ToolContext): Promise<unknown> {
  const state = await getState(ctx);
  if (!state.active_client_id) {
    return { error: "Empresa ainda não identificada — chame resolve_active_client primeiro." };
  }

  const { data } = await supabaseAdmin
    .from("client_document_config")
    .select("name, periodicity, next_due_date")
    .eq("client_id", state.active_client_id)
    .eq("enabled", true)
    .order("next_due_date", { ascending: true });

  const today = new Date().toISOString().slice(0, 10);
  const documents = (data ?? []).map((d) => ({
    name: d.name,
    periodicity: d.periodicity,
    next_due_date: d.next_due_date,
    status:
      d.next_due_date === null
        ? "sob_demanda"
        : d.next_due_date < today
          ? "atrasado"
          : d.next_due_date === today
            ? "vence_hoje"
            : "em_dia",
  }));

  return { documents };
}

// Sem pipeline de embeddings/pgvector ainda (RAG completo sobre
// knowledge_base_documents é um gap documentado, não implementado nesta
// etapa) — a busca aqui é lexical, só sobre o FAQ manual (RF07), que já
// cobre o critério de aceite de "priorizar a base de conhecimento antes de
// responder de forma genérica" para o caso mais comum (perguntas
// frequentes).
async function searchKnowledgeBase(ctx: ToolContext, input: unknown): Promise<unknown> {
  const query = asString(asRecord(input)["query"])?.toLowerCase();
  if (!query) return { results: [] };

  const { data } = await supabaseAdmin
    .from("knowledge_base_faq")
    .select("question, answer")
    .eq("tenant_id", ctx.tenantId);

  const terms = query.split(/\s+/).filter(Boolean);
  const results = (data ?? [])
    .map((faq) => {
      const haystack = `${faq.question} ${faq.answer}`.toLowerCase();
      const score = terms.filter((t) => haystack.includes(t)).length;
      return { faq, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => r.faq);

  return { results };
}

interface BusyRange {
  start: number;
  end: number;
}

async function checkAvailability(ctx: ToolContext, input: unknown): Promise<unknown> {
  const record = asRecord(input);
  const departmentSlug = asString(record["departmentSlug"]);
  const preferredDate = asString(record["preferredDate"]) ?? new Date().toISOString().slice(0, 10);
  const durationMin = asNumber(record["durationMin"]) ?? 30;

  if (!departmentSlug) return { error: "departmentSlug é obrigatório." };

  const { data: department } = await supabaseAdmin
    .from("departments")
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .eq("slug", departmentSlug)
    .maybeSingle();
  if (!department) return { error: `Departamento '${departmentSlug}' não encontrado.` };

  const { data: staffRows } = await supabaseAdmin
    .from("staff_departments")
    .select("staff_id")
    .eq("department_id", department.id);
  const staffIds = (staffRows ?? []).map((r) => r.staff_id);
  if (staffIds.length === 0) return { slots: [] };

  const dayOfWeek = new Date(`${preferredDate}T00:00:00Z`).getUTCDay();
  const { data: hours } = await supabaseAdmin
    .from("business_hours")
    .select("start_time, end_time")
    .eq("tenant_id", ctx.tenantId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();
  if (!hours) return { slots: [], note: "Fora do horário comercial configurado para este dia." };

  // hours.start_time/end_time são horário local (ver nota em types.ts) —
  // fromBusinessHoursWallClock converte para o instante UTC real antes de
  // comparar contra appointments/staff_time_blocks (que são UTC de verdade).
  const dayStart = fromBusinessHoursWallClock(
    new Date(`${preferredDate}T${hours.start_time}Z`),
  ).getTime();
  const dayEnd = fromBusinessHoursWallClock(
    new Date(`${preferredDate}T${hours.end_time}Z`),
  ).getTime();
  if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || dayStart >= dayEnd) {
    return { slots: [], note: "Data inválida." };
  }

  const [{ data: appts }, { data: blocks }] = await Promise.all([
    supabaseAdmin
      .from("appointments")
      .select("staff_id, start_at, duration_min")
      .in("staff_id", staffIds)
      .gte("start_at", new Date(dayStart).toISOString())
      .lt("start_at", new Date(dayEnd).toISOString()),
    supabaseAdmin
      .from("staff_time_blocks")
      .select("staff_id, start_at, end_at")
      .in("staff_id", staffIds)
      .lt("start_at", new Date(dayEnd).toISOString())
      .gt("end_at", new Date(dayStart).toISOString()),
  ]);

  const busyByStaff = new Map<string, BusyRange[]>();
  const pushBusy = (staffId: string, start: number, end: number) => {
    const list = busyByStaff.get(staffId) ?? [];
    list.push({ start, end });
    busyByStaff.set(staffId, list);
  };
  for (const a of appts ?? []) {
    const start = new Date(a.start_at).getTime();
    pushBusy(a.staff_id, start, start + a.duration_min * 60_000);
  }
  for (const b of blocks ?? []) {
    pushBusy(b.staff_id, new Date(b.start_at).getTime(), new Date(b.end_at).getTime());
  }

  const stepMs = 30 * 60_000;
  const durationMs = durationMin * 60_000;
  const slots: Array<{ staffId: string; startAt: string }> = [];

  outer: for (const staffId of staffIds) {
    const busy = busyByStaff.get(staffId) ?? [];
    for (let t = dayStart; t + durationMs <= dayEnd; t += stepMs) {
      const slotEnd = t + durationMs;
      const overlaps = busy.some((b) => t < b.end && slotEnd > b.start);
      if (!overlaps) {
        slots.push({ staffId, startAt: new Date(t).toISOString() });
        if (slots.length >= 5) break outer;
      }
    }
  }

  const { data: staffNames } = await supabaseAdmin
    .from("staff")
    .select("id, name")
    .in("id", staffIds);
  const nameById = new Map((staffNames ?? []).map((s) => [s.id, s.name]));

  return {
    slots: slots.map((s) => ({ ...s, staffName: nameById.get(s.staffId) ?? "" })),
  };
}

async function bookAppointment(ctx: ToolContext, input: unknown): Promise<unknown> {
  const record = asRecord(input);
  const staffId = asString(record["staffId"]);
  const startAt = asString(record["startAt"]);
  const durationMin = asNumber(record["durationMin"]) ?? 30;
  const appointmentTypeRaw = asString(record["appointmentType"]);
  const appointmentType = (["ligacao", "video", "presencial"] as const).includes(
    appointmentTypeRaw as never,
  )
    ? (appointmentTypeRaw as "ligacao" | "video" | "presencial")
    : "ligacao";
  const title = asString(record["title"]) ?? "Atendimento agendado pela IA";

  if (!staffId || !startAt) return { error: "staffId e startAt são obrigatórios." };

  const state = await getState(ctx);
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      tenant_id: ctx.tenantId,
      title,
      client_id: state.active_client_id,
      lead_id: ctx.leadId,
      staff_id: staffId,
      appointment_type: appointmentType,
      start_at: startAt,
      duration_min: durationMin,
      origin: "ia",
    })
    .select("id, start_at")
    .single();

  if (error) {
    // 23P01 = exclusion_violation — a constraint appointments_no_overlap_per_staff
    // (RF06) pegou um conflito de horário para o mesmo staff.
    if (error.code === "23P01") {
      return {
        error: "Esse horário acabou de ficar indisponível. Escolha outro com check_availability.",
      };
    }
    return { error: `Não foi possível agendar: ${error.message}` };
  }

  return { ok: true, appointmentId: data.id, startAt: data.start_at };
}

export async function escalateToDepartment(ctx: ToolContext, input: unknown): Promise<unknown> {
  const record = asRecord(input);
  const departmentSlug = asString(record["departmentSlug"]);
  const reason = asString(record["reason"]) ?? "Motivo não informado";

  if (!departmentSlug) return { error: "departmentSlug é obrigatório." };

  const { data: department } = await supabaseAdmin
    .from("departments")
    .select("id, name")
    .eq("tenant_id", ctx.tenantId)
    .eq("slug", departmentSlug)
    .maybeSingle();
  if (!department) return { error: `Departamento '${departmentSlug}' não encontrado.` };

  const { error: convError } = await supabaseAdmin
    .from("conversations")
    .update({ status: "fila_departamento", department_id: department.id })
    .eq("id", ctx.conversationId);
  if (convError) return { error: `Não foi possível escalar: ${convError.message}` };

  await supabaseAdmin.from("escalations").insert({
    tenant_id: ctx.tenantId,
    conversation_id: ctx.conversationId,
    department_id: department.id,
  });

  await supabaseAdmin
    .from("agent_conversation_state")
    .upsert(
      { conversation_id: ctx.conversationId, tenant_id: ctx.tenantId, is_escalated: true },
      { onConflict: "conversation_id" },
    );

  return { ok: true, department: department.name, reason };
}

async function createLeadTool(ctx: ToolContext, input: unknown): Promise<unknown> {
  if (!ctx.leadId) return { error: "Esta conversa não é de um lead." };
  const record = asRecord(input);
  const patch: Database["public"]["Tables"]["leads"]["Update"] = {};
  const name = asString(record["name"]);
  const segment = asString(record["segment"]);
  const reason = asString(record["reason"]);
  if (name) patch["name"] = name;
  if (segment) patch["segment"] = segment;
  if (reason) patch["reason"] = reason;
  if (Object.keys(patch).length === 0) return { error: "Nada para atualizar." };

  const { error } = await supabaseAdmin.from("leads").update(patch).eq("id", ctx.leadId);
  if (error) return { error: error.message };
  return { ok: true };
}

async function qualifyLead(ctx: ToolContext, input: unknown): Promise<unknown> {
  if (!ctx.leadId) return { error: "Esta conversa não é de um lead." };
  const record = asRecord(input);
  const patch: Database["public"]["Tables"]["leads"]["Update"] = { stage: "qualificado" };
  const segment = asString(record["segment"]);
  const reason = asString(record["reason"]);
  if (segment) patch["segment"] = segment;
  if (reason) patch["reason"] = reason;

  const { error } = await supabaseAdmin.from("leads").update(patch).eq("id", ctx.leadId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function resolveActiveClient(ctx: ToolContext, input: unknown): Promise<unknown> {
  if (!ctx.contactId)
    return { error: "Esta conversa não tem contato vinculado a CNPJ (é um lead)." };

  const { data: links } = await supabaseAdmin
    .from("client_contact_links")
    .select("client_id, clients(name, cnpj)")
    .eq("contact_id", ctx.contactId);

  const candidates = (links ?? [])
    .map((l) => {
      const client = l.clients as { name: string; cnpj: string } | null;
      return client ? { id: l.client_id, name: client.name, cnpj: client.cnpj } : null;
    })
    .filter((c): c is { id: string; name: string; cnpj: string } => c !== null);

  if (candidates.length === 0) return { error: "Nenhuma empresa vinculada a este contato." };

  const onlyCandidate = candidates.length === 1 ? candidates[0] : undefined;
  if (onlyCandidate) {
    await setActiveClient(ctx, onlyCandidate.id);
    return { resolved: true, client: onlyCandidate };
  }

  const choice = asString(asRecord(input)["choice"])?.toLowerCase();
  if (!choice) {
    return { resolved: false, options: candidates };
  }

  const match = candidates.find(
    (c) => c.name.toLowerCase().includes(choice) || c.cnpj.includes(choice),
  );
  if (!match) {
    return {
      resolved: false,
      options: candidates,
      error: "Não encontrei essa empresa entre as vinculadas.",
    };
  }

  await setActiveClient(ctx, match.id);
  return { resolved: true, client: match };
}

export async function executeAgentTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  switch (name) {
    case "get_client_context":
      return getClientContext(ctx);
    case "check_pending_documents":
      return checkPendingDocuments(ctx);
    case "search_knowledge_base":
      return searchKnowledgeBase(ctx, input);
    case "check_availability":
      return checkAvailability(ctx, input);
    case "book_appointment":
      return bookAppointment(ctx, input);
    case "escalate_to_department":
      return escalateToDepartment(ctx, input);
    case "create_lead":
      return createLeadTool(ctx, input);
    case "qualify_lead":
      return qualifyLead(ctx, input);
    case "resolve_active_client":
      return resolveActiveClient(ctx, input);
    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}
