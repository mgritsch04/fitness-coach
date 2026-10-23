// Echte Connector-Werkzeuge für die automatischen User-Tests (scripts/usertest/run.mjs), ohne Cloudflare:
//   cd worker && npx vite-node dev/usertest-bridge.ts -- <port> <static-dir>
// Alle Werkzeuge aus createServer() laufen gegen eine D1-Nachbildung (node:sqlite, echtes Schema) mit synthetischen
// Grunddaten bis heute (dev/seed.ts). Keine echten Messwerte, keine Secrets: WHOOP/Wahoo/Wetter sind nicht erreichbar.
//   POST /tool  {"name": "...", "args": {...}}  → {"payload": ..., "isError": bool}
//   POST /fit   {"start": ISO, "seconds": n, "watts": n} → {"fileBase64": ...} synthetische FIT-Fahrt (für import_fit)
//   POST /gap   {"days": ["YYYY-MM-DD", ...]} → entfernt WHOOP-Tageswerte und Schlaf dieser Tage (Lücke für #379)
//   GET  /...   Dateien aus <static-dir> (Vorschau-Seite des Artefakts, gleicher Ursprung wie /tool)
import { createServer as createHttp } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { McpServer } from "@modelcontextprotocol/server";
import { createServer } from "../src/mcp";
import type { Env } from "../src/env";
import { DEFAULT_TIMEZONE, todayIn } from "../src/core/analysis";
import { fakeD1 } from "../test/fake-d1";
import { syntheticRide } from "../test/fit-builder";
import { seedSynthetic } from "./seed";

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
const [port, dir] = process.argv.slice(2).filter((a) => a !== "--");
const handlers = new Map<string, Handler>();
const orig = McpServer.prototype.registerTool;
McpServer.prototype.registerTool = function (this: McpServer, name: string, cfg: unknown, cb: Handler) {
  handlers.set(name, cb);
  return (orig as (...a: unknown[]) => unknown).call(this, name, cfg, cb);
} as typeof orig;

const db = fakeD1();
await seedSynthetic(db, todayIn(DEFAULT_TIMEZONE), Date.now());
const env = { DB: db, WHOOP_CLIENT_ID: "usertest", WHOOP_CLIENT_SECRET: "usertest" } as unknown as Env;
createServer(env, { whoopUserId: "usertest" }, `http://localhost:${port}`);

const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json" };
createHttp(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/tool") {
      let body = "";
      for await (const c of req) body += c;
      const { name, args } = JSON.parse(body) as { name: string; args?: Record<string, unknown> };
      const h = handlers.get(name);
      const out = h ? await h(args ?? {}) : { content: [{ text: JSON.stringify({ error: "unknown_tool", tool: name }) }], isError: true };
      const text = out.content[0]?.text ?? "null";
      let payload: unknown;
      try { payload = JSON.parse(text); } catch { payload = text; }
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ payload, isError: out.isError ?? false }));
      return;
    }
    if (req.method === "POST" && req.url === "/gap") {
      let body = "";
      for await (const c of req) body += c;
      const { days } = JSON.parse(body) as { days: string[] };
      for (const d of days) {
        await db.prepare("DELETE FROM daily WHERE source = 'whoop' AND day = ?").bind(d).run();
        await db.prepare("DELETE FROM sleeps WHERE source = 'whoop' AND day = ?").bind(d).run();
      }
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ removed: days }));
      return;
    }
    if (req.method === "POST" && req.url === "/fit") {
      let body = "";
      for await (const c of req) body += c;
      const o = JSON.parse(body) as { start?: string; seconds?: number; watts?: number; shape?: "intervals" | "long" | "ramp" | "test20" };
      // shape: "ramp" = 5 min 100 W, dann +20 W je Minute; "test20" = 15 min 150 W, 20 min 250 W; "intervals" = 10 min warm, 5 × (4 min 260 W / 2 min 120 W), 5 min cool; "long" = 100 min 170 W, danach 10 min 260 W
      const shaped = o.shape === "intervals" ? (s: number) => (s < 600 ? 150 : s >= 600 + 5 * 360 ? 110 : (s - 600) % 360 < 240 ? 260 - Math.floor(((s - 600) % 360) / 80) : 120)
        : o.shape === "long" ? (s: number) => (s < 6000 ? 170 : 260)
        : o.shape === "ramp" ? (s: number) => (s < 300 ? 100 : s < 300 + 12 * 60 ? 100 + 20 * Math.floor((s - 300) / 60) : 80)
        : o.shape === "test20" ? (s: number) => (s < 900 ? 150 : s < 2100 ? 250 : 100) : undefined;
      const seconds = o.seconds ?? (o.shape === "intervals" ? 600 + 5 * 360 + 300 : o.shape === "long" ? 6600 : o.shape === "ramp" ? 300 + 12 * 60 + 300 : o.shape === "test20" ? 2400 : undefined);
      // Puls ohne Überlauf: ruhiger Anstieg von 125 auf 145 (gleichmäßige Fahrt) bzw. folgt der Leistung (Intervalle)
      const hr = (s: number) => Math.min(190, 125 + Math.round(((shaped ?? (() => o.watts ?? 150))(s) - 100) / 8) + Math.min(10, Math.floor(s / 600)));
      const cadence = (s: number) => 82 + (((shaped ?? (() => o.watts ?? 150))(s) - 100) > 120 ? 12 : 0) + (s % 7);
      const fit = syntheticRide({ start: o.start, seconds, power: shaped ?? (o.watts ? () => o.watts! : undefined), hr, cadence });
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ fileBase64: Buffer.from(fit).toString("base64") }));
      return;
    }
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "");
    const file = join(dir, path === "/" ? "preview.html" : path);
    const data = await readFile(file).catch(() => null);
    if (!data) return void res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(data);
  } catch (e) {
    if (res.headersSent) return void res.end();
    res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: String((e as Error).message ?? e) }));
  }
}).listen(Number(port), () => console.log(`ready ${port} ${handlers.size}`));
