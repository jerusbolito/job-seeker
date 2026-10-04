import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchJobsAgent } from "@/lib/agent";
import { combinedSkills, parseLearned } from "@/lib/coach";
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
  location: z.string().default(""),
  remoteOnly: z.boolean().default(false),
  jobType: z.string().optional(),
  resumeId: z.string().optional(),
});

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { llm, location, remoteOnly, jobType, resumeId } = parsed.data;

  const resume = resumeId
    ? await prisma.resume.findFirst({ where: { id: resumeId, userId } })
    : await prisma.resume.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
  if (!resume) {
    return NextResponse.json({ error: "Upload a resume first." }, { status: 400 });
  }

  try {
    const profile = JSON.parse(resume.profileJson) as ResumeProfile;
    // Skills learned from coach answers feed straight into search planning.
    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId } });
    const enriched: ResumeProfile = {
      ...profile,
      skills: combinedSkills(profile, parseLearned(coachProfile?.learnedJson)),
    };
    const result = await searchJobsAgent(
      enriched,
      { location, remoteOnly, jobType },
      llm as LlmSettings
    );

    const search = await prisma.jobSearch.create({
      data: {
        userId,
        location,
        remoteOnly,
        jobType,
        resultsJson: JSON.stringify(result),
      },
    });

    return NextResponse.json({ id: search.id, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: `Job search failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }
}
