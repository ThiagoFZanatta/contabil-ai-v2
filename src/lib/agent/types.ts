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
