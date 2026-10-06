import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: RouteContext<"/api/resume/[id]">) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const resume = await prisma.resume.findFirst({ where: { id, userId } });
  if (!resume) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: resume.id,
    filename: resume.filename,
    text: resume.text,
    profile: JSON.parse(resume.profileJson),
    createdAt: resume.createdAt,
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/resume/[id]">) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.resume.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.resume.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
