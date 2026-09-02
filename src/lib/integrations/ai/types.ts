// Interface plugável do motor de IA conversacional (PRD 10.1, 10.4) — hoje
// só a OpenAI é implementada (v1.5, troca do provedor anterior), mas o
// motor de atendimento (RF03) e o copiloto interno (RF11) devem depender
// só deste contrato.

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

export type AiEmbedResult = { ok: true; vectors: number[][] } | { ok: false; error: string };

export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  callAgent(params: {
    systemPrompt: string;
    messages: AiMessage[];
    tools?: AiToolDefinition[];
  }): Promise<AiAgentResult>;
  testConnection(): Promise<AiTestResult>;
  // RAG (RF07): embeddings dos pedaços de texto extraídos dos documentos da
  // Base de Conhecimento, e da própria pergunta na hora da busca semântica.
  embed(texts: string[]): Promise<AiEmbedResult>;
}
