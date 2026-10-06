"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";

interface CoachQuestion {
  question: string;
  category: "behavioral" | "technical" | "discovery";
  targetSkill: string | null;
}

interface Feedback {
  score: number;
  verdict: "strong" | "good" | "fair" | "weak";
  strengths: string[];
  improvements: string[];
}

interface LearnedProfile {
  skills: string[];
  preferences: string[];
  facts: string[];
}

interface DemandReport {
  inDemand: { skill: string; demand: "high" | "medium" | "emerging"; why: string }[];
  covered: string[];
  gaps: { skill: string; priority: "high" | "medium" | "low"; suggestion: string }[];
  recommendations: { type: "learn" | "resume" | "search"; text: string }[];
  jobCount: number;
  usedLiveData: boolean;
  providerErrors: string[];
  createdAt?: string;
}

interface CoachData {
  learned: LearnedProfile;
  questionCount: number;
  demandReport: DemandReport | null;
}

const CATEGORY_STYLES: Record<string, string> = {
  behavioral: "bg-blue-50 text-blue-800 ring-blue-200",
  technical: "bg-purple-50 text-purple-800 ring-purple-200",
  discovery: "bg-teal-50 text-teal-800 ring-teal-200",
};

const VERDICT_STYLES: Record<string, string> = {
  strong: "bg-green-100 text-green-800",
  good: "bg-emerald-100 text-emerald-800",
  fair: "bg-amber-100 text-amber-800",
  weak: "bg-red-100 text-red-800",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-zinc-100 text-zinc-600",
};

const TYPE_LABELS: Record<string, string> = {
  learn: "Learn",
  resume: "Resume",
  search: "Search",
};

