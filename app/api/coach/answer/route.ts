import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluateAnswer, mergeLearned, parseLearned } from "@/lib/coach";
import type { LlmSettings } from "@/lib/types";
import type { ResumeProfile } from "@/lib/llm";

export const runtime = "nodejs";

const schema = z.object({
  llm: z.object({
    provider: z.string(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    model: z.string(),
  }),
  question: z.string().min(1),
  category: z.enum(["behavioral", "technical", "discovery"]),
  answer: z.string().min(1, "Write an answer first."),
  resumeId: z.string().optional(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }
  const { llm, question, category, answer, resumeId } = parsed.data;

  const resume = resumeId
    ? await prisma.resume.findFirst({ where: { id: resumeId, userId } })
    : await prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!resume) {
    return NextResponse.json({ error: "Upload a resume first." }, { status: 400 });
  }

  try {
    const profile = JSON.parse(resume.profileJson) as ResumeProfile;
    const feedback = await evaluateAnswer(question, category, answer, profile, llm as LlmSettings);

    await prisma.coachQA.create({
      data: {
        userId,
        question,
        category,
        answer,
        feedbackJson: JSON.stringify(feedback),
      },
    });

    const existing = await prisma.coachProfile.findUnique({ where: { userId } });
    const learned = mergeLearned(
      parseLearned(existing?.learnedJson),
      feedback.extracted
    );
    await prisma.coachProfile.upsert({
      where: { userId },
      create: { userId, learnedJson: JSON.stringify(learned) },
      update: { learnedJson: JSON.stringify(learned) },
    });

    return NextResponse.json({ feedback, learned });
  } catch (e) {
    return NextResponse.json(
      { error: `Evaluation failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }
}
