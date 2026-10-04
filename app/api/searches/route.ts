import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searches = await prisma.jobSearch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(
    searches.map((s) => ({
      id: s.id,
      location: s.location,
      remoteOnly: s.remoteOnly,
      jobType: s.jobType,
      result: JSON.parse(s.resultsJson),
      createdAt: s.createdAt,
    }))
  );
}
