export function html(title: string, body: string, headers?: Headers, status = 200): Response {
  const page = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 16px;color:#1b1f1d}h1{font-size:1.6rem}h2{font-size:1.15rem;margin-top:1.6rem}code{background:#eef1ef;padding:0 4px;border-radius:4px}button{font:inherit;padding:8px 14px;margin-right:8px}</style></head><body>${body}</body></html>`;
  const h = new Headers(headers);
  h.set("content-type", "text/html; charset=utf-8");
  return new Response(page, { status, headers: h });
}

// Minimaler Markdown-Umbau für die Datenschutzseite (Überschriften, Absätze, Hervorhebung, Code).
export function markdownToHtml(md: string): string {
  const inline = (s: string) =>
    escape(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>");
  return md
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const h = /^(#{1,3}) (.*)$/.exec(block);
      if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
      return `<p>${inline(block.replace(/\n/g, " "))}</p>`;
    })
    .join("\n");
}

export function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
