import { describe, it, expect, vi, afterEach } from "vitest";
import { stripHtml, truncate, fetchJson } from "./util";

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("removes script and style blocks entirely", () => {
    const html = "<p>keep</p><script>evil()</script><style>.x{}</style><p>this</p>";
    expect(stripHtml(html)).toBe("keep this");
  });

  it("decodes common entities", () => {
    expect(stripHtml("a &amp; b &lt;tag&gt; &quot;q&quot; &#39;s&nbsp;end"))
      .toBe(`a & b <tag> "q" 's end`);
  });

  it("handles empty input", () => {
    expect(stripHtml("")).toBe("");
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("abc", 10)).toBe("abc");
    expect(truncate("abcde", 5)).toBe("abcde");
  });

  it("truncates with ellipsis beyond the limit", () => {
    expect(truncate("abcdef", 5)).toBe("abcde…");
  });
});

describe("fetchJson", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"a":1}', { status: 200 }))
    );
    await expect(fetchJson<{ a: number }>("https://x.test")).resolves.toEqual({ a: 1 });
  });

  it("throws with status on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 }))
    );
    await expect(fetchJson("https://x.test")).rejects.toThrow("HTTP 503");
  });
});
