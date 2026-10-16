// Vorschau des Dashboards mit synthetischen Daten und einem nachgebauten window.claude.
//   node artifact/dev/preview.mjs [out-dir]   → schreibt preview.html und Screenshots (Playwright/Chromium)
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(here, "out"));
mkdirSync(out, { recursive: true });
const page = readFileSync(join(here, "..", "dashboard.html"), "utf8");
const mock = readFileSync(join(here, "mock-dashboard.json"), "utf8");
const shim = `<script>
window.__MOCK__ = ${mock};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const payloads = {
  get_dashboard: (i) => { const d = window.__MOCK__.get_dashboard; if (!i?.compact) return d;
    const col = (rows) => { const keys = [...new Set(rows.flatMap(Object.keys))]; return { keys, rows: rows.map((r) => keys.map((k) => r[k] ?? null)) }; };
    return { ...d, compact: 1, days: col(d.days), workouts: col(d.workouts) }; },
  get_power_curve: () => window.__MOCK__.get_power_curve,
  get_fitness_profile: () => window.__MOCK__.get_fitness_profile,
  get_training_load: () => window.__MOCK__.get_training_load,
  get_health_trends: () => window.__MOCK__.get_health_trends,
  get_strain_recovery: () => window.__MOCK__.get_strain_recovery,
  get_recovery_factors: () => window.__MOCK__.get_recovery_factors,
  get_sleep_report: () => window.__MOCK__.get_sleep_report,
  get_records: () => window.__MOCK__.get_records,
  get_endurance_profile: () => window.__MOCK__.get_endurance_profile,
  get_strength_cycling_interference: () => ({ today: "2026-03-31", range: { from: "2025-10-03", to: "2026-03-31", days: 180 }, legSessions: 24, nextDay: { avgRecovery: 61, avgHrv: 58, groups: [{ group: "afterLegs", label: "Nach Beineinheit", days: 24, recovery: 52.5, hrv: 55, recoveryVsAvg: -7.5, hrvVsAvgPct: -6.2 },{ group: "afterRide", label: "Nach Radeinheit (ohne Beine)", days: 80, recovery: 61.2, hrv: 55, recoveryVsAvg: 1.2, hrvVsAvgPct: 0.8 },{ group: "afterOther", label: "Nach anderem Training", days: 10, recovery: 60, hrv: 55, recoveryVsAvg: null, hrvVsAvgPct: null },{ group: "afterRest", label: "Nach Ruhetag", days: 40, recovery: 63.1, hrv: 55, recoveryVsAvg: 3.1, hrvVsAvgPct: 2.4 }] }, nextRide: [{ bucket: "lt24", label: "unter 24 h", rides: 2, hardRides: 0, efVsTypicalPct: null, hardIntensity: null, hardIntensityVsTypical: null },{ bucket: "24to48", label: "24–48 h", rides: 12, hardRides: 4, efVsTypicalPct: -4.8, hardIntensity: 0.86, hardIntensityVsTypical: null },{ bucket: "48to72", label: "48–72 h", rides: 15, hardRides: 6, efVsTypicalPct: -0.9, hardIntensity: 0.93, hardIntensityVsTypical: null },{ bucket: "gt72", label: "3–7 Tage", rides: 20, hardRides: 8, efVsTypicalPct: 0.6, hardIntensity: 0.95, hardIntensityVsTypical: null },{ bucket: "none", label: "ohne Beine (7 Tage)", rides: 9, hardRides: 3, efVsTypicalPct: 0.3, hardIntensity: 0.94, hardIntensityVsTypical: null }], suggestion: { hours: 48, text: "In deinen Daten ist die Radeinheit ab etwa 48 h nach Beinen wieder so effizient wie sonst. Harte Intervalle daher mit mindestens 48 h Abstand planen (Beobachtung, keine Ursache-Wirkung)." }, recentRides: [], notes: ["Beineinheit = Krafteinheit mit mindestens 3 Beinsätzen.", "Beobachtungen aus deinen Daten, keine Diagnose."] }),
  get_recovery_forecast: (a) => ({ today: "2026-03-31", tomorrow: "2026-04-01", observations: 90, typicalSleepH: 7.6, available: true, notes: ["Schätzung aus deinen eigenen Daten.", "Abends ist die Prognose am genauesten."], assumptions: { sleepH: (a && a.sleepH) || 7.6, sleepFromInput: !!(a && a.sleepH), extraLoad: (a && a.extraLoad) || 0, todayRecovery: 81, todayLoad: 74, todayStrain: 12.4, lateTraining: !!(a && a.extraLoad) }, forecast: { recovery: 72, low: 58, high: 86, zone: "green" }, scenarios: [{ label: "1 Stunde mehr Schlaf", recovery: 79, low: 65, high: 93, delta: 7 }, { label: "1 Stunde weniger Schlaf", recovery: 65, low: 51, high: 79, delta: -7 }, { label: "Noch 1 h lockeres Training heute Abend (etwa 50 Punkte)", recovery: 66, low: 52, high: 80, delta: -6 }], effects: { perSleepHour: 7, per10Load: -0.8, perStrainPoint: -1.2, perRecoveryPoint: 0.3, lateTraining: -2 }, quality: { maePct: 6.2, rmsePct: 7.9, maeIfGuessingAverage: 11.1, maeIfSameAsToday: 14.2, recent: [{ day: "2026-03-18", actual: 62, predicted: 58 },{ day: "2026-03-19", actual: 77, predicted: 70 },{ day: "2026-03-20", actual: 66, predicted: 64 },{ day: "2026-03-21", actual: 54, predicted: 60 },{ day: "2026-03-22", actual: 83, predicted: 76 },{ day: "2026-03-23", actual: 49, predicted: 55 },{ day: "2026-03-24", actual: 72, predicted: 68 },{ day: "2026-03-25", actual: 53, predicted: 57 },{ day: "2026-03-26", actual: 60, predicted: 63 },{ day: "2026-03-27", actual: 61, predicted: 59 },{ day: "2026-03-28", actual: 84, predicted: 78 },{ day: "2026-03-29", actual: 86, predicted: 80 },{ day: "2026-03-30", actual: 87, predicted: 82 },{ day: "2026-03-31", actual: 81, predicted: 79 }] } }),
  get_ftp_tests: () => window.__MOCK__.get_ftp_tests,
  analyze_ftp_test: () => ({ workout: { source: "mywhoosh", sourceId: "m1", day: window.__MOCK__.get_dashboard.today, sport: "cycling", durationS: 1500 }, result: { protocol: "ramp", detection: "auto", label: "Ramp-Test", basisW: 340, basisStartS: 1100, factor: 0.75, ftpW: 255, message: "Ramp-Test: 75 % von 340 W (beste Minute) = FTP etwa 255 W (Schätzung)." } }),
  save_ftp_test: () => window.__MOCK__.get_ftp_tests,
  get_period_summaries: (i) => window.__MOCK__.get_period_summaries[i.period ?? "month"],
  get_body_history: () => window.__MOCK__.get_body_history,
  get_bike_workout: () => window.__MOCK__.get_bike_workout,
  get_ride_weather: () => window.__MOCK__.get_ride_weather,
  set_weather_location: (i) => ({ location: { name: i.name, lat: 47.1, lon: 15.4 } }),
  log_weight: (i) => ({ saved: { day: window.__MOCK__.get_dashboard.today, weightKg: i.weightKg }, ...window.__MOCK__.get_body_history }),
  export_csv: (i) => ({ fileName: "fitness-" + i.dataset + ".csv", rows: 2, csv: "day;value\\n2026-03-30;1\\n2026-03-31;2\\n" }),
  sync_now: () => ({ whoop: { ok: true, result: { days: 3, sleeps: 3, workouts: 4 } }, wahoo: { ok: false, error: "wahoo_not_configured", message: "übersprungen" } }),
  wahoo_status: () => ({ configured: false, connected: false }),
  update_settings: (i) => i,
  get_strength: () => { const t = window.__MOCK__.get_dashboard.today, d = (n) => { const x = new Date(t + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }; const wk = d(-((new Date(t + "T12:00:00Z").getUTCDay() + 6) % 7));
    const sq = [{ exercise: "squat", exerciseName: "Kniebeuge", reps: 5, weightKg: 100 }, { exercise: "squat", exerciseName: "Kniebeuge", reps: 5, weightKg: 100 }, { exercise: "bench_press", exerciseName: "Bankdrücken", reps: 8, weightKg: 72.5 }];
    return { today: t, range: { from: d(-83), to: t },
      sessions: [{ id: "s2", day: t, name: "Beine & Brust", durationMin: 60, rpe: 8, load: 70, sets: sq }, { id: "s1", day: d(-4), name: null, durationMin: 45, rpe: 6.5, load: 38, sets: sq.slice(2) }],
      weeks: [{ week: wk, sessions: 2, sets: 4, tonnageKg: 2740, muscles: [{ muscle: "quads", label: "Oberschenkel vorne", sets: 2, tonnageKg: 1000 }, { muscle: "chest", label: "Brust", sets: 2, tonnageKg: 1160 }, { muscle: "glutes", label: "Gesäß", sets: 1, tonnageKg: 0 }, { muscle: "triceps", label: "Trizeps", sets: 1, tonnageKg: 0 }] }],
      progress: [{ exercise: "squat", name: "Kniebeuge", sessions: 3, history: [[-20, 95], [-10, 97.5], [0, 100]].map(([o, w]) => ({ day: d(o), e1rmKg: Math.round(w * (1 + 5 / 30) * 10) / 10, topSet: { reps: 5, weightKg: w }, sets: 3 })), bestE1rmKg: 116.7, bestDay: t, change4wPct: 2.6, status: "progress" },
        { exercise: "bench_press", name: "Bankdrücken", sessions: 2, history: [[-4, 72.5], [0, 72.5]].map(([o, w]) => ({ day: d(o), e1rmKg: 91.8, topSet: { reps: 8, weightKg: w }, sets: 1 })), bestE1rmKg: 91.8, bestDay: d(-4), change4wPct: 0, status: "plateau" }],
      templates: [{ name: "Beine & Brust", exercises: [{ exercise: "squat", sets: 3, reps: 5, weightKg: 100 }] }],
      coachNotes: [{ effect: "down", text: "Schwere Beineinheit heute: morgen eher locker radeln, keine Intervalle." }],
      note: "1RM und Belastung sind Schätzungen." }; },
  suggest_strength_session: (i) => ({ template: i.template, exercises: [{ exercise: "squat", name: "Kniebeuge", sets: 3, reps: 5, weightKg: 105, basis: "increase", lastDay: null }], coachNotes: [] }),
  log_strength_session: (i) => { window.__gymSaved = i; return { id: "s3", exercises: [], load: { value: 52 } }; },
  save_strength_template: (i) => i,
  update_settings: (i) => i,
  save_plan: () => window.__MOCK__.get_dashboard.training.thisWeek,
  set_goals: () => ({ saved: [], deleted: [], goals: [] }),
  save_journal: (i) => ({ day: window.__MOCK__.get_dashboard.today, ...i }),
  save_workout_rpe: (i) => ({ saved: i }),
  get_week_review: (i) => window.__MOCK__.get_week_review[i.week ?? "previous"],
  save_coach_note: (i) => ({ id: 1, ...i }),
  import_fit: (i) => ({ fileName: i.fileName, imported: true, updated: false, workout: { sourceId: "x", day: window.__MOCK__.get_dashboard.today, startTime: window.__MOCK__.get_dashboard.today + "T17:00:00Z", sport: "cycling", durationS: 3720, distanceM: 31400, avgPowerW: 195, normalizedPowerW: 212, avgHr: 142, maxHr: 171, avgCadenceRpm: 88, tss: 71 }, secondsOfData: 3720, powerCurve: null, sameRideIn: ["whoop"] }),
};
const mcp = {
  watchTool(s, t, input, h) { setTimeout(() => h({ type: "data", result: { payload: payloads[t](input) } }), 50); return () => {}; },
  async callTool(s, t, input) { await sleep(100); return { payload: payloads[t](input) }; },
  async invalidate() {},
  async listTools() { return { servers: [], fileArgs: true }; },
};
const sample = async (input, o = {}) => { if (o.tools) { const t = o.tools.find((x) => x.name === "krafttraining"); window.__toolResult = t ? String(await t.execute({ wochen: 4 }, { signal: new AbortController().signal })).length : -1; } const text = "**Heute normales Training.** Deine Erholung ist gelb und die HRV liegt im Normalbereich.\\n- 45–60 min Grundlage auf dem Rad\\n- danach 10 min Mobility"; o.onText?.({ text, delta: text }); return { text, truncated: false }; };
sample.limits = async () => ({ tools: {} });
sample.json = async () => ({ hinweis: "Beispielplan.", tage: [{ tag: "2026-03-31", einheit: "Rad locker", dauerMin: 60, intensitaet: "locker", belastung: 45, ziel: "Grundlage" }] });
const downloads = { async save() {} };
window.claude = { use: async (n) => (n === "mcp" ? mcp : n === "sample" ? sample : n === "downloads" ? downloads : null) };
</script>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${shim}${page}</body></html>`;
writeFileSync(join(out, "preview.html"), html);
for (const d of ["app", "sections"]) cpSync(join(here, "..", d), join(out, d), { recursive: true });

