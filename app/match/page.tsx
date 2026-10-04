"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import MatchResultView, { type MatchAnalysisData } from "@/components/MatchResultView";

export default function MatchPage() {
  const { llm, resumeId } = useAppStore();
  const hydrated = useHydrated();
  const [jdText, setJdText] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<MatchAnalysisData | null>(null);

  if (!hydrated) return null;

  async function analyze() {
    if (!llm.apiKey && llm.provider !== "ollama") {
      setError("Set your LLM API key on the dashboard first.");
      return;
    }
    setBusy(true);
    setError("");
    setAnalysis(null);

    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, resumeId, jdText, jobUrl }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Analysis failed.");
      return;
    }
    setAnalysis(data.analysis);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Match a job description</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Paste any job description and get a match score, skills gaps, ATS keyword
          analysis, and concrete resume suggestions.
        </p>
      </div>

      {!resumeId && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Upload a resume on the{" "}
          <Link href="/dashboard" className="underline">
            dashboard
          </Link>{" "}
          first.
        </p>
      )}

      <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Job posting URL (optional)</span>
          <input
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">Job description</span>
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            rows={10}
            placeholder="Paste the full job description here…"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
          />
        </label>
        <button
          onClick={analyze}
          disabled={busy || jdText.trim().length < 50 || !resumeId}
          className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {busy ? "Analyzing…" : "Analyze match"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {analysis && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <MatchResultView analysis={analysis} />
        </div>
      )}
    </div>
  );
}
