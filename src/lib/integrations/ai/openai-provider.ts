import type { AiAgentResult, AiEmbedResult, AiProvider, AiTestResult } from "./types";

export interface OpenAiConfig {
  apiKey: string;
  model?: string;
}

// Modelo de embedding fixo (RF07/RAG) — diferente do modelo de chat, não é
// selecionável por tenant: é uma escolha de custo/infraestrutura da própria
// migration de knowledge_base_chunks (coluna embedding vector(1536)), que
// esse modelo precisa continuar batendo.
const EMBEDDING_MODEL = "text-embedding-3-small";

// Lista curada citada no PRD (seção 10.1, v1.5) — não um catálogo aberto de
// todos os modelos da OpenAI. Mantida em código só para validar o valor
// vindo do form; a fonte de verdade da escolha é a coluna
// tenant_integrations.ai_selected_model (mesma lista no check constraint).
export const OPENAI_CURATED_MODELS = ["gpt-5-mini", "gpt-5", "gpt-5-nano"] as const;
export type OpenAiCuratedModel = (typeof OPENAI_CURATED_MODELS)[number];
export const DEFAULT_OPENAI_MODEL: OpenAiCuratedModel = "gpt-5-mini";

interface OpenAiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAiChoice {
  message?: { content?: string | null; tool_calls?: OpenAiToolCall[] };
}

function safeParseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// Implementação real da OpenAI Chat Completions API, atrás da AiProvider
// (PRD 10.1, v1.5 — substitui a Anthropic). Serve tanto o motor de
// atendimento (RF03) quanto o copiloto interno (RF11) — nenhum dos dois
// deve chamar fetch() para api.openai.com diretamente. O formato de tools
// da OpenAI (function calling) fica inteiramente encapsulado aqui: o
// restante da orquestração só fala com AiToolDefinition/AiAgentResult.
export function createOpenAiProvider(config: OpenAiConfig | null): AiProvider {
  return {
    name: "openai",

    isConfigured(): boolean {
      return config !== null;
    },

    async callAgent({ systemPrompt, messages, tools }): Promise<AiAgentResult> {
      if (!config) {
        return { ok: false, error: "OpenAI não configurado para este tenant" };
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model ?? DEFAULT_OPENAI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          ...(tools && tools.length > 0
            ? {
                tools: tools.map((t) => ({
                  type: "function",
                  function: { name: t.name, description: t.description, parameters: t.inputSchema },
                })),
                tool_choice: "auto",
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { ok: false, error: `OpenAI API respondeu ${response.status}: ${errorBody}` };
      }

      const body = (await response.json()) as { choices?: OpenAiChoice[] };
      const message = body.choices?.[0]?.message;

      const toolCalls = (message?.tool_calls ?? []).map((call) => ({
        name: call.function.name,
        input: safeParseToolArguments(call.function.arguments),
      }));

      return { ok: true, text: message?.content ?? "", toolCalls };
    },

    async testConnection(): Promise<AiTestResult> {
      if (!config) {
        return { ok: false, error: "OpenAI não configurado para este tenant" };
      }

      const model = config.model ?? DEFAULT_OPENAI_MODEL;
      const response = await fetch(`https://api.openai.com/v1/models/${model}`, {
        headers: { authorization: `Bearer ${config.apiKey}` },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { ok: false, error: `OpenAI API respondeu ${response.status}: ${errorBody}` };
      }

      const body = (await response.json()) as { id?: string };
      return { ok: true, detail: `Conectado ao modelo ${body.id ?? model}` };
    },

    async embed(texts: string[]): Promise<AiEmbedResult> {
      if (!config) {
        return { ok: false, error: "OpenAI não configurado para este tenant" };
      }
      if (texts.length === 0) {
        return { ok: true, vectors: [] };
      }

      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { ok: false, error: `OpenAI API respondeu ${response.status}: ${errorBody}` };
      }

      const body = (await response.json()) as {
        data?: Array<{ embedding: number[]; index: number }>;
      };
      const items = (body.data ?? []).slice().sort((a, b) => a.index - b.index);
      return { ok: true, vectors: items.map((item) => item.embedding) };
    },
  };
}
