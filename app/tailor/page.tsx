"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useHydrated } from "@/lib/useHydrated";
import { markdownToHtml, markdownToHtmlDocument } from "@/lib/markdown";
import { diffLines } from "@/lib/diff";
import type { GapAnswer } from "@/lib/tailor";
import MatchResultView, { type MatchAnalysisData } from "@/components/MatchResultView";

interface DraftSummary {
  id: string;
  jobTitle: string | null;
  jobUrl: string | null;
  jdPreview: string;
  content: string;
  changes: string[];
  evaluation: MatchAnalysisData | null;
  createdAt: string;
  updatedAt: string;
}

const DRAFT_KEY = "job-seeker:tailor-draft";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeName(s: string | null): string {
  const name = (s || "tailored-resume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return name || "tailored-resume";
}

function readPendingDraft() {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(DRAFT_KEY);
  try {
    const d = JSON.parse(raw) as {
      jobTitle?: string;
      jobUrl?: string;
      jdText?: string;
      answers?: GapAnswer[];
    };
    return {
      jobTitle: d.jobTitle ?? "",
      jobUrl: d.jobUrl ?? "",
      jdText: d.jdText ?? "",
      answers: Array.isArray(d.answers)
        ? d.answers.filter(
            (a) => typeof a?.question === "string" && a?.answer?.trim()
          )
        : [],
    };
  } catch {
    return null;
  }
}

export default function TailorPage() {
  const { llm, resumeId } = useAppStore();
  const hydrated = useHydrated();

  // Handoff from "Tailor resume" buttons elsewhere in the app — read lazily
  // at hydration so a fast click never misses the carried answers.
  const [pendingDraft] = useState(readPendingDraft);
  const [jobTitle, setJobTitle] = useState(pendingDraft?.jobTitle ?? "");
  const [jobUrl, setJobUrl] = useState(pendingDraft?.jobUrl ?? "");
  const [jdText, setJdText] = useState(pendingDraft?.jdText ?? "");
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);

  const [docId, setDocId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [changes, setChanges] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [evaluation, setEvaluation] = useState<MatchAnalysisData | null>(null);
  const [view, setView] = useState<"preview" | "edit" | "diff">("preview");
  const [resumeText, setResumeText] = useState<string | null>(null);

  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  // Q&A carried over from the JD match flow — skip re-asking.
  const [draftAnswers, setDraftAnswers] = useState<GapAnswer[]>(
    pendingDraft?.answers ?? []
  );

  const [busy, setBusy] = useState<"questions" | "generate" | "save" | "evaluate" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const dirty = docId !== null && content !== savedContent;
  const previewHtml = useMemo(() => markdownToHtml(content), [content]);

  async function loadDrafts() {
    const res = await fetch("/api/tailor");
    if (res.ok) setDrafts(await res.json());
  }

  useEffect(() => {
    loadDrafts();
  }, []);

  if (!hydrated) return null;

  function llmMissing() {
    if (!llm.apiKey && llm.provider !== "ollama") {
      setError("Set your LLM API key on the dashboard first.");
      return true;
    }
    return false;
  }

  function openDoc(d: DraftSummary) {
    setDocId(d.id);
    setContent(d.content);
    setSavedContent(d.content);
    setChanges(d.changes);
    setWarnings([]);
    setEvaluation(d.evaluation);
    setJobTitle(d.jobTitle ?? "");
    setJobUrl(d.jobUrl ?? "");
    setQuestions(null);
    setAnswers([]);
    setDraftAnswers([]);
    setView("preview");
    setError("");
    setNotice("");
    // List only carries a JD preview; fetch the full record for the JD text.
    fetch(`/api/tailor/${d.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((full) => {
        if (full?.jdText) setJdText(full.jdText);
      });
  }

  function newDoc() {
    setDocId(null);
    setContent("");
    setSavedContent("");
    setChanges([]);
    setWarnings([]);
    setEvaluation(null);
    setQuestions(null);
    setAnswers([]);
    setDraftAnswers([]);
    setError("");
    setNotice("");
  }

  async function checkGaps() {
    if (llmMissing()) return;
    setBusy("questions");
    setError("");
    setNotice("");
    setQuestions(null);

    const res = await fetch("/api/tailor/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, resumeId, jdText, priorAnswers: draftAnswers }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(null);
      setError(data.error ?? "Gap analysis failed.");
      return;
    }
    if (!data.questions?.length) {
      // Nothing missing — go straight to generation with any prior answers.
      await doGenerate(draftAnswers);
      return;
    }
    setBusy(null);
    setQuestions(data.questions);
    setAnswers(data.questions.map(() => ""));
  }

  async function doGenerate(qa: GapAnswer[]) {
    setBusy("generate");
    setError("");
    setNotice("");

    const res = await fetch("/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, resumeId, jdText, jobTitle, jobUrl, answers: qa }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Generation failed.");
      return;
    }
    setDocId(data.id);
    setContent(data.content);
    setSavedContent(data.content);
    setChanges(data.changes);
    setWarnings(data.warnings ?? []);
    setEvaluation(null);
    setQuestions(null);
    setAnswers([]);
    setDraftAnswers([]);
    setView("preview");
    await loadDrafts();
  }

  async function showDiff() {
    setView("diff");
    if (resumeText === null && resumeId) {
      const res = await fetch(`/api/resume/${resumeId}`);
      if (res.ok) {
        const data = await res.json();
        setResumeText(data.text ?? "");
      }
    }
  }

  async function save() {
    if (!docId) return;
    setBusy("save");
    setError("");
    setNotice("");
    const res = await fetch(`/api/tailor/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Save failed.");
      return;
    }
    setSavedContent(content);
    setNotice("Saved.");
    loadDrafts();
  }

  async function evaluate() {
    if (llmMissing()) return;
    setBusy("evaluate");
    setError("");
    setNotice("");
    const res = await fetch("/api/tailor/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ llm, resumeId, id: docId, content, jdText }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? "Evaluation failed.");
      return;
    }
    setEvaluation(data.analysis);
    setSavedContent(content); // evaluate persists content server-side when docId is set
    loadDrafts();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/tailor/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (docId === id) newDoc();
      loadDrafts();
    }
  }

  const base = safeName(jobTitle);
  const printHtml = markdownToHtmlDocument(content, jobTitle || "Tailored Resume").replace(
    "</body>",
    "<script>window.addEventListener('load',()=>window.print())</script></body>"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight">Tailor your resume</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Generate a resume tailored to a specific job description, edit it by
          hand, re-evaluate the fit, and download the result.
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

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Job title (optional)</span>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
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
                rows={8}
                placeholder="Paste the full job description here…"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={checkGaps}
                disabled={busy !== null || jdText.trim().length < 50 || !resumeId}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {busy === "questions"
                  ? "Checking gaps…"
                  : busy === "generate"
                    ? "Generating…"
                    : docId
                      ? "Regenerate"
                      : "Generate tailored resume"}
              </button>
              {draftAnswers.length > 0 && (
                <span className="self-center text-xs text-zinc-500">
                  {draftAnswers.length} answer(s) from your JD match analysis will be included
                </span>
              )}
              {docId && (
                <button
                  onClick={newDoc}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {questions && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div>
                <h2 className="text-sm font-medium text-zinc-900">
                  The JD wants things your resume doesn&apos;t show
                </h2>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Answer what applies — anything you write is treated as real
                  experience and woven into the resume. Leave blank to skip.
                  {draftAnswers.length > 0 &&
                    ` Your ${draftAnswers.length} JD-match answer(s) are already covered — these are only the remaining gaps.`}
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
                  onClick={() =>
                    doGenerate([
                      ...draftAnswers,
                      ...(questions ?? [])
                        .map((question, i) => ({ question, answer: answers[i] ?? "" }))
                        .filter((a) => a.answer.trim()),
                    ])
                  }
                  disabled={busy !== null}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  {busy === "generate" ? "Generating…" : "Generate with my answers"}
                </button>
                <button
                  onClick={() => doGenerate(draftAnswers)}
                  disabled={busy !== null}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
                >
                  Skip — generate anyway
                </button>
              </div>
            </div>
          )}

          {drafts.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-sm font-medium text-zinc-900">Saved versions</h2>
              <ul className="space-y-2">
                {drafts.map((d) => (
                  <li key={d.id} className="group flex items-center justify-between gap-2 text-sm">
                    <button
                      onClick={() => openDoc(d)}
                      className={`min-w-0 flex-1 truncate text-left hover:underline ${
                        d.id === docId ? "font-medium text-zinc-900" : "text-zinc-600"
                      }`}
                      title={d.jdPreview}
                    >
                      {d.jobTitle || d.jdPreview.slice(0, 60) || "Untitled"}
                      <span className="ml-1 text-xs text-zinc-400">
                        {new Date(d.updatedAt).toLocaleDateString()}
                        {d.evaluation ? ` · ${d.evaluation.score}%` : ""}
                      </span>
                    </button>
                    <button
                      onClick={() => remove(d.id)}
                      className="text-xs text-zinc-400 opacity-0 hover:text-red-600 group-hover:opacity-100"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {notice}
            </p>
          )}

          {busy === "generate" && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
              Writing your tailored resume… this can take 15–40 seconds depending
              on your model.
            </div>
          )}

          {!docId && busy !== "generate" && (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">
              Paste a job description and generate a tailored resume — or pick a
              saved version on the left.
            </div>
          )}

          {docId && (
            <>
              {changes.length > 0 && (
                <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-2 text-sm font-medium text-zinc-900">What the AI tailored</h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
                    {changes.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <h2 className="mb-2 text-sm font-medium text-amber-900">
                    Possible fabrications — verify before sending
                  </h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2.5">
                  <div className="flex items-center gap-1">
                    {(["edit", "preview", "diff"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => (v === "diff" ? showDiff() : setView(v))}
                        className={`rounded-md px-3 py-1 text-sm capitalize ${view === v ? "bg-accent text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                      >
                        {v === "diff" ? "Diff" : v}
                      </button>
                    ))}
                    {dirty && <span className="ml-2 text-xs text-amber-600">unsaved changes</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <button
                      onClick={save}
                      disabled={busy !== null || !dirty}
                      className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {busy === "save" ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={evaluate}
                      disabled={busy !== null || content.trim().length < 50}
                      className="rounded-md bg-accent px-3 py-1 text-white hover:bg-accent-hover disabled:opacity-50"
                    >
                      {busy === "evaluate" ? "Evaluating…" : "Evaluate"}
                    </button>
                    <button
                      onClick={() => download(`${base}.md`, content, "text/markdown")}
                      className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50"
                    >
                      .md
                    </button>
                    <button
                      onClick={() =>
                        download(
                          `${base}.html`,
                          markdownToHtmlDocument(content, jobTitle || "Tailored Resume"),
                          "text/html"
                        )
                      }
                      className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50"
                    >
                      .html
                    </button>
                    <button
                      onClick={() => {
                        const url = URL.createObjectURL(new Blob([printHtml], { type: "text/html" }));
                        window.open(url, "_blank");
                      }}
                      className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50"
                    >
                      Print / PDF
                    </button>
                  </div>
                </div>
                {view === "preview" && (
                  <div
                    className="prose-resume px-6 py-5 text-sm leading-relaxed text-zinc-800 [&_h1]:mb-1 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1+p]:text-zinc-500 [&_h2]:mt-5 [&_h2]:border-b [&_h2]:border-zinc-200 [&_h2]:pb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-zinc-500 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-medium [&_h3~p]:my-0.5 [&_h3~p]:text-zinc-500 [&_h3~p]:text-[13px] [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_hr]:my-4 [&_hr]:border-zinc-200"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                )}
                {view === "edit" && (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={28}
                    spellCheck={false}
                    className="block w-full resize-y rounded-b-xl px-4 py-3 font-mono text-xs leading-relaxed focus:outline-none"
                  />
                )}
                {view === "diff" && (
                  <div className="max-h-[70vh] overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed">
                    {resumeText === null ? (
                      <p className="text-zinc-500">Loading original resume…</p>
                    ) : (
                      <>
                        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                          Original resume → tailored resume
                        </p>
                        {diffLines(resumeText, content).map((l, i) => (
                          <div
                            key={i}
                            className={
                              l.type === "add"
                                ? "bg-green-50 text-green-900"
                                : l.type === "del"
                                  ? "bg-red-50 text-red-800 line-through decoration-red-300"
                                  : "text-zinc-500"
                            }
                          >
                            <span className="mr-2 inline-block w-4 select-none text-right">
                              {l.type === "add" ? "+" : l.type === "del" ? "-" : " "}
                            </span>
                            <span className="whitespace-pre-wrap">{l.text || " "}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {evaluation && (
                <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-medium">AI evaluation</h2>
                  <p className="text-xs text-zinc-400">
                    Score reflects the current resume text against this job description.
                  </p>
                  <MatchResultView analysis={evaluation} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
