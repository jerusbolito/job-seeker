import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scanDemand, parseLearned } from "@/lib/coach";
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
  resumeId: z.string().optional(),
  refresh: z.boolean().default(false),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { llm, resumeId, refresh } = parsed.data;

  if (!refresh) {
    const latest = await prisma.demandReport.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < 24 * 60 * 60 * 1000) {
      return NextResponse.json({
        report: { ...JSON.parse(latest.reportJson), createdAt: latest.createdAt },
        cached: true,
      });
    }
  }

  const [resume, coachProfile] = await Promise.all([
    resumeId
      ? prisma.resume.findFirst({ where: { id: resumeId, userId } })
      : prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.coachProfile.findUnique({ where: { userId } }),
  ]);
  if (!resume) {
    return NextResponse.json({ error: "Upload a resume first." }, { status: 400 });
  }

  try {
    const profile = JSON.parse(resume.profileJson) as ResumeProfile;
    const report = await scanDemand(
      profile,
      parseLearned(coachProfile?.learnedJson),
      llm as LlmSettings
    );

    const record = await prisma.demandReport.create({
      data: { userId, reportJson: JSON.stringify(report) },
    });

    return NextResponse.json({
      report: { ...report, createdAt: record.createdAt },
      cached: false,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Demand scan failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }
}
