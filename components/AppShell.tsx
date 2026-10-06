import Link from "next/link";
import { auth } from "@/auth";
import NavLinks from "./NavLinks";
import SignOutButton from "./SignOutButton";

export default async function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    );
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col border-r border-zinc-200 bg-white lg:flex">
        <div className="px-5 py-5">
          <Link
            href="/dashboard"
            className="font-serif text-xl font-semibold tracking-tight"
          >
            JobSeeker
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          <NavLinks variant="sidebar" />
        </nav>
        <div className="border-t border-zinc-100 px-5 py-4">
          <p className="truncate text-xs text-zinc-400">{session.user.email}</p>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white lg:hidden">
        <div className="flex items-center gap-4 px-4 py-3">
          <Link
            href="/dashboard"
            className="shrink-0 font-serif text-lg font-semibold tracking-tight"
          >
            JobSeeker
          </Link>
          <nav className="flex flex-1 items-center gap-4 overflow-x-auto text-sm">
            <NavLinks variant="bar" />
          </nav>
          <SignOutButton />
        </div>
      </header>

      <main className="w-full flex-1 lg:pl-60">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</div>
      </main>
    </>
  );
}
