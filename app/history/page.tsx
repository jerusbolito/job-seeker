import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

interface StoredResult {
  jobs: Array<{ title: string; company: string; location: string; url: string; score: number }>;
  queries: string[];
  totalCandidates: number;
}

interface StoredAnalysis {
  score: number;
  verdict: string;
  summary: string;
}

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [searches, matches, tailored] = await Promise.all([
    prisma.jobSearch.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.matchAnalysis.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.tailoredResume.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">History</h1>

      <section>
        <h2 className="mb-3 text-lg font-medium">Job searches</h2>
        {searches.length === 0 ? (
          <p className="text-sm text-zinc-500">No searches yet.</p>
        ) : (
          <ul className="space-y-3">
            {searches.map((s) => {
              const r = JSON.parse(s.resultsJson) as StoredResult;
              return (
                <li key={s.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {s.location || "Anywhere"}
                      {s.remoteOnly ? " · remote" : ""}
                      {s.jobType ? ` · ${s.jobType}` : ""}
                    </span>
                    <span className="text-zinc-400">
                      {new Date(s.createdAt).toLocaleString()} · {r.jobs.length} picks /{" "}
                      {r.totalCandidates} candidates
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {r.jobs.slice(0, 5).map((j) => (
                      <li key={j.url} className="text-sm text-zinc-600">
                        <a href={j.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {j.title} — {j.company}
                        </a>{" "}
                        <span className="text-zinc-400">({j.score}%)</span>
                      </li>
                    ))}
                    {r.jobs.length > 5 && (
                      <li className="text-xs text-zinc-400">+{r.jobs.length - 5} more</li>
                    )}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Match analyses</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-zinc-500">No analyses yet.</p>
        ) : (
          <ul className="space-y-3">
            {matches.map((m) => {
              const a = JSON.parse(m.analysisJson) as StoredAnalysis;
              return (
                <li key={m.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {a.score}% — {a.verdict}
                    </span>
                    <span className="text-zinc-400">
                      {new Date(m.createdAt).toLocaleString()}
                      {m.jobUrl && (
                        <>
                          {" · "}
                          <a
                            href={m.jobUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            listing
                          </a>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">{a.summary}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-400">{m.jdText}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Tailored resumes</h2>
        {tailored.length === 0 ? (
          <p className="text-sm text-zinc-500">No tailored resumes yet.</p>
        ) : (
          <ul className="space-y-3">
            {tailored.map((t) => {
              const evaluation = t.evaluationJson
                ? (JSON.parse(t.evaluationJson) as StoredAnalysis)
                : null;
              return (
                <li key={t.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {t.jobTitle || "Untitled resume"}
                      {evaluation && (
                        <span className="ml-2 text-zinc-500">
                          — {evaluation.score}% {evaluation.verdict}
                        </span>
                      )}
                    </span>
                    <span className="text-zinc-400">
                      {new Date(t.updatedAt).toLocaleString()}
                      {t.jobUrl && (
                        <>
                          {" · "}
                          <a
                            href={t.jobUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            listing
                          </a>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-zinc-400">{t.jdText}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
