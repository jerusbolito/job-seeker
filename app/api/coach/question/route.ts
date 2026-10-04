import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextQuestion, parseLearned } from "@/lib/coach";
import type { LlmSettings } from "@/lib/types";
import type { ResumeProfile } from "@/lib/llm";
import type { DemandReportData } from "@/lib/coach";

export const runtime = "nodejs";

const schema = z.object({
  llm: z.object({
    provider: z.string(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    model: z.string(),
  }),
  resumeId: z.string().optional(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { llm, resumeId } = parsed.data;

  const [resume, coachProfile, recentQA, report] = await Promise.all([
    resumeId
      ? prisma.resume.findFirst({ where: { id: resumeId, userId } })
      : prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.coachProfile.findUnique({ where: { userId } }),
    prisma.coachQA.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 8 }),
    prisma.demandReport.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!resume) {
    return NextResponse.json({ error: "Upload a resume first." }, { status: 400 });
  }

  const gaps = report
    ? (JSON.parse(report.reportJson) as DemandReportData).gaps
        .filter((g) => g.priority !== "low")
        .map((g) => g.skill)
    : [];

  try {
    const profile = JSON.parse(resume.profileJson) as ResumeProfile;
    const question = await nextQuestion(
      profile,
      parseLearned(coachProfile?.learnedJson),
      recentQA.map((q) => ({
        question: q.question,
        answer: q.answer,
        score: (JSON.parse(q.feedbackJson) as { score?: number }).score ?? 0,
      })),
      gaps,
      llm as LlmSettings
    );
    return NextResponse.json(question);
  } catch (e) {
    return NextResponse.json(
      { error: `Question generation failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }
}
