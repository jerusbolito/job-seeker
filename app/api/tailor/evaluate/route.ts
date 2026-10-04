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
  // Evaluate either a saved tailored resume (id) or ad-hoc content + jdText.
  id: z.string().optional(),
  content: z.string().min(50, "Resume content is too short to evaluate."),
  jdText: z.string().min(50).optional(),
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
  const { llm, id, content, jdText, resumeId } = parsed.data;

  const [resume, tailored] = await Promise.all([
    resumeId
      ? prisma.resume.findFirst({ where: { id: resumeId, userId } })
      : prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    id ? prisma.tailoredResume.findFirst({ where: { id, userId } }) : null,
  ]);
  if (!resume) {
    return NextResponse.json({ error: "Upload a resume first." }, { status: 400 });
  }
  if (id && !tailored) {
    return NextResponse.json({ error: "Tailored resume not found." }, { status: 404 });
  }

  const jd = tailored?.jdText ?? jdText;
  if (!jd || jd.length < 50) {
    return NextResponse.json(
      { error: "A job description is required to evaluate." },
      { status: 400 }
    );
  }

  try {
    const profile = JSON.parse(resume.profileJson) as ResumeProfile;
    const analysis = await analyzeMatch(profile, content, jd, llm as LlmSettings);

    if (tailored) {
      await prisma.tailoredResume.update({
        where: { id: tailored.id },
        data: { content, evaluationJson: JSON.stringify(analysis) },
      });
    }

    return NextResponse.json({ analysis });
  } catch (e) {
    return NextResponse.json(
      { error: `Evaluation failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }
}
