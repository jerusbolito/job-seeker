import { NextResponse } from "next/server";
import { extractText } from "unpdf";
import mammoth from "mammoth";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractProfile } from "@/lib/llm";
import type { LlmSettings } from "@/lib/types";

export const runtime = "nodejs";

async function extractFileText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
    return text;
  }
  if (name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return buf.toString("utf-8");
  }
  throw new Error("Unsupported file type — upload a PDF, DOCX, or TXT resume.");
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const llmRaw = form.get("llm");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (typeof llmRaw !== "string") {
    return NextResponse.json({ error: "Missing LLM settings" }, { status: 400 });
  }

  let llm: LlmSettings;
  try {
    llm = JSON.parse(llmRaw);
  } catch {
    return NextResponse.json({ error: "Invalid LLM settings" }, { status: 400 });
  }

  let text: string;
  try {
    text = await extractFileText(file);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not read file" },
      { status: 422 }
    );
  }
  if (!text.trim()) {
    return NextResponse.json({ error: "No text could be extracted from this file." }, { status: 422 });
  }

  try {
    const profile = await extractProfile(text, llm);
    const resume = await prisma.resume.create({
      data: { userId, filename: file.name, text, profileJson: JSON.stringify(profile) },
    });
    return NextResponse.json({ id: resume.id, filename: resume.filename, profile });
  } catch (e) {
    return NextResponse.json(
      { error: `LLM extraction failed: ${e instanceof Error ? e.message : "unknown error"}` },
      { status: 502 }
    );
  }
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resumes = await prisma.resume.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, profileJson: true, createdAt: true },
  });
  return NextResponse.json(
    resumes.map((r) => ({ ...r, profile: JSON.parse(r.profileJson), profileJson: undefined }))
  );
}
