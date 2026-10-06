import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

import { generateObject } from "ai";
import {
  generateTailoredResume,
  findGapQuestions,
  findUnverifiedTerms,
  filterAnsweredQuestions,
  renderResumeMarkdown,
  type TailoredResumeData,
} from "./tailor";
import type { ResumeProfile } from "./llm";
import type { LlmSettings } from "./types";

const settings: LlmSettings = { provider: "openai", model: "gpt-4o-mini", apiKey: "test" };

const profile: ResumeProfile = {
  name: "Jane",
  headline: "Dev",
  skills: ["Python"],
  experienceYears: 5,
  seniority: "senior",
  roles: ["Engineer"],
  keywords: [],
  summary: "",
  experience: [],
};

const data: TailoredResumeData = {
  strategy: {
    keepRoles: ["Senior Engineer — NewCo", "Engineer — OldCo"],
    dropRoles: [],
    emphasis: "Backend depth",
    prioritySkills: ["Python"],
  },
  name: "Jane Doe",
  contact: "jane@example.com · Sydney",
  summary: "Backend engineer.",
  skills: ["Python", "TypeScript"],
  experience: [
    {
      role: "Engineer",
      company: "OldCo",
      location: null,
      startDate: "Jan 2018",
      endDate: "Dec 2020",
      bullets: ["Did things"],
    },
    {
      role: "Senior Engineer",
      company: "NewCo",
      location: "Sydney",
      startDate: "Feb 2021",
      endDate: "Present",
      bullets: ["Did newer things"],
    },
  ],
  education: [
    { degree: "BSc CS", school: "Uni X", dates: "2014 – 2017", details: null },
  ],
  extraSections: [],
  changes: ["tightened summary"],
};

beforeEach(() => vi.mocked(generateObject).mockReset());

describe("generateTailoredResume", () => {
  it("renders structured data into markdown", async () => {
    vi.mocked(generateObject).mockResolvedValue({ object: data } as never);
    const out = await generateTailoredResume(profile, "resume text", "jd text", settings);
    expect(out.markdown).toContain("# Jane Doe");
    expect(out.markdown).toContain("## Experience");
    expect(out.changes).toEqual(["tightened summary"]);
  });

  it("includes verified gap answers in the prompt", async () => {
    vi.mocked(generateObject).mockResolvedValue({ object: data } as never);
    await generateTailoredResume(profile, "r", "jd", settings, [
      { question: "PyTorch experience?", answer: "Built a CNN classifier side project" },
    ]);
    const prompt = vi.mocked(generateObject).mock.calls[0][0].prompt;
    expect(prompt).toContain("VERIFIED ANSWERS");
    expect(prompt).toContain("PyTorch experience?");
    expect(prompt).toContain("Built a CNN classifier side project");
  });

  it("omits the answers block when none are given", async () => {
    vi.mocked(generateObject).mockResolvedValue({ object: data } as never);
    await generateTailoredResume(profile, "r", "jd", settings);
    expect(vi.mocked(generateObject).mock.calls[0][0].prompt).not.toContain(
      "VERIFIED ANSWERS"
    );
  });

  it("instructs the model not to fabricate", async () => {
    vi.mocked(generateObject).mockResolvedValue({ object: data } as never);
    await generateTailoredResume(profile, "r", "jd", settings);
    expect(vi.mocked(generateObject).mock.calls[0][0].prompt).toContain("NEVER fabricate");
  });
});

describe("renderResumeMarkdown", () => {
  it("sorts experience reverse-chronologically regardless of input order", () => {
    const md = renderResumeMarkdown(data);
    const currentIdx = md.indexOf("Senior Engineer");
    const oldIdx = md.indexOf("Engineer — OldCo");
    expect(currentIdx).toBeGreaterThan(-1);
    expect(oldIdx).toBeGreaterThan(-1);
    expect(currentIdx).toBeLessThan(oldIdx);
    expect(md).toContain("Feb 2021 – Present");
  });

  it("handles a single date range and missing optional fields", () => {
    const md = renderResumeMarkdown({
      ...data,
      experience: [
        {
          role: "Dev",
          company: "Acme",
          location: null,
          startDate: "2019",
          endDate: null,
          bullets: [],
        },
      ],
      education: [],
      extraSections: [],
    });
    expect(md).toContain("2019 – Present");
  });
});

describe("findGapQuestions", () => {
  it("returns the question list", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { questions: ["Do you know PyTorch?"] },
    } as never);
    const qs = await findGapQuestions(profile, "r", "jd", settings);
    expect(qs).toEqual(["Do you know PyTorch?"]);
  });

  it("passes prior answers so the model dedupes questions", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { questions: [] },
    } as never);
    await findGapQuestions(profile, "r", "jd", settings, [
      { question: "Kubernetes experience?", answer: "2 years in prod" },
    ]);
    const prompt = vi.mocked(generateObject).mock.calls[0][0].prompt;
    expect(prompt).toContain("ALREADY CONFIRMED");
    expect(prompt).toContain("Kubernetes experience?");
    expect(prompt).toContain("2 years in prod");
  });

  it("omits the prior-answers block when none exist", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { questions: [] },
    } as never);
    await findGapQuestions(profile, "r", "jd", settings);
    expect(vi.mocked(generateObject).mock.calls[0][0].prompt).not.toContain(
      "ALREADY CONFIRMED"
    );
  });
});

describe("filterAnsweredQuestions", () => {
  const prior = [
    { question: "Do you have Docker Compose experience?", answer: "Yes, 2 years in prod" },
  ];

  it("drops questions that overlap heavily with prior answers", () => {
    const qs = [
      "Do you have hands-on Docker Compose experience?",
      "Are you familiar with PyTorch?",
    ];
    expect(filterAnsweredQuestions(qs, prior)).toEqual([
      "Are you familiar with PyTorch?",
    ]);
  });

  it("passes everything through when there are no prior answers", () => {
    const qs = ["Do you know PyTorch?"];
    expect(filterAnsweredQuestions(qs, [])).toEqual(qs);
  });
});

describe("findUnverifiedTerms", () => {
  const resume =
    "Senior Engineer at NewCo\nPreviously Engineer at OldCo\nSkills: Python, TypeScript\nBuilt APIs";
  const answers = [{ question: "q", answer: "I also used Docker" }];

  it("flags skills absent from resume and answers", () => {
    const w = findUnverifiedTerms(
      { ...data, skills: ["Python", "Kubernetes"], experience: data.experience },
      resume,
      answers
    );
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("Kubernetes");
  });

  it("flags invented employers but accepts real ones", () => {
    const w = findUnverifiedTerms(
      {
        ...data,
        experience: [
          { role: "Eng", company: "NewCo", location: null, startDate: "2021", endDate: "Present", bullets: [] },
          { role: "Eng", company: "FakeCorp", location: null, startDate: "2018", endDate: "2020", bullets: [] },
        ],
      },
      resume,
      answers
    );
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("FakeCorp");
  });

  it("accepts skills that only appear in the answers", () => {
    const w = findUnverifiedTerms({ ...data, skills: ["Docker"] }, resume, answers);
    expect(w).toHaveLength(0);
  });
});
