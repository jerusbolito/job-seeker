"use client";

import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useAppStore } from "@/lib/store";
import LlmSettingsForm from "@/components/LlmSettingsForm";
import CoachWidget from "@/components/CoachWidget";
import type { ResumeProfile } from "@/lib/llm";

interface ResumeRow {
  id: string;
  filename: string;
  profile: ResumeProfile;
  createdAt: string;
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value == null) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function DashboardPage() {
  const { llm, resumeId, setResumeId } = useAppStore();
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [selected, setSelected] = useState<ResumeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadResumes() {
    const res = await fetch("/api/resume");
    if (res.ok) {
      const data: ResumeRow[] = await res.json();
      setResumes(data);
      if (data.length > 0) {
        const current = data.find((r) => r.id === resumeId) ?? data[0];
        setSelected(current);
        setResumeId(current.id);
      }
    }
  }

  useEffect(() => {
    fetch("/api/resume")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ResumeRow[]) => {
        setResumes(data);
        if (data.length > 0) {
          const current = data.find((r) => r.id === resumeId) ?? data[0];
          setSelected(current);
          setResumeId(current.id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      if (!llm.apiKey && llm.provider !== "ollama") {
        setError("Set your LLM API key below before uploading.");
        return;
      }
      setBusy(true);
      setError("");
      setNotice("");

      const form = new FormData();
      form.append("file", file);
      form.append("llm", JSON.stringify(llm));

      const res = await fetch("/api/resume", { method: "POST", body: form });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setNotice(`Parsed "${data.filename}" successfully.`);
      setResumeId(data.id);
      await loadResumes();
    },
    [llm] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
    disabled: busy,
  });

  const profile = selected?.profile;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Upload a resume and configure your LLM provider. Your API key stays in
          this browser session only.
        </p>
      </div>

      <LlmSettingsForm />

      <section>
        <h2 className="mb-3 text-lg font-medium">Resume</h2>
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
            isDragActive ? "border-zinc-900 bg-zinc-100" : "border-zinc-300 bg-white hover:border-zinc-400"
          } ${busy ? "opacity-60" : ""}`}
        >
          <input {...getInputProps()} />
          {busy ? (
            <p className="text-zinc-600">Parsing resume with your LLM…</p>
          ) : isDragActive ? (
            <p className="text-zinc-600">Drop the file here…</p>
          ) : (
            <p className="text-zinc-600">
              Drag &amp; drop your resume (PDF, DOCX, TXT), or click to browse
            </p>
          )}
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {notice}
          </p>
        )}

        {resumes.length > 0 && (
          <div className="mt-4">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-500">Active resume</span>
              <select
                value={selected?.id ?? ""}
                onChange={(e) => {
                  const r = resumes.find((x) => x.id === e.target.value) ?? null;
                  setSelected(r);
                  setResumeId(r?.id ?? null);
                }}
                className="w-full max-w-md rounded-md border border-zinc-300 bg-white px-3 py-2"
              >
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.filename} — {new Date(r.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </section>

      {profile && (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-medium">Extracted profile</h2>
            <span className="text-xs text-zinc-400">
              {profile.experienceYears != null ? `${profile.experienceYears} yrs experience` : ""}
              {profile.experienceYears != null ? " · " : ""}
              {profile.seniority} level
            </span>
          </div>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="font-medium text-zinc-900">{profile.name}</p>
              <p className="text-zinc-600">{profile.headline}</p>
            </div>
            <p className="leading-relaxed text-zinc-600">{profile.summary}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Target roles
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {asArray(profile.roles).map((r) => (
                    <span
                      key={r}
                      className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs text-white"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Search keywords
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {asArray(profile.keywords).map((k) => (
                    <span
                      key={k}
                      className="rounded-full px-2.5 py-0.5 text-xs text-zinc-700 ring-1 ring-zinc-200"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Skills
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {asArray(profile.skills).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <CoachWidget />
    </div>
  );
}
