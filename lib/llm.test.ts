import { describe, it, expect } from "vitest";
import { withSchemaPrompt, getModel, resumeProfileSchema } from "./llm";
import type { LlmProvider } from "./types";

const schema = resumeProfileSchema;

describe("withSchemaPrompt", () => {
  it("returns the prompt unchanged for schema-capable providers", () => {
    for (const p of ["openai", "anthropic", "google"] as LlmProvider[]) {
      expect(withSchemaPrompt(schema, p, "do thing")).toBe("do thing");
    }
  });

  it("embeds a JSON schema for prompt-schema providers", () => {
    for (const p of ["deepseek", "groq", "ollama", "custom"] as LlmProvider[]) {
      const out = withSchemaPrompt(schema, p, "do thing");
      expect(out).toContain("do thing");
      expect(out).toContain("JSON object matching this JSON schema");
      expect(out).toContain('"seniority"');
    }
  });

  it("minifies the embedded schema (no descriptions)", () => {
    const out = withSchemaPrompt(schema, "deepseek", "x");
    expect(out).not.toContain("description");
    expect(out).not.toContain("$schema");
  });
});

describe("getModel", () => {
  it("constructs models for hosted providers", () => {
    expect(getModel({ provider: "openai", model: "gpt-4o-mini", apiKey: "k" })).toBeTruthy();
    expect(getModel({ provider: "ollama", model: "llama3" })).toBeTruthy();
  });

  it("throws for custom provider without a base URL", () => {
    expect(() => getModel({ provider: "custom", model: "m", apiKey: "k" })).toThrow(
      /base URL/
    );
  });
});

describe("resumeProfileSchema", () => {
  const valid = {
    name: "Jane",
    headline: "Dev",
    skills: ["Python"],
    experienceYears: 5,
    seniority: "senior",
    roles: ["Engineer"],
    keywords: ["python"],
    summary: "…",
    experience: [],
  };

  it("accepts a valid profile", () => {
    expect(resumeProfileSchema.parse(valid)).toEqual(valid);
  });

  it("allows null experienceYears", () => {
    expect(resumeProfileSchema.parse({ ...valid, experienceYears: null }).experienceYears)
      .toBeNull();
  });

  it("rejects unknown seniority levels", () => {
    expect(() => resumeProfileSchema.parse({ ...valid, seniority: "guru" })).toThrow();
  });
});
