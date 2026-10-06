import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const STEPS = [
  {
    n: "01",
    title: "Match",
    text: "Paste any job description. Get a scored breakdown of what fits, what's missing, and which exact lines to rewrite.",
  },
  {
    n: "02",
    title: "Tailor",
    text: "Generate an ATS-safe version of your resume for that role — every change auditable in a diff, nothing fabricated.",
  },
  {
    n: "03",
    title: "Practice",
    text: "Answer the interview questions a coach would ask, then see which skills the market actually wants from you.",
  },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <>
      <p className="font-serif text-lg font-semibold tracking-tight">JobSeeker</p>
      <div className="pt-12 sm:pt-20">
      <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        A resume workflow, not another job board.
      </h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-600">
        Upload your resume, score it against real job descriptions, and get
        rewrite-ready suggestions — powered by your own LLM key, stored nowhere.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/register"
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100"
        >
          Sign in
        </Link>
      </div>

      <div className="mt-20 grid gap-10 border-t border-zinc-200 pt-10 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n}>
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400">
              {s.n}
            </p>
            <h2 className="mt-1.5 font-medium text-zinc-900">{s.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
