// Interface plugável do canal de mensageria (PRD 10.1, 10.3) — hoje só a
// Meta Cloud API é implementada, mas nada no resto do sistema deve depender
// diretamente dela: tudo passa por este contrato.

export interface WhatsAppMessage {
  to: string;
  text: string;
}

export type WhatsAppSendResult =
  { ok: true; providerMessageId: string } | { ok: false; error: string };

export type WhatsAppTestResult = { ok: true; detail: string } | { ok: false; error: string };

export interface WhatsAppProvider {
  readonly name: string;
  isConfigured(): boolean;
  sendMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult>;
  testConnection(): Promise<WhatsAppTestResult>;
}
