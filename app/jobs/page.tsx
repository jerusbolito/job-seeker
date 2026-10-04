"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import JobCard, { type RankedJob } from "@/components/JobCard";

interface SearchResponse {
  jobs: RankedJob[];
  queries: string[];
  providerErrors: string[];
  totalCandidates: number;
}

export default function JobsPage() {
  const { llm, resumeId } = useAppStore();
  const hydrated = useHydrated();
  const [location, setLocation] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [jobType, setJobType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SearchResponse | null>(null);

  if (!hydrated) return null;

  async function search() {
    if (!llm.apiKey && llm.provider !== "ollama") {
      setError("Set your LLM API key on the dashboard first.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);

    const res = await fetch("/api/jobs/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, location, remoteOnly, jobType, resumeId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Search failed.");
      return;
    }
    setResult(data);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Find jobs</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Your LLM generates search queries from your resume profile, we query free
          job APIs (Remotive, RemoteOK, Arbeitnow, Jobicy), then rank the results.
          Free sources skew toward remote &amp; tech roles.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Preferred location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder='e.g. "Austin, TX" or "Remote"'
              className="w-56 rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Job type (optional)</span>
            <input
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              placeholder="e.g. full-time, contract"
              className="w-48 rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-sm">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              className="h-4 w-4"
            />
            Remote only
          </label>
          <button
            onClick={search}
            disabled={busy || !resumeId}
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {busy ? "Searching…" : "Find jobs"}
          </button>
        </div>
        {!resumeId && (
          <p className="mt-3 text-sm text-amber-700">
            Upload a resume on the{" "}
            <Link href="/dashboard" className="underline">
              dashboard
            </Link>{" "}
            first.
          </p>
        )}
      </div>

      {busy && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          Generating queries → searching providers → ranking matches. This can take
          20–60 seconds depending on your model.
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div className="text-sm text-zinc-500">
            {result.totalCandidates} candidates scanned · queries:{" "}
            {result.queries.map((q) => (
              <code key={q} className="mr-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                {q}
              </code>
            ))}
            {result.providerErrors.length > 0 && (
              <span className="ml-2 text-amber-700">
                ({result.providerErrors.length} provider(s) failed — partial results)
              </span>
            )}
          </div>

          {result.jobs.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              No matching jobs found. Try broadening the location (e.g. &quot;Remote&quot;
              or a larger metro) or uploading a more detailed resume.
            </p>
          ) : (
            result.jobs.map((job) => <JobCard key={job.id} job={job} />)
          )}
        </div>
      )}
    </div>
  );
}
