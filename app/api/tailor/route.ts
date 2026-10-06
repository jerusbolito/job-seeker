import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTailoredResume } from "@/lib/tailor";
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
  jdText: z.string().min(50, "Paste a full job description (50+ characters)."),
  jobTitle: z.string().max(200).optional().or(z.literal("")),
  jobUrl: z.url().optional().or(z.literal("")),
  resumeId: z.string().optional(),
  answers: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .max(10)
    .optional(),
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
  const { llm, jdText, jobTitle, jobUrl, resumeId, answers } = parsed.data;

  const resume = resumeId
    ? await prisma.resume.findFirst({ where: { id: resumeId, userId } })
    : await prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!resume) {
    return NextResponse.json({ error: "Upload a resume first." }, { status: 400 });
  }

  try {
    const profile = JSON.parse(resume.profileJson) as ResumeProfile;
    const answered = (answers ?? []).filter((a) => a.answer.trim());
    const tailored = await generateTailoredResume(
      profile,
      resume.text,
      jdText,
      llm as LlmSettings,
      answered
    );

    const record = await prisma.tailoredResume.create({
      data: {
        userId,
        jobTitle: jobTitle || null,
        jobUrl: jobUrl || null,
        jdText,
        content: tailored.markdown,
        changesJson: JSON.stringify(tailored.changes),
        qaJson: answered.length ? JSON.stringify(answered) : null,
      },
    });

    return NextResponse.json({
      id: record.id,
      content: tailored.markdown,
      changes: tailored.changes,
      warnings: tailored.warnings,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Generation failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resumes = await prisma.tailoredResume.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      jobTitle: true,
      jobUrl: true,
      jdText: true,
      content: true,
      changesJson: true,
      evaluationJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json(
    resumes.map((r) => ({
      ...r,
      jdPreview: r.jdText.slice(0, 200),
      jdText: undefined,
      changes: JSON.parse(r.changesJson),
      evaluation: r.evaluationJson ? JSON.parse(r.evaluationJson) : null,
      changesJson: undefined,
      evaluationJson: undefined,
    }))
  );
}
