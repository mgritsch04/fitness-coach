#!/usr/bin/env node
/*
 * Automatischer User-Test eines Issues (ein [USERTEST]-Issue oder ein Feature-Issue mit Label auto-user-test).
 *
 *   node scripts/usertest/run.mjs <issue-nr> [--port 4391] [--out usertest-reports] [--gpu]
 *   node scripts/usertest/run.mjs <issue-nr> --plan          # gibt "cloud" oder "pc" aus
 *   node scripts/usertest/run.mjs <issue-nr> --report-only   # Berichte aus report.json neu erzeugen
 *
 * Baut die Vorschau des Dashboard-Artefakts (artifact/dev/preview.mjs --build-only) und startet
 * worker/dev/usertest-bridge.ts: die echten Connector-Werkzeuge des Workers gegen eine D1-Nachbildung mit
 * synthetischen Daten bis heute. Die Seite ruft die Werkzeuge darüber auf (live); nur WHOOP/Wahoo/Sync und das
 * Wetter (Netz) sowie Claude (`sample`) bleiben Beispielantworten. Dann führt es scenarios/<issue-nr>.mjs
 * Schritt für Schritt in Chromium aus, macht je Schritt ein Bild und schreibt <out>/<nr>/report.json,
 * report.md (Issue-Kommentar) und report.html (Bildbericht, nur lokal; kein Artefakt, Bericht nur als Issue-Kommentar).
 *
 * Szenario: export default { issue, feature?, title, name, device: 'desktop' | 'phone', scheme?: 'light' | 'dark',
 *   pc?: true (nur wenn ein Schritt Optik auf echter Grafik beurteilt), realDevice?: [..],
 *   steps: [{ nr, action, expected, run: async (t) => ({ status, observed }) }] }.
 * status: ok (nachweislich geprüft: DOM/Daten/Werkzeug) · fail · look (nur am Bild beurteilbar) ·
 *   device (nur am echten Gerät / im echten Alltag prüfbar) · skip (optional, nicht geprüft).
 * Urteil: bestanden = alle Schritte ok (optionale skip erlaubt), keine Konsolenfehler, nichts nur am Gerät,
 *   bei pc:true auf echter Grafikkarte gelaufen · pc = sonst bestanden, braucht aber echte Grafik · pruefen = alles andere.
 * FEHLGESCHLAGEN schreibt nur der Nutzer; ein fail wird nie als bestanden gewertet.
 */
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const issue = args.find((a) => /^\d+$/.test(a));
if (!issue) {
  console.error("Aufruf: node scripts/usertest/run.mjs <issue-nr> [--plan] [--port 4391] [--out usertest-reports] [--gpu] [--report-only]");
  process.exit(2);
}
const scenario = (await import(pathToFileURL(join(here, "scenarios", `${issue}.mjs`)).href)).default;
if (args.includes("--plan")) {
  console.log(scenario.pc ? "pc" : "cloud");
  process.exit(0);
}
const port = Number(opt("port", process.env.USERTEST_PORT ?? 4391));
const outDir = resolve(root, opt("out", "usertest-reports"), issue);
mkdirSync(outDir, { recursive: true });
const LABEL = { ok: "✅ erfüllt", fail: "❌ nicht erfüllt", look: "👁 bitte selbst anschauen", device: "📱 nur am echten Gerät / im Alltag prüfbar", skip: "⏭ nicht geprüft (optional)" };

if (args.includes("--report-only")) {
  const r = { ...JSON.parse(readFileSync(join(outDir, "report.json"), "utf8")), name: scenario.name, realDevice: scenario.realDevice ?? [] };
  r.verdict = verdict(r);
  writeFileSync(join(outDir, "report.md"), markdown(r));
  writeFileSync(join(outDir, "report.html"), html(r));
  console.log(`Urteil: ${r.verdict}`);
  process.exit(0);
}

