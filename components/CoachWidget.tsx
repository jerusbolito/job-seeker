"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CoachSummary {
  questionCount: number;
  demandReport: {
    recommendations: { type: string; text: string }[];
    createdAt?: string;
  } | null;
}

export default function CoachWidget() {
  const [data, setData] = useState<CoachSummary | null>(null);

  useEffect(() => {
    fetch("/api/coach")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d));
  }, []);

  const recs = data?.demandReport?.recommendations?.slice(0, 3) ?? [];
  const answered = data?.questionCount ?? 0;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Coach</h2>
        <Link href="/coach" className="text-sm text-zinc-500 underline hover:text-zinc-900">
          Open coach
        </Link>
      </div>

      {recs.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">
          Answer interview questions on the{" "}
          <Link href="/coach" className="underline">
            coach page
          </Link>{" "}
          — the app learns about you, then scans job listings for skills the market
          wants that you&apos;re missing.
          {answered > 0 && ` ${answered} question${answered === 1 ? "" : "s"} answered so far.`}
        </p>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-zinc-400">
            {answered} question{answered === 1 ? "" : "s"} answered · suggestions from your
            latest market scan
          </p>
          <ul className="mt-2 space-y-2">
            {recs.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
                  {r.type}
                </span>
                <span className="text-zinc-700">{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
