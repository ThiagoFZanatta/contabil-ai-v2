import type { AiAgentResult, AiProvider, AiTestResult } from "./types";

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicContentBlock {
  type: "text" | "tool_use";
  text?: string;
  name?: string;
  input?: unknown;
}

// Implementação real da Anthropic Messages API, atrás da AiProvider. Serve
// tanto o motor de atendimento (RF03) quanto o copiloto interno (RF11) —
// nenhum dos dois deve chamar fetch() para api.anthropic.com diretamente.
export function createAnthropicProvider(config: AnthropicConfig | null): AiProvider {
  return {
    name: "anthropic",

    isConfigured(): boolean {
      return config !== null;
    },

    async callAgent({ systemPrompt, messages, tools }): Promise<AiAgentResult> {
      if (!config) {
        return { ok: false, error: "Anthropic não configurado para este tenant" };
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model ?? DEFAULT_MODEL,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: 1024,
          ...(tools && tools.length > 0
            ? {
                tools: tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  input_schema: t.inputSchema,
                })),
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { ok: false, error: `Anthropic API respondeu ${response.status}: ${errorBody}` };
      }

      const body = (await response.json()) as { content?: AnthropicContentBlock[] };
      const blocks = body.content ?? [];

      const text = blocks
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text)
        .join("\n");

      const toolCalls = blocks
        .filter((b) => b.type === "tool_use" && b.name)
        .map((b) => ({ name: b.name as string, input: b.input }));

      return { ok: true, text, toolCalls };
    },

    async testConnection(): Promise<AiTestResult> {
      if (!config) {
        return { ok: false, error: "Anthropic não configurado para este tenant" };
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.model ?? DEFAULT_MODEL,
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return { ok: false, error: `Anthropic API respondeu ${response.status}: ${errorBody}` };
      }

      const body = (await response.json()) as { model?: string };
      return {
        ok: true,
        detail: `Conectado ao modelo ${body.model ?? config.model ?? DEFAULT_MODEL}`,
      };
    },
  };
}