const win = process.platform === "win32";
// Seite bauen: synthetische Beispielantworten (für die Werkzeuge ohne Live-Weg) und Vorschau-HTML
const site = join(outDir, "site");
const worker = join(root, "worker");
const mock = join(root, "artifact/dev/mock-dashboard.json");
if (!existsSync(join(worker, "node_modules"))) execSync("npm ci", { cwd: worker, stdio: "inherit", shell: win });
if (!existsSync(mock)) writeFileSync(mock, execSync("npx vite-node dev/mock-dashboard.ts", { cwd: worker, shell: win, stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 28 }));
execSync(`node "${join(root, "artifact/dev/preview.mjs")}" "${site}" --build-only`, { stdio: "inherit" });
// Live-Weg: die Seite ruft die echten Werkzeuge über /tool der Brücke auf (gleicher Ursprung).
const MOCK_ONLY = ["sync_now", "whoop_status", "whoop_recovery", "wahoo_status", "wahoo_connect", "get_ride_weather", ...(scenario.mockTools ?? [])];
const live = `<script>
(() => {
  const mockOnly = ${JSON.stringify(MOCK_ONLY)}, liveOn = ${scenario.live === false ? "false" : "true"};
  const viaBridge = async (t, input) => {
    const r = await (await fetch("/tool", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: t, args: input ?? {} }) })).json();
    if (r.error) throw { code: "server_unavailable", message: r.error };
    if (r.isError) throw { code: "tool_error", message: JSON.stringify(r.payload) };
    return { payload: r.payload };
  };
  const use = window.claude.use;
  window.claude.use = async (n) => {
    const m = await use(n);
    if (n !== "mcp" || !liveOn) return m;
    const isLive = (t) => !mockOnly.includes(t);
    return { ...m,
      async callTool(s, t, input, o) { if (!isLive(t)) return m.callTool(s, t, input, o); (window.__calls ??= []).push(t); return viaBridge(t, input); },
      watchTool(s, t, input, h, o) { if (!isLive(t)) return m.watchTool(s, t, input, h, o); (window.__calls ??= []).push(t);
        viaBridge(t, input).then((r) => h({ type: "data", result: r }), (e) => h({ type: "error", error: e })); return () => {}; } };
  };
})();
</script>`;
const previewFile = join(site, "preview.html");
const built = readFileSync(previewFile, "utf8");
const cut = built.indexOf("</script>") + "</script>".length;
writeFileSync(previewFile, built.slice(0, cut) + live + built.slice(cut));

const bridge = spawn("npx", ["vite-node", "dev/usertest-bridge.ts", "--", String(port), site], { cwd: worker, stdio: ["ignore", "pipe", "inherit"], detached: !win, shell: win });
const stopBridge = () => {
  try {
    if (win) execSync(`taskkill /pid ${bridge.pid} /T /F`, { stdio: "ignore" });
    else process.kill(-bridge.pid);
  } catch {
    /* schon beendet */
  }
};
process.on("exit", stopBridge);
await new Promise((ok, fail) => {
  const timer = setTimeout(() => fail(new Error(`Brücke auf Port ${port} startet nicht`)), 90_000);
  bridge.stdout.on("data", (b) => String(b).includes("ready") && (clearTimeout(timer), ok()));
  bridge.on("exit", (c) => fail(new Error(`Brücke beendet (${c})`)));
});
let bridgeDied = false;
bridge.on("exit", () => (bridgeDied = true));
const baseURL = `http://localhost:${port}`;

