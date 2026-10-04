import type { NormalizedJob } from "@/lib/types";
import { fetchJson, stripHtml, truncate } from "../util";

interface RemotiveResponse {
  jobs: Array<{
    id: number;
    url: string;
    title: string;
    company_name: string;
    candidate_required_location: string;
    publication_date: string;
    description: string;
  }>;
}

export async function searchRemotive(query: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<RemotiveResponse>(
    `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=50`
  );
  return (data.jobs ?? []).map((j) => ({
    id: `remotive-${j.id}`,
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || "Remote",
    url: j.url,
    source: "Remotive",
    postedAt: j.publication_date ?? null,
    isRemote: true,
    description: truncate(stripHtml(j.description ?? ""), 800),
  }));
}
