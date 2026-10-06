import { describe, it, expect } from "vitest";
import { diffLines } from "./diff";

describe("diffLines", () => {
  it("marks unchanged lines as same", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
    ]);
  });

  it("marks added and deleted lines", () => {
    const out = diffLines("a\nold\nb", "a\nnew\nb");
    expect(out.filter((l) => l.type === "del").map((l) => l.text)).toEqual(["old"]);
    expect(out.filter((l) => l.type === "add").map((l) => l.text)).toEqual(["new"]);
    expect(out.filter((l) => l.type === "same").map((l) => l.text)).toEqual(["a", "b"]);
  });

  it("handles a fully rewritten document", () => {
    const out = diffLines("x\ny", "p\nq");
    expect(out.every((l) => l.type !== "same")).toBe(true);
  });

  it("handles empty inputs", () => {
    expect(diffLines("", "a")).toEqual([
      { type: "del", text: "" },
      { type: "add", text: "a" },
    ]);
  });
});
