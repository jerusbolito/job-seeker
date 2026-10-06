import { z } from "zod";
import { generateStructured, type ResumeProfile } from "./llm";
import type { LlmSettings } from "./types";

export const matchAnalysisSchema = z.object({
  score: z.number().min(0).max(100).describe("Overall fit score 0-100"),
  verdict: z.enum(["strong", "good", "fair", "weak"]),
  subscores: z
    .object({
      skillsMatch: z.number().min(0).max(100).describe("Hard-skill coverage of the JD"),
      experienceMatch: z.number().min(0).max(100).describe("Relevance of work history"),
      seniorityFit: z.number().min(0).max(100).describe("Level/seniority alignment"),
      keywordCoverage: z.number().min(0).max(100).describe("ATS keyword coverage"),
    })
    .describe("Component scores — the overall score should be consistent with these"),
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

export const positioningQuestionsSchema = z.object({
  questions: z
    .array(z.string())
    .max(6)
    .describe(
      "Short interview questions that surface material to strengthen the resume's positioning for this JD"
    ),
});

export interface PositioningAnswer {
  question: string;
  answer: string;
}

export async function findPositioningQuestions(
  profile: ResumeProfile,
  resumeText: string,
  jdText: string,
  settings: LlmSettings
): Promise<string[]> {
  const object = await generateStructured({
    settings,
    schema: positioningQuestionsSchema,
    prompt:
      `You are a resume coach preparing to advise a candidate on tailoring their resume to a job description. Before making suggestions, ask the candidate up to 5 short interview questions that would surface material the resume undersells or omits — quantified results, scope/scale (team size, budget, users, uptime), relevant projects or adjacent experience, impact behind flat bullet points, or constraints the JD cares about (availability, on-site, domain). Phrase each question so the answer can be turned directly into a resume bullet or summary line (e.g. "You list 'improved API performance' — by how much, and how did you measure it?"). Do NOT ask about anything already clearly stated in the resume, and do NOT ask yes/no trivia. If the resume already positions the candidate well, return an empty list.

CANDIDATE PROFILE:
${JSON.stringify(profile)}

RESUME:
${resumeText.slice(0, 8000)}

JOB DESCRIPTION:
${jdText.slice(0, 8000)}`,
  });
  return object.questions;
}

export async function analyzeMatch(
  profile: ResumeProfile,
  resumeText: string,
  jdText: string,
  settings: LlmSettings,
  answers: PositioningAnswer[] = []
): Promise<MatchAnalysis> {
  const answersBlock =
    answers.length > 0
      ? `\nCANDIDATE'S ANSWERS TO POSITIONING QUESTIONS (verified by the candidate — treat as true material that belongs in the resume):\n${answers
          .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
          .join("\n")}\n\nWeave these answers into your suggestions — if an answer reveals metrics or experience not on the resume, the "suggested" text should incorporate it verbatim where possible.\n`
      : "";

  const object = await generateStructured({
    settings,
    schema: matchAnalysisSchema,
    prompt:
      `You are an expert resume coach and ATS specialist. Analyze how well this candidate's resume matches the job description and return the analysis as JSON. Be honest about gaps — don't inflate the score. Score each of the four component areas independently first (skills match, experience match, seniority fit, ATS keyword coverage), then set the overall score as their blend — skills and experience count most. For each suggestion: name the exact resume section, quote the current wording verbatim from the resume text (or null if the content doesn't exist yet), and provide a ready-to-paste alternative that naturally works in the missing keywords or quantifies impact. No generic advice like "improve your resume" — every suggestion must have replacement text.

CANDIDATE PROFILE:
${JSON.stringify(profile)}

RESUME TEXT:
${resumeText.slice(0, 8000)}

JOB DESCRIPTION:
${jdText.slice(0, 8000)}${answersBlock}`,
  });
  return object;
}