const pw = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.js"));
const chromium = pw.chromium ?? pw.default.chromium;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const errors = [];
// Jede Abschnittsdatei muss in dashboard.html eingetragen sein (sonst fehlt sie nach dem Veröffentlichen).
for (const f of readdirSync(join(here, "..", "sections"))) if (f.endsWith(".js") && !page.includes(`src="sections/${f}"`)) errors.push(`sections/${f} fehlt in dashboard.html`);
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
  if (tab === "training") { await p.selectOption("#stTpl", "Beine & Brust"); await p.waitForTimeout(300); await p.setInputFiles("#fitFile", { name: "mywhoosh-ride.fit", mimeType: "application/octet-stream", buffer: Buffer.alloc(2048, 1) }); await p.waitForTimeout(500); }
  if (tab === "training") {
    // Gym-Modus: aus der letzten Einheit starten, ersten Satz abhaken, beenden und speichern.
    const plan = await p.$eval("#gySrc", (s) => s.value);
    if (!plan.startsWith("p:")) errors.push(`${name}: Gym-Modus bietet die Krafteinheit aus dem Wochenplan nicht an (${plan})`);
    await p.selectOption("#gySrc", "s:s2"); await p.click("#gyBody button.primary"); await p.waitForTimeout(200);
    await p.click("#gyBody .gy-set .ok"); await p.waitForTimeout(100);
    const rest = await p.evaluate(() => !document.getElementById("gyRest").hidden);
    if (!rest) errors.push(`${name}: Gym-Modus startet keine Pause`);
    await p.screenshot({ path: join(out, "phone-gym.png") });
    await p.click("#gyBody .gy-row .primary"); await p.click("#gyFinish .gy-rpe button:nth-child(7)"); await p.click("#gyFinish .primary"); await p.waitForTimeout(300);
    const saved = await p.evaluate(() => window.__gymSaved);
    if (!(saved?.exercises?.[0]?.sets?.length === 1 && saved.rpe === 7 && saved.startTime)) errors.push(`${name}: Gym-Modus speichert falsch ${JSON.stringify(saved)}`);
  }
  if (name === "desktop-light") {
    const stuck = await p.evaluate(() => [...document.querySelectorAll("#sections > section:not([hidden])")].filter((s) => s.innerText.includes("Lädt …")).map((s) => s.id));
    if (stuck.length) errors.push(`${name}: noch „Lädt …“ in ${stuck.join(", ")}`);
    await p.click("[data-coach=explain]"); await p.waitForTimeout(300);
    await p.fill("#askInput", "Wie entwickelt sich meine Kniebeuge?"); await p.click("#askBtn"); await p.waitForTimeout(400);
    const tr = await p.evaluate(() => window.__toolResult);
    if (!(tr > 100)) errors.push(`${name}: Coach-Werkzeug krafttraining lieferte nichts (${tr})`);
  }
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (sw > 0) errors.push(`${name}: horizontal overflow ${sw}px`);
  await p.screenshot({ path: join(out, `${name}.png`), fullPage: !tab });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "keine Fehler");
if (errors.length) process.exitCode = 1;
