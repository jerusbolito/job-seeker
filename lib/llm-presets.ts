import type { LlmProvider } from "./types";

export const PROVIDER_PRESETS: Record<
  LlmProvider,
  { label: string; baseUrl?: string; defaultModel: string; needsKey: boolean }
> = {
  openai: { label: "OpenAI", defaultModel: "gpt-4o-mini", needsKey: true },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    needsKey: true,
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    needsKey: true,
  },
  anthropic: { label: "Anthropic", defaultModel: "claude-sonnet-4-5", needsKey: true },
  google: { label: "Google Gemini", defaultModel: "gemini-2.5-flash", needsKey: true },
  ollama: {
    label: "Ollama (local)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
    needsKey: false,
  },
  custom: { label: "OpenAI-compatible", defaultModel: "", needsKey: true },
};
