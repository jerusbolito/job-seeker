import { describe, it, expect } from "vitest";
import { markdownToHtml, markdownToHtmlDocument } from "./markdown";

describe("markdownToHtml", () => {
  it("renders headings", () => {
    expect(markdownToHtml("# Name")).toBe("<h1>Name</h1>");
    expect(markdownToHtml("## Section")).toBe("<h2>Section</h2>");
    expect(markdownToHtml("### Role")).toBe("<h3>Role</h3>");
  });

  it("renders paragraphs and skips blank lines", () => {
    expect(markdownToHtml("hello\n\nworld")).toBe("<p>hello</p>\n<p>world</p>");
  });

  it("renders inline formatting", () => {
    const html = markdownToHtml("a **bold** and *em* and `code`");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>em</em>");
    expect(html).toContain("<code>code</code>");
  });

  it("renders http(s) links", () => {
    expect(markdownToHtml("[site](https://example.com)")).toContain(
      '<a href="https://example.com">site</a>'
    );
  });

  it("does not linkify non-http URLs", () => {
    const html = markdownToHtml("[x](javascript:alert(1))");
    expect(html).not.toContain("<a");
    expect(html).toContain("javascript:alert(1)");
  });

  it("groups consecutive bullets into a single ul", () => {
    const html = markdownToHtml("- one\n- two\npara");
    expect(html).toBe("<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n<p>para</p>");
  });

  it("closes a list before a following heading", () => {
    const html = markdownToHtml("- a\n## Next");
    expect(html).toBe("<ul>\n<li>a</li>\n</ul>\n<h2>Next</h2>");
  });

  it("renders horizontal rules", () => {
    expect(markdownToHtml("---")).toBe("<hr>");
  });

  it("escapes HTML in input", () => {
    const html = markdownToHtml('<script>alert("x")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes attribute-breaking characters", () => {
    const html = markdownToHtml('a "quoted" <b>thing</b>');
    expect(html).not.toContain("<b>");
    expect(html).toContain("&quot;quoted&quot;");
  });

  it("supports a realistic resume", () => {
    const md = [
      "# Jane Doe",
      "jane@example.com | linkedin.com/in/jane",
      "",
      "## Summary",
      "Engineer with **8 years** of experience.",
      "",
      "## Experience",
      "### Lead — Acme",
      "- Built *fast* pipelines",
      "- Led team of 5",
    ].join("\n");
    const html = markdownToHtml(md);
    expect(html).toContain("<h1>Jane Doe</h1>");
    expect(html).toContain("<strong>8 years</strong>");
    expect(html).toContain("<li>Built <em>fast</em> pipelines</li>");
    expect((html.match(/<ul>/g) ?? []).length).toBe(1);
  });
});

describe("markdownToHtmlDocument", () => {
  it("wraps content in a full HTML document", () => {
    const doc = markdownToHtmlDocument("# Hi", "My Resume");
    expect(doc).toContain("<!doctype html>");
    expect(doc).toContain("<title>My Resume</title>");
    expect(doc).toContain("<h1>Hi</h1>");
    expect(doc).toContain("<style>");
  });

  it("escapes the title", () => {
    const doc = markdownToHtmlDocument("x", '<img src=x onerror=alert(1)>');
    expect(doc).not.toContain("<img");
  });
});
