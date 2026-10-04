import type { NormalizedJob } from "@/lib/types";
import { fetchJson, stripHtml, truncate } from "../util";

interface RemoteOkEntry {
  id?: string;
  position?: string;
  company?: string;
  location?: string;
  url?: string;
  date?: string;
  description?: string;
  tags?: string[];
}

export async function searchRemoteOk(query: string): Promise<NormalizedJob[]> {
  const data = await fetchJson<RemoteOkEntry[]>("https://remoteok.com/api");
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  return (data ?? [])
    .filter((e) => e.position && e.company)
    .filter((e) => {
      const hay = `${e.position} ${e.company} ${(e.tags ?? []).join(" ")}`.toLowerCase();
      return terms.length === 0 || terms.some((t) => hay.includes(t));
    })
    .slice(0, 50)
    .map((e) => ({
      id: `remoteok-${e.id ?? e.url}`,
      title: e.position!,
      company: e.company!,
      location: e.location || "Remote",
      url: e.url ?? (e.id ? `https://remoteok.com/remote-jobs/${e.id}` : "https://remoteok.com"),
      source: "RemoteOK",
      postedAt: e.date ?? null,
      isRemote: true,
      description: truncate(stripHtml(e.description ?? ""), 800),
    }));
}
