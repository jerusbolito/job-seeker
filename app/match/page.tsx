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
  const [busy, setBusy] = useState<"questions" | "analyze" | null>(null);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<MatchAnalysisData | null>(null);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [usedAnswers, setUsedAnswers] = useState<{ question: string; answer: string }[]>([]);

  if (!hydrated) return null;

  async function startAnalysis() {
    if (!llm.apiKey && llm.provider !== "ollama") {
      setError("Set your LLM API key on the dashboard first.");
      return;
    }
    setBusy("questions");
    setError("");
    setAnalysis(null);
    setQuestions(null);

    const res = await fetch("/api/match/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, resumeId, jdText }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(null);
      setError(data.error ?? "Could not generate questions.");
      return;
    }
    if (!data.questions?.length) {
      // Resume is already well-positioned — go straight to analysis.
      await analyze(false);
      return;
    }
    setBusy(null);
    setQuestions(data.questions);
    setAnswers(data.questions.map(() => ""));
  }

  async function analyze(withAnswers = true) {
    const answered = withAnswers
      ? (questions ?? [])
          .map((question, i) => ({ question, answer: answers[i] ?? "" }))
          .filter((a) => a.answer.trim())
      : [];

    setBusy("analyze");
    setError("");
    setAnalysis(null);

    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, resumeId, jdText, jobUrl, answers: answered }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Analysis failed.");
      return;
    }
    setAnalysis(data.analysis);
    setUsedAnswers(answered);
    setQuestions(null);
    setAnswers([]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Match a job description</h1>
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

      <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
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
          onClick={startAnalysis}
          disabled={busy !== null || jdText.trim().length < 50 || !resumeId}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {busy === "questions"
            ? "Reading…"
            : busy === "analyze"
              ? "Analyzing…"
              : "Analyze match"}
        </button>
      </div>

      {questions && (
        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div>
            <h2 className="text-sm font-medium text-zinc-900">
              A few questions before the suggestions
            </h2>
            <p className="mt-0.5 text-xs text-zinc-600">
              Your answers become material for the suggested wording — answer what
              applies, leave the rest blank.
            </p>
          </div>
          {questions.map((q, i) => (
            <label key={i} className="block text-sm">
              <span className="mb-1 block font-medium text-zinc-800">{q}</span>
              <textarea
                value={answers[i] ?? ""}
                onChange={(e) =>
                  setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))
                }
                rows={2}
                placeholder="Your answer — or leave blank if it doesn't apply"
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs"
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => analyze()}
              disabled={busy !== null}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {busy === "analyze" ? "Analyzing…" : "Analyze with my answers"}
            </button>
            <button
              onClick={() => analyze(false)}
              disabled={busy !== null}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
            >
              Skip — analyze anyway
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {analysis && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <MatchResultView analysis={analysis} />
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <Link
              href="/tailor"
              onClick={() =>
                sessionStorage.setItem(
                  "job-seeker:tailor-draft",
                  JSON.stringify({ jobTitle: "", jobUrl, jdText, answers: usedAnswers })
                )
              }
              className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
            >
              {usedAnswers.length > 0
                ? `Tailor resume with my ${usedAnswers.length} answer(s)`
                : "Generate a tailored resume for this job"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
