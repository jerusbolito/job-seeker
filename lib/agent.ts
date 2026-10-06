import { z } from "zod";
import { generateStructured, type ResumeProfile } from "./llm";
import { searchAllProviders } from "./jobs/aggregator";
import { truncate } from "./jobs/util";
import type { LlmSettings, NormalizedJob } from "./types";

const searchPlanSchema = z.object({
  queries: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Short job-board search queries, e.g. 'frontend developer react'"),
});

const rankingSchema = z.object({
  picks: z
    .array(
      z.object({
        url: z.string(),
        score: z.number().min(0).max(100),
        reason: z.string().describe("1-2 sentence explanation of fit"),
      })
    )
    .max(15),
});

export interface RankedJob extends NormalizedJob {
  score: number;
  reason: string;
}

export interface SearchResult {
  jobs: RankedJob[];
  queries: string[];
  providerErrors: string[];
  totalCandidates: number;
}

export async function searchJobsAgent(
  profile: ResumeProfile,
  prefs: { location: string; remoteOnly: boolean; jobType?: string },
  settings: LlmSettings
): Promise<SearchResult> {
  // Only the fields the LLM needs — keeps prompt tokens low.
  const brief = {
    roles: profile.roles.slice(0, 6),
    seniority: profile.seniority,
    experienceYears: profile.experienceYears,
    skills: profile.skills.slice(0, 20),
  };

  // Stage 1: plan search queries from the resume profile.
  const plan = await generateStructured({
    settings,
    schema: searchPlanSchema,
    prompt:
      `Generate up to 5 short job-board search queries (2-5 words) that would surface relevant openings for this candidate, and return them as JSON. Prioritize the strongest skills and target roles.

Candidate:
${JSON.stringify(brief)}
${prefs.jobType ? `Desired job type: ${prefs.jobType}` : ""}`,
  });

  // Stage 2: run queries across all job providers, filtered by location.
  const { jobs, errors } = await searchAllProviders(
    plan.queries,
    prefs.location,
    prefs.remoteOnly
  );

  if (jobs.length === 0) {
    return { jobs: [], queries: plan.queries, providerErrors: errors, totalCandidates: 0 };
  }

  // Stage 3: LLM ranks candidates against the profile + location preference.
  // Only fields needed to judge fit — source/postedAt don't affect ranking.
  const candidates = jobs.slice(0, 60).map((j) => ({
    url: j.url,
    title: j.title,
    company: j.company,
    location: j.location,
    description: truncate(j.description, 160),
  }));

  const ranking = await generateStructured({
    settings,
    schema: rankingSchema,
    prompt:
      `Rank these job listings for the candidate and return the ranking as JSON. Pick the best 5-15 matches, score each 0-100 for fit (skills match, seniority match, location fit for "${prefs.location}"${prefs.remoteOnly ? ", remote preferred" : ""}), and give a brief reason.

Candidate profile:
${JSON.stringify(brief)}

Job listings:
${JSON.stringify(candidates)}`,
  });

  const byUrl = new Map(jobs.map((j) => [j.url, j]));
  const ranked = ranking.picks
    .filter((p) => byUrl.has(p.url))
    .map((p) => ({ ...byUrl.get(p.url)!, score: p.score, reason: p.reason }))
    .sort((a, b) => b.score - a.score);

  return {
    jobs: ranked,
    queries: plan.queries,
    providerErrors: errors,
    totalCandidates: jobs.length,
  };
}
