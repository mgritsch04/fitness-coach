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
  get_power_curve: (i) => ({ ...window.__MOCK__.get_power_curve, ...(i?.compare ? { comparison: window.__MOCK__.power_compare[i.compare] } : {}) }),
  get_fitness_profile: () => window.__MOCK__.get_fitness_profile,
  get_training_load: () => window.__MOCK__.get_training_load,
  get_health_trends: () => window.__MOCK__.get_health_trends,
  get_strain_recovery: () => window.__MOCK__.get_strain_recovery,
  get_recovery_factors: () => window.__MOCK__.get_recovery_factors,
  get_sleep_report: () => window.__MOCK__.get_sleep_report,
  get_records: () => window.__MOCK__.get_records,
  get_endurance_profile: () => window.__MOCK__.get_endurance_profile,
  get_hrv_trend: () => window.__MOCK__.get_hrv_trend,
  get_training_timing: () => window.__MOCK__.get_training_timing,
  get_durability: () => window.__MOCK__.get_durability,
  get_aerobic_decoupling: () => window.__MOCK__.get_aerobic_decoupling,
  get_interval_quality: () => window.__MOCK__.get_interval_quality,
  get_cadence_profile: () => window.__MOCK__.get_cadence_profile,
  get_rider_profile: () => window.__MOCK__.get_rider_profile,
  get_muscle_balance: () => window.__MOCK__.get_muscle_balance,
  get_recovery_curve: () => window.__MOCK__.get_recovery_curve,
  get_readiness_alignment: () => window.__MOCK__.get_readiness_alignment,
  get_eftp_trend: () => window.__MOCK__.get_eftp_trend,
  get_indoor_outdoor: () => window.__MOCK__.get_indoor_outdoor,
  get_analysis_highlights: () => ({ highlights: [
    { topic: "muscles", title: "Muskelbalance", tool: "get_muscle_balance", tone: "warn", text: "Rücken und Beinbeuger bekommen deutlich weniger Sätze als Brust und Beinstrecker." },
    { topic: "aerobic", title: "Aerobe Basis", tool: "get_aerobic_decoupling", tone: "good", text: "Puls bleibt bei lockeren Fahrten stabil zur Leistung." },
    { topic: "rider", title: "Fahrertyp: Allrounder", tool: "get_rider_profile", tone: "neutral", text: "Trainingsvorschlag: Sprints einbauen." },
    { topic: "x", title: "Ohne Abschnitt", tool: "get_unknown", tone: "neutral", text: "Synthetischer Eintrag ohne Sprungziel." } ], more: 2, notes: ["Schätzungen, keine Diagnose."] }),
  get_strength_cycling_interference: () => ({ today: "2026-03-31", range: { from: "2025-10-03", to: "2026-03-31", days: 180 }, legSessions: 24, nextDay: { avgRecovery: 61, avgHrv: 58, groups: [{ group: "afterLegs", label: "Nach Beineinheit", days: 24, recovery: 52.5, hrv: 55, recoveryVsAvg: -7.5, hrvVsAvgPct: -6.2 },{ group: "afterRide", label: "Nach Radeinheit (ohne Beine)", days: 80, recovery: 61.2, hrv: 55, recoveryVsAvg: 1.2, hrvVsAvgPct: 0.8 },{ group: "afterOther", label: "Nach anderem Training", days: 10, recovery: 60, hrv: 55, recoveryVsAvg: null, hrvVsAvgPct: null },{ group: "afterRest", label: "Nach Ruhetag", days: 40, recovery: 63.1, hrv: 55, recoveryVsAvg: 3.1, hrvVsAvgPct: 2.4 }] }, nextRide: [{ bucket: "lt24", label: "unter 24 h", rides: 2, hardRides: 0, efVsTypicalPct: null, hardIntensity: null, hardIntensityVsTypical: null },{ bucket: "24to48", label: "24–48 h", rides: 12, hardRides: 4, efVsTypicalPct: -4.8, hardIntensity: 0.86, hardIntensityVsTypical: null },{ bucket: "48to72", label: "48–72 h", rides: 15, hardRides: 6, efVsTypicalPct: -0.9, hardIntensity: 0.93, hardIntensityVsTypical: null },{ bucket: "gt72", label: "3–7 Tage", rides: 20, hardRides: 8, efVsTypicalPct: 0.6, hardIntensity: 0.95, hardIntensityVsTypical: null },{ bucket: "none", label: "ohne Beine (7 Tage)", rides: 9, hardRides: 3, efVsTypicalPct: 0.3, hardIntensity: 0.94, hardIntensityVsTypical: null }], suggestion: { hours: 48, text: "In deinen Daten ist die Radeinheit ab etwa 48 h nach Beinen wieder so effizient wie sonst. Harte Intervalle daher mit mindestens 48 h Abstand planen (Beobachtung, keine Ursache-Wirkung)." }, recentRides: [], notes: ["Beineinheit = Krafteinheit mit mindestens 3 Beinsätzen.", "Beobachtungen aus deinen Daten, keine Diagnose."] }),
  get_recovery_forecast: (a) => ({ today: "2026-03-31", tomorrow: "2026-04-01", observations: 90, typicalSleepH: 7.6, available: true, notes: ["Schätzung aus deinen eigenen Daten.", "Abends ist die Prognose am genauesten."], assumptions: { sleepH: (a && a.sleepH) || 7.6, sleepFromInput: !!(a && a.sleepH), extraLoad: (a && a.extraLoad) || 0, todayRecovery: 81, todayLoad: 74, todayStrain: 12.4, lateTraining: !!(a && a.extraLoad) }, forecast: { recovery: 72, low: 58, high: 86, zone: "green" }, scenarios: [{ label: "1 Stunde mehr Schlaf", recovery: 79, low: 65, high: 93, delta: 7 }, { label: "1 Stunde weniger Schlaf", recovery: 65, low: 51, high: 79, delta: -7 }, { label: "Noch 1 h lockeres Training heute Abend (etwa 50 Punkte)", recovery: 66, low: 52, high: 80, delta: -6 }], effects: { perSleepHour: 7, per10Load: -0.8, perStrainPoint: -1.2, perRecoveryPoint: 0.3, lateTraining: -2 }, quality: { maePct: 6.2, rmsePct: 7.9, maeIfGuessingAverage: 11.1, maeIfSameAsToday: 14.2, recent: [{ day: "2026-03-18", actual: 62, predicted: 58 },{ day: "2026-03-19", actual: 77, predicted: 70 },{ day: "2026-03-20", actual: 66, predicted: 64 },{ day: "2026-03-21", actual: 54, predicted: 60 },{ day: "2026-03-22", actual: 83, predicted: 76 },{ day: "2026-03-23", actual: 49, predicted: 55 },{ day: "2026-03-24", actual: 72, predicted: 68 },{ day: "2026-03-25", actual: 53, predicted: 57 },{ day: "2026-03-26", actual: 60, predicted: 63 },{ day: "2026-03-27", actual: 61, predicted: 59 },{ day: "2026-03-28", actual: 84, predicted: 78 },{ day: "2026-03-29", actual: 86, predicted: 80 },{ day: "2026-03-30", actual: 87, predicted: 82 },{ day: "2026-03-31", actual: 81, predicted: 79 }] } }),
  get_ftp_tests: () => window.__MOCK__.get_ftp_tests,
  analyze_ftp_test: () => ({ workout: { source: "mywhoosh", sourceId: "m1", day: window.__MOCK__.get_dashboard.today, sport: "cycling", durationS: 1500 }, result: { protocol: "ramp", detection: "auto", label: "Ramp-Test", basisW: 340, basisStartS: 1100, factor: 0.75, ftpW: 255, message: "Ramp-Test: 75 % von 340 W (beste Minute) = FTP etwa 255 W (Schätzung)." } }),
  save_ftp_test: () => window.__MOCK__.get_ftp_tests,
  get_period_summaries: (i) => window.__MOCK__.get_period_summaries[i.period ?? "month"],
  get_body_history: () => window.__MOCK__.get_body_history,
  get_bike_workout: () => window.__MOCK__.get_bike_workout,
  list_bike_workouts: (i) => { const m = window.__MOCK__.list_bike_workouts; return { ...m, items: m.items.filter((x) => (!i?.category || x.category === i.category) && (!i?.maxMin || x.durationMin <= i.maxMin)) }; },
  get_ride_weather: () => window.__MOCK__.get_ride_weather,
  set_weather_location: (i) => ({ location: { name: i.name, lat: 47.1, lon: 15.4 } }),
  log_weight: (i) => ((window.__weightIn = i), { saved: i.entries ? { count: i.entries.length, from: i.entries[0].day, to: i.entries.at(-1).day } : { day: window.__MOCK__.get_dashboard.today, weightKg: i.weightKg }, ...window.__MOCK__.get_body_history }),
  export_csv: (i) => ({ fileName: "fitness-" + i.dataset + ".csv", rows: 2, csv: "day;value\\n2026-03-30;1\\n2026-03-31;2\\n" }),
  sync_now: () => ({ whoop: { ok: true, result: { days: 3, sleeps: 3, workouts: 4 } }, wahoo: { ok: false, error: "wahoo_not_configured", message: "übersprungen" } }),
  wahoo_status: () => ({ configured: false, connected: false }),
  update_settings: (i) => ((window.__settingsIn = i), i),
  get_strength: () => { const t = window.__MOCK__.get_dashboard.today, d = (n) => { const x = new Date(t + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }; const wk = d(-((new Date(t + "T12:00:00Z").getUTCDay() + 6) % 7));
    const sq = [{ exercise: "squat", exerciseName: "Kniebeuge", reps: 5, weightKg: 100 }, { exercise: "squat", exerciseName: "Kniebeuge", reps: 5, weightKg: 100 }, { exercise: "bench_press", exerciseName: "Bankdrücken", reps: 8, weightKg: 72.5 }];
    return { today: t, range: { from: d(-83), to: t },
      sessions: [{ id: "s2", day: t, name: "Beine & Brust", durationMin: 60, rpe: 8, load: 70, sets: sq }, { id: "s1", day: d(-4), name: null, durationMin: 45, rpe: 6.5, load: 38, sets: sq.slice(2) }],
      weeks: [{ week: wk, sessions: 2, sets: 4, tonnageKg: 2740, muscles: [{ muscle: "quads", label: "Oberschenkel vorne", sets: 2, tonnageKg: 1000 }, { muscle: "chest", label: "Brust", sets: 2, tonnageKg: 1160 }, { muscle: "glutes", label: "Gesäß", sets: 1, tonnageKg: 0 }, { muscle: "triceps", label: "Trizeps", sets: 1, tonnageKg: 0 }] }],
      progress: [{ exercise: "squat", name: "Kniebeuge", sessions: 3, history: [[-20, 95], [-10, 97.5], [0, 100]].map(([o, w]) => ({ day: d(o), e1rmKg: Math.round(w * (1 + 5 / 30) * 10) / 10, topSet: { reps: 5, weightKg: w }, sets: 3 })), bestE1rmKg: 116.7, bestDay: t, change4wPct: 2.6, status: "progress" },
        { exercise: "bench_press", name: "Bankdrücken", sessions: 2, history: [[-4, 72.5], [0, 72.5]].map(([o, w]) => ({ day: d(o), e1rmKg: 91.8, topSet: { reps: 8, weightKg: w }, sets: 1 })), bestE1rmKg: 91.8, bestDay: d(-4), change4wPct: 0, status: "plateau" }],
      repRecords: [{ exercise: "bench_press", name: "Bankdrücken", marks: [{ kg: 72.5, reps: 8, day: d(-4) }] }, { exercise: "dumbbell_bench_press", name: "Kurzhantel-Bankdrücken", marks: [{ kg: 32, reps: 6, day: d(-11) }, { kg: 28, reps: 8, day: d(-11) }] }],
      standards: { available: true, weightKg: 75, note: "Grobe Richtwerte für trainierte Erwachsene, keine Norm.", text: "", exercises: [{ exercise: "back_squat", name: "Kniebeuge", e1rmKg: 116.7, perKg: 1.56, level: "Stark", next: { level: "Sehr stark", e1rmKg: 150 }, day: t }, { exercise: "bench_press", name: "Bankdrücken", e1rmKg: 91.8, perKg: 1.22, level: "Stark", next: { level: "Sehr stark", e1rmKg: 113 }, day: d(-4) }] },
      templates: [{ name: "Beine & Brust", exercises: [{ exercise: "squat", sets: 3, reps: 5, weightKg: 100 }] }],
      coachNotes: [{ effect: "down", text: "Schwere Beineinheit heute: morgen eher locker radeln, keine Intervalle." }],
      note: "1RM und Belastung sind Schätzungen." }; },
  suggest_strength_session: (i) => ({ template: i.template, exercises: [{ exercise: "squat", name: "Kniebeuge", sets: 3, reps: 5, weightKg: 105, basis: "increase", lastDay: null }], coachNotes: [] }),
  log_strength_session: (i) => { window.__gymSaved = i; return { id: "s3", exercises: [], load: { value: 52 } }; },
  save_strength_template: (i) => i,
  get_express_session: (i) => { window.__expressIn = i; return { minutes: i.minutes, fullMin: 52, estimatedMin: 28, fits: true, dropped: ["Bankdrücken"], changes: ["Grundübungen 2 Sätze"], note: "", text: "Gekürzt von etwa 52 auf 28 min: Grundübungen 2 Sätze. Weggelassen: Bankdrücken.",
    exercises: [{ exercise: "back_squat", name: "Kniebeuge", sets: 2, reps: 5, weightKg: 100, unit: "Wdh", restS: 120, superset: null, priority: 1 }, { exercise: "dumbbell_row", name: "Kurzhantelrudern", sets: 2, reps: 10, weightKg: 26, unit: "Wdh", restS: 60, superset: "A", priority: 2 }] }; },
  get_exercise_alternatives: (i) => ({ exercise: "bench_press", name: i.exercise, known: true, pattern: "push", alternatives: [{ exercise: "dumbbell_bench", name: "Kurzhantel-Bankdrücken", startKg: 30, lastDay: null, basis: "history" }], note: "Startgewicht aus deiner letzten Einheit." }),
  save_plan: () => window.__MOCK__.get_dashboard.training.thisWeek,
  set_goals: () => ({ saved: [], deleted: [], goals: [] }),
  save_journal: (i) => ({ day: window.__MOCK__.get_dashboard.today, ...i }),
  save_workout_rpe: (i) => { window.__rpeSaved = i; return { saved: i }; },
  get_consistency: () => { const t = window.__MOCK__.get_dashboard.today, x = new Date(t + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() - (x.getUTCDay() + 6) % 7); const ws = (n) => { const y = new Date(x); y.setUTCDate(y.getUTCDate() - 7 * n); return y.toISOString().slice(0, 10); };
    const weeks = Array.from({ length: 12 }, (_, i) => { const n = 11 - i, met = n >= 1 && n <= 3; return { week: ws(n), strength: met ? 3 : n === 0 ? 1 : 1, rides: met ? 3 : 1, met, current: n === 0, planned: null, done: null }; });
    return { target: { strength: 2, rides: 3, strengthSource: "prefs", ridesSource: "estimate" }, weeks, streak: 3, bestStreak: 3, ratePct: 27, planAdherencePct: 80, text: "3 Wochen in Folge 2× Kraft + 3× Rad. Diese Woche fehlen noch 1× Kraft und 2× Rad.", note: "Kraft zählt einmal pro Tag, Rad ab 20 min." }; },
  log_sweat_test: (i) => { window.__sweatIn = i; const rate = Math.round(((i.weightBeforeKg - i.weightAfterKg + i.drankL) / (i.durationMin / 60)) * 100) / 100; return { saved: { id: 1, ...i, rateLph: rate }, indoor: { tests: 1, rateLph: rate, drinkLph: 1, lastDay: "2026-03-31" }, outdoor: null, tests: [], text: "Rolle: " + String(rate).replace(".", ",") + " l/h Schweiß, etwa 1 l pro Stunde trinken (1 Messung).", note: "" }; },
  save_recommendation_feedback: (i) => { window.__fbSaved = i; return { saved: { day: window.__MOCK__.get_dashboard.today, verdict: i.verdict }, today: i.verdict, count: 4, scoreDelta: 0, text: "" }; },
  get_week_review: (i) => window.__MOCK__.get_week_review[i.week ?? "previous"],
  save_coach_note: (i) => ({ id: 1, ...i }),
  import_fit: (i) => ({ fileName: i.fileName, imported: true, updated: false, workout: { sourceId: "x", day: window.__MOCK__.get_dashboard.today, startTime: window.__MOCK__.get_dashboard.today + "T17:00:00Z", sport: "cycling", durationS: 3720, distanceM: 31400, avgPowerW: 195, normalizedPowerW: 212, avgHr: 142, maxHr: 171, avgCadenceRpm: 88, tss: 71 }, secondsOfData: 3720, powerCurve: null, sameRideIn: ["whoop"] }),
};
const mcp = {
  watchTool(s, t, input, h) { (window.__calls ??= []).push(t); setTimeout(() => h({ type: "data", result: { payload: payloads[t](input) } }), 50); return () => {}; },
  async callTool(s, t, input) { (window.__calls ??= []).push(t); await sleep(100); return { payload: payloads[t](input) }; },
  async invalidate() {},
  async listTools() { return { servers: [], fileArgs: true }; },
};
const sample = async (input, o = {}) => { if (o.tools) { const t = o.tools.find((x) => x.name === "krafttraining"); window.__toolResult = t ? String(await t.execute({ wochen: 4 }, { signal: new AbortController().signal })).length : -1; if (!window.__toolBad) { window.__toolBad = []; for (const x of o.tools) { try { if (String(await x.execute({}, { signal: new AbortController().signal })).length < 20) window.__toolBad.push(x.name + ": leer"); } catch (e) { window.__toolBad.push(x.name + ": " + e.message); } } window.__toolCount = o.tools.length; } } const text = "**Heute normales Training.** Deine Erholung ist gelb und die HRV liegt im Normalbereich.\\n- 45–60 min Grundlage auf dem Rad\\n- danach 10 min Mobility"; o.onText?.({ text, delta: text }); return { text, truncated: false }; };
sample.limits = async () => ({ tools: {} });
sample.json = async () => ({ hinweis: "Beispielplan.", tage: [{ tag: "2026-03-31", einheit: "Rad locker", dauerMin: 60, intensitaet: "locker", belastung: 45, ziel: "Grundlage" }] });
const downloads = { async save(f) { const b = f.data instanceof Blob ? f.data : new Blob([f.data]); const u = new Uint8Array(await b.arrayBuffer()); window.__saved = { filename: f.filename, text: await b.text(), size: u.length, b64: u.length < 3e6 ? btoa(Array.from(u, (x) => String.fromCharCode(x)).join("")) : "" }; } };
window.claude = { use: async (n) => (n === "mcp" ? mcp : n === "sample" ? sample : n === "downloads" ? downloads : null) };
</script>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${shim}${page}</body></html>`;
writeFileSync(join(out, "preview.html"), html);
for (const d of ["app", "sections"]) cpSync(join(here, "..", d), join(out, d), { recursive: true });
// Nur die Seite bauen (für die automatischen User-Tests, scripts/usertest/run.mjs), ohne Browser.
if (process.argv.includes("--build-only")) process.exit(0);

const pw = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.js"));
const chromium = pw.chromium ?? pw.default.chromium;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const errors = [];
// axe-core ist eine Dev-Abhängigkeit nur für die Vorschau (in der CI per npm install --no-save).
const axeSrc = await import("node:module").then(({ createRequire }) => readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8")).catch(() => null);
if (!axeSrc && process.env.CI) errors.push("axe-core fehlt in der CI (#211)");
if (!axeSrc) console.warn("axe-core nicht installiert: Barrierefreiheit wird nicht geprüft (npm install --no-save axe-core@4.10.3).");
const a11y = [];
// Jede Abschnittsdatei muss in dashboard.html eingetragen sein (sonst fehlt sie nach dem Veröffentlichen).
for (const f of readdirSync(join(here, "..", "sections"))) if (f.endsWith(".js") && !page.includes(`src="sections/${f}"`)) errors.push(`sections/${f} fehlt in dashboard.html`);
const shots = [["desktop-light", { width: 1280, height: 900 }, "light"], ["desktop-dark", { width: 1280, height: 900 }, "dark"],
  ...["heute", "coach", "verlauf", "training", "mehr"].map((t) => [`phone-${t}`, { width: 390, height: 844 }, t === "verlauf" ? "dark" : "light", t])];
for (const [name, vp, scheme, tab] of shots) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, hasTouch: name.startsWith("phone") });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await p.goto("file://" + join(out, "preview.html"));
  await p.waitForTimeout(800);
  if (tab) { await p.click(`#tabbar [data-tab=${tab}]`); await p.waitForTimeout(300); }
  if (tab === "training") {
    // Einklappen (#188): am Handy nur die ersten zwei offen, eingeklappte laden nichts; Aufklappen lädt und bleibt gemerkt.
    const f = await p.evaluate(() => ({ folded: document.querySelectorAll("#sections > section.on.folded").length, open: [...document.querySelectorAll("#sections > section.on.foldable:not(.folded)")].map((x) => x.id), h: document.documentElement.scrollHeight, cad: window.__calls.includes("get_cadence_profile") }));
    if (f.folded < 10 || f.open.length !== 2 || f.h > 6000 || f.cad) errors.push(`${name}: Einklappen falsch ${JSON.stringify(f)}`);
    await p.click("#sec-cadence > .fold-bar"); await p.waitForTimeout(300);
    const g = await p.evaluate(() => ({ open: !document.getElementById("sec-cadence").classList.contains("folded"), cad: window.__calls.includes("get_cadence_profile"), text: document.getElementById("sec-cadence").innerText.length }));
    if (!g.open || !g.cad || g.text < 100) errors.push(`${name}: Aufklappen lädt nicht ${JSON.stringify(g)}`);
    await p.reload(); await p.waitForTimeout(800); await p.click("#tabbar [data-tab=training]"); await p.waitForTimeout(300);
    if (await p.evaluate(() => document.getElementById("sec-cadence").classList.contains("folded"))) errors.push(`${name}: Aufgeklappt wird nicht gemerkt`);
    await p.screenshot({ path: join(out, "phone-training-folded.png"), fullPage: true });
    // Für die folgenden Tests alles aufklappen.
    await p.evaluate(() => document.querySelectorAll("#sections > section.on.folded > .fold-bar").forEach((b) => b.click())); await p.waitForTimeout(400);
  }
  if (tab === "training") {
    // Workout-Filter (#220): Sportart, Quelle, Suche; 25 je Seite, „weitere laden“, gemerkt nach Neuladen, zurücksetzen.
    const wo = () => p.evaluate(() => ({ rows: [...document.querySelectorAll("#tWorkouts tbody tr:not(.rpe-row)")].map((r) => r.cells[1]?.innerText ?? ""), count: document.getElementById("woCount").textContent, more: !document.getElementById("btnMoreWorkouts").hidden, over: document.documentElement.scrollWidth > innerWidth }));
    const w0 = await wo();
    if (w0.rows.length !== 25 || !w0.more || w0.over) errors.push(`${name}: Workout-Liste ohne Filter falsch ${JSON.stringify({ n: w0.rows.length, more: w0.more, over: w0.over })}`);
    await p.click("#btnMoreWorkouts"); await p.waitForTimeout(150);
    if ((await wo()).rows.length !== 50) errors.push(`${name}: „weitere laden“ lädt nicht nach`);
    await p.click("#woKind [data-k=bike]"); await p.waitForTimeout(150);
    const w1 = await wo();
    if (!w1.rows.length || w1.rows.some((r) => !/Radfahren|Spinning/.test(r)) || !/ von /.test(w1.count)) errors.push(`${name}: Filter Rad falsch ${JSON.stringify(w1.rows.slice(0, 3))} ${w1.count}`);
    await p.selectOption("#woSource", "mywhoosh"); await p.fill("#woSearch", "radfahren"); await p.waitForTimeout(150);
    const w2 = await wo();
    if (!w2.rows.length || w2.rows.some((r) => !/Radfahren/.test(r))) errors.push(`${name}: Quelle/Suche falsch ${JSON.stringify(w2.rows.slice(0, 3))}`);
    await p.fill("#woSearch", "gibtsnicht"); await p.waitForTimeout(150);
    if (!/passen zum Filter/.test(await p.locator("#tWorkouts tbody").innerText())) errors.push(`${name}: leerer Filter ohne Hinweis`);
    await p.fill("#woSearch", "radfahren"); await p.reload(); await p.waitForTimeout(800); await p.click("#tabbar [data-tab=training]"); await p.waitForTimeout(300);
    const w3 = await p.evaluate(() => ({ q: document.getElementById("woSearch").value, src: document.getElementById("woSource").value, kind: document.querySelector("#woKind [aria-pressed=true]")?.dataset.k }));
    if (w3.q !== "radfahren" || w3.src !== "mywhoosh" || w3.kind !== "bike") errors.push(`${name}: Filter nicht gemerkt ${JSON.stringify(w3)}`);
    await p.locator("#sec-workouts").scrollIntoViewIfNeeded(); await p.evaluate(() => document.getElementById("sec-workouts").scrollIntoView()); await p.waitForTimeout(200);
    await p.screenshot({ path: join(out, "phone-workout-filter.png") });
    await p.click("#btnResetWorkouts"); await p.waitForTimeout(150);
    if ((await wo()).rows.length !== 25) errors.push(`${name}: Zurücksetzen zeigt nicht wieder alle`);
  }
  if (tab === "training") { await p.selectOption("#stTpl", "Beine & Brust"); await p.waitForTimeout(300); await p.setInputFiles("#fitFile", { name: "mywhoosh-ride.fit", mimeType: "application/octet-stream", buffer: Buffer.alloc(2048, 1) }); await p.waitForTimeout(500); }
  if (tab === "mehr") {
    // Datenstand je Quelle (#212): Kopfzeile mit WHOOP und MyWhoosh; mit veralteten Daten „veraltet“ als Wort und Hinweis im Briefing.
    const f0 = await p.$$eval("#fresh button", (b) => b.map((x) => x.textContent));
    if (f0.length !== 2 || !/^WHOOP/.test(f0[0]) || f0.some((t) => /veraltet/.test(t)) || await p.isHidden("#fresh")) errors.push(`${name}: Datenstand falsch ${JSON.stringify(f0)}`);
    await p.evaluate(async () => {
      const d = window.__MOCK__.get_dashboard, h = (n) => new Date(Date.parse(d.generatedAt) - n * 3600e3).toISOString();
      d.freshness = { stale: true, note: "Daten von WHOOP sind nicht aktuell (abgeglichen vor 2 Tagen). Empfehlungen können darum danebenliegen.",
        sources: [{ source: "whoop", label: "WHOOP", lastSyncAt: h(50), lastDataAt: h(55), ageH: 50, level: "stale", error: false, text: "abgeglichen vor 2 Tagen" },
          { source: "wahoo", label: "Wahoo", lastSyncAt: null, lastDataAt: null, ageH: null, level: "none", error: false, text: "nicht verbunden" },
          { source: "mywhoosh", label: "MyWhoosh", lastSyncAt: null, lastDataAt: h(200), ageH: 200, level: "stale", error: false, text: "letzte Fahrt vor 8 Tagen" }] };
      await FC.reload();
    });
    await p.waitForTimeout(300);
    const f1 = await p.$$eval("#fresh button", (b) => b.map((x) => x.textContent));
    if (!f1.length || !f1.every((t) => /veraltet/.test(t))) errors.push(`${name}: veralteter Datenstand ohne Wort ${JSON.stringify(f1)}`);
    if (!/WHOOP/.test(await p.evaluate(() => document.getElementById("bfStale").textContent))) errors.push(`${name}: kein Datenstand-Hinweis im Briefing`);
    await p.screenshot({ path: join(out, "phone-fresh-stale.png") });
    await p.click("#fresh button"); await p.waitForTimeout(600);
    const at = await p.evaluate(() => { const r = document.getElementById("sec-sources").getBoundingClientRect(); return { top: Math.round(r.top), vis: !document.getElementById("sec-sources").hidden }; });
    if (!at.vis || at.top < -5 || at.top > 200) errors.push(`${name}: Datenstand-Tippen springt nicht zu Datenquellen ${JSON.stringify(at)}`);
  }
  if (tab === "coach") {
    // Konstanz (#209): 12 Wochenkacheln, 3 erreicht, laufende Woche markiert.
    const cs = await p.evaluate(() => ({ vis: !document.getElementById("sec-consistency")?.hidden, n: document.querySelectorAll("#csWeeks .cs-w").length, met: document.querySelectorAll("#csWeeks .cs-w.met").length, cur: document.querySelectorAll("#csWeeks .cs-w.current").length, text: document.getElementById("csText")?.textContent ?? "" }));
    if (!cs.vis || cs.n !== 12 || cs.met !== 3 || cs.cur !== 1 || !cs.text.includes("in Folge")) errors.push(`${name}: Konstanz-Karte falsch ${JSON.stringify(cs)}`);
    else await p.locator("#sec-consistency").screenshot({ path: join(out, "phone-consistency.png") });
    // Wochenbilanz als Bild (#218): Knopf speichert eine gültige, nicht leere PNG-Karte.
    const btn = p.locator("#rvImg"); await btn.scrollIntoViewIfNeeded();
    await btn.click(); await p.waitForFunction(() => window.__saved?.filename?.endsWith(".png"), null, { timeout: 5000 }).catch(() => {});
    const img = await p.evaluate(() => window.__saved);
    const png = img?.b64 ? Buffer.from(img.b64, "base64") : Buffer.alloc(0);
    if (!/^wochenbilanz-\d{4}-\d{2}-\d{2}\.png$/.test(img?.filename ?? "") || png.length < 20000 || png.subarray(1, 4).toString() !== "PNG" || png.readUInt32BE(16) !== 1080 || png.readUInt32BE(20) !== 1350) errors.push(`${name}: Wochenbilanz-Bild falsch ${img?.filename} ${png.length}`);
    else writeFileSync(join(out, "wochenbilanz.png"), png);
    if (!/gespeichert/.test(await p.locator("#rvMsg").innerText())) errors.push(`${name}: Wochenbilanz ohne Rückmeldung`);
  }
  if (tab === "verlauf") {
    // Diagramme am Handy (#210): Tippen zeigt die Werte und lässt sie stehen, Tippen daneben blendet sie aus.
    const box = p.locator("#sections > section.on:not(.folded) .chart svg").first();
    await box.scrollIntoViewIfNeeded(); const bb = await box.boundingBox();
    await p.touchscreen.tap(bb.x + bb.width * 0.6, bb.y + bb.height / 2); await p.waitForTimeout(400);
    const t1 = await p.evaluate(() => { const t = [...document.querySelectorAll(".tip")].find((x) => !x.hidden); return t && { text: t.innerText, rows: t.querySelectorAll(".row").length, over: document.documentElement.scrollWidth > innerWidth }; });
    if (!t1 || t1.rows < 1 || !/\d/.test(t1.text) || t1.over) errors.push(`${name}: Tippen zeigt keine Werte ${JSON.stringify(t1)}`);
    await p.screenshot({ path: join(out, "phone-chart-tap.png") });
    await p.touchscreen.tap(bb.x + bb.width / 2, Math.max(4, bb.y - 60)); await p.waitForTimeout(200);
    if (await p.evaluate(() => [...document.querySelectorAll(".tip")].some((x) => !x.hidden))) errors.push(`${name}: Tippen daneben blendet Werte nicht aus`);
  }
  if (tab === "heute") {
    // Heute (#191): bis „Heute dran“ offen, darunter eingeklappt.
    const hf = await p.evaluate(() => [...document.querySelectorAll("#sections > section.on.foldable")].map((x) => `${x.id.slice(4)}:${x.classList.contains("folded") ? "zu" : "auf"}`));
    if (!hf.includes("agenda:auf") || !hf.includes("weather:zu") || !hf.includes("forecast:zu")) errors.push(`${name}: Heute-Einklappen falsch ${JSON.stringify(hf)}`);
    // „Neu im Dashboard“ (#152): Liste da, Sprung in den Training-Tab, „Alles gesehen“ bleibt nach Neuladen.
    const news = await p.$$eval("#wnList li", (l) => l.length);
    await p.screenshot({ path: join(out, "phone-news.png") });
    await p.click("#wnList .wn-more").catch(() => errors.push(`${name}: Neu im Dashboard ohne „weitere zeigen“`)); await p.waitForTimeout(100);
    if ((await p.$$eval("#wnList li", (l) => l.length)) <= news) errors.push(`${name}: „weitere zeigen“ zeigt nicht mehr`);
    if (!news) errors.push(`${name}: Neu im Dashboard ist leer`);
    else {
      await p.locator("#wnList li button", { has: p.locator("strong", { hasText: /^Muskelbalance$/ }) }).click(); await p.waitForTimeout(300);
      const at = await p.evaluate(() => document.querySelector("#tabbar [aria-current=page]")?.dataset.tab ?? "alle");
      if (at !== "training") errors.push(`${name}: Neu im Dashboard springt nach ${at} statt Training`);
      await p.click("#tabbar [data-tab=heute]").catch(() => {}); await p.waitForTimeout(200);
      await p.click("#wnSeen"); await p.reload(); await p.waitForTimeout(800);
      await p.click("#tabbar [data-tab=heute]"); await p.waitForTimeout(300);
      if (await p.evaluate(() => !document.getElementById("sec-whatsnew").hidden)) errors.push(`${name}: Neu im Dashboard nach „Alles gesehen“ noch da`);
    }
    // Auf einen Blick (#180): Befunde mit Kennzeichnung, „Details“ nur mit Sprungziel, springt in den richtigen Tab.
    const hl = await p.$$eval("#hlList .hl-item", (l) => l.map((x) => [x.querySelector(".hl-tag")?.textContent, !!x.querySelector("button")]));
    if (hl.length !== 4 || hl[0][0] !== "Achtung" || hl.filter((x) => x[1]).length !== 3) errors.push(`${name}: Auf einen Blick falsch ${JSON.stringify(hl)}`);
    else {
      await p.click("#hlList .hl-item button"); await p.waitForTimeout(1500);
      const at = await p.evaluate(() => document.querySelector("#tabbar [aria-current=page]")?.dataset.tab ?? "alle");
      const top = await p.evaluate(() => document.getElementById("sec-musclebalance")?.getBoundingClientRect().top ?? 9999);
      if (at !== "training" || Math.abs(top) > 80) errors.push(`${name}: Auf einen Blick springt nach ${at}, Abstand ${Math.round(top)} px`);
      await p.click("#tabbar [data-tab=heute]"); await p.waitForTimeout(300);
    }
    // Wochenplan als Kalenderdatei (#157): gültiger Aufbau, Zeilen höchstens 75 Byte.
    const calBtn = await p.$("#agBody .ag-act .ag-cal");
    if (!calBtn) errors.push(`${name}: Heute dran ohne Kalender-Knopf`);
    else {
      await calBtn.click(); await p.waitForTimeout(200);
      const f = await p.evaluate(() => window.__saved);
      const lines = f?.text?.split("\r\n") ?? [];
      const ok = f?.filename?.endsWith(".ics") && lines[0] === "BEGIN:VCALENDAR" && lines.includes("END:VCALENDAR") && lines.some((l) => l.startsWith("DTSTART;VALUE=DATE:")) && lines.every((l) => Buffer.byteLength(l) <= 75);
      if (!ok) errors.push(`${name}: Kalenderdatei fehlerhaft ${JSON.stringify(f?.text?.slice(0, 300))}`);
    }
    // „Heute dran“ (#122): Wochenstreifen da, Knopf startet den Gym-Modus mit der Planeinheit.
    const n = await p.$$eval("#agBody .ag-day", (d) => d.length);
    if (n !== 7) errors.push(`${name}: Heute dran zeigt ${n} statt 7 Tage`);
    await p.screenshot({ path: join(out, "phone-heute.png"), fullPage: false });
    await p.evaluate(() => document.querySelector("#agBody .ag-rpe")?.scrollIntoView({ block: "center" }));
    const rpeBtn = p.locator("#agBody .ag-rpe .rpe-pick button:nth-child(7)");
    if (!(await rpeBtn.count())) errors.push(`${name}: Heute dran fragt nicht nach der Anstrengung`);
    else { await rpeBtn.click(); await p.waitForTimeout(300); const r = await p.evaluate(() => window.__rpeSaved); if (!(r?.rpe === 7 && r.source && r.sourceId)) errors.push(`${name}: Anstrengung falsch gespeichert ${JSON.stringify(r)}`); }
    const gymBtn = await p.$("#agBody .ag-act .primary");
    if (gymBtn && (await gymBtn.textContent()).includes("Gym")) {
      await gymBtn.click(); await p.waitForTimeout(400);
      const on = await p.evaluate(() => document.querySelectorAll("#gyBody .gy-ex").length);
      if (!on) errors.push(`${name}: Heute dran startet den Gym-Modus nicht`);
      await p.evaluate(() => localStorage.removeItem("fc-gym"));
    } else errors.push(`${name}: Heute dran ohne Gym-Knopf am Krafttag`);
    // Rückmeldung zur Empfehlung (#216): nach erledigter Einheit drei Knöpfe, Auswahl bleibt markiert.
    await p.click("#tabbar [data-tab=heute]").catch(() => {}); await p.waitForTimeout(300);
    const fbBtn = p.locator("#agBody .ag-fb button:nth-child(2)");
    if (!(await fbBtn.count())) errors.push(`${name}: Heute dran fragt nicht nach der Rückmeldung zur Empfehlung`);
    else {
      await fbBtn.click(); await p.waitForTimeout(300);
      const fbr = await p.evaluate(() => [window.__fbSaved?.verdict, document.querySelector("#agBody .ag-fb button:nth-child(2)")?.getAttribute("aria-pressed")]);
      if (fbr[0] !== "too_hard" || fbr[1] !== "true") errors.push(`${name}: Rückmeldung falsch gespeichert ${JSON.stringify(fbr)}`);
      // Doppeltag (#298): heute Rad und Kraft, Hinweis zur Reihenfolge.
      if (!/Doppeltag/.test(await p.textContent("#agBody .ag-both").catch(() => ""))) errors.push(`${name}: kein Doppeltag-Hinweis`);
      // Schweißrate (#282): nach der Radeinheit messen, Rate wird gespeichert und angezeigt.
      await p.click("#agBody .ag-sw summary"); await p.fill("#swBefore", "70");
      // Aufklappen ändert die Höhe → ResizeObserver zeichnet neu; Formular muss offen bleiben und Werte behalten.
      await p.waitForTimeout(400);
      const swk = await p.evaluate(() => ({ open: document.querySelector("#agBody .ag-sw")?.open, v: document.getElementById("swBefore")?.value }));
      if (!(swk.open && swk.v === "70")) errors.push(`${name}: Schweißrate-Formular klappt zu ${JSON.stringify(swk)}`); await p.fill("#swAfter", "69,2".replace(",", ".")); await p.fill("#swDrank", "0.6"); await p.fill("#swDur", "60");
      await p.click("#agBody .ag-sw .primary"); await p.waitForFunction(() => /l\/h/.test(document.getElementById("swOut")?.textContent ?? ""), null, { timeout: 3000 }).catch(() => {});
      const swr = await p.evaluate(() => ({ in: window.__sweatIn, out: document.getElementById("swOut")?.textContent ?? "", open: document.querySelector("#agBody .ag-sw")?.open, n: document.querySelectorAll("#swOut").length, msg: document.getElementById("agMsg")?.textContent }));
      if (!(swr.in?.weightBeforeKg === 70 && swr.in.indoor === true && /1,4 l\/h/.test(swr.out))) errors.push(`${name}: Schweißrate falsch ${JSON.stringify(swr)}`);
    }
    // Mobility (#223): Abschnitt öffnen, Timer starten und stoppen.
    await p.evaluate(() => FC.goTo("mobility")); await p.waitForTimeout(300);
    const moN = await p.$$eval("#moList li", (l) => l.length);
    if (moN < 4) errors.push(`${name}: Mobility zeigt ${moN} Übungen`);
    await p.click("#moStart").catch(() => errors.push(`${name}: Mobility ohne Start-Knopf`)); await p.waitForTimeout(1200);
    if (!(await p.evaluate(() => !document.getElementById("moRun").hidden && /\d+ s/.test(document.getElementById("moRun").textContent)))) errors.push(`${name}: Mobility-Timer läuft nicht`);
    await p.click("#moStart").catch(() => {});
    // Kraft pro kg (#203): Tabelle mit Stufen im Abschnitt Krafttraining.
    await p.evaluate(() => FC.goTo("strength")); await p.waitForTimeout(800);
    const stdN = await p.$$eval("#stStd tbody tr", (r) => r.length).catch(() => 0);
    if (stdN !== 2) errors.push(`${name}: Kraft pro kg zeigt ${stdN} statt 2 Zeilen`);
    await p.click("#tabbar [data-tab=heute]").catch(() => {}); await p.waitForTimeout(200);
    await p.click("#tabbar [data-tab=heute]"); await p.waitForTimeout(200);
  }
  if (tab === "training") {
    // Sprungleiste (#168): Abschnittsnamen oben, Tippen scrollt zum Abschnitt.
    const jumps = await p.$$eval("#jump:not([hidden]) button", (b) => b.map((x) => x.textContent));
    if (jumps.length < 4 || !jumps.includes("Trittfrequenz")) errors.push(`${name}: Sprungleiste fehlt oder unvollständig ${JSON.stringify(jumps)}`);
    else {
      await p.click("#jump button:text-is('Trittfrequenz')"); await p.waitForTimeout(900);
      const top = await p.evaluate(() => document.getElementById("sec-cadence").getBoundingClientRect().top);
      if (Math.abs(top) > 40) errors.push(`${name}: Sprungleiste springt nicht (top ${top})`);
      await p.evaluate(() => window.scrollTo(0, 0));
    }
    // Gym-Modus: aus der letzten Einheit starten, ersten Satz abhaken, beenden und speichern.
    const plan = await p.$eval("#gySrc", (s) => s.value);
    if (!plan.startsWith("p:")) errors.push(`${name}: Gym-Modus bietet die Krafteinheit aus dem Wochenplan nicht an (${plan})`);
    await p.selectOption("#gySrc", "s:s2"); await p.click("#gyBody button.primary"); await p.waitForTimeout(200);
    if (!(await p.$("#gyBody .gy-last"))) errors.push(`${name}: Gym-Modus zeigt „Letztes Mal“ nicht`);
    await p.fill("#gyBody .gy-set input[aria-label$='Gewicht in kg']", "105"); await p.press("#gyBody .gy-set input[aria-label$='Gewicht in kg']", "Tab");
    // Scheibenrechner (#143): 105 kg an der 20-kg-Stange = je Seite 25 + 15 + 2,5.
    const plates = await p.textContent("#gyPlates").catch(() => "");
    if (plates !== "25 + 15 + 2,5 kg") errors.push(`${name}: Scheibenrechner zeigt „${plates}“`);
    // Aufwärmsätze (#148): Stange, 40 / 65 / 85 kg vor dem ersten Arbeitssatz.
    const warm = await p.$$eval("#gyWarm li", (l) => l.map((x) => x.textContent)).catch(() => []);
    if (warm.length !== 4 || !warm[3].startsWith("85 kg × 2")) errors.push(`${name}: Aufwärmsätze ${JSON.stringify(warm)}`);
    await p.screenshot({ path: join(out, "phone-gym-warm.png") });
    await p.click("#gyBody .gy-set .ok"); await p.waitForTimeout(100);
    if (await p.$("#gyWarm")) errors.push(`${name}: Aufwärmsätze nach dem ersten Satz noch sichtbar`);
    if (!/Neuer Bestwert/.test(await p.textContent("#gyBody .gy-note"))) errors.push(`${name}: Gym-Modus meldet keinen Bestwert`);
    const rest = await p.evaluate(() => !document.getElementById("gyRest").hidden);
    if (!rest) errors.push(`${name}: Gym-Modus startet keine Pause`);
    // Reserve je Satz (#280): „3+“ macht den nächsten Satz 2,5 % schwerer (Langhantel: 107,5 kg).
    await p.click("#gyBody .gy-rir button:nth-of-type(3)").catch(() => errors.push(`${name}: keine Reserve-Knöpfe nach dem Satz`)); await p.waitForTimeout(100);
    const rir = await p.evaluate(() => ({ kg: document.querySelectorAll("#gyBody .gy-ex")[0]?.querySelectorAll(".gy-set input[aria-label$='Gewicht in kg']")[1]?.value, note: document.querySelector("#gyBody .gy-note")?.textContent ?? "" }));
    if (rir.kg !== "107.5" || !/Bestwert/.test(rir.note) || !/107,5 kg/.test(rir.note)) errors.push(`${name}: Reserve passt das Gewicht nicht an ${JSON.stringify(rir)}`);
    await p.screenshot({ path: join(out, "phone-gym.png") });
    // Übung tauschen (#204): letzte Übung gegen Alternative tauschen, Satzzahl bleibt.
    const before = await p.$$eval("#gyBody .gy-ex", (l) => { const c = l[l.length - 1]; return c.querySelectorAll(".gy-set").length; });
    await p.click("#gyBody .gy-ex:last-of-type .gy-swap"); await p.waitForSelector("#gyBody .gy-swapbox button", { timeout: 2000 }).catch(() => {});
    await p.click("#gyBody .gy-swapbox button").catch(() => errors.push(`${name}: Tauschen zeigt keine Alternative`)); await p.waitForTimeout(100);
    const after = await p.$$eval("#gyBody .gy-ex", (l) => { const c = l[l.length - 1]; return { h: c.querySelector("h3")?.textContent ?? "", n: c.querySelectorAll(".gy-set").length }; });
    if (!after.h.includes("Kurzhantel-Bankdrücken") || after.n !== before) errors.push(`${name}: Tauschen ersetzt die Übung nicht richtig ${JSON.stringify({ before, after })}`);
    // Wiederholungsrekord (#299): nach dem Tausch Kurzhantel-Bankdrücken 28 kg × 10, bisher bei ≥ 28 kg höchstens 8 Wdh.
    const bench = "#gyBody .gy-ex:last-of-type .gy-set";
    await p.fill(`${bench} input[aria-label$='Gewicht in kg']`, "28"); await p.fill(`${bench} input[aria-label$='Wiederholungen']`, "10");
    await p.click(`${bench} .ok`); await p.waitForTimeout(100);
    const repNote = await p.textContent("#gyBody .gy-note").catch(() => "");
    if (!/Wiederholungsrekord: erstmals 10 Wdh\. mit 28 kg \(bisher höchstens 8\)/.test(repNote)) errors.push(`${name}: kein Wiederholungsrekord „${repNote}“`);
    await p.click("#gyBody .gy-row .primary"); await p.click("#gyFinish .gy-rpe button:nth-child(7)"); await p.click("#gyFinish .primary"); await p.waitForTimeout(300);
    const saved = await p.evaluate(() => window.__gymSaved);
    if (!(saved?.exercises?.[0]?.sets?.length === 1 && saved.exercises[0].sets[0].rpe === 7 && saved.rpe === 7 && saved.startTime)) errors.push(`${name}: Gym-Modus speichert falsch ${JSON.stringify(saved)}`);
    // Express (#281): „Nur 30 min“ kürzt die Einheit über get_express_session.
    await p.selectOption("#gySrc", "s:s2"); await p.selectOption("#gyTime", "30"); await p.click("#gyBody button.primary"); await p.waitForTimeout(200);
    const ex = await p.evaluate(() => ({ min: window.__expressIn?.minutes, n: window.__expressIn?.exercises?.length, cards: [...document.querySelectorAll("#gyBody .gy-ex h3")].map((h) => h.textContent), sets: document.querySelectorAll("#gyBody .gy-ex")[0]?.querySelectorAll(".gy-set").length, ss: document.querySelectorAll("#gyBody .gy-ex")[1]?.querySelector(".gy-exh .muted")?.textContent ?? "", msg: document.getElementById("gyMsg")?.textContent ?? "" }));
    if (ex.min !== 30 || ex.n !== 2 || ex.cards.join("|") !== "Kniebeuge|Kurzhantelrudern" || ex.sets !== 2 || !/Supersatz A/.test(ex.ss) || !/Gekürzt/.test(ex.msg)) errors.push(`${name}: Express-Einheit falsch ${JSON.stringify(ex)}`);
  }
  if (name === "desktop-light") {
    // Favoriten (#291): Stern an „Trittfrequenz“ heftet sie oben auf „Heute“ an, Sprung, nach Neuladen gemerkt, lösen.
    const favNone = await p.evaluate(() => document.getElementById("sec-favorites").hidden && document.querySelectorAll(".fav-btn").length);
    if (!favNone || favNone < 20) errors.push(`${name}: Favoriten-Sterne fehlen oder Leiste ohne Favoriten sichtbar (${favNone})`);
    await p.evaluate(() => document.querySelector("#h-cadence .fav-btn").click()); await p.waitForTimeout(100);
    const fav = await p.evaluate(() => ({ vis: !document.getElementById("sec-favorites").hidden, items: [...document.querySelectorAll("#favList button")].map((b) => b.textContent), pressed: document.querySelector("#h-cadence .fav-btn").getAttribute("aria-pressed") }));
    if (!fav.vis || fav.items.join() !== "TrittfrequenzTraining" || fav.pressed !== "true") errors.push(`${name}: Anheften falsch ${JSON.stringify(fav)}`);
    await p.reload(); await p.waitForTimeout(900);
    const kept = await p.$$eval("#favList button", (b) => b.map((x) => x.textContent));
    if (kept.join() !== "TrittfrequenzTraining") errors.push(`${name}: Favorit nach Neuladen weg ${JSON.stringify(kept)}`);
    await p.screenshot({ path: join(out, "desktop-favorites.png") });
    await p.click("#favList button"); await p.waitForTimeout(1600);
    const fj = await p.evaluate(() => ({ tab: document.querySelector("#tabbar [aria-current=page]")?.dataset.tab, top: Math.round(document.getElementById("sec-cadence").getBoundingClientRect().top) }));
    if (fj.tab !== "training" || Math.abs(fj.top) > 60) errors.push(`${name}: Favorit springt falsch ${JSON.stringify(fj)}`);
    await p.evaluate(() => document.querySelector("#h-cadence .fav-btn").click()); await p.waitForTimeout(100);
    if (!(await p.evaluate(() => document.getElementById("sec-favorites").hidden))) errors.push(`${name}: Lösen blendet Favoriten nicht aus`);
    await p.evaluate(() => { FC.showTab("heute"); window.scrollTo(0, 0); }); await p.waitForTimeout(200);
  }
  if (name === "phone-mehr" || name === "desktop-light") {
    // Abschnitte suchen (#269): „kadenz“ findet Trittfrequenz im Training-Tab, Enter springt hin und klappt am Handy auf.
    if (name === "phone-mehr") await p.click("#btnSearch");
    else if (await p.evaluate(() => !document.getElementById("sec-whatsnew").hidden)) {
      // Desktop: der Eintrag unter „Neu im Dashboard“ öffnet die Suche; danach per Taste „/“.
      await p.locator("#wnList li button", { has: p.locator("strong", { hasText: /^Abschnitte suchen$/ }) }).click().catch(() => errors.push(`${name}: Suche fehlt unter „Neu im Dashboard“`));
      await p.waitForTimeout(100);
      if (!(await p.evaluate(() => document.getElementById("searchDlg").open))) errors.push(`${name}: „Neu im Dashboard“ öffnet die Suche nicht`);
      await p.keyboard.press("Escape"); await p.waitForTimeout(100);
      await p.evaluate(() => document.activeElement?.blur()); await p.keyboard.press("/");
    } else { await p.evaluate(() => document.activeElement?.blur()); await p.keyboard.press("/"); }
    await p.waitForTimeout(100);
    if (!(await p.evaluate(() => document.getElementById("searchDlg").open && document.activeElement?.id === "searchInput"))) errors.push(`${name}: Suche öffnet nicht`);
    await p.fill("#searchInput", "kadenz"); await p.waitForTimeout(100);
    const hits = await p.$$eval("#searchList button", (b) => b.map((x) => x.textContent));
    if (!hits.length || !/^Trittfrequenz.*Training$/.test(hits[0])) errors.push(`${name}: Suche „kadenz“ findet ${JSON.stringify(hits)}`);
    await p.screenshot({ path: join(out, `${name}-search-open.png`) });
    await p.fill("#searchInput", "xyzq"); await p.waitForTimeout(50);
    if (!/Kein Abschnitt/.test(await p.textContent("#searchHint"))) errors.push(`${name}: Suche ohne Treffer-Hinweis`);
    await p.fill("#searchInput", "kadenz"); await p.press("#searchInput", "Enter"); await p.waitForTimeout(1700);
    const at = await p.evaluate(() => ({ dlg: document.getElementById("searchDlg").open, tab: document.querySelector("#tabbar [aria-current=page]")?.dataset.tab, folded: document.getElementById("sec-cadence").classList.contains("folded"), top: Math.round(document.getElementById("sec-cadence").getBoundingClientRect().top), cad: window.__calls.includes("get_cadence_profile") }));
    if (at.dlg || at.tab !== "training" || at.folded || Math.abs(at.top) > 60 || !at.cad) errors.push(`${name}: Suche springt falsch ${JSON.stringify(at)}`);
    await p.screenshot({ path: join(out, `${name}-search.png`) });
    await p.click("#tabbar [data-tab=" + (tab ?? "heute") + "]").catch(() => {}); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
  }
  if (tab === "verlauf") {
    // Gewicht nachtragen (#30): eingefügte Zeilen werden erkannt und als entries gespeichert.
    await p.evaluate(() => { FC.goTo("body"); }); await p.waitForTimeout(400);
    await p.evaluate(() => { document.getElementById("bdPast").open = true; });
    await p.fill("#bdLines", "Datum;Gewicht\n2026-03-01 82,4\n02.03.2026;82,1");
    await p.click("#bdPastSave"); await p.waitForTimeout(300);
    const w = await p.evaluate(() => ({ in: window.__weightIn, msg: document.getElementById("bdPastMsg").textContent }));
    if (JSON.stringify(w.in?.entries) !== JSON.stringify([{ day: "2026-03-01", weightKg: 82.4 }, { day: "2026-03-02", weightKg: 82.1 }]) || !/2 Tage nachgetragen/.test(w.msg)) errors.push(`${name}: Gewicht nachtragen falsch ${JSON.stringify(w)}`);
  }
  if (name === "desktop-light") {
    // Reiter am PC (#322): Leiste oben, nur Abschnitte des offenen Reiters, nach Neuladen derselbe Reiter.
    const dt = await p.evaluate(() => ({ bar: getComputedStyle(document.getElementById("tabbar")).display, vis: [...document.querySelectorAll("#sections > section:not([hidden])")].filter((s) => s.offsetParent).map((s) => s.id) }));
    if (dt.bar === "none" || !dt.vis.includes("sec-today") || dt.vis.includes("sec-cadence") || dt.vis.includes("sec-settings")) errors.push(`${name}: Reiter am PC falsch ${JSON.stringify(dt)}`);
    await p.click("#tabbar [data-tab=training]"); await p.reload(); await p.waitForTimeout(800);
    const dt2 = await p.evaluate(() => ({ tab: document.querySelector("#tabbar [aria-current=page]")?.dataset.tab, today: !!document.getElementById("sec-today").offsetParent, cad: !!document.getElementById("sec-cadence").offsetParent }));
    if (dt2.tab !== "training" || dt2.today || !dt2.cad) errors.push(`${name}: Reiter nach Neuladen falsch ${JSON.stringify(dt2)}`);
    // Anordnung für alle Geräte (#67): Ausblenden speichert über update_settings; „nur dieses Gerät“ speichert nichts.
    await p.evaluate(() => FC.layout.setHidden("cadence", true)); await p.waitForTimeout(900);
    const up = await p.evaluate(() => window.__settingsIn?.dashboardLayout);
    if (!up?.hidden?.includes("cadence") || up.deskTabs !== true) errors.push(`${name}: Anordnung nicht für alle Geräte gespeichert ${JSON.stringify(up)}`);
    await p.evaluate(() => { window.__settingsIn = null; FC.layout.setMode("device"); FC.layout.setHidden("cadence", false); }); await p.waitForTimeout(900);
    if (await p.evaluate(() => window.__settingsIn)) errors.push(`${name}: „nur dieses Gerät“ speichert trotzdem im Worker`);
    // Alles untereinander (Schalter in „Dashboard anpassen“): dann alle Abschnitte wie bisher.
    await p.evaluate(() => { FC.layout.setMode("all"); FC.layout.setDeskTabs(false); window.scrollTo(0, 0); }); await p.waitForTimeout(1200);
    const all = await p.evaluate(() => ({ bar: getComputedStyle(document.getElementById("tabbar")).display, today: !!document.getElementById("sec-today").offsetParent, coach: !!document.getElementById("sec-coach").offsetParent }));
    if (all.bar !== "none" || !all.today || !all.coach) errors.push(`${name}: „alles untereinander“ falsch ${JSON.stringify(all)}`);
    const stuck = await p.evaluate(() => [...document.querySelectorAll("#sections > section:not([hidden])")].filter((s) => s.innerText.includes("Lädt …")).map((s) => s.id));
    if (stuck.length) errors.push(`${name}: noch „Lädt …“ in ${stuck.join(", ")}`);
    await p.click("[data-coach=explain]"); await p.waitForTimeout(300);
    await p.fill("#askInput", "Wie entwickelt sich meine Kniebeuge?"); await p.click("#askBtn"); await p.waitForTimeout(400);
    const tr = await p.evaluate(() => window.__toolResult);
    if (!(tr > 100)) errors.push(`${name}: Coach-Werkzeug krafttraining lieferte nichts (${tr})`);
    // Alle Chat-Werkzeuge (#185) liefern mit leerer Eingabe Daten.
    const [bad, cnt] = await p.evaluate(() => [window.__toolBad, window.__toolCount]);
    if (!bad || bad.length || cnt < 25) errors.push(`${name}: Coach-Werkzeuge fehlerhaft (${cnt}) ${JSON.stringify(bad)}`);
    // Fragen-Vorschlag antippen, dann neu laden: der Chat bleibt erhalten (#118).
    await p.click("#askChips .chip"); await p.waitForTimeout(300);
    await p.reload(); await p.waitForTimeout(800);
    const kept = await p.$$eval("#chat .q", (q) => q.length);
    if (kept !== 2) errors.push(`${name}: Coach-Chat nach Neuladen ${kept} statt 2 Fragen`);
  }
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (sw > 0) errors.push(`${name}: horizontal overflow ${sw}px`);
  if (axeSrc) {
    // Barrierefreiheit (#211): axe-core, WCAG 2 A/AA, in jeder Ansicht hell und dunkel.
    await p.addScriptTag({ content: axeSrc });
    const res = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] }))
      .violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary })) })));
    for (const v of res) for (const n of v.nodes) a11y.push({ view: name, ...v, nodes: undefined, ...n });
  }
  await p.screenshot({ path: join(out, `${name}.png`), fullPage: !tab });
  await ctx.close();
}
await browser.close();
writeFileSync(join(out, "a11y.json"), JSON.stringify(a11y, null, 1));
{
  // Je Regel und Element einmal melden (die Ansichten überschneiden sich).
  const seen = new Map();
  for (const v of a11y) { const k = `${v.id} ${v.target}`; if (!seen.has(k)) seen.set(k, v); }
  for (const v of seen.values()) if (["serious", "critical"].includes(v.impact)) errors.push(`Barrierefreiheit (${v.view}): ${v.id} – ${v.help} – ${v.target}`);
}
console.log(errors.length ? errors.join("\n") : "keine Fehler");
if (errors.length) process.exitCode = 1;
