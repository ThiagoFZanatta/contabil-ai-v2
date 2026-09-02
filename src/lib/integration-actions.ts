import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Server functions de gestão das integrações (PRD 10.1, 10.3, 10.4).
// Toda leitura de status/metadados não sensíveis é feita direto pelo
// client SDK (RLS já permite para a própria equipe); só a escrita do
// segredo e o teste de conexão passam por aqui, com o service role
// carregado dinamicamente (nunca no topo do arquivo, que vai para o
// bundle do cliente).

async function requireAdminCaller(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ tenant_id: string; is_admin: boolean }> {
  const { data: caller, error } = await supabase
    .from("staff")
    .select("tenant_id, is_admin")
    .eq("id", userId)
    .single();

  if (error || !caller) {
    throw new Error("Não foi possível confirmar seu cadastro de equipe.");
  }
  if (!caller.is_admin) {
    throw new Error("Apenas administradores podem gerenciar integrações.");
  }
  return caller;
}

const saveWhatsAppInput = z.object({
  phoneNumberId: z.string().trim().min(1, "Informe o Phone Number ID."),
  wabaId: z.string().trim().min(1, "Informe o WABA ID."),
  phoneNumber: z.string().trim().min(1, "Informe o número do WhatsApp."),
  accessToken: z.string().trim().min(1, "Informe o token de acesso."),
  appSecret: z.string().trim().min(1, "Informe o App Secret."),
});

export const saveWhatsAppCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => saveWhatsAppInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const caller = await requireAdminCaller(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: secretError } = await supabaseAdmin.from("tenant_integration_secrets").upsert(
      {
        tenant_id: caller.tenant_id,
        provider: "whatsapp",
        secret_value: data.accessToken,
      },
      { onConflict: "tenant_id,provider" },
    );
    if (secretError) {
      throw new Error(`Não foi possível salvar o token: ${secretError.message}`);
    }

    // App Secret é usado só para validar a assinatura de cada entrega do
    // webhook (X-Hub-Signature-256) — não é o token de envio, por isso vive
    // como uma segunda linha de segredo, sob uma chave própria.
    const { error: appSecretError } = await supabaseAdmin.from("tenant_integration_secrets").upsert(
      {
        tenant_id: caller.tenant_id,
        provider: "whatsapp_app_secret",
        secret_value: data.appSecret,
      },
      { onConflict: "tenant_id,provider" },
    );
    if (appSecretError) {
      throw new Error(`Não foi possível salvar o App Secret: ${appSecretError.message}`);
    }

    const { error: integrationError } = await supabaseAdmin.from("tenant_integrations").upsert(
      {
        tenant_id: caller.tenant_id,
        provider: "whatsapp",
        is_configured: true,
        metadata: {
          phone_number_id: data.phoneNumberId,
          waba_id: data.wabaId,
          phone_number: data.phoneNumber,
        },
        updated_by: userId,
      },
      { onConflict: "tenant_id,provider" },
    );
    if (integrationError) {
      throw new Error(`Não foi possível salvar a integração: ${integrationError.message}`);
    }

    // tenants.whatsapp_number já existia desde o schema estrutural (pensado
    // para esta etapa); meta_verification_status fica por conta do processo
    // real de verificação da Meta, não é setado aqui.
    const { error: tenantError } = await supabaseAdmin
      .from("tenants")
      .update({ whatsapp_number: data.phoneNumber })
      .eq("id", caller.tenant_id);
    if (tenantError) {
      throw new Error(`Não foi possível salvar o número do WhatsApp: ${tenantError.message}`);
    }

    return { ok: true as const };
  });

const saveOpenAiInput = z.object({
  apiKey: z.string().trim().min(1, "Informe a chave de API."),
});

