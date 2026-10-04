"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { NormalizedJob } from "@/lib/types";
import MatchResultView, { type MatchAnalysisData } from "./MatchResultView";

export interface RankedJob extends NormalizedJob {
  score: number;
  reason: string;
}

export default function JobCard({ job }: { job: RankedJob }) {
  const { llm, resumeId } = useAppStore();
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState<MatchAnalysisData | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [err, setErr] = useState("");

  async function analyze() {
    if (analysis) {
      setExpanded((v) => !v);
      return;
    }
    setAnalyzing(true);
    setErr("");
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        llm,
        resumeId,
        jobUrl: job.url,
        jdText: `${job.title} at ${job.company} (${job.location})\n\n${job.description}`,
      }),
    });
    const data = await res.json();
    setAnalyzing(false);
    if (!res.ok) {
      setErr(data.error ?? "Analysis failed.");
      return;
    }
    setAnalysis(data.analysis);
    setExpanded(true);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-zinc-900 underline-offset-2 hover:underline"
          >
            {job.title}
          </a>
          <p className="text-sm text-zinc-600">
            {job.company} · {job.location}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500">
            {job.source}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              job.score >= 75
                ? "bg-green-100 text-green-800"
                : job.score >= 50
                  ? "bg-amber-100 text-amber-800"
                  : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {job.score}% fit
          </span>
        </div>
      </div>

      <p className="mt-2 text-sm text-zinc-600">{job.reason}</p>
      {job.description && (
        <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{job.description}</p>
      )}

      <div className="mt-3 flex items-center gap-3 text-sm">
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="text-zinc-900 underline underline-offset-2"
        >
          View listing
        </a>
        <button
          onClick={analyze}
          disabled={analyzing}
          className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 disabled:opacity-50"
        >
          {analyzing ? "Analyzing…" : analysis ? (expanded ? "Hide analysis" : "Show analysis") : "Analyze fit"}
        </button>
        {job.postedAt && (
          <span className="text-xs text-zinc-400">
            posted {new Date(job.postedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {expanded && analysis && <MatchResultView analysis={analysis} />}
    </div>
  );
}
