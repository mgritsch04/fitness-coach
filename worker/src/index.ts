import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import privacyMarkdown from "../../docs/PRIVACY.md";

// Machbarkeitstest (IDEAS Zeile 0): ein Connector ohne Daten, damit wir prüfen
// können, ob ein Claude-Artefakt einen eigenen Connector aufrufen darf.
// Noch ohne Login – deshalb liefert er bewusst keine Fitness- oder Gesundheitsdaten.
function createServer() {
  const server = new McpServer({ name: "fitness-coach", version: "0.0.1" });

  server.registerTool(
    "ping",
    {
      description: "Verbindungstest: antwortet mit der Serverzeit und dem übergebenen Text.",
      inputSchema: { text: z.string().max(200).optional() },
    },
    async ({ text }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({ ok: true, serverTime: new Date().toISOString(), echo: text ?? null }),
        },
      ],
    }),
  );

  return server;
}

const mcp = createMcpHandler(createServer);

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/mcp") return mcp(request, env, ctx);
    if (pathname === "/privacy") return html("Privacy Policy – Fitness Coach", markdownToHtml(privacyMarkdown));
    if (pathname === "/") return html("Fitness Coach", "<h1>Fitness Coach</h1><p>Private application. <a href=\"/privacy\">Privacy Policy</a></p>");
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

interface Env {}

function html(title: string, body: string): Response {
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:16px/1.55 system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 16px;color:#1b1f1d}h1{font-size:1.6rem}h2{font-size:1.15rem;margin-top:1.6rem}code{background:#eef1ef;padding:0 4px;border-radius:4px}</style></head><body>${body}</body></html>`;
  return new Response(page, { headers: { "content-type": "text/html; charset=utf-8" } });
}

// Minimaler Markdown-Umbau für die Datenschutzseite (Überschriften, Absätze, Hervorhebung, Code).
function markdownToHtml(md: string): string {
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

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