const pw = await import("playwright").catch(() => import("@playwright/test")).catch(() => import("/opt/node22/lib/node_modules/playwright/index.js"));
const chromium = pw.chromium ?? pw.default.chromium;
const localChromium = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const gpu = args.includes("--gpu");
const browser = await chromium.launch({
  executablePath: existsSync(localChromium) ? localChromium : undefined,
  args: gpu ? ["--ignore-gpu-blocklist", "--enable-gpu-rasterization", ...(win ? ["--use-angle=d3d11"] : process.platform === "darwin" ? ["--use-angle=metal"] : [])] : [],
});
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const devices = {
  desktop: { viewport: { width: 1280, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: IPHONE_UA },
};
const device = scenario.device ?? "desktop";
const context = await browser.newContext({ baseURL, acceptDownloads: true, colorScheme: scenario.scheme ?? "light", ...devices[device] });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// Fehlende Dateien mit Adresse melden (die Konsole nennt sie nicht); das Favicon fehlt in der Vorschau absichtlich.
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
page.on("response", (r) => r.status() >= 400 && !r.url().endsWith("/favicon.ico") && errors.push(`${r.status()} ${r.url()}`));

/** Hilfen für jeden Schritt. */
const t = {
  page,
  context,
  outDir,
  /** Dashboard neu laden (leerer Speicher der Seite), optional einen Tab öffnen. */
  async open(tab) {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 });
    await page.waitForLoadState("networkidle"); // nachladende Werkzeuge zeichnen Abschnitte sonst während des Tippens neu
    await page.waitForTimeout(600);
    if (tab) await t.tab(tab);
  },
  /** Tab wechseln (heute, coach, verlauf, training, mehr). */
  async tab(name) {
    const btn = page.locator(`#tabbar [data-tab=${name}]`);
    if (await btn.isVisible()) await btn.click();
    else await page.evaluate((n) => window.FC.showTab(n), name); // Desktop: keine Tab-Leiste
    await page.waitForTimeout(400);
  },
  /** Zu einem Abschnitt springen (klappt ihn auf). */
  async section(id) {
    await page.evaluate((s) => window.FC.goTo(s), id);
    await page.waitForTimeout(500);
    return page.locator(`#sec-${id}`);
  },
  /** Echtes Werkzeug direkt aufrufen (z. B. Daten anlegen oder das Ergebnis nachprüfen). */
  async tool(name, input = {}) {
    const r = await (await fetch(`${baseURL}/tool`, { method: "POST", body: JSON.stringify({ name, args: input }) })).json();
    if (r.error || r.isError) throw new Error(`${name}: ${r.error ?? JSON.stringify(r.payload)}`);
    return r.payload;
  },
  /** Synthetische FIT-Fahrt als Base64 (für import_fit), z. B. { start: "2026-10-17T16:00:00Z", seconds: 3600, watts: 180 }. */
  async fit(o = {}) {
    return (await (await fetch(`${baseURL}/fit`, { method: "POST", body: JSON.stringify(o) })).json()).fileBase64;
  },
  /** Werkzeuge, die die Seite bisher aufgerufen hat. */
  calls: () => page.evaluate(() => window.__calls ?? []),
  text: (sel) => page.locator(sel).first().innerText(),
  /** Warten, bis fn() etwas Wahres liefert (oder die Zeit um ist); gibt den letzten Wert zurück. */
  async poll(fn, timeout = 8000) {
    const end = Date.now() + timeout;
    let v;
    while (Date.now() < end) {
      v = await fn().catch(() => undefined);
      if (v) return v;
      await page.waitForTimeout(200);
    }
    return v;
  },
  extraShots: [],
  /** Zusätzliches Bild im Schritt (das Bild am Ende des Schritts kommt automatisch). */
  async shot(caption, locator) {
    const file = `step-${t._step}-${t.extraShots.length + 1}.jpg`;
    await (locator ?? page).screenshot({ path: join(outDir, file), type: "jpeg", quality: 72 });
    t.extraShots.push({ file, caption });
  },
};

const renderer = await page
  .evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return gl ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : "kein WebGL";
  })
  .catch(() => "unbekannt");
const software = /swiftshader|llvmpipe|software/i.test(renderer);
if (gpu && software) console.warn(`Achtung: --gpu gesetzt, aber der Browser rechnet mit Software-Grafik (${renderer}); zählt nicht als echte Grafik.`);

const results = [];
for (const step of scenario.steps) {
  t._step = step.nr;
  t.extraShots = [];
  const errBefore = errors.length;
  const started = Date.now();
  let res;
  try {
    res = await step.run(t);
  } catch (e) {
    res = { status: "fail", observed: `Abbruch: ${String(e.message ?? e).split("\n")[0]}` };
  }
  if (errors.length > errBefore && res.status === "ok") res = { status: "fail", observed: `${res.observed} – aber Fehler in der Konsole: ${errors.slice(errBefore).join(" | ")}` };
  const shots = [...t.extraShots];
  if (!res.noFinalShot) {
    const file = `step-${step.nr}.jpg`;
    const target = res.locator ?? page;
    await target.screenshot({ path: join(outDir, file), type: "jpeg", quality: 72 }).catch(() => undefined);
    if (existsSync(join(outDir, file))) shots.push({ file, caption: res.caption ?? "Nach dem Schritt" });
  }
  results.push({ nr: step.nr, action: step.action, expected: step.expected, status: res.status, observed: res.observed, shots, ms: Date.now() - started });
  console.log(`Schritt ${step.nr}: ${res.status} – ${res.observed}`);
}
await browser.close();
if (bridgeDied) {
  // Kaputter Testlauf (nicht das Feature): kein Bericht, kein Urteil.
  console.error("Abbruch: die Werkzeug-Brücke ist während des Tests ausgefallen – Lauf ungültig, bitte wiederholen.");
  process.exit(1);
}
stopBridge();

