import type { NormalizedJob } from "@/lib/types";
import { fetchJson, stripHtml, truncate } from "../util";

interface ArbeitnowResponse {
  data: Array<{
    slug: string;
    title: string;
    company_name: string;
    location: string;
    url: string;
    created_at: number;
    description: string;
    remote: boolean;
    tags: string[];
  }>;
}

export async function searchArbeitnow(query: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<ArbeitnowResponse>(
    "https://www.arbeitnow.com/api/job-board-api"
  );
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return (data.data ?? [])
    .filter((j) => {
      const hay = `${j.title} ${j.company_name} ${(j.tags ?? []).join(" ")}`.toLowerCase();
      return terms.length === 0 || terms.some((t) => hay.includes(t));
    })
    .map((j) => ({
      id: `arbeitnow-${j.slug}`,
      title: j.title,
      company: j.company_name,
      location: j.location || (j.remote ? "Remote" : "Unknown"),
      url: j.url,
      source: "Arbeitnow",
      postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
      isRemote: !!j.remote,
      description: truncate(stripHtml(j.description ?? ""), 800),
    }));
}
