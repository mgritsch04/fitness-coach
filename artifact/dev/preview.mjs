// Vorschau des Dashboards mit synthetischen Daten und einem nachgebauten window.claude.
//   node artifact/dev/preview.mjs [out-dir]   → schreibt preview.html und Screenshots (Playwright/Chromium)
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(process.argv[2] ?? join(here, "out"));
mkdirSync(out, { recursive: true });
const page = readFileSync(join(here, "..", "dashboard.html"), "utf8");
// Gym-Seite (#321) wird aus dashboard.html erzeugt und muss aktuell sein.
const { buildGym, GYM_SECTIONS } = await import("./build-gym.mjs");
const gymPage = buildGym(page);
const gymStale = readFileSync(join(here, "..", "gym.html"), "utf8") !== gymPage;
const mock = readFileSync(join(here, "mock-dashboard.json"), "utf8");
const shim = `<script>
window.__MOCK__ = ${mock};
// #331: genau ein Krafttraining ist mit der Einheit „s1“ (mit Sätzen) verknüpft.
{ const ws = window.__MOCK__.get_dashboard.workouts; for (const w of ws) delete w.strengthSessionId;
  if (ws[0]) ws[0].strengthSessionId = "s1"; }
// #370: Vorlage je Wochentag; heute (2026-03-31) ist Dienstag, Donnerstag verweist auf eine gelöschte Vorlage.
{ const t = window.__MOCK__.get_dashboard.training; if (t) t.prefs = { ...(t.prefs ?? {}), templateByDay: [null, "Beine & Brust", null, "Gelöscht", null, null, null] }; }
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
  get_workout_detail: (i) => { if (i?.sourceId === "nofit") return { found: false, message: "Für dieses Workout gibt es keine Sekundenwerte.", available: [] };
    const points = Array.from({ length: 120 }, (_, k) => ({ t: k * 30, power: k % 20 < 6 ? 260 : 150 + (k % 7) * 4, hr: 120 + Math.round(k / 3), cadence: 88 }));
    const z = (names, secs) => names.map((name, k) => ({ zone: k + 1, name, min: k * 50, max: k < names.length - 1 ? k * 50 + 49 : null, seconds: secs[k], sharePct: Math.round((secs[k] / secs.reduce((a, b) => a + b)) * 1000) / 10 }));
    return { found: true, workout: {}, ftpOrigin: "user", reference: { ftpW: 250, thresholdHr: 170 }, stats: { durationS: 3600, avgPowerW: 180, normalizedPowerW: 195, maxPowerW: 410, variabilityIndex: 1.08, intensityFactor: 0.78, tssEstimate: 61, workKj: 648, avgHr: 142, maxHr: 171, avgCadence: 88 },
      series: { stepS: 30, points }, zones: { power: z(["Aktive Erholung", "Ausdauer", "Tempo", "Schwelle", "VO2max"], [300, 1800, 900, 480, 120]), hr: z(["Z1", "Z2", "Z3"], [600, 2400, 600]) },
      intervals: { thresholdW: 220, basis: "ftp", intervals: [{ startS: 300, durationS: 180, avgPowerW: 262, pctFtp: 105, avgHr: 160, maxHr: 168, avgCadence: 90 }] }, decoupling: { pct: 3.2, firstHalf: 1.3, secondHalf: 1.26 }, powerCurve: {}, available: [], notes: [] }; },
  get_ride_weather: () => window.__MOCK__.get_ride_weather,
  set_weather_location: (i) => ({ location: { name: i.name, lat: 47.1, lon: 15.4 } }),
  log_weight: (i) => ((window.__weightIn = i), { saved: i.entries ? { count: i.entries.length, from: i.entries[0].day, to: i.entries.at(-1).day } : { day: window.__MOCK__.get_dashboard.today, weightKg: i.weightKg }, ...window.__MOCK__.get_body_history }),
  export_backup: () => ({ fileName: "fitness-sicherung-test.json", createdAt: "2026-03-31T10:00:00Z", counts: { daily: 2, journal: 1 }, tables: { daily: [{ day: "2026-03-30" }, { day: "2026-03-31" }], journal: [{ day: "2026-03-31" }] } }),
  export_csv: (i) => ({ fileName: "fitness-" + i.dataset + ".csv", rows: 2, csv: "day;value\\n2026-03-30;1\\n2026-03-31;2\\n" }),
  sync_now: () => ({ whoop: { ok: true, result: { days: 3, sleeps: 3, workouts: 4 } }, wahoo: { ok: false, error: "wahoo_not_configured", message: "übersprungen" } }),
  wahoo_status: () => ({ configured: false, connected: false }),
  update_settings: (i) => ((window.__settingsIn = i), i),
  get_strength: () => { const t = window.__MOCK__.get_dashboard.today, d = (n) => { const x = new Date(t + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }; const wk = d(-((new Date(t + "T12:00:00Z").getUTCDay() + 6) % 7));
    const sq = [{ exercise: "squat", exerciseName: "Kniebeuge", reps: 5, weightKg: 100 }, { exercise: "squat", exerciseName: "Kniebeuge", reps: 5, weightKg: 100 }, { exercise: "bench_press", exerciseName: "Bankdrücken", reps: 8, weightKg: 72.5 }];
    return { today: t, range: { from: d(-83), to: t },
      sessions: [{ id: "s2", day: t, name: "Beine & Brust", durationMin: 60, rpe: 8, load: 70, sets: sq }, { id: "s1", day: d(-4), name: null, durationMin: 45, rpe: 6.5, load: 38, sets: sq.slice(2) }, { id: "s0", day: d(-40), name: "Zug", durationMin: 50, rpe: 7, load: 40, sets: [{ exercise: "lat_pulldown", exerciseName: "Latziehen", reps: 10, weightKg: 55 }, { exercise: "lat_pulldown", exerciseName: "Latziehen", reps: 8, weightKg: 60, rpe: 8 }] }],
      weeks: [{ week: wk, sessions: 2, sets: 4, tonnageKg: 2740, muscles: [{ muscle: "quads", label: "Oberschenkel vorne", sets: 2, tonnageKg: 1000 }, { muscle: "chest", label: "Brust", sets: 2, tonnageKg: 1160 }, { muscle: "glutes", label: "Gesäß", sets: 1, tonnageKg: 0 }, { muscle: "triceps", label: "Trizeps", sets: 1, tonnageKg: 0 }] }],
      progress: [{ exercise: "squat", name: "Kniebeuge", sessions: 3, history: [[-20, 95], [-10, 97.5], [0, 100]].map(([o, w]) => ({ day: d(o), e1rmKg: Math.round(w * (1 + 5 / 30) * 10) / 10, topSet: { reps: 5, weightKg: w }, sets: 3 })), bestE1rmKg: 116.7, bestDay: t, change4wPct: 2.6, status: "progress", forecast: { available: true, reason: null, weeks: 8, currentKg: 116.7, perWeekKg: 1.2, points: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ day: d(7 * k), e1rmKg: Math.round((116.7 + 1.2 * k) * 10) / 10 })), targetKg: 126.3, target: { reps: 5, weightKg: 107.5 }, text: "Bei gleichem Tempo in 8 Wochen etwa 126,3 kg geschätztes Maximum (jetzt ≈ 116,7 kg), das wären 5 × 107,5 kg. Schätzung aus dem Trend der letzten 12 Wochen." } },
        { exercise: "bench_press", name: "Bankdrücken", sessions: 2, history: [[-4, 72.5], [0, 72.5]].map(([o, w]) => ({ day: d(o), e1rmKg: 91.8, topSet: { reps: 8, weightKg: w }, sets: 1 })), bestE1rmKg: 91.8, bestDay: d(-4), change4wPct: 0, status: "plateau", forecast: { available: false, reason: "Zu wenig Daten für eine Prognose (mindestens 3 Einheiten über 2 Wochen in den letzten 12 Wochen).", weeks: 8, currentKg: null, perWeekKg: null, points: [], targetKg: null, target: null, text: "Zu wenig Daten für eine Prognose (mindestens 3 Einheiten über 2 Wochen in den letzten 12 Wochen)." } }],
      repRecords: [{ exercise: "bench_press", name: "Bankdrücken", marks: [{ kg: 72.5, reps: 8, day: d(-4) }] }, { exercise: "dumbbell_bench_press", name: "Kurzhantel-Bankdrücken", marks: [{ kg: 32, reps: 6, day: d(-11) }, { kg: 28, reps: 8, day: d(-11) }] }],
      standards: { available: true, weightKg: 75, note: "Grobe Richtwerte für trainierte Erwachsene, keine Norm.", text: "", exercises: [{ exercise: "back_squat", name: "Kniebeuge", e1rmKg: 116.7, perKg: 1.56, level: "Stark", next: { level: "Sehr stark", e1rmKg: 150 }, day: t }, { exercise: "bench_press", name: "Bankdrücken", e1rmKg: 91.8, perKg: 1.22, level: "Stark", next: { level: "Sehr stark", e1rmKg: 113 }, day: d(-4) }] },
      templates: [{ name: "Beine & Brust", exercises: [{ exercise: "squat", name: "Kniebeuge", sets: 3, reps: 5, weightKg: 100 }] }],
      coachNotes: [{ effect: "down", text: "Schwere Beineinheit heute: morgen eher locker radeln, keine Intervalle." }],
      note: "1RM und Belastung sind Schätzungen." }; },
  suggest_strength_session: (i) => ({ template: i.template, exercises: [{ exercise: "squat", name: "Kniebeuge", sets: 3, reps: 5, weightKg: 105, basis: "increase", lastDay: null, lastSets: [{ reps: 6, weightKg: 100 }, { reps: 5, weightKg: 102.5 }] }], coachNotes: [] }),
  log_strength_session: (i) => { window.__gymSaved = i; return { id: "s3", exercises: [], load: { value: 52 } }; },
  delete_strength_session: (i) => { window.__deleted = i.id; return { deleted: i.id }; },
  save_strength_template: (i) => { window.__tplSaved = i; return i; },
  get_exercises: () => ({ exercises: [
    { exercise: "bizeps schwarze", name: "Bizeps schwarze", sessions: 2, sets: 5, lastDay: "2026-03-08", bestE1rmKg: 26.7, hidden: false, mergedFrom: [], muscles: { primary: ["biceps"], secondary: [], source: "auto" },
      last: { day: "2026-03-08", sets: [{ reps: 10, weightKg: 20 }] }, history: [{ day: "2026-03-08", sets: [{ reps: 10, weightKg: 20 }] }, { day: "2026-03-01", sets: [{ reps: 10, weightKg: 15 }, { reps: 8, weightKg: 17.5 }] }] },
    { exercise: "bizeps curls", name: "Bizeps curls", sessions: 1, sets: 3, lastDay: "2026-03-02", bestE1rmKg: 22, hidden: false, mergedFrom: [], muscles: { primary: ["biceps"], secondary: [], source: "auto" },
      last: { day: "2026-03-02", sets: [{ reps: 10, weightKg: 15 }, { reps: 8, weightKg: 17.5 }, { reps: 8, weightKg: 17.5 }] }, history: [{ day: "2026-03-02", sets: [{ reps: 10, weightKg: 15 }, { reps: 8, weightKg: 17.5 }, { reps: 8, weightKg: 17.5 }] }] },
    { exercise: "einarmrudern", name: "Einarmrudern", sessions: 1, sets: 4, lastDay: "2026-03-03", bestE1rmKg: 32, hidden: false, unilateral: true, mergedFrom: [], muscles: { primary: ["back"], secondary: ["biceps"], source: "auto" },
      last: { day: "2026-03-03", sets: [{ reps: 10, weightKg: 24, side: "L" }, { reps: 9, weightKg: 24, side: "R" }] }, history: [{ day: "2026-03-03", sets: [{ reps: 10, weightKg: 24, side: "L" }, { reps: 9, weightKg: 24, side: "R" }] }] },
    { exercise: "xyz", name: "Maschine X", sessions: 0, sets: 0, lastDay: null, bestE1rmKg: null, hidden: false, mergedFrom: [], muscles: { primary: ["other"], secondary: [], source: "unknown" }, last: null, history: [] },
    { exercise: "alt", name: "Alte Übung", sessions: 1, sets: 1, lastDay: "2026-01-01", bestE1rmKg: null, hidden: true, mergedFrom: [], muscles: { primary: ["core"], secondary: [], source: "auto" }, last: null, history: [] }],
    duplicates: [{ reason: "Alle enthalten „bizeps“", exercises: [{ exercise: "bizeps schwarze", name: "Bizeps schwarze" }, { exercise: "bizeps curls", name: "Bizeps curls" }] }], note: "" }),
  manage_exercise: (i) => { (window.__exActs ??= []).push(i); return { saved: i.action }; },
  save_gym_draft: () => ({ saved: true }),
  get_gym_draft: () => ({ draft: null, updatedAt: null }),
  set_training_prefs: (i) => { window.__prefsSaved = i; return i; },
  set_day_time: (i) => { window.__dayTime = i; return window.__MOCK__.get_dashboard.training.thisWeek; },
  describe_exercise: (i) => (/reifen/i.test(i.text) ? { query: i.text, suggestions: [], custom: { name: "Reifen umwerfen" }, note: "Keine passende Übung im Katalog gefunden. Du kannst sie als eigene Übung anlegen." } : { query: i.text, suggestions: [{ exercise: "lat_pulldown", name: "Latziehen", muscles: ["Rücken", "Bizeps"], match: 100, why: ["kabel"] }, { exercise: "cable_row", name: "Rudern am Kabel", muscles: ["Rücken", "Bizeps"], match: 60, why: ["kabel"] }], custom: { name: "Am Kabel ziehen" }, note: "Vorschläge aus dem Übungskatalog." }),
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
const sample = async (input, o = {}) => { if (window.__failSample) { const code = window.__failSample; window.__failSample = null; throw { code, message: "Testfehler" }; } if (o.tools && window.__failTools) { window.__failTools = false; throw { code: "tools_unavailable", message: "Testfehler" }; } if (o.tools) { const t = o.tools.find((x) => x.name === "krafttraining"); window.__toolResult = t ? String(await t.execute({ wochen: 4 }, { signal: new AbortController().signal })).length : -1; if (!window.__toolBad) { window.__toolBad = []; for (const x of o.tools) { try { if (String(await x.execute({}, { signal: new AbortController().signal })).length < 20) window.__toolBad.push(x.name + ": leer"); } catch (e) { window.__toolBad.push(x.name + ": " + e.message); } } window.__toolCount = o.tools.length; } } const text = "**Heute normales Training.** Deine Erholung ist gelb und die HRV liegt im Normalbereich.\\n- 45–60 min Grundlage auf dem Rad\\n- danach 10 min Mobility"; o.onText?.({ text, delta: text }); return { text, truncated: false }; };
sample.limits = async () => ({ tools: {} });
sample.json = async () => ({ hinweis: "Beispielplan.", tage: ["Rad locker (Zone 2) mit Kadenzübungen", "Kraft Beine und Rumpf", "Ruhetag mit Mobility", "Rad Schwelle 3×10 min", "Kraft Oberkörper", "Rad lang und ruhig", "Ruhetag"].map((einheit, i) => ({ tag: new Date(Date.UTC(2026, 2, 31 + i)).toISOString().slice(0, 10), einheit, dauerMin: 60 + i * 5, intensitaet: i % 3 === 2 ? "Ruhe" : "locker", belastung: 45 + i * 7, ziel: "Grundlage aufbauen und gut erholen" })) });
const downloads = { async save(f) { const b = f.data instanceof Blob ? f.data : new Blob([f.data]); const u = new Uint8Array(await b.arrayBuffer()); window.__saved = { filename: f.filename, text: await b.text(), size: u.length, b64: u.length < 3e6 ? btoa(Array.from(u, (x) => String.fromCharCode(x)).join("")) : "" }; } };
window.claude = { use: async (n) => (n === "mcp" ? mcp : n === "sample" ? sample : n === "downloads" ? downloads : null) };
</script>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${shim}${page}</body></html>`;
writeFileSync(join(out, "preview.html"), html);
writeFileSync(join(out, "preview-gym.html"), html.replace(page, gymPage));
for (const d of ["app", "sections"]) cpSync(join(here, "..", d), join(out, d), { recursive: true });
// Nur die Seite bauen (für die automatischen User-Tests, scripts/usertest/run.mjs), ohne Browser.
if (process.argv.includes("--build-only")) process.exit(0);

