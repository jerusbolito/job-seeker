import { describe, it, expect } from "vitest";
import { parseLearned, mergeLearned, combinedSkills, EMPTY_LEARNED } from "./coach";
import type { ResumeProfile } from "./llm";

const baseProfile: ResumeProfile = {
  name: "Jane",
  headline: "Dev",
  skills: ["Python", "React"],
  experienceYears: 5,
  seniority: "senior",
  roles: ["Engineer"],
  keywords: [],
  summary: "",
};

describe("parseLearned", () => {
  it("returns empty profile for null/undefined/malformed input", () => {
    expect(parseLearned(null)).toEqual(EMPTY_LEARNED);
    expect(parseLearned(undefined)).toEqual(EMPTY_LEARNED);
    expect(parseLearned("not json{")).toEqual(EMPTY_LEARNED);
    expect(parseLearned('{"skills":"oops"}')).toEqual(EMPTY_LEARNED);
  });

  it("parses a stored profile", () => {
    const parsed = parseLearned(
      JSON.stringify({ skills: ["Go"], preferences: ["remote"], facts: ["shipped X"] })
    );
    expect(parsed).toEqual({ skills: ["Go"], preferences: ["remote"], facts: ["shipped X"] });
  });

  it("fills missing fields with empty arrays", () => {
    expect(parseLearned('{"skills":["Go"]}')).toEqual({
      skills: ["Go"],
      preferences: [],
      facts: [],
    });
  });

  it("coerces non-string entries to strings", () => {
    expect(parseLearned('{"skills":[42]}').skills).toEqual(["42"]);
  });
});

describe("mergeLearned", () => {
  it("appends new items", () => {
    const merged = mergeLearned(EMPTY_LEARNED, { skills: ["Go"], facts: ["f1"] });
    expect(merged.skills).toEqual(["Go"]);
    expect(merged.facts).toEqual(["f1"]);
  });

  it("dedupes case-insensitively and keeps first-seen casing", () => {
    const merged = mergeLearned(
      { ...EMPTY_LEARNED, skills: ["Python"] },
      { skills: ["python", "Rust", "PYTHON"] }
    );
    expect(merged.skills).toEqual(["Python", "Rust"]);
  });

  it("skips blank and whitespace-only items", () => {
    const merged = mergeLearned(EMPTY_LEARNED, { skills: ["", "   ", "Go"] });
    expect(merged.skills).toEqual(["Go"]);
  });

  it("caps lists at their limits", () => {
    const many = Array.from({ length: 70 }, (_, i) => `s${i}`);
    const merged = mergeLearned(EMPTY_LEARNED, { skills: many });
    expect(merged.skills).toHaveLength(60);
  });

  it("preserves base items when adding nothing", () => {
    const base = { skills: ["A"], preferences: ["p"], facts: ["f"] };
    expect(mergeLearned(base, {})).toEqual(base);
  });
});

describe("combinedSkills", () => {
  it("unions resume and learned skills without duplicates", () => {
    const learned = { skills: ["python", "Go"], preferences: [], facts: [] };
    expect(combinedSkills(baseProfile, learned)).toEqual(["Python", "React", "Go"]);
  });

  it("returns resume skills unchanged when nothing was learned", () => {
    expect(combinedSkills(baseProfile, { ...EMPTY_LEARNED })).toEqual(["Python", "React"]);
  });
});
