// Resolve as credenciais reais de um tenant e monta as instâncias dos
// providers (Meta Cloud API / OpenAI) já prontas para uso. Nunca é
// importado no topo de um arquivo que vai para o bundle do cliente — só
// dinamicamente, de dentro de handlers de server function, já que este
// arquivo por sua vez importa o supabaseAdmin (service role) no topo, o
// que só é seguro em módulos ".server.ts".
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createOpenAiProvider } from "@/lib/integrations/ai/openai-provider";
import type { AiProvider } from "@/lib/integrations/ai/types";
import { createMetaCloudProvider } from "@/lib/integrations/whatsapp/meta-cloud-provider";
import type { WhatsAppProvider } from "@/lib/integrations/whatsapp/types";

async function getSecret(tenantId: string, provider: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("tenant_integration_secrets")
    .select("secret_value")
    .eq("tenant_id", tenantId)
    .eq("provider", provider)
    .maybeSingle();
  return data?.secret_value ?? null;
}

export async function resolveWhatsAppProvider(tenantId: string): Promise<WhatsAppProvider> {
  const { data: integration } = await supabaseAdmin
    .from("tenant_integrations")
    .select("is_configured, metadata")
    .eq("tenant_id", tenantId)
    .eq("provider", "whatsapp")
    .maybeSingle();

  if (!integration?.is_configured) {
    return createMetaCloudProvider(null);
  }

  const metadata = (integration.metadata ?? {}) as { phone_number_id?: string };
  const accessToken = await getSecret(tenantId, "whatsapp");

  if (!accessToken || !metadata.phone_number_id) {
    return createMetaCloudProvider(null);
  }

  return createMetaCloudProvider({ phoneNumberId: metadata.phone_number_id, accessToken });
}

export async function resolveAiProvider(tenantId: string): Promise<AiProvider> {
  const { data: integration } = await supabaseAdmin
    .from("tenant_integrations")
    .select("is_configured, ai_selected_model")
    .eq("tenant_id", tenantId)
    .eq("provider", "openai")
    .maybeSingle();

  if (!integration?.is_configured) {
    return createOpenAiProvider(null);
  }

  const apiKey = await getSecret(tenantId, "openai");
  if (!apiKey) {
    return createOpenAiProvider(null);
  }

  return createOpenAiProvider({ apiKey, model: integration.ai_selected_model });
}