const git = (c) => execSync(`git ${c}`, { cwd: root }).toString().trim();
const report = {
  issue: Number(issue),
  feature: scenario.feature ?? null,
  title: scenario.title,
  name: scenario.name,
  device,
  viewport: devices[device].viewport,
  commit: git("rev-parse --short HEAD"),
  branch: git("rev-parse --abbrev-ref HEAD"),
  date: new Date().toISOString(),
  pc: !!scenario.pc,
  gpu: gpu && !software,
  renderer,
  realDevice: scenario.realDevice ?? [],
  results,
  consoleErrors: errors,
};
report.verdict = verdict(report);
writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
writeFileSync(join(outDir, "report.md"), markdown(report));
writeFileSync(join(outDir, "report.html"), html(report));
console.log(`Urteil: ${report.verdict}\nBericht: ${join(outDir, "report.html")}`);
process.exit(0);

function counts(r) {
  const c = { ok: 0, fail: 0, look: 0, device: 0, skip: 0 };
  for (const s of r.results) c[s.status]++;
  return c;
}

/** bestanden | pc | pruefen (siehe Kopf). */
function verdict(r) {
  const c = counts(r);
  const clean = c.ok > 0 && c.ok + c.skip === r.results.length && !r.consoleErrors.length && !r.realDevice.length;
  if (!clean) return "pruefen";
  return r.pc && !r.gpu ? "pc" : "bestanden";
}