export const saveOpenAiCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => saveOpenAiInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const caller = await requireAdminCaller(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: secretError } = await supabaseAdmin.from("tenant_integration_secrets").upsert(
      {
        tenant_id: caller.tenant_id,
        provider: "openai",
        secret_value: data.apiKey,
      },
      { onConflict: "tenant_id,provider" },
    );
    if (secretError) {
      throw new Error(`Não foi possível salvar a chave: ${secretError.message}`);
    }

    // Só toca is_configured/metadata aqui — ai_selected_model, se a linha já
    // existir, não é reescrito para o default pelo upsert (coluna omitida do
    // payload não entra no "on conflict do update"). Ver saveAiSelectedModel.
    const { error: integrationError } = await supabaseAdmin.from("tenant_integrations").upsert(
      {
        tenant_id: caller.tenant_id,
        provider: "openai",
        is_configured: true,
        metadata: {},
        updated_by: userId,
      },
      { onConflict: "tenant_id,provider" },
    );
    if (integrationError) {
      throw new Error(`Não foi possível salvar a integração: ${integrationError.message}`);
    }

    return { ok: true as const };
  });

const saveAiSelectedModelInput = z.object({
  model: z.enum(["gpt-5-mini", "gpt-5", "gpt-5-nano"]),
});

// Troca só o modelo GPT curado (PRD 10.1/RF11, v1.5) sem exigir reenviar a
// chave de API — a credencial e a escolha de modelo são independentes na
// UI (Tela 8), mesmo vivendo na mesma linha de tenant_integrations.
export const saveAiSelectedModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => saveAiSelectedModelInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const caller = await requireAdminCaller(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("tenant_integrations").upsert(
      {
        tenant_id: caller.tenant_id,
        provider: "openai",
        ai_selected_model: data.model,
        updated_by: userId,
      },
      { onConflict: "tenant_id,provider" },
    );
    if (error) {
      throw new Error(`Não foi possível salvar o modelo selecionado: ${error.message}`);
    }

    return { ok: true as const };
  });

const providerInput = z.object({
  provider: z.enum(["whatsapp", "openai"]),
});

export const removeIntegrationCredential = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => providerInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const caller = await requireAdminCaller(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Primeiro desliga is_configured (o gatilho no banco não deixaria
    // permanecer true sem segredo), só depois apaga o segredo em si.
    const { error: integrationError } = await supabaseAdmin
      .from("tenant_integrations")
      .update({ is_configured: false, updated_by: userId })
      .eq("tenant_id", caller.tenant_id)
      .eq("provider", data.provider);
    if (integrationError) {
      throw new Error(`Não foi possível desativar a integração: ${integrationError.message}`);
    }

    const { error: secretError } = await supabaseAdmin
      .from("tenant_integration_secrets")
      .delete()
      .eq("tenant_id", caller.tenant_id)
      .eq("provider", data.provider);
    if (secretError) {
      throw new Error(`Não foi possível remover a credencial: ${secretError.message}`);
    }

    if (data.provider === "whatsapp") {
      const { error: appSecretError } = await supabaseAdmin
        .from("tenant_integration_secrets")
        .delete()
        .eq("tenant_id", caller.tenant_id)
        .eq("provider", "whatsapp_app_secret");
      if (appSecretError) {
        throw new Error(`Não foi possível remover o App Secret: ${appSecretError.message}`);
      }
    }

    return { ok: true as const };
  });

export const testWhatsAppConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const caller = await requireAdminCaller(supabase, userId);

    const { resolveWhatsAppProvider } = await import("@/lib/integrations/resolve.server");
    const provider = await resolveWhatsAppProvider(caller.tenant_id);

    if (!provider.isConfigured()) {
      return { ok: false as const, error: "WhatsApp ainda não configurado para este tenant." };
    }

    return provider.testConnection();
  });

export const testOpenAiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const caller = await requireAdminCaller(supabase, userId);

    const { resolveAiProvider } = await import("@/lib/integrations/resolve.server");
    const provider = await resolveAiProvider(caller.tenant_id);

    if (!provider.isConfigured()) {
      return { ok: false as const, error: "OpenAI ainda não configurado para este tenant." };
    }

    return provider.testConnection();
  });
