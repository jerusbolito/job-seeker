import type { NormalizedJob } from "@/lib/types";
import { searchRemotive } from "./providers/remotive";
import { searchRemoteOk } from "./providers/remoteok";
import { searchArbeitnow } from "./providers/arbeitnow";
import { searchJobicy } from "./providers/jobicy";

const PROVIDERS = [searchRemotive, searchRemoteOk, searchArbeitnow, searchJobicy];

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function dedupeKey(job: NormalizedJob): string {
  if (job.url) return `url:${job.url.split("?")[0]}`;
  return `tc:${norm(job.title)}|${norm(job.company)}`;
}

export function matchesLocation(
  job: NormalizedJob,
  location: string,
  remoteOnly: boolean
): boolean {
  const loc = norm(job.location);
  const isRemoteJob =
    job.isRemote || /remote|anywhere|worldwide|global/.test(loc);
  if (remoteOnly) return isRemoteJob;
  if (!location.trim()) return true;
  const target = norm(location);
  if (/remote/.test(target)) return isRemoteJob;
  const tokens = target.split(" ").filter((t) => t.length > 1);
  if (tokens.length === 0) return true;
  return tokens.some((t) => loc.includes(t)) || isRemoteJob;
}

export async function searchAllProviders(
  queries: string[],
  location: string,
  remoteOnly: boolean
): Promise<{ jobs: NormalizedJob[]; errors: string[] }> {
  const tasks = queries.flatMap((q) =>
    PROVIDERS.map(async (p) => {
      try {
        return await p(q);
      } catch (e) {
        return { __error: e instanceof Error ? e.message : String(e) };
      }
    })
  );

  const results = await Promise.all(tasks);
  const seen = new Set<string>();
  const jobs: NormalizedJob[] = [];
  const errors = new Set<string>();

  for (const r of results) {
    if (!Array.isArray(r)) {
      errors.add(r.__error);
      continue;
    }
    for (const job of r) {
      const key = dedupeKey(job);
      if (seen.has(key)) continue;
      seen.add(key);
      if (matchesLocation(job, location, remoteOnly)) jobs.push(job);
    }
  }

  return { jobs, errors: [...errors] };
}