function markdown(r) {
  const c = counts(r);
  const head =
    r.verdict === "bestanden"
      ? "**Automatisch BESTANDEN** – jeder Schritt wurde mit synthetischen Daten nachweislich geprüft."
      : r.verdict === "pc"
        ? "**Automatischer Test: noch auf dem PC prüfen** – ohne Fehler, aber die Optik braucht eine echte Grafikkarte."
        : `Automatische Vorprüfung – bitte selbst anschauen: ${r.results.filter((s) => s.status !== "ok" && s.status !== "skip").map((s) => `Schritt ${s.nr}`).join(", ") || "Konsolenfehler"}${r.realDevice.length ? ", Punkte nur am echten Gerät" : ""}.`;
  const look = r.results.filter((s) => s.status !== "ok" && s.status !== "skip");
  const lines = [
    head,
    "",
    `Stand: \`${r.commit}\` (${r.branch}) · Chromium ${r.gpu ? "auf dem PC, echte Grafikkarte" : "in der Cloud"}, ${r.device === "phone" ? `Handy-Ansicht ${r.viewport.width}×${r.viewport.height}` : `Desktop ${r.viewport.width}×${r.viewport.height}`} · echte Worker-Werkzeuge mit synthetischen Daten (keine echten Messwerte) · ${r.date.slice(0, 16).replace("T", " ")} UTC`,
    "",
    `Ergebnis: ${c.ok} erfüllt · ${c.fail} nicht erfüllt · ${c.look} selbst anschauen · ${c.device} nur am echten Gerät / im Alltag${c.skip ? ` · ${c.skip} optional übersprungen` : ""}`,
    "",
    "| Schritt | Ergebnis | Beobachtet |",
    "|---|---|---|",
    ...r.results.map((s) => `| ${s.nr} | ${LABEL[s.status]} | ${s.observed.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`),
  ];
  if (r.verdict === "pruefen" && (look.length || r.realDevice.length || r.consoleErrors.length)) {
    lines.push("", "**Bitte selbst anschauen:**", ...look.map((s) => `- Schritt ${s.nr}: ${s.action} – ${s.observed}`), ...r.realDevice.map((d) => `- ${d}`));
    if (r.consoleErrors.length) lines.push(`- Fehler in der Browser-Konsole: ${r.consoleErrors.slice(0, 5).map((e) => `\`${e.slice(0, 160)}\``).join(", ")}`);
    lines.push("", "Bitte hier mit `BESTANDEN` oder `FEHLGESCHLAGEN: …` antworten.");
  }
  return lines.join("\n") + "\n";
}

function html(r) {
  const c = counts(r);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const img = (f) => `data:image/jpeg;base64,${readFileSync(join(outDir, f)).toString("base64")}`;
  const V = { bestanden: ["ok", "Automatisch bestanden"], pc: ["device", "Noch auf dem PC prüfen"], pruefen: ["look", "Bitte selbst anschauen"] }[r.verdict];
  const steps = r.results
    .map(
      (s) => `<section class="step ${s.status}">
  <header><span class="nr">${s.nr}</span><span class="badge ${s.status}">${esc(LABEL[s.status])}</span></header>
  <dl><dt>Schritt</dt><dd>${esc(s.action)}</dd><dt>Erwartet</dt><dd>${esc(s.expected)}</dd><dt>Beobachtet</dt><dd>${esc(s.observed)}</dd></dl>
  <div class="shots">${s.shots.map((sh) => `<figure><img loading="lazy" src="${img(sh.file)}" alt="${esc(sh.caption)}"><figcaption>${esc(sh.caption)}</figcaption></figure>`).join("")}</div>
</section>`,
    )
    .join("\n");
  // nur der Seiteninhalt: das Artefakt bekommt beim Veröffentlichen sein Dokumentgerüst
  return `<title>User-Test #${r.issue}</title>
<style>
/* Prüfprotokoll: Urteil und Zusammenfassung oben, dann ein Block pro Schritt mit Statusstreifen und Bildern */
:root{color-scheme:light;--bg:#f6f6f4;--card:#fff;--text:#1d1d1b;--muted:#5f5f5a;--line:#e2e1dc;--ok:#1f7a3f;--fail:#b3261e;--look:#8a5a00;--device:#3b5bab;--skip:#6f6f69}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#171716;--card:#222220;--text:#ecebe6;--muted:#a3a29b;--line:#383733;--ok:#5cc47f;--fail:#f08079;--look:#e0b25a;--device:#8fa9ec;--skip:#a3a29b;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#171716;--card:#222220;--text:#ecebe6;--muted:#a3a29b;--line:#383733;--ok:#5cc47f;--fail:#f08079;--look:#e0b25a;--device:#8fa9ec;--skip:#a3a29b;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1000px;margin:0 auto;padding:24px 16px 64px}h1{font-size:22px;margin:0 0 4px}.meta{color:var(--muted);font-size:13px;margin:0 0 16px}
.verdict{font-weight:700;font-size:17px;margin:0 0 12px}.verdict.ok{color:var(--ok)}.verdict.look{color:var(--look)}.verdict.device{color:var(--device)}
.note{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:0 0 16px}
.sum{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}.sum span{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:13px}
.step{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--line);border-radius:10px;padding:14px;margin:0 0 14px}
.step.ok{border-left-color:var(--ok)}.step.fail{border-left-color:var(--fail)}.step.look{border-left-color:var(--look)}.step.device{border-left-color:var(--device)}.step.skip{border-left-color:var(--skip)}
.step header{display:flex;align-items:center;gap:10px;margin-bottom:8px}.nr{font-weight:700;font-size:18px}
.badge{font-size:13px;font-weight:600}.badge.ok{color:var(--ok)}.badge.fail{color:var(--fail)}.badge.look{color:var(--look)}.badge.device{color:var(--device)}.badge.skip{color:var(--muted)}
dl{display:grid;grid-template-columns:90px 1fr;gap:4px 12px;margin:0 0 10px}dt{color:var(--muted);font-size:13px}dd{margin:0}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}figure{margin:0}img{width:100%;border:1px solid var(--line);border-radius:6px;display:block}
figcaption{color:var(--muted);font-size:12px;margin-top:4px}ul{margin:6px 0 0;padding-left:20px}
@media (max-width:560px){dl{grid-template-columns:1fr}}
</style>
<main>
<h1>User-Test #${r.issue} · ${esc(r.name ?? "")}</h1>
<p class="meta">${esc(r.title)}<br>Stand ${esc(r.commit)} (${esc(r.branch)}) · Chromium ${r.gpu ? "auf dem PC, echte Grafikkarte" : "in der Cloud"}, ${r.device === "phone" ? `Handy-Ansicht ${r.viewport.width}×${r.viewport.height}` : `Desktop ${r.viewport.width}×${r.viewport.height}`} · ${esc(r.date.slice(0, 16).replace("T", " "))} UTC</p>
<p class="verdict ${V[0]}">${V[1]}</p>
<div class="note">Der Test klickt die Schritte aus dem Issue automatisch im Dashboard durch. Die Werkzeuge sind die echten des Workers, die Daten aber synthetisch (keine echten Messwerte); Claude-Texte sind Beispielantworten.${r.realDevice.length ? `<br><strong>Nur am echten Gerät / im Alltag prüfbar:</strong><ul>${r.realDevice.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}</div>
<div class="sum"><span>${c.ok} erfüllt</span><span>${c.fail} nicht erfüllt</span><span>${c.look} am Bild beurteilen</span><span>${c.device} nur am Gerät</span>${r.consoleErrors.length ? `<span>${r.consoleErrors.length} Konsolenfehler</span>` : ""}</div>
${steps}
</main>
`;
}
