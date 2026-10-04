import { generateObject } from "ai";
import { z } from "zod";
import { getModel, withSchemaPrompt, type ResumeProfile } from "./llm";
import { searchAllProviders } from "./jobs/aggregator";
import { truncate } from "./jobs/util";
import type { LlmSettings } from "./types";

// What the app has learned about the user from interview answers —
// persisted as CoachProfile.learnedJson. `skills` are skills evidenced in
// answers (whether or not they appear on the resume); diff against
// profile.skills at render/query time to find "new" skills.
export interface LearnedProfile {
  skills: string[];
  preferences: string[];
  facts: string[];
}

export const EMPTY_LEARNED: LearnedProfile = { skills: [], preferences: [], facts: [] };

export function parseLearned(json: string | null | undefined): LearnedProfile {
  if (!json) return { ...EMPTY_LEARNED };
  try {
    const p = JSON.parse(json) as Partial<LearnedProfile>;
    return {
      skills: Array.isArray(p.skills) ? p.skills.map(String) : [],
      preferences: Array.isArray(p.preferences) ? p.preferences.map(String) : [],
      facts: Array.isArray(p.facts) ? p.facts.map(String) : [],
    };
  } catch {
    return { ...EMPTY_LEARNED };
  }
}

const normKey = (s: string) => s.toLowerCase().trim();

// Deduped union merge — intentionally dumb so a bad extraction can't
// corrupt the stored profile.
export function mergeLearned(
  base: LearnedProfile,
  add: Partial<LearnedProfile>
): LearnedProfile {
  const merge = (a: string[], b: string[] | undefined, cap: number) => {
    const seen = new Set(a.map(normKey));
    const out = [...a];
    for (const item of b ?? []) {
      const v = String(item).trim();
      if (!v || seen.has(normKey(v)) || out.length >= cap) continue;
      seen.add(normKey(v));
      out.push(v);
    }
    return out;
  };
  return {
    skills: merge(base.skills, add.skills, 60),
    preferences: merge(base.preferences, add.preferences, 30),
    facts: merge(base.facts, add.facts, 60),
  };
}

// Resume + learned skills, deduped — used by job-search planning.
export function combinedSkills(profile: ResumeProfile, learned: LearnedProfile): string[] {
  return mergeLearned({ ...EMPTY_LEARNED, skills: [...profile.skills] }, learned).skills;
}

const questionSchema = z.object({
  question: z.string().describe("A single interview question to ask the candidate"),
  category: z.enum(["behavioral", "technical", "discovery"]),
  targetSkill: z
    .string()
    .nullable()
    .describe("Skill or gap this question probes, or null"),
});

export type CoachQuestion = z.infer<typeof questionSchema>;

interface QAHistoryEntry {
  question: string;
  answer: string;
  score: number;
}

export async function nextQuestion(
  profile: ResumeProfile,
  learned: LearnedProfile,
  recentQA: QAHistoryEntry[],
  gapSkills: string[],
  settings: LlmSettings
): Promise<CoachQuestion> {
  const { object } = await generateObject({
    model: getModel(settings),
    schema: questionSchema,
    prompt: withSchemaPrompt(
      questionSchema,
      settings.provider,
      `You are an interview coach. Generate ONE interview question for this candidate and return it as JSON. Rotate between categories: "behavioral" (STAR-style), "technical" (probe depth on a claimed skill), and "discovery" (uncover achievements, projects, or preferences not on the resume so the app can learn more about them).

Rules:
- Never repeat or rephrase a question that was already asked.
- If a recent answer scored poorly, consider a follow-up on that area.
- Occasionally probe a market gap skill the candidate is missing.
- Discovery questions should surface concrete, resume-worthy facts.

Candidate profile:
${JSON.stringify({
  roles: profile.roles.slice(0, 6),
  seniority: profile.seniority,
  skills: profile.skills.slice(0, 20),
})}

Already learned about the candidate:
${JSON.stringify(learned)}

Market gap skills: ${gapSkills.slice(0, 8).join(", ") || "unknown"}

Already asked (most recent last):
${JSON.stringify(recentQA.map((q) => ({ q: q.question, score: q.score })))}`
    ),
  });
  return object;
}

