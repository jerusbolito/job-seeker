interface Suggestion {
  section: string;
  current: string | null;
  suggested: string;
  why: string;
}

export interface MatchAnalysisData {
  score: number;
  verdict: "strong" | "good" | "fair" | "weak";
  subscores?: {
    skillsMatch: number;
    experienceMatch: number;
    seniorityFit: number;
    keywordCoverage: number;
  };
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  keywordGaps: string[];
  suggestions: Suggestion[];
}

const VERDICT_STYLES: Record<string, string> = {
  strong: "bg-green-100 text-green-800",
  good: "bg-emerald-100 text-emerald-800",
  fair: "bg-amber-100 text-amber-800",
  weak: "bg-red-100 text-red-800",
};

function Chip({ children, tone }: { children: string; tone: "good" | "bad" | "warn" }) {
  const styles = {
    good: "bg-green-50 text-green-800 ring-green-200",
    bad: "bg-red-50 text-red-800 ring-red-200",
    warn: "bg-amber-50 text-amber-800 ring-amber-200",
  }[tone];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ${styles}`}>{children}</span>
  );
}

export default function MatchResultView({ analysis: a }: { analysis: MatchAnalysisData }) {

  return (
    <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-zinc-200 text-lg font-semibold">
          {a.score}
        </div>
        <div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT_STYLES[a.verdict] ?? ""}`}>
            {a.verdict} match
          </span>
          <p className="mt-1 text-sm text-zinc-600">{a.summary}</p>
        </div>
      </div>

      {a.subscores && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {(
            [
              ["Skills", a.subscores.skillsMatch],
              ["Experience", a.subscores.experienceMatch],
              ["Seniority", a.subscores.seniorityFit],
              ["Keywords", a.subscores.keywordCoverage],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-zinc-500">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${
                    value >= 75
                      ? "bg-green-500"
                      : value >= 50
                        ? "bg-amber-400"
                        : "bg-red-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Matched skills
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {a.matchedSkills.map((s) => (
              <Chip key={s} tone="good">
                {s}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Missing skills
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {a.missingSkills.map((s) => (
              <Chip key={s} tone="bad">
                {s}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            ATS keyword gaps
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {a.keywordGaps.map((s) => (
              <Chip key={s} tone="warn">
                {s}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Suggestions
        </h4>
        {a.suggestions.filter((s) => s.suggested?.trim()).length === 0 ? (
          <p className="text-sm text-zinc-500">No concrete suggestions.</p>
        ) : null}
        <ul className="space-y-3">
          {a.suggestions
            .filter((s) => s.suggested?.trim())
            .map((s, i) => (
            <li key={i} className="rounded-lg bg-zinc-50 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
                  {s.section}
                </span>
                <span className="text-zinc-500">{s.why}</span>
              </div>
              {s.current && (
                <div className="mt-3 border-l-2 border-red-300 pl-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-red-500">
                    Replace
                  </p>
                  <p className="mt-0.5 text-zinc-500 line-through decoration-red-300">
                    {s.current}
                  </p>
                </div>
              )}
              <div className="mt-3 border-l-2 border-green-400 pl-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-green-600">
                  {s.current ? "With" : "Add"}
                </p>
                <p className="mt-0.5 text-zinc-800">{s.suggested}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
