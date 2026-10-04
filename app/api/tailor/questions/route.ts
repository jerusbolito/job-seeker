import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findGapQuestions } from "@/lib/tailor";
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
  const { llm, jdText, resumeId } = parsed.data;

  const resume = resumeId
    ? await prisma.resume.findFirst({ where: { id: resumeId, userId } })
    : await prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!resume) {
    return NextResponse.json({ error: "Upload a resume first." }, { status: 400 });
  }

  try {
    const profile = JSON.parse(resume.profileJson) as ResumeProfile;
    const questions = await findGapQuestions(profile, resume.text, jdText, llm as LlmSettings);
    return NextResponse.json({ questions });
  } catch (e) {
    return NextResponse.json(
      { error: `Gap analysis failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }
}
