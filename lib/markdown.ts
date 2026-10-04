// Minimal Markdown -> HTML renderer for resume previews, .html downloads,
// and the print-to-PDF view. Input is always HTML-escaped first, so the
// output is safe to inject via dangerouslySetInnerHTML.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/\b_([^_\n]+)_\b/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function markdownToHtml(markdown: string): string {
  const lines = escapeHtml(markdown).split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (/^\s*[-*•]\s+/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(trimmed.replace(/^[-*•]\s+/, ""))}</li>`);
      continue;
    }
    closeList();

    if (!trimmed) continue;
    if (/^-{3,}$|^\*{3,}$/.test(trimmed)) {
      out.push("<hr>");
      continue;
    }
    const h = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    out.push(`<p>${inline(trimmed)}</p>`);
  }
  closeList();
  return out.join("\n");
}

const RESUME_CSS = `
  body { font-family: Georgia, 'Times New Roman', serif; color: #18181b; max-width: 720px; margin: 0 auto; padding: 32px; line-height: 1.45; font-size: 14px; }
  h1 { font-size: 26px; margin: 0 0 2px; }
  h1 + p { color: #52525b; margin-top: 0; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid #d4d4d8; padding-bottom: 3px; margin: 20px 0 8px; }
  h3 { font-size: 15px; margin: 14px 0 2px; }
  h3 + p, h3 + p + p { margin: 2px 0; color: #52525b; font-size: 13px; }
  p { margin: 6px 0; }
  ul { margin: 6px 0; padding-left: 20px; }
  li { margin: 3px 0; }
  a { color: inherit; }
  hr { border: none; border-top: 1px solid #d4d4d8; margin: 16px 0; }
  code { font-family: inherit; }
  @media print { body { padding: 0; } }
`;

export function markdownToHtmlDocument(markdown: string, title = "Resume"): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${RESUME_CSS}</style>
</head>
<body>
${markdownToHtml(markdown)}
</body>
</html>`;
}
