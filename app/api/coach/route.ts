import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLearned } from "@/lib/coach";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, qas, questionCount, report] = await Promise.all([
    prisma.coachProfile.findUnique({ where: { userId } }),
    prisma.coachQA.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.coachQA.count({ where: { userId } }),
    prisma.demandReport.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    learned: parseLearned(profile?.learnedJson),
    recentQA: qas.map((q) => ({
      id: q.id,
      question: q.question,
      category: q.category,
      answer: q.answer,
      feedback: JSON.parse(q.feedbackJson),
      createdAt: q.createdAt,
    })),
    questionCount,
    demandReport: report
      ? { ...JSON.parse(report.reportJson), createdAt: report.createdAt }
      : null,
  });
}
