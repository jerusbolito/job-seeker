import { z } from "zod";
import { generateStructured, type ResumeProfile } from "./llm";
import type { LlmSettings } from "./types";

export const gapQuestionsSchema = z.object({
  questions: z
    .array(z.string())
    .max(6)
    .describe(
      "Short direct questions asking whether the candidate has experience the JD requires but the resume doesn't show"
    ),
});

export async function findGapQuestions(
  profile: ResumeProfile,
  resumeText: string,
  jdText: string,
  settings: LlmSettings,
  priorAnswers: GapAnswer[] = []
): Promise<string[]> {
  const priorBlock =
    priorAnswers.length > 0
      ? `\n\nALREADY CONFIRMED BY THE CANDIDATE — these answers are verified resume material. Any requirement, skill, or experience covered by them is NOT a gap: do not ask about it, and do not rephrase the same question differently.\n${priorAnswers
          .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
          .join("\n")}`
      : "";

  const object = await generateStructured({
    settings,
    schema: gapQuestionsSchema,
    prompt:
      `You are an ATS specialist preparing to tailor a resume to a job description. Find significant requirements in the JD that are NOT evidenced anywhere in the resume — hard skills, tools, domain experience, certifications, years of experience. For each gap, write one short question to ask the candidate, phrased so their answer can be truthfully added to the resume (e.g. "The role requires PyTorch — do you have hands-on experience with it? Describe projects where you used it."). Do NOT ask about skills or experience already on the resume, soft/vague requirements, or trivial gaps. If there are no real gaps, return an empty list.

CANDIDATE PROFILE:
${JSON.stringify(profile)}

RESUME:
${resumeText.slice(0, 8000)}

JOB DESCRIPTION:
${jdText.slice(0, 8000)}${priorBlock}`,
  });
  return object.questions;
}

// Safety net for when the model asks a question that substantially overlaps
// with something the candidate already answered. Content-word overlap >= 60%
// counts as a repeat.
const STOP_WORDS = new Set([
  "have", "with", "that", "this", "from", "your", "does", "what", "when",
  "where", "which", "would", "could", "should", "describe", "tell", "about",
  "experience", "role", "requires", "required", "there", "their", "they",
]);

function contentWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export function filterAnsweredQuestions(
  questions: string[],
  priorAnswers: GapAnswer[]
): string[] {
  if (!priorAnswers.length) return questions;
  const priorWords = new Set(
    priorAnswers.flatMap((a) => contentWords(`${a.question} ${a.answer}`))
  );
  return questions.filter((q) => {
    const words = contentWords(q);
    if (words.length === 0) return true;
    const overlap = words.filter((w) => priorWords.has(w)).length / words.length;
    return overlap < 0.6;
  });
}

export const tailoredResumeSchema = z.object({
  // The model fills this BEFORE the resume fields, forcing it to decide what
  // to keep and emphasize first — a free two-pass effect in a single call.
  strategy: z
    .object({
      keepRoles: z
        .array(z.string())
        .describe("Every 'role — company' to include, most relevant first"),
      dropRoles: z
        .array(z.string())
        .describe("Roles to omit as irrelevant, if any"),
      emphasis: z.string().describe("One-line tailoring angle for this JD"),
      prioritySkills: z
        .array(z.string())
        .describe("The candidate's strongest skills to feature — only from the resume or verified answers"),
    })
    .describe("Tailoring plan — decide BEFORE writing the resume"),
  name: z.string().describe("Candidate's full name"),
  contact: z
    .string()
    .describe("Single line of contact info: email · phone · location · links"),
  summary: z.string().describe("2-3 sentence professional summary"),
  skills: z
    .array(z.string())
    .max(40)
    .describe("The candidate's strongest, best-evidenced skills first — not merely what the JD asks for"),
  experience: z
    .array(
      z.object({
        role: z.string(),
        company: z.string(),
        location: z.string().nullable().describe("City/region or 'Remote'"),
        startDate: z.string().describe("Start date in 'Mon YYYY' format, e.g. 'Mar 2021'"),
        endDate: z
          .string()
          .nullable()
          .describe("End date in 'Mon YYYY' format, or 'Present' if current"),
        bullets: z
          .array(z.string())
          .max(8)
          .describe("Achievement bullets, most relevant to the JD first"),
      })
    )
    .describe("Work history — order doesn't matter, it is sorted on render"),
  education: z
    .array(
      z.object({
        degree: z.string(),
        school: z.string(),
        dates: z.string().nullable().describe("e.g. '2016 – 2020'"),
        details: z.string().nullable().describe("Honors, relevant coursework, etc."),
      })
    )
    .describe("Education history"),
  extraSections: z
    .array(
      z.object({
        title: z.string().describe("Section heading, e.g. 'Projects' or 'Certifications'"),
        items: z.array(z.string()).max(10),
      })
    )
    .describe("Additional sections — only if present in the original resume"),
  changes: z
    .array(z.string())
    .max(10)
    .describe("Short list of what was emphasized, reordered, or rephrased vs the original resume"),
});

export interface GapAnswer {
  question: string;
  answer: string;
}

export type TailoredResumeData = z.infer<typeof tailoredResumeSchema>;
export type TailoredResume = {
  markdown: string;
  changes: string[];
  warnings: string[];
};

function wordRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
}

