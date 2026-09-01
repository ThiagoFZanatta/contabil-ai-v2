import type {
  WhatsAppMessage,
  WhatsAppProvider,
  WhatsAppSendResult,
  WhatsAppTestResult,
} from "./types";

export interface MetaCloudConfig {
  phoneNumberId: string;
  accessToken: string;
}

const GRAPH_API_VERSION = "v21.0";

// Implementação real da Meta Cloud API (WhatsApp Business API), atrás da
// WhatsAppProvider. Só é instanciada com config != null quando a credencial
// do tenant existir de verdade — até lá, o resolver entrega um provider
// "desligado" (isConfigured() === false) em vez disto.
export function createMetaCloudProvider(config: MetaCloudConfig | null): WhatsAppProvider {
  return {
    name: "meta-cloud",

    isConfigured(): boolean {
      return config !== null;
    },

    async sendMessage(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
      if (!config) {
        return { ok: false, error: "WhatsApp não configurado para este tenant" };
      }

      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: message.to,
            type: "text",
            text: { body: message.text },
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        return { ok: false, error: `Meta Cloud API respondeu ${response.status}: ${errorBody}` };
      }

      const body = (await response.json()) as { messages?: Array<{ id: string }> };
      const providerMessageId = body.messages?.[0]?.id;
      if (!providerMessageId) {
        return { ok: false, error: "Meta Cloud API não retornou id da mensagem" };
      }

      return { ok: true, providerMessageId };
    },

    async testConnection(): Promise<WhatsAppTestResult> {
      if (!config) {
        return { ok: false, error: "WhatsApp não configurado para este tenant" };
      }

      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}?fields=verified_name,code_verification_status`,
        { headers: { Authorization: `Bearer ${config.accessToken}` } },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        return { ok: false, error: `Meta Cloud API respondeu ${response.status}: ${errorBody}` };
      }

      const body = (await response.json()) as {
        verified_name?: string;
        code_verification_status?: string;
      };

      return {
        ok: true,
        detail: `Número verificado: ${body.verified_name ?? "—"} (status: ${body.code_verification_status ?? "desconhecido"})`,
      };
    },
  };
}
