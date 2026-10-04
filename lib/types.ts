export type LlmProvider =
  | "openai"
  | "deepseek"
  | "groq"
  | "anthropic"
  | "google"
  | "ollama"
  | "custom";

export interface LlmSettings {
  provider: LlmProvider;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface NormalizedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  postedAt: string | null;
  isRemote: boolean;
  description: string;
}