// Flags skills/employers in the generated resume that don't appear in the
// original resume or verified answers — possible fabrication.
export function findUnverifiedTerms(
  data: TailoredResumeData,
  resumeText: string,
  answers: GapAnswer[]
): string[] {
  const corpus = `${resumeText} ${answers.map((a) => a.answer).join(" ")}`;
  const warnings: string[] = [];

  for (const skill of data.skills ?? []) {
    if (skill.trim().length > 1 && !wordRegex(skill).test(corpus)) {
      warnings.push(`"${skill}" isn't in your original resume or answers — verify it's real.`);
    }
  }
  for (const e of data.experience ?? []) {
    const company = e.company
      .replace(/[,.\s]+(inc|llc|ltd|pty|corp|corporation|co|gmbh|sarl)\.?$/i, "")
      .trim();
    if (company.length > 2 && !corpus.toLowerCase().includes(company.toLowerCase())) {
      warnings.push(`Employer "${e.company}" doesn't appear in your original resume — verify.`);
    }
  }
  return warnings.slice(0, 8);
}

// Best-effort date value for sorting. "Present"/current roles sort first;
// unparseable dates sort last.
function dateValue(s: string | null | undefined): number {
  if (!s) return 0;
  const t = s.trim();
  if (/present|current|ongoing|now/i.test(t)) return Number.MAX_SAFE_INTEGER;
  const p = Date.parse(t);
  if (!Number.isNaN(p)) return p;
  const my = t.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (my) return Date.UTC(+my[2], +my[1] - 1);
  const years = t.match(/(?:19|20)\d{2}/g);
  if (years) return Date.UTC(+years[years.length - 1], 0);
  return 0;
}

// Deterministic ATS-friendly render: fixed section order, single column,
// plain headings and bullets, experience sorted reverse-chronologically.
export function renderResumeMarkdown(r: TailoredResumeData): string {
  const experience = [...(r.experience ?? [])].sort((a, b) => {
    const end = dateValue(b.endDate) - dateValue(a.endDate);
    return end !== 0 ? end : dateValue(b.startDate) - dateValue(a.startDate);
  });
  const education = [...(r.education ?? [])].sort(
    (a, b) => dateValue(b.dates) - dateValue(a.dates)
  );

  const lines: string[] = [`# ${r.name}`, r.contact, "", "## Professional Summary", r.summary];

  if (r.skills?.length) {
    lines.push("", "## Skills", r.skills.join(", "));
  }
  if (experience.length) {
    lines.push("", "## Experience");
    for (const e of experience) {
      lines.push(`### ${e.role} — ${e.company}`);
      const meta = [[e.startDate, e.endDate ?? "Present"].filter(Boolean).join(" – "), e.location]
        .filter(Boolean)
        .join(" · ");
      lines.push(meta);
      for (const b of e.bullets ?? []) lines.push(`- ${b}`);
    }
  }
  if (education.length) {
    lines.push("", "## Education");
    for (const e of education) {
      lines.push(`### ${e.degree} — ${e.school}`);
      if (e.dates) lines.push(e.dates);
      if (e.details) lines.push(e.details);
    }
  }
  for (const s of r.extraSections ?? []) {
    if (!s.items?.length) continue;
    lines.push("", `## ${s.title}`);
    for (const i of s.items) lines.push(`- ${i}`);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function generateTailoredResume(
  profile: ResumeProfile,
  resumeText: string,
  jdText: string,
  settings: LlmSettings,
  answers: GapAnswer[] = []
): Promise<TailoredResume> {
  const answersBlock =
    answers.length > 0
      ? `\nCANDIDATE'S VERIFIED ANSWERS TO GAP QUESTIONS (the candidate confirmed these — treat them as true resume material):\n${answers
          .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
          .join("\n")}\n`
      : "";
  const object = await generateStructured({
    settings,
    schema: tailoredResumeSchema,
    maxOutputTokens: 8192,
    prompt:
      `You are an expert resume writer and ATS specialist. Rewrite the candidate's resume so it is tailored to the job description, and return it as structured JSON.

Process: FIRST fill in the "strategy" block — decide which roles to keep (default: all real roles), which to drop, the emphasis angle, and the priority skills. THEN write the resume fields following that strategy exactly.

Rules:
- NEVER fabricate experience, employers, degrees, metrics, or skills. You may only use facts present in the original resume or in the candidate's verified answers below. You may rephrase, reorder, and emphasize what is already there.
- Mirror the job description's language and keywords naturally (ATS optimization) — put the most relevant accomplishments first.
- In the skills section, lead with the candidate's strongest skills — the ones most evidenced by their experience. JD-relevant skills they genuinely have belong in the list, but never front-load a skill just because the JD demands it.
- Keep it to one page worth of content. Use quantified bullets where the original supports them. Bullets must be plain text — no bold/italic markup, no columns or tables.
- Dates must use "Mon YYYY" format (e.g. "Mar 2021"); use "Present" for the end date of current roles.
- Include every real job from the original resume unless your strategy explicitly drops it for irrelevance — never drop a role silently.
- In "changes", briefly note what you tailored so the user can review it.

CANDIDATE PROFILE:
${JSON.stringify(profile)}

ORIGINAL RESUME:
${resumeText.slice(0, 8000)}

JOB DESCRIPTION:
${jdText.slice(0, 8000)}${answersBlock}`,
  });
  return {
    markdown: renderResumeMarkdown(object),
    changes: object.changes,
    warnings: findUnverifiedTerms(object, resumeText, answers),
  };
}
