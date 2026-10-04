import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NormalizedJob } from "@/lib/types";

vi.mock("./providers/remotive", () => ({ searchRemotive: vi.fn() }));
vi.mock("./providers/remoteok", () => ({ searchRemoteOk: vi.fn() }));
vi.mock("./providers/arbeitnow", () => ({ searchArbeitnow: vi.fn() }));
vi.mock("./providers/jobicy", () => ({ searchJobicy: vi.fn() }));

import { searchRemotive } from "./providers/remotive";
import { searchRemoteOk } from "./providers/remoteok";
import { searchArbeitnow } from "./providers/arbeitnow";
import { searchJobicy } from "./providers/jobicy";
import { matchesLocation, searchAllProviders } from "./aggregator";

function job(partial: Partial<NormalizedJob>): NormalizedJob {
  return {
    id: "x",
    title: "Engineer",
    company: "Acme",
    location: "Remote",
    url: "https://example.com/job",
    source: "test",
    postedAt: null,
    isRemote: true,
    description: "",
    ...partial,
  };
}

const providers = [searchRemotive, searchRemoteOk, searchArbeitnow, searchJobicy];

beforeEach(() => {
  for (const p of providers) vi.mocked(p).mockReset().mockResolvedValue([]);
});

describe("matchesLocation", () => {
  it("accepts everything when no location is set", () => {
    expect(matchesLocation(job({ location: "Berlin", isRemote: false }), "", false)).toBe(true);
  });

  it("remoteOnly keeps only remote jobs", () => {
    expect(matchesLocation(job({ isRemote: true }), "", true)).toBe(true);
    expect(matchesLocation(job({ location: "Berlin", isRemote: false }), "", true)).toBe(false);
  });

  it("treats 'anywhere/worldwide' locations as remote", () => {
    expect(matchesLocation(job({ location: "Worldwide", isRemote: false }), "", true)).toBe(true);
  });

  it("matches location tokens case-insensitively", () => {
    const j = job({ location: "Sydney, Australia", isRemote: false });
    expect(matchesLocation(j, "sydney", false)).toBe(true);
    expect(matchesLocation(j, "Melbourne", false)).toBe(false);
  });

  it("remote jobs match a 'remote' search", () => {
    expect(matchesLocation(job({ isRemote: true }), "remote", false)).toBe(true);
  });

  it("remote jobs still surface for city searches", () => {
    expect(matchesLocation(job({ isRemote: true }), "Berlin", false)).toBe(true);
  });
});

describe("searchAllProviders", () => {
  it("aggregates jobs from all providers", async () => {
    vi.mocked(searchRemotive).mockResolvedValue([job({ url: "https://a/1" })]);
    vi.mocked(searchJobicy).mockResolvedValue([job({ url: "https://a/2" })]);
    const { jobs } = await searchAllProviders(["dev"], "", false);
    expect(jobs).toHaveLength(2);
  });

  it("dedupes by URL ignoring query strings", async () => {
    vi.mocked(searchRemotive).mockResolvedValue([
      job({ url: "https://a/job?utm=1" }),
    ]);
    vi.mocked(searchRemoteOk).mockResolvedValue([
      job({ url: "https://a/job?utm=2" }),
    ]);
    const { jobs } = await searchAllProviders(["dev"], "", false);
    expect(jobs).toHaveLength(1);
  });

  it("dedupes by title+company when URL is missing", async () => {
    const j1 = job({ url: "", title: "Dev Ops!", company: "Acme Inc." });
    const j2 = job({ url: "", title: "dev ops", company: "acme inc" });
    vi.mocked(searchRemotive).mockResolvedValue([j1]);
    vi.mocked(searchJobicy).mockResolvedValue([j2]);
    const { jobs } = await searchAllProviders(["dev"], "", false);
    expect(jobs).toHaveLength(1);
  });

  it("isolates provider failures and reports them", async () => {
    vi.mocked(searchRemotive).mockRejectedValue(new Error("HTTP 500"));
    vi.mocked(searchRemoteOk).mockResolvedValue([job({ url: "https://a/1" })]);
    const { jobs, errors } = await searchAllProviders(["dev"], "", false);
    expect(jobs).toHaveLength(1);
    expect(errors).toEqual(["HTTP 500"]);
  });

  it("filters results by location preference", async () => {
    vi.mocked(searchRemotive).mockResolvedValue([
      job({ url: "https://a/berlin", location: "Berlin", isRemote: false }),
      job({ url: "https://a/tokyo", location: "Tokyo", isRemote: false }),
      job({ url: "https://a/remote", isRemote: true }),
    ]);
    const { jobs } = await searchAllProviders(["dev"], "Berlin", false);
    expect(jobs.map((j) => j.url)).toEqual(["https://a/berlin", "https://a/remote"]);
  });

  it("runs every provider for every query", async () => {
    await searchAllProviders(["dev", "data"], "", false);
    for (const p of providers) expect(p).toHaveBeenCalledTimes(2);
  });
});