const evaluationSchema = z.object({
  score: z.number().min(0).max(100).describe("Answer quality 0-100"),
  verdict: z.enum(["strong", "good", "fair", "weak"]),
  strengths: z.array(z.string()).max(4).describe("What the answer did well"),
  improvements: z.array(z.string()).max(4).describe("Concrete ways to improve the answer"),
  extracted: z.object({
    skills: z
      .array(z.string())
      .describe("Skills/tools the answer evidences, including soft skills"),
    preferences: z
      .array(z.string())
      .describe("Work preferences revealed (remote, domain, team size, etc.)"),
    facts: z
      .array(z.string())
      .describe("Resume-worthy facts learned (projects, achievements, metrics, constraints)"),
  }),
});

export type AnswerEvaluation = z.infer<typeof evaluationSchema>;

export async function evaluateAnswer(
  question: string,
  category: string,
  answer: string,
  profile: ResumeProfile,
  settings: LlmSettings
): Promise<AnswerEvaluation> {
  const { object } = await generateObject({
    model: getModel(settings),
    schema: evaluationSchema,
    prompt: withSchemaPrompt(
      evaluationSchema,
      settings.provider,
      `You are an honest interview coach. Evaluate this ${category} interview answer and return the evaluation as JSON. Score like a real hiring panel — don't inflate. Give concrete improvements, not generic advice. Then extract everything the answer reveals about the candidate: skills/tools demonstrated, work preferences, and resume-worthy facts (projects, achievements, quantified impact).

Candidate context (for calibration only):
${JSON.stringify({ seniority: profile.seniority, roles: profile.roles.slice(0, 6) })}

QUESTION: ${question}

ANSWER:
${answer.slice(0, 4000)}`
    ),
  });
  return object;
}

const demandReportSchema = z.object({
  inDemand: z
    .array(
      z.object({
        skill: z.string(),
        demand: z.enum(["high", "medium", "emerging"]),
        why: z.string().describe("One short sentence on why it's in demand"),
      })
    )
    .max(20),
  covered: z
    .array(z.string())
    .describe("In-demand skills the candidate already has"),
  gaps: z
    .array(
      z.object({
        skill: z.string(),
        priority: z.enum(["high", "medium", "low"]),
        suggestion: z.string().describe("Concrete next step to close this gap"),
      })
    )
    .max(10),
  recommendations: z
    .array(
      z.object({
        type: z.enum(["learn", "resume", "search"]),
        text: z.string().describe("One actionable suggestion"),
      })
    )
    .max(8),
});

export type DemandReportData = z.infer<typeof demandReportSchema>;

export interface DemandResult extends DemandReportData {
  jobCount: number;
  usedLiveData: boolean;
  providerErrors: string[];
}

export async function scanDemand(
  profile: ResumeProfile,
  learned: LearnedProfile,
  settings: LlmSettings
): Promise<DemandResult> {
  const model = getModel(settings);
  const queries = profile.roles.slice(0, 4).map((r) => r.split("/")[0].trim()).filter(Boolean);

  const { jobs, errors } = queries.length
    ? await searchAllProviders(queries, "", false)
    : { jobs: [], errors: [] };

  const candidateSkills = combinedSkills(profile, learned);
  const listings = jobs.slice(0, 80).map((j) => ({
    title: j.title,
    description: truncate(j.description, 200),
  }));

  const live = listings.length >= 15;
  const prompt = live
    ? `You are a labor-market analyst. These are real job listings for roles this candidate targets. Extract the most in-demand skills/tools/technologies across them, compare against the candidate's current skills, and return the analysis as JSON. Prioritize gaps that appear in many listings. Recommendations should be concrete: "learn" = what to pick up, "resume" = how to better surface existing skills, "search" = new job-search angles/keywords.

Candidate skills: ${JSON.stringify(candidateSkills)}
Candidate roles: ${JSON.stringify(profile.roles.slice(0, 6))}
Seniority: ${profile.seniority}

Live job listings (${listings.length}):
${JSON.stringify(listings)}`
    : `You are a labor-market analyst. Using current market knowledge, list the most in-demand skills/tools/technologies for this candidate's target roles, compare against their current skills, and return the analysis as JSON. Recommendations should be concrete: "learn" = what to pick up, "resume" = how to better surface existing skills, "search" = new job-search angles/keywords.

Candidate skills: ${JSON.stringify(candidateSkills)}
Candidate roles: ${JSON.stringify(profile.roles.slice(0, 6))}
Seniority: ${profile.seniority}`;

  const { object } = await generateObject({
    model,
    schema: demandReportSchema,
    prompt: withSchemaPrompt(demandReportSchema, settings.provider, prompt),
  });

  return { ...object, jobCount: listings.length, usedLiveData: live, providerErrors: errors };
}
