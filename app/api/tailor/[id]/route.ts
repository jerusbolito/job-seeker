import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const putSchema = z.object({
  content: z.string().min(1, "Resume content cannot be empty."),
  evaluation: z.unknown().optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/tailor/[id]">) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const record = await prisma.tailoredResume.findFirst({ where: { id, userId } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: record.id,
    jobTitle: record.jobTitle,
    jobUrl: record.jobUrl,
    jdText: record.jdText,
    content: record.content,
    changes: JSON.parse(record.changesJson),
    evaluation: record.evaluationJson ? JSON.parse(record.evaluationJson) : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/tailor/[id]">) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const existing = await prisma.tailoredResume.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.tailoredResume.update({
    where: { id },
    data: {
      content: parsed.data.content,
      ...(parsed.data.evaluation !== undefined
        ? { evaluationJson: JSON.stringify(parsed.data.evaluation) }
        : {}),
    },
  });
  return NextResponse.json({ id: updated.id, updatedAt: updated.updatedAt });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tailor/[id]">) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.tailoredResume.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.tailoredResume.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
