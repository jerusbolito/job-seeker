import { generateObject } from "ai";
import { z } from "zod";
import { getModel, withSchemaPrompt, type ResumeProfile } from "./llm";
import type { LlmSettings } from "./types";

export const matchAnalysisSchema = z.object({
  score: z.number().min(0).max(100).describe("Overall fit score 0-100"),
  verdict: z.enum(["strong", "good", "fair", "weak"]),
  summary: z.string().describe("2-3 sentence assessment"),
  matchedSkills: z.array(z.string()).describe("Skills the resume has that the JD requires"),
  missingSkills: z.array(z.string()).describe("Required skills absent from the resume"),
  keywordGaps: z
    .array(z.string())
    .describe("ATS keywords in the JD missing from the resume"),
  suggestions: z
    .array(
      z.object({
        section: z
          .string()
          .describe("Exact resume section to change, e.g. 'Summary' or 'Experience — Acme Corp'"),
        current: z
          .string()
          .nullable()
          .describe("Existing wording to replace, quoted verbatim from the resume; null if adding new content"),
        suggested: z
          .string()
          .describe("Ready-to-paste alternative wording (1-2 sentences or a bullet)"),
        why: z.string().describe("Why this improves the match for this JD"),
      })
    )
    .max(6)
    .describe("Concrete resume improvements with replacement wording"),
});

export type MatchAnalysis = z.infer<typeof matchAnalysisSchema>;

export async function analyzeMatch(
  profile: ResumeProfile,
  resumeText: string,
  jdText: string,
  settings: LlmSettings
): Promise<MatchAnalysis> {
  const { object } = await generateObject({
    model: getModel(settings),
    schema: matchAnalysisSchema,
    prompt: withSchemaPrompt(
      matchAnalysisSchema,
      settings.provider,
      `You are an expert resume coach and ATS specialist. Analyze how well this candidate's resume matches the job description and return the analysis as JSON. Be honest about gaps — don't inflate the score. For each suggestion: name the exact resume section, quote the current wording verbatim from the resume text (or null if the content doesn't exist yet), and provide a ready-to-paste alternative that naturally works in the missing keywords or quantifies impact. No generic advice like "improve your resume" — every suggestion must have replacement text.

CANDIDATE PROFILE:
${JSON.stringify(profile)}

RESUME TEXT:
${resumeText.slice(0, 8000)}

JOB DESCRIPTION:
${jdText.slice(0, 8000)}`
    ),
  });
  return object;
}
