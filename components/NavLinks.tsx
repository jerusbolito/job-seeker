"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/dashboard", "Dashboard"],
  ["/jobs", "Find Jobs"],
  ["/match", "Match a JD"],
  ["/tailor", "Tailor"],
  ["/coach", "Coach"],
  ["/history", "History"],
] as const;

export default function NavLinks({
  variant = "bar",
}: {
  variant?: "bar" | "sidebar";
}) {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map(([href, label]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const className =
          variant === "sidebar"
            ? `rounded-md px-3 py-2 text-sm ${
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`
            : active
              ? "font-medium text-zinc-900 underline decoration-accent decoration-2 underline-offset-4"
              : "whitespace-nowrap text-zinc-500 hover:text-zinc-900";
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