const pw = await import("playwright").catch(() => import("/opt/node22/lib/node_modules/playwright/index.js"));
const chromium = pw.chromium ?? pw.default.chromium;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const errors = [];
if (gymStale) errors.push("artifact/gym.html ist veraltet: node artifact/dev/build-gym.mjs ausführen (#321)");
// axe-core ist eine Dev-Abhängigkeit nur für die Vorschau (in der CI per npm install --no-save).
const axeSrc = await import("node:module").then(({ createRequire }) => readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8")).catch(() => null);
if (!axeSrc && process.env.CI) errors.push("axe-core fehlt in der CI (#211)");
if (!axeSrc) console.warn("axe-core nicht installiert: Barrierefreiheit wird nicht geprüft (npm install --no-save axe-core@4.10.3).");
const a11y = [];
// Jede Abschnittsdatei muss in dashboard.html eingetragen sein (sonst fehlt sie nach dem Veröffentlichen).
for (const f of readdirSync(join(here, "..", "sections"))) if (f.endsWith(".js") && !page.includes(`src="sections/${f}"`)) errors.push(`sections/${f} fehlt in dashboard.html`);
const shots = [["desktop-light", { width: 1280, height: 900 }, "light"], ["desktop-dark", { width: 1280, height: 900 }, "dark"],
  ...["heute", "coach", "verlauf", "training", "mehr"].map((t) => [`phone-${t}`, { width: 390, height: 844 }, t === "verlauf" ? "dark" : "light", t]),
  ["phone-gympage", { width: 390, height: 844 }, "light", null, "preview-gym.html"], ["desktop-gympage", { width: 1280, height: 900 }, "dark", null, "preview-gym.html"]];
for (const [name, vp, scheme, tab, file] of shots) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, hasTouch: name.startsWith("phone") });
  // Die bestehenden Ansichten prüfen den vollen Umfang; die einfache Ansicht (Standard) wird unten eigens geprüft.
  await ctx.addInitScript(() => { try { if (!localStorage.getItem("fc-layout")) localStorage.setItem("fc-layout", JSON.stringify({ simple: false })); } catch {} });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  await p.goto("file://" + join(out, file ?? "preview.html"));
  await p.waitForTimeout(800);
  if (tab) { await p.click(`#tabbar [data-tab=${tab}]`); await p.waitForTimeout(300); }
  if (tab === "training") {
    // Einklappen (#188): am Handy nur die ersten zwei offen, eingeklappte laden nichts; Aufklappen lädt und bleibt gemerkt.
    const f = await p.evaluate(() => ({ folded: document.querySelectorAll("#sections > section.on.folded").length, open: [...document.querySelectorAll("#sections > section.on.foldable:not(.folded)")].map((x) => x.id), h: document.documentElement.scrollHeight, cad: window.__calls.includes("get_cadence_profile") }));
    if (f.folded < 10 || f.open.length !== 2 || f.h > 6000 || f.cad) errors.push(`${name}: Einklappen falsch ${JSON.stringify(f)}`);
    await p.click("#sec-cadence > .fold-bar"); await p.waitForTimeout(300);
    const g = await p.evaluate(() => ({ open: !document.getElementById("sec-cadence").classList.contains("folded"), cad: window.__calls.includes("get_cadence_profile"), text: document.getElementById("sec-cadence").innerText.length }));
    if (!g.open || !g.cad || g.text < 100) errors.push(`${name}: Aufklappen lädt nicht ${JSON.stringify(g)}`);
    await p.reload(); await p.waitForSelector("body.has-data"); await p.waitForTimeout(800); await p.click("#tabbar [data-tab=training]"); await p.waitForTimeout(300);
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
    await p.fill("#woSearch", "radfahren"); await p.reload(); await p.waitForSelector("body.has-data"); await p.waitForTimeout(800); await p.click("#tabbar [data-tab=training]"); await p.waitForTimeout(300);
    const w3 = await p.evaluate(() => ({ q: document.getElementById("woSearch").value, src: document.getElementById("woSource").value, kind: document.querySelector("#woKind [aria-pressed=true]")?.dataset.k }));
    if (w3.q !== "radfahren" || w3.src !== "mywhoosh" || w3.kind !== "bike") errors.push(`${name}: Filter nicht gemerkt ${JSON.stringify(w3)}`);
    await p.locator("#sec-workouts").scrollIntoViewIfNeeded(); await p.evaluate(() => document.getElementById("sec-workouts").scrollIntoView()); await p.waitForTimeout(200);
    await p.screenshot({ path: join(out, "phone-workout-filter.png") });
    await p.click("#btnResetWorkouts"); await p.waitForTimeout(150);
    if ((await wo()).rows.length !== 25) errors.push(`${name}: Zurücksetzen zeigt nicht wieder alle`);
    // Workout-Detail (#334): Rad mit FIT (Verlauf, Zonen, Intervalle), Kraft mit Übungen, ohne Übungen, Rad ohne FIT.
    const wdText = () => p.evaluate(() => ({ open: document.getElementById("woDetail").open, text: document.getElementById("wdBody").innerText, svg: document.querySelectorAll("#wdBody .wd-chart svg").length, zones: document.querySelectorAll("#wdBody .wd-zone").length, rows: document.querySelectorAll("#wdBody .wd-tbl tbody tr").length, over: document.documentElement.scrollWidth > innerWidth || document.getElementById("woDetail").scrollWidth > document.getElementById("woDetail").clientWidth + 1 }));
    await p.click("#woKind [data-k=bike]"); await p.waitForTimeout(150);
    await p.locator("#tWorkouts tbody tr:not(.rpe-row) td:nth-child(2) button.link").first().click(); await p.waitForSelector("#wdBody .wd-chart", { timeout: 3000 }).catch(() => {});
    const d1 = await wdText();
    if (!d1.open || d1.svg !== 1 || d1.zones < 8 || d1.rows !== 1 || !/Entkopplung/.test(d1.text) || d1.over) errors.push(`${name}: Rad-Detail falsch ${JSON.stringify({ ...d1, text: d1.text.slice(0, 120) })}`);
    await p.screenshot({ path: join(out, "phone-workout-detail-bike.png") });
    await p.keyboard.press("Escape"); await p.waitForTimeout(100);
    if (await p.evaluate(() => document.getElementById("woDetail").open)) errors.push(`${name}: Workout-Detail schließt nicht mit Escape`);
    const open = (w) => p.evaluate((w) => FC.state.openWorkout(w), w);
    const base = await p.evaluate(() => ({ ...FC.state.data.workouts[0] }));
    await open({ ...base, sport: "weightlifting", strengthSessionId: "s1" }); await p.waitForTimeout(300);
    const d2 = await wdText();
    if (!/Bankdrücken/.test(d2.text) || !/8 × 72,5 kg/.test(d2.text) || d2.over) errors.push(`${name}: Kraft-Detail falsch ${JSON.stringify(d2.text.slice(0, 200))}`);
    await p.screenshot({ path: join(out, "phone-workout-detail-strength.png") });
    await open({ ...base, sport: "weightlifting", strengthSessionId: null }); await p.waitForTimeout(200);
    if (!/keine Übungen eingetragen/.test((await wdText()).text)) errors.push(`${name}: Kraft ohne Übungen ohne Hinweis`);
    await open({ ...base, sport: "cycling", strengthSessionId: null, sourceId: "nofit" }); await p.waitForTimeout(200);
    const d4 = await wdText();
    if (!/keine Sekundenwerte/.test(d4.text) || d4.svg) errors.push(`${name}: Rad ohne FIT ohne Hinweis ${JSON.stringify(d4.text.slice(0, 200))}`);
    await open({ ...base, sport: "running", strengthSessionId: null }); await p.waitForTimeout(100);
    if (!/Dauer/.test((await wdText()).text)) errors.push(`${name}: Basisdaten fehlen`);
    await p.keyboard.press("Escape"); await p.click("#btnResetWorkouts").catch(() => {}); await p.waitForTimeout(100);
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
    // Feste Krafttage (#323): zwei Tage wählen und speichern.
    await p.evaluate(() => { document.getElementById("fixBox").open = true; });
    await p.selectOption("#fixDays select[data-day='0']", "Beine"); await p.selectOption("#fixDays select[data-day='3']", "Oberkörper");
    await p.click("#fixSave"); await p.waitForTimeout(200);
    const fx = await p.evaluate(() => ({ saved: window.__prefsSaved, msg: document.getElementById("fixMsg").textContent }));
    if (JSON.stringify(fx.saved?.fixedStrength) !== JSON.stringify([{ day: 0, focus: "Beine" }, { day: 3, focus: "Oberkörper" }]) || !/2 feste Krafttage/.test(fx.msg)) errors.push(`${name}: Feste Krafttage falsch ${JSON.stringify(fx)}`);
    // Workout zur Radeinheit (#337): Tag antippen zeigt Profil und Sprung zum MyWhoosh-Abschnitt.
    const rb = await p.evaluate(async () => {
      const wo = window.__MOCK__.get_dashboard.training.rideWorkouts?.days ?? [];
      if (!wo.length) return { n: 0 };
      const day = wo[0].day, labels = [...document.querySelectorAll("#wplan .pd")];
      const idx = window.__MOCK__.get_dashboard.training.thisWeek.plan.days.findIndex((x) => x.day === day);
      labels[idx].click();
      return { n: wo.length, txt: document.getElementById("planDetail").textContent, btn: !!document.querySelector("#planDetail button"), name: wo[0].name };
    });
    if (!rb.n || !rb.btn || !rb.txt.includes("Workout für MyWhoosh") || !rb.txt.includes(rb.name)) errors.push(`${name}: Workout in der Plan-Karte fehlt ${JSON.stringify(rb)}`);
    // Kraft-Vorlage je Wochentag (#370): Dienstag vorbelegt, gelöschte Vorlage (Donnerstag) zeigt „keine“; Montag wählen und speichern.
    await p.evaluate(() => { document.getElementById("tplBox").open = true; });
    await p.waitForSelector("#tplDays select[data-day='0']");
    const tpl0 = await p.evaluate(() => ({ di: document.querySelector("#tplDays select[data-day='1']").value, dl: document.querySelector("#tplDays select[data-day='3']").value }));
    if (tpl0.di !== "Beine & Brust" || tpl0.dl !== "") errors.push(`${name}: Vorlage je Wochentag falsch angezeigt ${JSON.stringify(tpl0)}`);
    await p.selectOption("#tplDays select[data-day='0']", "Beine & Brust");
    await p.click("#tplSave"); await p.waitForTimeout(200);
    const tp = await p.evaluate(() => ({ saved: window.__prefsSaved, msg: document.getElementById("tplMsg").textContent }));
    if (JSON.stringify(tp.saved?.templateByDay) !== JSON.stringify(["Beine & Brust", "Beine & Brust", null, null, null, null, null]) || !/2 Tage/.test(tp.msg)) errors.push(`${name}: Vorlage je Wochentag speichern falsch ${JSON.stringify(tp)}`);
    // Rad und Kraft getrennt je Tag (#399): Montag Kraft UND Rad, Mittwoch nur Rad; alles bleibt lesbar.
    await p.fill("#tplDays input[data-ride='0']", "Z2"); await p.fill("#tplDays input[data-ride='2']", "Intervalle 4x8");
    await p.click("#tplSave"); await p.waitForTimeout(200);
    const tr2 = await p.evaluate(() => window.__prefsSaved);
    if (JSON.stringify(tr2?.templateByDay) !== JSON.stringify(["Beine & Brust", "Beine & Brust", null, null, null, null, null]) || JSON.stringify(tr2?.rideByDay) !== JSON.stringify(["Z2", null, "Intervalle 4x8", null, null, null, null])) errors.push(`${name}: Rad und Kraft getrennt speichern falsch ${JSON.stringify(tr2)}`);
    // Radzeit je Wochentag (#336): Montag 0 min, Freitag 120 min, Dienstag locker; dazu „Heute nur 45 min“.
    await p.evaluate(() => { document.getElementById("timeBox").open = true; });
    await p.fill("#dayTimes input[data-day='0']", "0"); await p.fill("#dayTimes input[data-day='4']", "120"); await p.check("#dayTimes input[data-easy='1']");
    await p.click("#timeSave"); await p.waitForTimeout(200);
    const tm = await p.evaluate(() => ({ saved: window.__prefsSaved, msg: document.getElementById("timeMsg").textContent }));
    if (JSON.stringify(tm.saved?.dayMinutes) !== JSON.stringify([0, null, null, null, 120, null, null]) || JSON.stringify(tm.saved?.easyDays) !== "[1]" || !/Gespeichert/.test(tm.msg)) errors.push(`${name}: Zeiten je Wochentag falsch ${JSON.stringify(tm)}`);
    await p.fill("#quickMin", "45"); await p.click("#quickSet"); await p.waitForTimeout(200);
    const qt = await p.evaluate(() => ({ called: window.__dayTime, msg: document.getElementById("quickMsg").textContent }));
    if (qt.called?.minutes !== 45 || !/45 min/.test(qt.msg)) errors.push(`${name}: Heute nur X min falsch ${JSON.stringify(qt)}`);
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
  if (file) {
    // Gym-Seite (#321): nur Gym-Modus und Krafttraining, keine Reiter, beide Abschnitte geladen.
    const g = await p.evaluate(() => ({ ids: [...document.querySelectorAll("#sections > section")].map((s) => s.id), vis: [...document.querySelectorAll("#sections > section")].filter((s) => s.offsetParent).length, bar: !!document.getElementById("tabbar"), title: document.title, calls: window.__calls ?? [] }));
    if ([...g.ids].sort().join() !== GYM_SECTIONS.map((s) => `sec-${s}`).sort().join()) errors.push(`${name}: falsche Abschnitte ${JSON.stringify(g.ids)}`);
    // Vorlage je Wochentag (#370): heute (Dienstag) ist „Beine & Brust“ vorausgewählt und lässt sich ändern.
    await p.waitForSelector("#gySrc");
    const gs = await p.evaluate(() => ({ v: document.getElementById("gySrc").value, hint: document.getElementById("gyTplHint")?.textContent ?? "" }));
    if (gs.v !== "t:Beine & Brust" || !/Beine & Brust/.test(gs.hint)) errors.push(`${name}: Gym schlägt die Wochentags-Vorlage nicht vor ${JSON.stringify(gs)}`);
    await p.selectOption("#gySrc", ""); if ((await p.evaluate(() => document.getElementById("gySrc").value)) !== "") errors.push(`${name}: Gym-Vorschlag lässt sich nicht ändern`);
    if (g.vis !== GYM_SECTIONS.length || g.bar || g.title !== "Gym Tracker" || !g.calls.includes("get_strength")) errors.push(`${name}: Gym-Seite falsch ${JSON.stringify({ ...g, calls: undefined, strength: g.calls.includes("get_strength") })}`);
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
    // Kachel antippen zeigt den Verlauf (Diagramm), nochmal antippen schließt ihn.
    await p.click("#tiles .tile.tl").catch(() => errors.push(`${name}: Kachel nicht anklickbar`)); await p.waitForTimeout(250);
    const tl = await p.evaluate(() => ({ open: !!document.querySelector("#tiles .tile.open svg"), n: document.querySelectorAll("#tiles .tile.tl").length }));
    if (!tl.open || tl.n !== 6) errors.push(`${name}: Kachel-Verlauf falsch ${JSON.stringify(tl)}`);
    await p.click("#tiles .tile.open button[data-n='180']").catch(() => errors.push(`${name}: Zeitraum-Knopf fehlt`)); await p.waitForTimeout(200);
    if (!(await p.$("#tiles .tile.open svg"))) errors.push(`${name}: Kachel klappt beim Zeitraumwechsel zu`);
    for (const n of [365, 3650]) {
      await p.click(`#tiles .tile.open button[data-n='${n}']`).catch(() => errors.push(`${name}: Zeitraum ${n} fehlt`)); await p.waitForTimeout(400);
      if (!(await p.$("#tiles .tile.open svg"))) errors.push(`${name}: Kachel-Verlauf ${n} ohne Diagramm`);
    }
    await (await p.$("#tiles .tile.open"))?.screenshot({ path: join(out, `${name}-kachel.png`) });
    await p.click("#tiles .tile.open .label").catch(() => {}); await p.waitForTimeout(150);
    if (await p.$("#tiles .tile.open")) errors.push(`${name}: Kachel-Verlauf schließt nicht`);
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
      await p.click("#wnSeen"); await p.reload(); await p.waitForSelector("body.has-data"); await p.waitForTimeout(800);
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
      await p.click("#jump button:text-is('Trittfrequenz')"); await p.waitForTimeout(1800);
      const top = await p.evaluate(() => document.getElementById("sec-cadence").getBoundingClientRect().top);
      if (Math.abs(top) > 40) errors.push(`${name}: Sprungleiste springt nicht (top ${top})`);
      await p.evaluate(() => window.scrollTo(0, 0));
    }
    // Gym-Modus: aus der letzten Einheit starten, ersten Satz abhaken, beenden und speichern.
    // Heute ist die Vorlage je Wochentag (#370) vorausgewählt; die Planeinheit bleibt wählbar.
    const plan = await p.$eval("#gySrc", (s) => s.value);
    if (plan !== "t:Beine & Brust" || (await p.$("#gySrc option[value^='p:']")) || (await p.$("#gyWeek"))) errors.push(`${name}: Gym-Modus bietet Wochentags-Vorlage nicht an oder zeigt Wochenplan (${plan})`);
    await p.selectOption("#gySrc", "s:s2"); await p.click("#gyBody button.primary"); await p.waitForTimeout(200);
    if (!(await p.$("#gyBody .gy-last"))) errors.push(`${name}: Gym-Modus zeigt „Letztes Mal“ nicht`);
    // Verlauf und Prognose im Gym-Modus (#328)
    await p.click("#gyBody .gy-last button").catch(() => errors.push(`${name}: Gym-Modus ohne „Verlauf“`)); await p.waitForTimeout(200);
    const gh = await p.evaluate(() => ({ svg: !!document.querySelector("#gyBody .st-chart svg"), t: document.querySelector("#gyBody .st-detailbox .chart-cap")?.textContent ?? "" }));
    if (!gh.svg || !/in 8 Wochen/.test(gh.t)) errors.push(`${name}: Gym-Verlauf falsch ${JSON.stringify(gh)}`);
    await p.click("#gyBody .gy-last button"); await p.waitForTimeout(100);
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
    // Dauer seit letztem Satz (#107)
    const since = await p.evaluate(() => ({ on: !document.getElementById("gySince")?.hidden, t: document.getElementById("gySinceT")?.textContent ?? "" }));
    if (!since.on || !/^0:0\d$/.test(since.t)) errors.push(`${name}: „seit letztem Satz“ fehlt ${JSON.stringify(since)}`);
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
    // Als Vorlage speichern (#319)
    if (!(await p.$("#gyTplName"))) errors.push(`${name}: nach dem Speichern fehlt „Als Vorlage speichern“`);
    else {
      await p.fill("#gyTplName", "Beine Test"); await p.click("#gyBody .panel .primary"); await p.waitForTimeout(200);
      const tpl = await p.evaluate(() => ({ t: window.__tplSaved, opt: [...document.querySelectorAll("#gySrc option")].some((o) => o.value === "t:Beine Test") }));
      if (!(tpl.t?.name === "Beine Test" && tpl.t.exercises?.[0]?.sets === 1 && tpl.opt)) errors.push(`${name}: Vorlage aus Einheit falsch ${JSON.stringify(tpl)}`);
    }
    // Vorlage wie letztes Mal, eigene Übung wählen, Vorlage aktualisieren (#399)
    await p.selectOption("#gySrc", "t:Beine & Brust"); await p.click("#gyBody .gy-start button.primary"); await p.waitForTimeout(300);
    const lm = await p.$$eval("#gyBody .gy-ex:first-of-type .gy-set", (l) => l.map((r) => [...r.querySelectorAll("input")].map((i) => i.value).join("/")));
    if (JSON.stringify(lm) !== JSON.stringify(["6/100", "5/102.5"])) errors.push(`${name}: Vorlage nimmt nicht die Sätze vom letzten Mal ${JSON.stringify(lm)}`);
    await p.click("#gyBody .gy-ex:first-of-type .gy-swap"); await p.waitForSelector("#gyBody .gy-swapbox input[list=gyEx]", { timeout: 2000 }).catch(() => errors.push(`${name}: Tauschen ohne Auswahl eigener Übungen`));
    await p.fill("#gyBody .gy-swapbox input[list=gyEx]", "Bizeps curls"); await p.click("#gyBody .gy-swapbox input[list=gyEx] + button"); await p.waitForTimeout(150);
    const sw2 = await p.evaluate(() => ({ h: document.querySelector("#gyBody .gy-ex h3")?.textContent, kg: [...document.querySelectorAll("#gyBody .gy-ex:first-of-type .gy-set input")].map((i) => i.value).join(",") }));
    if (sw2.h !== "Bizeps curls" || sw2.kg !== "10,15,8,17.5,8,17.5") errors.push(`${name}: eigene Übung tauschen falsch ${JSON.stringify(sw2)}`);
    await p.click("#gyBody .gy-ex:first-of-type .gy-set .ok"); await p.click("#gyBody .gy-row .primary"); await p.click("#gyFinish .gy-rpe button:nth-child(6)"); await p.click("#gyFinish .primary"); await p.waitForTimeout(300);
    if (!(await p.$("#gyTplUpdate"))) errors.push(`${name}: keine Frage „Vorlage aktualisieren?“`);
    else {
      await p.click("#gyTplUpdate .primary"); await p.waitForTimeout(200);
      const up = await p.evaluate(() => window.__tplSaved);
      if (!(up?.name === "Beine & Brust" && up.exercises?.[0]?.exercise === "Bizeps curls" && !(await p.$("#gyTplUpdate")))) errors.push(`${name}: Vorlage aktualisieren falsch ${JSON.stringify(up)}`);
    }
    await p.click("#gyBody .linkish:text('Nein danke')").catch(() => errors.push(`${name}: „Nein danke“ fehlt`)); await p.waitForTimeout(100);
    // Einseitige Übung (#399): links und rechts getrennt, Pause nur nach rechts, Seiten werden gespeichert
    await p.selectOption("#gySrc", ""); await p.click("#gyBody .gy-start button.primary"); await p.waitForTimeout(200);
    await p.fill("#gyBody .gy-ex input[list=gyEx]", "Einarmrudern"); await p.press("#gyBody .gy-ex input[list=gyEx]", "Tab"); await p.waitForTimeout(200);
    const uni = await p.evaluate(() => ({ n: [...document.querySelectorAll("#gyBody .gy-ex:first-of-type .gy-set .n")].map((x) => x.textContent), v: [...document.querySelectorAll("#gyBody .gy-ex:first-of-type .gy-set")].map((r) => [...r.querySelectorAll("input")].map((i) => i.value).join("/")) }));
    if (JSON.stringify(uni.n) !== JSON.stringify(["1 L", "1 R"]) || JSON.stringify(uni.v) !== JSON.stringify(["10/24", "9/24"])) errors.push(`${name}: einseitige Übung falsch ${JSON.stringify(uni)}`);
    await p.evaluate(() => document.querySelectorAll("#gyBody .gy-ex:first-of-type .gy-set .ok")[0].click()); await p.waitForTimeout(100);
    const restL = await p.evaluate(() => !document.getElementById("gyRest").hidden);
    await p.evaluate(() => document.querySelectorAll("#gyBody .gy-ex:first-of-type .gy-set .ok")[1].click()); await p.waitForTimeout(100);
    const restR = await p.evaluate(() => !document.getElementById("gyRest").hidden);
    if (restL || !restR) errors.push(`${name}: Pause nach links ${restL} / nach rechts ${restR}`);
    await p.click("#gyBody .gy-row .primary"); await p.click("#gyFinish .gy-rpe button:nth-child(6)"); await p.click("#gyFinish .primary"); await p.waitForTimeout(300);
    const us = await p.evaluate(() => window.__gymSaved?.exercises?.[0]?.sets?.map((x) => x.side));
    if (JSON.stringify(us) !== JSON.stringify(["L", "R"])) errors.push(`${name}: Seiten nicht gespeichert ${JSON.stringify(us)}`);
    await p.click("#gyBody .linkish:text('Nein danke')").catch(() => {}); await p.waitForTimeout(100);
    // Krafttraining-Abschnitt: Verlauf und Prognose (#328), Einheit als Vorlage (#319)
    await p.click("#stProg tbody tr:first-child button").catch(() => errors.push(`${name}: Übung im Krafttraining nicht antippbar`)); await p.waitForTimeout(200);
    const sp = await p.evaluate(() => ({ svg: !!document.querySelector("#stProg .st-detail svg"), t: document.querySelector("#stProg .st-detail .chart-cap")?.textContent ?? "" }));
    if (!sp.svg || !/Schätzung/.test(sp.t)) errors.push(`${name}: Übungsverlauf falsch ${JSON.stringify(sp)}`);
    await p.screenshot({ path: join(out, "phone-strength-forecast.png") });
    await p.click("#stProg tbody tr.st-detail + tr button").catch(() => {}); await p.waitForTimeout(200);
    const sp2 = await p.$$eval("#stProg .st-detail .chart-cap", (l) => l.map((x) => x.textContent));
    if (!sp2.some((t) => /Zu wenig Daten/.test(t))) errors.push(`${name}: Übung ohne Prognose zeigt keinen Hinweis ${JSON.stringify(sp2)}`);
    window_tpl: {
      await p.click("#stSessions button.linkish[aria-expanded]").catch(() => errors.push(`${name}: Einheitenliste ohne „Als Vorlage speichern“`));
      // #332: Das Feld muss das Neuzeichnen (ResizeObserver, Zeitraumwechsel) überleben, samt Text.
      await p.waitForTimeout(400);
      if (!(await p.$("#stSessions .st-tplrow"))) { errors.push(`${name}: Namensfeld der Vorlage verschwindet wieder`); break window_tpl; }
      await p.fill("#stSessions .st-tplrow input", "Getippt");
      await p.evaluate(() => FC.rerender()); await p.waitForTimeout(100);
      const kept = await p.evaluate(() => document.querySelector("#stSessions .st-tplrow input")?.value);
      if (kept !== "Getippt") errors.push(`${name}: Vorlagen-Feld nach Neuzeichnen weg oder leer ${JSON.stringify(kept)}`);
      await p.fill("#stSessions .st-tplrow input", "Aus Liste"); await p.click("#stSessions .st-tplrow .primary"); await p.waitForTimeout(200);
      const t = await p.evaluate(() => window.__tplSaved);
      if (!(t?.name === "Aus Liste" && t.exercises?.length === 2 && t.exercises[0].sets === 2)) errors.push(`${name}: Vorlage aus Einheitenliste falsch ${JSON.stringify(t)}`);
    }
    // Vorlage aus der Workout-Übersicht (#331): nur Krafttrainings mit verknüpfter Einheit haben den Knopf.
    window_wotpl: {
      const n = await p.$$eval("#tWorkouts .wo-tpl", (l) => l.length);
      if (n !== 1) { errors.push(`${name}: Workout-Übersicht zeigt ${n} statt 1 „Als Vorlage speichern“`); break window_wotpl; }
      await p.click("#tWorkouts .wo-tpl"); await p.waitForTimeout(500);
      if (!(await p.$("#tWorkouts .wo-tplrow input"))) { errors.push(`${name}: Vorlagen-Feld in der Workout-Übersicht fehlt`); break window_wotpl; }
      await p.fill("#tWorkouts .wo-tplrow input", "Aus Übersicht"); await p.click("#tWorkouts .wo-tplrow .primary"); await p.waitForTimeout(200);
      const t = await p.evaluate(() => window.__tplSaved);
      if (!(t?.name === "Aus Übersicht" && t.exercises?.length === 1 && t.exercises[0].exercise === "bench_press")) errors.push(`${name}: Vorlage aus Workout-Übersicht falsch ${JSON.stringify(t)}`);
    }
    // Übung beschreiben (#327) im Erfassen-Formular
    await p.click("#stDescBtn"); await p.fill("#stDesc .st-desc-in", "am Kabel von oben ziehen"); await p.click("#stDesc .st-desc button"); await p.waitForTimeout(200);
    await p.click("#stDesc .st-desc-pick").catch(() => errors.push(`${name}: „Übung beschreiben“ zeigt keine Vorschläge`)); await p.waitForTimeout(100);
    const dsc = await p.$$eval("#stRows .ex", (l) => l.map((x) => x.value));
    if (!dsc.includes("Latziehen")) errors.push(`${name}: Vorschlag nicht übernommen ${JSON.stringify(dsc)}`);
    // Sätze einzeln nachtragen (#344): Schnelleingabe, je Satz ändern, Satz anfügen/entfernen, speichern.
    window_sets: {
      await p.evaluate(() => document.getElementById("stForm").scrollIntoView());
      const box = await p.$("#stRows .st-ex:nth-child(1)");
      await box.$eval(".ex", (i) => { i.value = "Kniebeuge"; });
      await box.$eval(".quick", (i) => { i.value = "3 × 60 kg × 10"; });
      await box.$eval("button[aria-label^='Sätze aus']", (b) => b.click());
      const filled = await box.$$eval(".st-set", (l) => l.map((r) => `${r.querySelector(".kg").value}x${r.querySelector(".reps").value}`));
      if (filled.join("|") !== "60x10|60x10|60x10") { errors.push(`${name}: Schnelleingabe falsch ${JSON.stringify(filled)}`); break window_sets; }
      const rows = await box.$$(".st-set");
      await rows[1].$eval(".kg", (i) => { i.value = "65"; }); await rows[1].$eval(".reps", (i) => { i.value = "8"; });
      await rows[2].$eval(".kg", (i) => { i.value = "65"; }); await rows[2].$eval(".reps", (i) => { i.value = "6"; });
      await box.$eval(".st-addset", (b) => b.click());
      const added = await box.$$eval(".st-set", (l) => l.length + ":" + l.at(-1).querySelector(".kg").value + "x" + l.at(-1).querySelector(".reps").value);
      if (added !== "4:65x6") errors.push(`${name}: Satz anfügen ohne Vorbelegung ${added}`);
      await box.$eval(".st-set:last-child button", (b) => b.click());
      await p.evaluate(() => { window.__gymSaved = null; document.querySelectorAll("#stRows .st-ex:not(:first-child) .ex").forEach((i) => { i.value = ""; }); });
      await p.evaluate(() => document.getElementById("stSave").click()); await p.waitForTimeout(300);
      const saved = await p.evaluate(() => window.__gymSaved);
      const ex0 = saved?.exercises?.[0];
      const smsg = await p.evaluate(() => document.getElementById("stMsg").textContent); if (!saved) errors.push(`${name}: stMsg ${smsg}`);
      if (!(ex0?.exercise === "Kniebeuge" && JSON.stringify(ex0.sets) === JSON.stringify([{ reps: 10, weightKg: 60 }, { reps: 8, weightKg: 65 }, { reps: 6, weightKg: 65 }]))) errors.push(`${name}: Sätze einzeln falsch gespeichert ${JSON.stringify(saved)}`);
      // Bearbeiten: vorhandene Einheit lädt ihre Sätze, Speichern ersetzt per id.
      await p.evaluate(() => [...document.querySelectorAll("#stSessions button")].find((b) => b.textContent === "Bearbeiten")?.click());
      const editRows = await p.evaluate(() => ({ bar: !document.getElementById("stEditBar").hidden, sets: document.querySelectorAll("#stRows .st-set").length }));
      if (!editRows.bar || editRows.sets < 1) { errors.push(`${name}: Bearbeiten füllt das Formular nicht ${JSON.stringify(editRows)}`); break window_sets; }
      await p.evaluate(() => { window.__gymSaved = null; document.getElementById("stSave").click(); }); await p.waitForTimeout(300);
      const re = await p.evaluate(() => window.__gymSaved);
      if (!re?.id) errors.push(`${name}: Bearbeiten speichert ohne id ${JSON.stringify(re)}`);
    }
    // Express (#281): „Nur 30 min“ kürzt die Einheit über get_express_session.
    await p.selectOption("#gySrc", "s:s2"); await p.selectOption("#gyTime", "30"); await p.click("#gyBody button.primary"); await p.waitForTimeout(200);
    const ex = await p.evaluate(() => ({ min: window.__expressIn?.minutes, n: window.__expressIn?.exercises?.length, cards: [...document.querySelectorAll("#gyBody .gy-ex h3")].map((h) => h.textContent), sets: document.querySelectorAll("#gyBody .gy-ex")[0]?.querySelectorAll(".gy-set").length, ss: document.querySelectorAll("#gyBody .gy-ex")[1]?.querySelector(".gy-exh .muted")?.textContent ?? "", msg: document.getElementById("gyMsg")?.textContent ?? "" }));
    if (ex.min !== 30 || ex.n !== 2 || ex.cards.join("|") !== "Kniebeuge|Kurzhantelrudern" || ex.sets !== 2 || !/Supersatz A/.test(ex.ss) || !/Gekürzt/.test(ex.msg)) errors.push(`${name}: Express-Einheit falsch ${JSON.stringify(ex)}`);
    // Übung beschreiben im Gym-Modus (#327): Unbekanntes als eigene Übung
    await p.click("#gyBody .gy-row .linkish:text('Übung beschreiben')").catch(() => errors.push(`${name}: Gym-Modus ohne „Übung beschreiben“`)); await p.waitForTimeout(100);
    await p.fill("#gyBody .st-desc-in", "Reifen umwerfen draußen"); await p.click("#gyBody .st-desc > .row button"); await p.waitForTimeout(200);
    await p.click("#gyBody .st-desc-out .linkish").catch(() => errors.push(`${name}: keine eigene Übung anlegbar`)); await p.waitForTimeout(100);
    const own = await p.$$eval("#gyBody .gy-ex h3", (l) => l.map((h) => h.textContent));
    if (own.at(-1) !== "Reifen umwerfen") errors.push(`${name}: eigene Übung nicht angelegt ${JSON.stringify(own)}`);
  }
  if (name === "desktop-light") {
    // Heute in 10 Sekunden (#372): Karte, schlanke Ansicht, Nutzungsvorschlag mit Ausblenden und Einblenden.
    const fo = await p.evaluate(() => ({ txt: document.getElementById("foBody")?.innerText ?? "", vis: !document.getElementById("sec-focus").hidden }));
    if (!fo.vis || !/tagesform/i.test(fo.txt) || !/heute dran/i.test(fo.txt)) errors.push(`${name}: „Heute in 10 Sekunden“ unvollständig ${JSON.stringify(fo)}`);
    await p.evaluate(() => document.getElementById("foLean").click()); await p.waitForTimeout(200);
    const lean = await p.evaluate(() => ({ vis: [...document.querySelectorAll("#sections > section.on")].filter((x) => x.offsetParent).map((x) => x.id) }));
    if (lean.vis.join() !== "sec-focus") errors.push(`${name}: schlanke Ansicht zeigt ${JSON.stringify(lean.vis)}`);
    await p.screenshot({ path: join(out, "desktop-focus-lean.png") });
    await p.evaluate(() => document.getElementById("foLean").click()); await p.waitForTimeout(200);
    if ((await p.evaluate(() => [...document.querySelectorAll("#sections > section.on")].filter((x) => x.offsetParent).length)) < 3) errors.push(`${name}: schlanke Ansicht lässt sich nicht aufheben`);
    await p.evaluate(() => { localStorage.setItem("fc-usage", JSON.stringify({ since: new Date(Date.now() - 9 * 864e5).toISOString(), views: { today: { n: 40, last: null }, agenda: { n: 5, last: null } } })); });
    await p.reload(); await p.waitForSelector("body.has-data"); await p.waitForTimeout(900);
    await p.evaluate(() => FC.goTo("layout")); await p.waitForTimeout(600);
    const sug = await p.evaluate(() => ({ btn: document.getElementById("loSugApply")?.textContent ?? null, st: document.getElementById("loSugState")?.textContent ?? "" }));
    if (!sug.btn) errors.push(`${name}: Vorschlag falsch ${JSON.stringify(sug)}`);
    await p.click("#loSugApply"); await p.waitForTimeout(300);
    const hid = await p.evaluate(() => ({ n: FC.layout.list().filter((x) => x.hidden).length, agenda: document.getElementById("sec-agenda").hidden, today: document.getElementById("sec-today").hidden }));
    if (hid.n < 10 || hid.today || hid.agenda) errors.push(`${name}: Ausblenden falsch ${JSON.stringify(hid)}`);
    await p.screenshot({ path: join(out, "desktop-focus-suggest.png") });
    await p.click("#loShowAll"); await p.waitForTimeout(300);
    if ((await p.evaluate(() => FC.layout.list().filter((x) => x.hidden).length)) !== 0) errors.push(`${name}: Wieder einblenden falsch`);
    await p.evaluate(() => { localStorage.removeItem("fc-usage"); FC.showTab("heute"); window.scrollTo(0, 0); }); await p.waitForTimeout(200);
    // Favoriten (#291): Stern an „Trittfrequenz“ heftet sie oben auf „Heute“ an, Sprung, nach Neuladen gemerkt, lösen.
    const favNone = await p.evaluate(() => document.getElementById("sec-favorites").hidden && document.querySelectorAll(".fav-btn").length);
    if (!favNone || favNone < 20) errors.push(`${name}: Favoriten-Sterne fehlen oder Leiste ohne Favoriten sichtbar (${favNone})`);
    await p.evaluate(() => document.querySelector("#h-cadence .fav-btn").click()); await p.waitForTimeout(100);
    const fav = await p.evaluate(() => ({ vis: !document.getElementById("sec-favorites").hidden, items: [...document.querySelectorAll("#favList button")].map((b) => b.textContent), pressed: document.querySelector("#h-cadence .fav-btn").getAttribute("aria-pressed") }));
    if (!fav.vis || fav.items.join() !== "TrittfrequenzTraining" || fav.pressed !== "true") errors.push(`${name}: Anheften falsch ${JSON.stringify(fav)}`);
    await p.reload(); await p.waitForSelector("body.has-data"); await p.waitForTimeout(900);
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
    await p.click("#tabbar [data-tab=training]"); await p.reload(); await p.waitForSelector("body.has-data"); await p.waitForTimeout(800);
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
    await p.reload(); await p.waitForSelector("body.has-data"); await p.waitForTimeout(800);
    const kept = await p.$$eval("#chat .q", (q) => q.length);
    if (kept !== 2) errors.push(`${name}: Coach-Chat nach Neuladen ${kept} statt 2 Fragen`);
    // Werkzeuge abgelehnt: einmal ohne Werkzeuge neu fragen; sonst Meldung mit Fehlercode (#338).
    await p.evaluate(() => { window.__failTools = true; }); await p.fill("#askInput", "Wie war die Woche?"); await p.click("#askBtn"); await p.waitForTimeout(400);
    const retry = await p.evaluate(() => [document.querySelector("#chat .a:last-child")?.innerText ?? "", window.__failTools]);
    if (!retry[0].includes("normales Training") || retry[1]) errors.push(`${name}: Coach fragt nach abgelehnten Werkzeugen nicht ohne neu (${JSON.stringify(retry)})`);
    await p.evaluate(() => { window.__failSample = "upstream_error"; }); await p.fill("#askInput", "Und morgen?"); await p.click("#askBtn"); await p.waitForTimeout(400);
    const errMsg = await p.evaluate(() => document.querySelector("#chat .a:last-child")?.innerText ?? "");
    if (!errMsg.includes("kurz gestört") || !errMsg.includes("Fehlercode: upstream_error")) errors.push(`${name}: Coach-Fehlermeldung ohne Code (${errMsg})`);
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

// Einfache Ansicht (Standard): nur Krafttraining und Radfahren; Liste der Krafteinheiten mit Detail, Bearbeiten, Löschen.
for (const [name, vp, scheme] of [["phone-simple", { width: 390, height: 844 }, "light"], ["desktop-simple", { width: 1280, height: 900 }, "dark"]]) {
  const ctx = await browser.newContext({ viewport: vp, colorScheme: scheme, hasTouch: name.startsWith("phone") });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  p.on("dialog", (d) => d.dismiss()); // wie im Artefakt-Fenster: confirm() liefert false
  await p.goto("file://" + join(out, "preview.html"));
  await p.waitForTimeout(800);
  const tabs = await p.evaluate(() => [...document.querySelectorAll("#tabbar button")].filter((b) => !b.hidden).map((b) => b.dataset.tab).join());
  if (tabs !== "heute,coach,verlauf,training,uebungen,mehr") errors.push(`${name}: Reiter der einfachen Ansicht falsch: ${tabs}`);
  const secs = async () => (await p.evaluate(() => [...document.querySelectorAll("#sections > section.on")].filter((x) => !x.hidden && x.offsetHeight > 0).map((x) => x.id.slice(4)).join())).split(",");
  const heute = await secs();
  if (heute.some((x) => ["highlights", "briefing", "mobility", "whatsnew", "sleeptarget", "recovery", "health"].includes(x)) || !heute.includes("today")) errors.push(`${name}: Heute zeigt Unnötiges: ${heute}`);
  await p.click("#tabbar [data-tab=training]"); await p.waitForTimeout(500);
  const tr = await secs();
  if (tr.join() !== "gym,liftlog,fit,strength,bikewo,hrzones,periods,year,workouts") errors.push(`${name}: Training falsch: ${tr}`);
  // Übungsverwaltung (#399): eigener Reiter „Übungen“: Verlauf, Dubletten zusammenführen, Muskelgruppen
  await p.click("#tabbar [data-tab=uebungen]"); await p.waitForTimeout(500);
  if (await p.$("#sec-exlist.folded .fold-bar")) { await p.click("#sec-exlist .fold-bar"); await p.waitForTimeout(500); }
  await p.click("#sec-exlist .ex-item > summary"); await p.waitForTimeout(150);
  const exv = await p.innerText("#sec-exlist .ex-item[open]");
  if (!/Verlauf/.test(exv) || !/20 kg × 10/.test(exv) || !/17,5 kg × 8/.test(exv) || !/Bizeps/.test(exv)) errors.push(`${name}: Übungsverlauf falsch ${exv.slice(0, 300)}`);
  if (!(await p.$("#exDup .ex-dup")) || !/Maschine X/.test(await p.innerText("#exList")) || !/nicht erkannt/.test(await p.innerText("#exList"))) errors.push(`${name}: Übungsverwaltung ohne Dubletten oder „nicht erkannt“`);
  await p.click("#exDup .ex-dup button"); await p.waitForTimeout(100); await p.click("#exDup .ex-dup button"); await p.waitForTimeout(300);
  await p.click("#sec-exlist .ex-item[open] .ex-mus input[value=back]"); await p.click("#sec-exlist .ex-item[open] button:text-is('Muskelgruppen speichern')"); await p.waitForTimeout(200);
  const acts = await p.evaluate(() => window.__exActs ?? []);
  if (!acts.some((a) => a.action === "merge" && a.exercise === "bizeps curls" && a.into === "bizeps schwarze") || !acts.some((a) => a.action === "muscles" && a.primary?.includes("back"))) errors.push(`${name}: Übungsverwaltung sendet falsch ${JSON.stringify(acts)}`);
  await p.screenshot({ path: join(out, "phone-exlist.png") });
  await p.click("#tabbar [data-tab=training]"); await p.waitForTimeout(500);
  const n = await p.$$eval("#llList .ll-item", (l) => l.length);
  if (n !== 3) errors.push(`${name}: Krafteinheiten ${n} statt 3`);
  await p.click("#ll-s2 > summary"); await p.waitForTimeout(150);
  const view = await p.innerText("#ll-s2");
  if (!/Kniebeuge/.test(view) || !/Satz 1: 100 kg × 5/.test(view) || !/Bankdrücken/.test(view)) errors.push(`${name}: Detail falsch ${view.slice(0, 200)}`);
  await p.click("#ll-s2 .ll-actions .primary"); await p.waitForTimeout(150);
  await p.fill("#ll-s2 .ll-exbox:first-child .ll-set:first-child .kg", "102.5");
  await p.click("#ll-s2 .ll-exbox:first-child .ll-set:last-child button[aria-label='Satz entfernen']");
  await p.click("#ll-s2 .ll-exbox:first-child >> text=+ Satz"); await p.waitForTimeout(100);
  await p.fill("#ll-s2 .ll-exbox:first-child .ll-set:last-child .reps", "6");
  await p.fill("#ll-s2 input[type=date]", "2026-03-30");
  await p.click("#ll-s2 .ll-actions >> text=Speichern"); await p.waitForTimeout(500);
  const sv = await p.evaluate(() => window.__gymSaved);
  const first = sv?.exercises?.[0];
  if (sv?.id !== "s2" || sv.day !== "2026-03-30" || sv.name !== "Beine & Brust" || first?.exercise !== "Kniebeuge" || first.sets.length !== 2 || first.sets[0].weightKg !== 102.5 || first.sets[1].reps !== 6) errors.push(`${name}: Bearbeiten speichert falsch ${JSON.stringify(sv)}`);
  await p.click("#ll-s1 > summary"); await p.click("#ll-s1 .ll-actions >> text=Löschen"); await p.waitForTimeout(100); await p.click("#ll-s1 .ll-actions button.ll-danger"); await p.waitForTimeout(400);
  if ((await p.evaluate(() => window.__deleted)) !== "s1") errors.push(`${name}: Löschen ruft nicht delete_strength_session`);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (sw > 0) errors.push(`${name}: horizontal overflow ${sw}px`);
  await p.click("#ll-s2 > summary").catch(() => {});
  await p.screenshot({ path: join(out, `${name}-training.png`), fullPage: false });
  // Umschalten auf den vollen Umfang in „Mehr“ blendet wieder alles ein.
  await p.click("#tabbar [data-tab=mehr]"); await p.waitForTimeout(300);
  await p.uncheck("#loSimple"); await p.waitForTimeout(500);
  const all = await p.evaluate(() => [...document.querySelectorAll("#tabbar button")].filter((b) => !b.hidden).length);
  if (all !== 6) errors.push(`${name}: Voller Umfang zeigt ${all} statt 6 Reiter`);
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
