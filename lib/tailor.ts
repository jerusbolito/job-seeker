import { generateObject } from "ai";
import { z } from "zod";
import { getModel, withSchemaPrompt, type ResumeProfile } from "./llm";
import type { LlmSettings } from "./types";

export const gapQuestionsSchema = z.object({
  questions: z
    .array(z.string())
    .max(6)
    .describe(
      "Short direct questions asking whether the candidate has experience the JD requires but the resume doesn't show"
    ),
});

export async function findGapQuestions(
  profile: ResumeProfile,
  resumeText: string,
  jdText: string,
  settings: LlmSettings
): Promise<string[]> {
  const { object } = await generateObject({
    model: getModel(settings),
    schema: gapQuestionsSchema,
    prompt: withSchemaPrompt(
      gapQuestionsSchema,
      settings.provider,
      `You are an ATS specialist preparing to tailor a resume to a job description. Find significant requirements in the JD that are NOT evidenced anywhere in the resume — hard skills, tools, domain experience, certifications, years of experience. For each gap, write one short question to ask the candidate, phrased so their answer can be truthfully added to the resume (e.g. "The role requires PyTorch — do you have hands-on experience with it? Describe projects where you used it."). Do NOT ask about skills or experience already on the resume, soft/vague requirements, or trivial gaps. If there are no real gaps, return an empty list.

CANDIDATE PROFILE:
${JSON.stringify(profile)}

RESUME:
${resumeText.slice(0, 8000)}

JOB DESCRIPTION:
${jdText.slice(0, 8000)}`
    ),
  });
  return object.questions;
}

export const tailoredResumeSchema = z.object({
  markdown: z
    .string()
    .describe(
      "Complete tailored resume in Markdown: # Name, contact line, ## Summary, ## Skills, ## Experience (### role — company, dates, - bullets), ## Education, plus optional sections like ## Projects or ## Certifications"
    ),
  changes: z
    .array(z.string())
    .max(10)
    .describe("Short list of what was emphasized, reordered, or rephrased vs the original resume"),
});

export type TailoredResume = z.infer<typeof tailoredResumeSchema>;

export interface GapAnswer {
  question: string;
  answer: string;
}

export async function generateTailoredResume(
  profile: ResumeProfile,
  resumeText: string,
  jdText: string,
  settings: LlmSettings,
  answers: GapAnswer[] = []
): Promise<TailoredResume> {
  const answersBlock =
    answers.length > 0
      ? `\nCANDIDATE'S VERIFIED ANSWERS TO GAP QUESTIONS (the candidate confirmed these — treat them as true resume material):\n${answers
          .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
          .join("\n")}\n`
      : "";
  const { object } = await generateObject({
    model: getModel(settings),
    schema: tailoredResumeSchema,
    prompt: withSchemaPrompt(
      tailoredResumeSchema,
      settings.provider,
      `You are an expert resume writer and ATS specialist. Rewrite the candidate's resume so it is tailored to the job description, and output it as Markdown.

Rules:
- NEVER fabricate experience, employers, degrees, metrics, or skills. You may only use facts present in the original resume or in the candidate's verified answers below. You may rephrase, reorder, and emphasize what is already there.
- Mirror the job description's language and keywords naturally (ATS optimization) — put the most relevant skills and accomplishments first.
- Keep it to one page worth of content. Use quantified bullets where the original supports them.
- Format: "# Full Name", a single contact/headline line, then "## Summary", "## Skills", "## Experience" (### Role — Company, then dates line, then - bullets), "## Education", plus optional extra sections (## Projects, ## Certifications) only if present in the original.
- In "changes", briefly note what you tailored so the user can review it.

CANDIDATE PROFILE:
${JSON.stringify(profile)}

ORIGINAL RESUME:
${resumeText.slice(0, 8000)}

JOB DESCRIPTION:
${jdText.slice(0, 8000)}${answersBlock}`
    ),
  });
  return object;
}