export default function CoachPage() {
  const { llm, resumeId } = useAppStore();
  const hydrated = useHydrated();
  const [data, setData] = useState<CoachData | null>(null);
  const [question, setQuestion] = useState<CoachQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyQ, setBusyQ] = useState(false);
  const [busyA, setBusyA] = useState(false);
  const [busyD, setBusyD] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/coach")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d));
  }, []);

  if (!hydrated) return null;

  const llmReady = !!llm.apiKey || llm.provider === "ollama";
  const ready = llmReady && !!resumeId;

  function errGuard(): boolean {
    if (!llmReady) {
      setError("Set your LLM API key on the dashboard first.");
      return false;
    }
    if (!resumeId) {
      setError("Upload a resume on the dashboard first.");
      return false;
    }
    setError("");
    return true;
  }

  async function getQuestion() {
    if (!errGuard()) return;
    setBusyQ(true);
    setQuestion(null);
    setFeedback(null);
    setAnswer("");
    const res = await fetch("/api/coach/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, resumeId }),
    });
    const d = await res.json();
    setBusyQ(false);
    if (!res.ok) {
      setError(d.error ?? "Could not generate a question.");
      return;
    }
    setQuestion(d);
  }

  async function submitAnswer() {
    if (!question || !errGuard()) return;
    setBusyA(true);
    setError("");
    const res = await fetch("/api/coach/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        llm,
        resumeId,
        question: question.question,
        category: question.category,
        answer,
      }),
    });
    const d = await res.json();
    setBusyA(false);
    if (!res.ok) {
      setError(d.error ?? "Evaluation failed.");
      return;
    }
    setFeedback(d.feedback);
    setData((prev) =>
      prev
        ? { ...prev, learned: d.learned, questionCount: prev.questionCount + 1 }
        : prev
    );
  }

  async function scanDemand(refresh: boolean) {
    if (!errGuard()) return;
    setBusyD(true);
    setError("");
    const res = await fetch("/api/coach/demand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, resumeId, refresh }),
    });
    const d = await res.json();
    setBusyD(false);
    if (!res.ok) {
      setError(d.error ?? "Demand scan failed.");
      return;
    }
    setData((prev) =>
      prev
        ? { ...prev, demandReport: d.report }
        : { learned: { skills: [], preferences: [], facts: [] }, questionCount: 0, demandReport: d.report }
    );
  }

  const report = data?.demandReport;
  const coveredSet = new Set((report?.covered ?? []).map((s) => s.toLowerCase()));
  const learned = data?.learned;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Coach</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Answer interview questions — the app learns about you, scores your
          answers, and compares your skills against what the market is asking for.
        </p>
      </div>

      {!ready && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Upload a resume and set your LLM key on the{" "}
          <Link href="/dashboard" className="underline">
            dashboard
          </Link>{" "}
          first.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Interview practice</h2>
          {data && data.questionCount > 0 && (
            <span className="text-xs text-zinc-400">
              {data.questionCount} question{data.questionCount === 1 ? "" : "s"} answered
            </span>
          )}
        </div>

        {!question ? (
          <div className="mt-4">
            <p className="text-sm text-zinc-600">
              Get a question tailored to your profile — behavioral, technical, or a
              discovery question that teaches the app more about you.
            </p>
            <button
              onClick={getQuestion}
              disabled={!ready || busyQ}
              className="mt-3 rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {busyQ ? "Thinking…" : "Ask me a question"}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-zinc-50 p-4">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${CATEGORY_STYLES[question.category]}`}
              >
                {question.category}
              </span>
              {question.targetSkill && (
                <span className="ml-2 text-xs text-zinc-400">
                  probing: {question.targetSkill}
                </span>
              )}
              <p className="mt-2 text-sm font-medium text-zinc-900">{question.question}</p>
            </div>

            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              placeholder="Answer like you're in a real interview — specifics and numbers help…"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />

            <div className="flex gap-2">
              <button
                onClick={submitAnswer}
                disabled={busyA || answer.trim().length < 10}
                className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {busyA ? "Evaluating…" : "Submit answer"}
              </button>
              <button
                onClick={getQuestion}
                disabled={busyQ || busyA}
                className="rounded-md border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {busyQ ? "Thinking…" : "Next question"}
              </button>
            </div>

            {feedback && (
              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-zinc-200 text-base font-semibold">
                    {feedback.score}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT_STYLES[feedback.verdict] ?? ""}`}
                  >
                    {feedback.verdict}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Strengths
                    </h4>
                    <ul className="space-y-1 text-sm text-zinc-700">
                      {feedback.strengths.map((s, i) => (
                        <li key={i}>+ {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Improve
                    </h4>
                    <ul className="space-y-1 text-sm text-zinc-700">
                      {feedback.improvements.map((s, i) => (
                        <li key={i}>→ {s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Skills radar</h2>
          <button
            onClick={() => scanDemand(!!report)}
            disabled={!ready || busyD}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {busyD ? "Scanning…" : report ? "Re-scan market" : "Scan market demand"}
          </button>
        </div>

        {!report ? (
          <p className="mt-3 text-sm text-zinc-600">
            Scan live job listings for your target roles and see which skills and
            tools the market asks for most — and where you stand.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            <p className="text-xs text-zinc-400">
              {report.usedLiveData
                ? `Based on ${report.jobCount} live listings`
                : "Based on model market knowledge (few live listings found)"}
              {report.createdAt &&
                ` · ${new Date(report.createdAt).toLocaleString()}`}
              {report.providerErrors.length > 0 &&
                ` · ${report.providerErrors.length} provider(s) failed`}
            </p>

            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                In demand now
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {report.inDemand.map((s) => {
                  const covered = coveredSet.has(s.skill.toLowerCase());
                  return (
                    <span
                      key={s.skill}
                      title={s.why}
                      className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ${
                        covered
                          ? "bg-green-50 text-green-800 ring-green-200"
                          : "bg-amber-50 text-amber-800 ring-amber-200"
                      }`}
                    >
                      {s.skill} · {s.demand}
                    </span>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">
                Green = you have it · Amber = gap
              </p>
            </div>

            {report.gaps.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Priority gaps
                </h3>
                <ul className="space-y-2">
                  {report.gaps.map((g) => (
                    <li key={g.skill} className="rounded-lg bg-zinc-50 p-3 text-sm">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLES[g.priority]}`}
                      >
                        {g.priority}
                      </span>
                      <span className="ml-2 font-medium">{g.skill}</span>
                      <p className="mt-1 text-zinc-600">{g.suggestion}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {report.recommendations.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Suggestions
                </h3>
                <ul className="space-y-2">
                  {report.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
                        {TYPE_LABELS[r.type] ?? r.type}
                      </span>
                      <span className="text-zinc-700">{r.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {learned &&
        (learned.skills.length > 0 ||
          learned.preferences.length > 0 ||
          learned.facts.length > 0) && (
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium">What we&apos;ve learned about you</h2>
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Skills from answers
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {learned.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Preferences
                </h3>
                <ul className="space-y-1 text-zinc-600">
                  {learned.preferences.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Facts
                </h3>
                <ul className="space-y-1 text-zinc-600">
                  {learned.facts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
    </div>
  );
}
