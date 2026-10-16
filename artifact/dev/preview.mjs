// Vorschau des Dashboards mit synthetischen Daten und einem nachgebauten window.claude.
//   node artifact/dev/preview.mjs [out-dir]   → schreibt preview.html und Screenshots (Playwright/Chromium)
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? join(here, "out");
mkdirSync(out, { recursive: true });
const page = readFileSync(join(here, "..", "dashboard.html"), "utf8");
const mock = readFileSync(join(here, "mock-dashboard.json"), "utf8");
const shim = `<script>
window.__MOCK__ = ${mock};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const payloads = {
  get_dashboard: () => window.__MOCK__.get_dashboard,
  get_power_curve: () => window.__MOCK__.get_power_curve,
  get_fitness_profile: () => window.__MOCK__.get_fitness_profile,
  get_training_load: () => window.__MOCK__.get_training_load,
  get_health_trends: () => window.__MOCK__.get_health_trends,
  get_strain_recovery: () => window.__MOCK__.get_strain_recovery,
  get_period_summaries: (i) => window.__MOCK__.get_period_summaries[i.period ?? "month"],
  sync_now: () => ({ whoop: { ok: true, result: { days: 3, sleeps: 3, workouts: 4 } }, wahoo: { ok: false, error: "wahoo_not_configured", message: "übersprungen" } }),
  wahoo_status: () => ({ configured: false, connected: false }),
  update_settings: (i) => i,
  import_fit: (i) => ({ fileName: i.fileName, imported: true, updated: false, workout: { sourceId: "x", day: window.__MOCK__.get_dashboard.today, startTime: window.__MOCK__.get_dashboard.today + "T17:00:00Z", sport: "cycling", durationS: 3720, distanceM: 31400, avgPowerW: 195, normalizedPowerW: 212, avgHr: 142, maxHr: 171, avgCadenceRpm: 88, tss: 71 }, secondsOfData: 3720, powerCurve: null, sameRideIn: ["whoop"] }),
};
const mcp = {
  watchTool(s, t, input, h) { setTimeout(() => h({ type: "data", result: { payload: payloads[t](input) } }), 50); return () => {}; },
  async callTool(s, t, input) { await sleep(100); return { payload: payloads[t](input) }; },
  async invalidate() {},
  async listTools() { return { servers: [], fileArgs: true }; },
};
const sample = async (input, o = {}) => { const text = "**Heute normales Training.** Deine Erholung ist gelb und die HRV liegt im Normalbereich.\\n- 45–60 min Grundlage auf dem Rad\\n- danach 10 min Mobility"; o.onText?.({ text, delta: text }); return { text, truncated: false }; };
sample.json = async () => ({ hinweis: "Beispielplan.", tage: [{ tag: "2026-03-31", einheit: "Rad locker", dauerMin: 60, intensitaet: "locker", belastung: 45, ziel: "Grundlage" }] });
window.claude = { use: async (n) => (n === "mcp" ? mcp : n === "sample" ? sample : null) };
</script>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${shim}${page}</body></html>`;
writeFileSync(join(out, "preview.html"), html);
for (const d of ["app", "sections"]) cpSync(join(here, "..", d), join(out, d), { recursive: true });

const pw = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.js"));
const chromium = pw.chromium ?? pw.default.chromium;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const errors = [];
const shots = [["desktop-light", { width: 1280, height: 900 }, "light"], ["desktop-dark", { width: 1280, height: 900 }, "dark"],
  ...["heute", "coach", "verlauf", "training", "mehr"].map((t) => [`phone-${t}`, { width: 390, height: 844 }, t === "verlauf" ? "dark" : "light", t])];
for (const [name, vp, scheme, tab] of shots) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await p.goto("file://" + join(out, "preview.html"));
  await p.waitForTimeout(800);
  if (tab) { await p.click(`#tabbar [data-tab=${tab}]`); await p.waitForTimeout(300); }
  if (tab === "training") { await p.setInputFiles("#fitFile", { name: "mywhoosh-ride.fit", mimeType: "application/octet-stream", buffer: Buffer.alloc(2048, 1) }); await p.waitForTimeout(500); }
  if (name === "desktop-light") { await p.click("[data-coach=explain]"); await p.waitForTimeout(300); }
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (sw > 0) errors.push(`${name}: horizontal overflow ${sw}px`);
  await p.screenshot({ path: join(out, `${name}.png`), fullPage: !tab });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "keine Fehler");
