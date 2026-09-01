// Interface plugável do motor de IA conversacional (PRD 10.1, 10.4) — hoje
// só a Anthropic é implementada, mas o motor de atendimento (RF03) e o
// copiloto interno (RF11) devem depender só deste contrato.

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type AiAgentResult =
  | { ok: true; text: string; toolCalls: Array<{ name: string; input: unknown }> }
  | { ok: false; error: string };

export type AiTestResult = { ok: true; detail: string } | { ok: false; error: string };

export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  callAgent(params: {
    systemPrompt: string;
    messages: AiMessage[];
    tools?: AiToolDefinition[];
  }): Promise<AiAgentResult>;
  testConnection(): Promise<AiTestResult>;
}
