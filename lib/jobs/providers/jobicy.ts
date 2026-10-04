import type { NormalizedJob } from "@/lib/types";
import { fetchJson, stripHtml, truncate } from "../util";

interface JobicyResponse {
  jobs: Array<{
    id: number;
    url: string;
    jobTitle: string;
    companyName: string;
    jobGeo: string;
    pubDate: string;
    jobDescription: string;
    jobType: string[];
  }>;
}

export async function searchJobicy(query: string): Promise<NormalizedJob[]> {
  // Jobicy's `tag` param works best with a single skill keyword; fall back to
  // broad fetch + local filtering for multi-word queries.
  const tag = query.trim().split(/\s+/).length === 1 ? `&tag=${encodeURIComponent(query)}` : "";
  const data = await fetchJson<JobicyResponse>(
    `https://jobicy.com/api/v2/remote-jobs?count=50${tag}`
  );
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return (data.jobs ?? [])
    .filter((j) => {
      const hay = `${j.jobTitle} ${j.companyName}`.toLowerCase();
      return tag || terms.length === 0 || terms.some((t) => hay.includes(t));
    })
    .map((j) => ({
      id: `jobicy-${j.id}`,
      title: j.jobTitle,
      company: j.companyName,
      location: j.jobGeo || "Remote",
      url: j.url,
      source: "Jobicy",
      postedAt: j.pubDate ?? null,
      isRemote: true,
      description: truncate(stripHtml(j.jobDescription ?? ""), 800),
    }));
}
