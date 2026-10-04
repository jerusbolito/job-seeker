import Link from "next/link";
import { auth } from "@/auth";
import SignOutButton from "./SignOutButton";

export default async function Nav() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <nav className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          JobSeeker
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900">
            Dashboard
          </Link>
          <Link href="/jobs" className="text-zinc-600 hover:text-zinc-900">
            Find Jobs
          </Link>
          <Link href="/match" className="text-zinc-600 hover:text-zinc-900">
            Match a JD
          </Link>
          <Link href="/tailor" className="text-zinc-600 hover:text-zinc-900">
            Tailor
          </Link>
          <Link href="/coach" className="text-zinc-600 hover:text-zinc-900">
            Coach
          </Link>
          <Link href="/history" className="text-zinc-600 hover:text-zinc-900">
            History
          </Link>
          <span className="hidden text-zinc-400 sm:inline">{session.user.email}</span>
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
