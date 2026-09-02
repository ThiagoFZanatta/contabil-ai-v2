// Contexto mínimo que toda tool/etapa da orquestração precisa para saber
// "de qual tenant, de qual conversa, e de quem" — evita que cada função
// tenha que redescobrir isso a partir do banco toda hora.
export interface ToolContext {
  tenantId: string;
  conversationId: string;
  contactId: string | null;
  leadId: string | null;
}

// Departamentos são fixos por tenant (seed automático — ver migration
// estrutural), então a lista de slugs pode ser um literal aqui em vez de
// uma consulta ao banco a cada tool call.
export const DEPARTMENT_SLUGS = ["fiscal", "societario", "financeiro", "dp_rh", "sdr"] as const;
export type DepartmentSlug = (typeof DEPARTMENT_SLUGS)[number];

// business_hours.start_time/end_time guardam horário local (ex: "08:00",
// combinando com o exemplo do RF10 e com o seed da migration) — não UTC.
// Simplificação aceita para o MVP (um único escritório, no Brasil, sem
// horário de verão desde 2019); vira coluna por tenant na fase de revenda
// multi-fuso (seção 11 do PRD). Compartilhado entre orchestrator.server.ts
// e tools.server.ts para as duas conversões (local -> UTC e UTC -> local)
// nunca divergirem.
export const BUSINESS_HOURS_UTC_OFFSET_MS = -3 * 60 * 60 * 1000;

// Direita: um instante UTC real -> um Date cujos acessores getUTCDay()/
// toISOString() leem como se fossem o relógio local (truque de fuso fixo).
export function toBusinessHoursWallClock(date: Date): Date {
  return new Date(date.getTime() + BUSINESS_HOURS_UTC_OFFSET_MS);
}

// Inversa: recebe um Date construído tratando o horário local como se fosse
// UTC (ex: new Date(`${data}T${hours.start_time}Z`) — sempre com o sufixo
// "Z" explícito, nunca deixando o parser cair no fuso ambiente do runtime)
// e devolve o instante UTC real correspondente.
export function fromBusinessHoursWallClock(literalUtcDate: Date): Date {
  return new Date(literalUtcDate.getTime() - BUSINESS_HOURS_UTC_OFFSET_MS);
}
