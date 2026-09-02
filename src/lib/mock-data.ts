// Tipos e helpers de status de documento (RF02/RF04), compartilhados entre
// as telas de Clientes e o badge de status — o resto deste arquivo (fila de
// conversas, agenda, leads etc.) já foi substituído por dados reais do
// Supabase nas respectivas telas.

export type DocStatus = "em_dia" | "pendente" | "atrasado";

export function statusLabel(status: DocStatus) {
  return { em_dia: "Em dia", pendente: "Pendente", atrasado: "Atrasado" }[status];
}
