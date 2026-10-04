import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeMatch } from "@/lib/matcher";
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
  jobUrl: z.url().optional().or(z.literal("")),
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
  const { llm, jdText, jobUrl, resumeId } = parsed.data;

  const resume = resumeId
    ? await prisma.resume.findFirst({ where: { id: resumeId, userId } })
    : await prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!resume) {
    return NextResponse.json({ error: "Upload a resume first." }, { status: 400 });
  }

  try {
    const profile = JSON.parse(resume.profileJson) as ResumeProfile;
    const analysis = await analyzeMatch(profile, resume.text, jdText, llm as LlmSettings);

    const record = await prisma.matchAnalysis.create({
      data: {
        userId,
        jdText,
        jobUrl: jobUrl || null,
        analysisJson: JSON.stringify(analysis),
      },
    });

    return NextResponse.json({ id: record.id, analysis });
  } catch (e) {
    return NextResponse.json(
      { error: `Analysis failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const matches = await prisma.matchAnalysis.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(
    matches.map((m) => ({
      id: m.id,
      jobUrl: m.jobUrl,
      jdPreview: m.jdText.slice(0, 200),
      analysis: JSON.parse(m.analysisJson),
      createdAt: m.createdAt,
    }))
  );
}
