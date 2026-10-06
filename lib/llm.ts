import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { LlmProvider, LlmSettings } from "./types";

// Providers routed through createOpenAICompatible don't support the
// json_schema response format, so the SDK sends only `response_format:
// json_object` and drops the schema. Embed it in the prompt instead.
const PROMPT_SCHEMA_PROVIDERS = new Set<LlmProvider>([
  "deepseek",
  "groq",
  "ollama",
  "custom",
]);

function minifySchema(schema: z.ZodType): string {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (node !== null && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        if (k === "$schema" || k === "description" || k === "default" || k === "examples")
          continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  return JSON.stringify(strip(z.toJSONSchema(schema)));
}

export function withSchemaPrompt(
  schema: z.ZodType,
  provider: LlmProvider,
  prompt: string
): string {
  if (!PROMPT_SCHEMA_PROVIDERS.has(provider)) return prompt;
  return `${prompt}\n\nRespond with a single JSON object matching this JSON schema:\n${minifySchema(schema)}`;
}

// Strips markdown fences / preamble and extracts the outermost JSON object —
// used by repairText when a model wraps or prefixes its JSON output.
function repairJsonText(text: string): string {
  let t = text.trim();
  t = t.replace(/^```[a-zA-Z]*\s*\n?/, "").replace(/```\s*$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

// Shared wrapper for every structured-output call: schema prompt injection,
// a generous output budget (default provider caps like DeepSeek's 4096 are
// the main cause of truncated/unparseable JSON), JSON repair, and one retry
// for transient schema misses.
export async function generateStructured<T>(args: {
  settings: LlmSettings;
  schema: z.ZodType<T>;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<T> {
  const { settings, schema, prompt, maxOutputTokens } = args;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: getModel(settings),
        schema,
        prompt: withSchemaPrompt(schema, settings.provider, prompt),
        maxOutputTokens: maxOutputTokens ?? 4096,
        repairText: async ({ text }) => repairJsonText(text),
      });
      return object as T;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

// The responseFormat warning is expected for the providers above; keep other
// warnings visible.
globalThis.AI_SDK_LOG_WARNINGS = ({ warnings, provider, model }) => {
  const rest = warnings.filter(
    (w) => !(w.type === "unsupported" && w.feature === "responseFormat")
  );
  if (rest.length > 0) {
    console.warn(
      `AI SDK Warning${provider && model ? ` (${provider} / ${model})` : ""}:`,
      rest
    );
  }
};

export function getModel(settings: LlmSettings): LanguageModel {
  const { provider, apiKey, model } = settings;
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    case "deepseek":
      return createOpenAICompatible({
        name: "deepseek",
        apiKey,
        baseURL: "https://api.deepseek.com",
      }).chatModel(model);
    case "groq":
      return createOpenAICompatible({
        name: "groq",
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      }).chatModel(model);
    case "ollama":
      return createOpenAICompatible({
        name: "ollama",
        apiKey: apiKey || "ollama",
        baseURL: settings.baseUrl || "http://localhost:11434/v1",
      }).chatModel(model);
    case "custom":
      if (!settings.baseUrl) throw new Error("Custom provider requires a base URL");
      return createOpenAICompatible({
        name: "custom",
        apiKey,
        baseURL: settings.baseUrl,
      }).chatModel(model);
  }
}

export const resumeProfileSchema = z.object({
  name: z.string().describe("Candidate's full name, or 'Unknown'"),
  headline: z.string().describe("One-line professional headline"),
  skills: z.array(z.string()).describe("Technical and professional skills"),
  experienceYears: z.number().nullable().describe("Estimated total years of experience"),
  seniority: z
    .enum(["junior", "mid", "senior", "lead", "executive"])
    .describe("Best-fit seniority level"),
  roles: z.array(z.string()).describe("Job titles/roles the candidate is suited for"),
  keywords: z.array(z.string()).describe("Search keywords for job boards"),
  summary: z.string().describe("2-3 sentence professional summary"),
  experience: z
    .array(
      z.object({
        role: z.string(),
        company: z.string(),
        startDate: z.string().nullable().describe("e.g. 'Mar 2021'"),
        endDate: z.string().nullable().describe("'Present' if current"),
        bullets: z
          .array(z.string())
          .describe("Achievement bullets verbatim from the resume"),
      })
    )
    .default([])
    .describe("Work history — roles, dates, and bullets exactly as written"),
});

export type ResumeProfile = z.infer<typeof resumeProfileSchema>;

export async function extractProfile(
  resumeText: string,
  settings: LlmSettings
): Promise<ResumeProfile> {
  return generateStructured({
    settings,
    schema: resumeProfileSchema,
    prompt: `Extract a structured professional profile from this resume and output it as JSON. Infer suitable target job titles and effective job-search keywords from the candidate's skills and experience.

RESUME:
${resumeText.slice(0, 8000)}`,
  });
}
