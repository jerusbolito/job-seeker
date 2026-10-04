import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

import { generateObject } from "ai";
import { generateTailoredResume, findGapQuestions } from "./tailor";
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
};

beforeEach(() => vi.mocked(generateObject).mockReset());

describe("generateTailoredResume", () => {
  it("returns the generated resume", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { markdown: "# Jane", changes: ["tightened summary"] },
    } as never);
    const out = await generateTailoredResume(profile, "resume text", "jd text", settings);
    expect(out.markdown).toBe("# Jane");
    expect(out.changes).toEqual(["tightened summary"]);
  });

  it("includes verified gap answers in the prompt", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { markdown: "# Jane", changes: [] },
    } as never);
    await generateTailoredResume(profile, "r", "jd", settings, [
      { question: "PyTorch experience?", answer: "Built a CNN classifier side project" },
    ]);
    const prompt = vi.mocked(generateObject).mock.calls[0][0].prompt;
    expect(prompt).toContain("VERIFIED ANSWERS");
    expect(prompt).toContain("PyTorch experience?");
    expect(prompt).toContain("Built a CNN classifier side project");
  });

  it("omits the answers block when none are given", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { markdown: "# Jane", changes: [] },
    } as never);
    await generateTailoredResume(profile, "r", "jd", settings);
    expect(vi.mocked(generateObject).mock.calls[0][0].prompt).not.toContain(
      "VERIFIED ANSWERS"
    );
  });

  it("instructs the model not to fabricate", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: { markdown: "# Jane", changes: [] },
    } as never);
    await generateTailoredResume(profile, "r", "jd", settings);
    expect(vi.mocked(generateObject).mock.calls[0][0].prompt).toContain("NEVER fabricate");
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
});
