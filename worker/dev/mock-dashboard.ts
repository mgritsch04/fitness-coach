// Erzeugt synthetische Antworten der Connector-Werkzeuge (keine echten Messwerte) für die Vorschau des Artefakts:
//   cd worker && npx vite-node dev/mock-dashboard.ts > ../artifact/dev/mock-dashboard.json
import { addDays } from "../src/core/analysis";
import { analysisContext, fitnessProfileView, recoveryFactorsView, sleepReportView, recordsView, enduranceView, recoveryForecastView, interferenceView, hrvTrendView, trainingTimingView, recoveryCurveView, readinessAlignmentView, healthTrendsView, periodSummariesView, strainRecoveryView, trainingLoadView, powerCompareView } from "../src/core/analytics";
import { buildDashboard } from "../src/core/dashboard";
import { ftpHistory, ftpTestSuggestion, readFtpTests, saveFtpTest } from "../src/core/ftp-test";
import { CURVE_DURATIONS_S, combineCurves } from "../src/core/power";
import { readPowerCurves } from "../src/core/repository";
import { runBatched, updateRecovery, upsertBody, upsertDaily, upsertSleep, upsertWorkout, upsertWorkoutStream } from "../src/core/repository";
import { setSyncState } from "../src/core/repository";
import { fakeD1 } from "../test/fake-d1";
import { saveGoal } from "../src/core/goals";
import { readJournal, saveJournal } from "../src/core/journal";
import { weekReview } from "../src/core/review";
import { weekView } from "../src/core/training";
import { weekStart } from "../src/core/analysis";
import { buildBikeWorkout, pickWorkouts, toZwo, zwoFileName } from "../src/core/bike-workout";
import { bestWindow, clothingAdvice, parseForecast, rideAdvice } from "../src/core/weather";
import { bodyReport, readBodyHistory, saveManualWeight } from "../src/core/body";
import { durabilityReport } from "../src/core/durability";
import { aerobicReport } from "../src/core/aerobic";
import { intervalReport } from "../src/core/intervals";
import { cadenceReport } from "../src/core/cadence";
import { riderProfile } from "../src/core/rider-profile";
import { muscleBalance } from "../src/core/muscle-balance";
import { eftpTrend } from "../src/core/eftp";
import { indoorOutdoor } from "../src/core/indoor-outdoor";

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const now = Date.parse("2026-03-31T09:00:00Z");
const db = fakeD1();
const stmts = [];
const start = "2025-10-01";
for (let i = 0; i < 182; i++) {
  const day = addDays(start, i);
  const fatigue = Math.sin(i / 9) * 8;
  const rec = Math.max(5, Math.min(99, Math.round(62 + fatigue + (rnd() - 0.5) * 40)));
  stmts.push(upsertDaily(db, { source: "whoop", sourceId: `c${i}`, day, startTime: `${day}T05:00:00.000Z`, endTime: null, strain: Number((8 + rnd() * 9).toFixed(1)), energyKj: 9000, avgHr: 66, maxHr: 165 }));
  stmts.push(updateRecovery(db, { source: "whoop", dailySourceId: `c${i}`, recoveryScore: rec, restingHr: Math.round(52 - fatigue / 3 + rnd() * 4), hrvMs: Math.round(58 + fatigue + (rnd() - 0.5) * 18), spo2Pct: 96, skinTempC: 33.4 }));
  const asleep = Math.round((6.2 + rnd() * 2.2) * 3600);
  stmts.push(upsertSleep(db, { source: "whoop", sourceId: `s${i}`, day, startTime: `${addDays(day, -1)}T22:30:00.000Z`, endTime: `${day}T06:30:00.000Z`, isNap: false,
    inBedS: asleep + 1800, asleepS: asleep, awakeS: 1800, lightS: Math.round(asleep * 0.5), deepS: Math.round(asleep * 0.22), remS: Math.round(asleep * 0.28),
    performancePct: Math.round(70 + rnd() * 28), efficiencyPct: 90, consistencyPct: 75, respiratoryRate: 15 }));
  if (i % 7 !== 3) {
    stmts.push(upsertWorkout(db, { source: "whoop", sourceId: `k${i}`, day, startTime: `${day}T05:30:00.000Z`, endTime: `${day}T06:05:00.000Z`, sport: "bodybuilding", durationS: 2100,
      distanceM: null, energyKj: 200, avgHr: 85 + Math.round(rnd() * 15), maxHr: 125, avgPowerW: null, normalizedPowerW: null, strain: 7.5 }));
  }
  if (i % 2 === 0) {
    const dur = 1800 + Math.round(rnd() * 3600);
    stmts.push(upsertWorkout(db, { source: "whoop", sourceId: `r${i}`, day, startTime: `${day}T16:00:00.000Z`, endTime: new Date(Date.parse(`${day}T16:00:00.000Z`) + dur * 1000).toISOString(), sport: i % 4 ? "spin" : "cycling", durationS: dur,
      distanceM: null, energyKj: 600, avgHr: 115 + Math.round(rnd() * 25), maxHr: 160, avgPowerW: null, normalizedPowerW: null, strain: 9,
      hrZoneS: [0.05, 0.2, 0.45, 0.2, 0.08, 0.02].map((f) => Math.round(f * dur * (0.7 + rnd() * 0.6))) }));
    if (i % 6 === 0) stmts.push(upsertWorkout(db, { source: "mywhoosh", sourceId: `m${i}`, day, startTime: `${day}T16:01:00.000Z`, endTime: new Date(Date.parse(`${day}T16:01:00.000Z`) + dur * 1000).toISOString(), sport: "cycling", durationS: dur,
      distanceM: 25000, energyKj: 650, avgHr: null, maxHr: null, avgPowerW: 180, normalizedPowerW: 195, strain: null }));
    if (i % 6 === 0) {
      const k = 0.9 + i / 1800 + rnd() * 0.06;
      const curve = Object.fromEntries(CURVE_DURATIONS_S.filter((d) => d <= dur).map((d) => [d, Math.round(k * (225 + 650 * Math.exp(-d / 25) + 110 * Math.exp(-d / 400) - 10 * Math.log10(d)))]));
      stmts.push(upsertWorkoutStream(db, { source: "mywhoosh", sourceId: `m${i}`, startTime: `${day}T16:01:00.000Z`, power: null, heartRate: null, cadence: null, powerCurve: curve }));
    }
  }
}
stmts.push(upsertBody(db, { source: "whoop", measuredAt: "2026-03-31", heightM: 1.8, weightKg: 75, maxHr: 188 }));
await runBatched(db, stmts);
await setSyncState(db, "whoop", true, null, new Date(now - 20 * 60_000).toISOString());
const curves = await readPowerCurves(db, addDays("2026-03-31", -364));
// Coach: Beispielziel und Check-in für die Abschnitte Wochenplan und Tagebuch.
await saveGoal(db, { kind: "event", title: "Radmarathon (Beispiel)", targetDate: "2026-05-24", priority: "A" });
// Körperwerte: synthetische eigene Gewichtseinträge (leicht fallend) und ein Gewichtsziel.
for (let i = 0; i < 182; i += 2 + (i % 3)) await saveManualWeight(db, addDays(start, i), Number((78.5 - i * 0.018 + (rnd() - 0.5) * 1.2).toFixed(1)));
await saveGoal(db, { kind: "weight", title: "Gewicht (Beispiel)", metric: "weightKg", targetValue: 74, unit: "kg", targetDate: "2026-06-30" });
await saveJournal(db, { day: "2026-03-31", feeling: 4, energy: 3, soreness: 3, stress: 2, motivation: 4, tags: ["reise"] });
const ctx = (days: number) => analysisContext(db, { days, now });
const dash = await buildDashboard(db, { days: 180, now });
const review = async (ws: string) => ({
  ...weekReview({ week: ws, today: dash.today, days: dash.days, weeks: dash.weeks, workouts: dash.workouts, comparison: (await weekView(db, dash, ws)).comparison,
    journal: await readJournal(db, addDays(ws, -7), addDays(ws, 6)), strengthSessions: dash.strength.sessions }),
  planSource: "Vorschlag",
  savedReview: null,
});
process.stdout.write(JSON.stringify({
  get_dashboard: dash,
  get_week_review: { previous: await review(addDays(weekStart(dash.today), -7)), current: await review(weekStart(dash.today)) },
  get_power_curve: { best: combineCurves(curves.map((w) => w.power_curve)), workouts: curves },
  power_compare: { previous: await powerCompareView(db, "previous", 90, now), lastYear: await powerCompareView(db, "lastYear", 90, now) },
  get_fitness_profile: fitnessProfileView(await ctx(28)),
  get_training_load: trainingLoadView(await ctx(365)),
  get_health_trends: healthTrendsView(await ctx(60)),
  get_strain_recovery: strainRecoveryView(await ctx(90)),
  get_recovery_factors: recoveryFactorsView(await ctx(90)),
  get_sleep_report: sleepReportView(await ctx(30)),
  get_body_history: { today: "2026-03-31", range: { from: addDays("2026-03-31", -179), to: "2026-03-31", days: 180 },
    ...bodyReport(await readBodyHistory(db, addDays("2026-03-31", -300)), addDays("2026-03-31", -179), "2026-03-31", { watts: 250, origin: "estimate" },
      { title: "Gewicht (Beispiel)", targetValue: 74, targetDate: "2026-06-30" }) },
  list_bike_workouts: { today: "2026-03-31", ...pickWorkouts({ recovery: 55 }) },
  get_bike_workout: (() => {
    const w = buildBikeWorkout("threshold", 75)!, ftp = 250, wt = (x?: number) => (x == null ? null : Math.round(x * ftp));
    return { day: "2026-03-31", planned: { type: "threshold", title: "Schwelle (Beispiel)", durationMin: 75, intensity: "", stored: false }, ftpW: ftp, ftpEstimated: true,
      workout: { ...w, steps: w.steps.map((s) => ({ ...s, watts: wt(s.power), wattsLow: wt(s.powerLow), wattsHigh: wt(s.powerHigh), onWatts: wt(s.onPower), offWatts: wt(s.offPower) })) },
      fileName: zwoFileName(w, "2026-03-31"), zwo: toZwo(w), howTo: [] };
  })(),
  get_records: await recordsView(db, await ctx(14), 30),
  get_endurance_profile: enduranceView(await ctx(180)),
  get_recovery_forecast: recoveryForecastView(await ctx(90)),
  get_strength_cycling_interference: await interferenceView(db, await ctx(180), 180),
  get_hrv_trend: hrvTrendView(await ctx(157), 90),
  get_training_timing: trainingTimingView(await ctx(120), 120),
  get_recovery_curve: recoveryCurveView(await ctx(180), 180),
  get_readiness_alignment: readinessAlignmentView(await ctx(90), 90),
  // Synthetische Sekundenreihen (keine Datenbank): 3 h Grundlage mit harten Blöcken früh und spät, Leistung fällt mit der Arbeit leicht ab.
  get_durability: durabilityReport([0, 1, 2].map((k) => ({
    day: addDays("2026-03-31", -7 * k - 2), source: "mywhoosh", sourceId: `d${k}`,
    power: Array.from({ length: 3 * 3600 - k * 1800 }, (_, t) => {
      const fade = 1 - t / 3600 * (0.025 + k * 0.01);
      const hard = (t >= 900 && t < 2100) || (t >= 7200 && t < 8400) ? 1.45 : t % 2400 < 300 ? 1.75 : 1;
      return Math.round(175 * hard * fade);
    }),
  })), "2026-03-31", 90),
  // Synthetische Sekundenreihen: zehn ruhige Fahrten (75–150 min), der Puls driftet mit der Zeit immer weniger.
  get_aerobic_decoupling: aerobicReport(Array.from({ length: 10 }, (_, k) => {
    const len = (75 + (k % 4) * 25) * 60, drift = 0.22 - k * 0.019;
    return {
      day: addDays("2026-03-31", -6 * (9 - k) - 1), source: "mywhoosh", sourceId: `a${k}`,
      power: Array.from({ length: len }, (_, t) => 165 + ((t * 7) % 23)),
      heartRate: Array.from({ length: len }, (_, t) => Math.round(128 * (1 + drift * (t / len)))),
    };
  }), "2026-03-31", 120),
  // Synthetische Intervalltrainings: abwechselnd 5 × 4 min VO2max und 3 × 12 min Schwelle, Leistung steigt über die Wochen.
  get_interval_quality: intervalReport(Array.from({ length: 8 }, (_, k) => {
    const vo2 = k % 2 === 0, reps = vo2 ? 5 : 3, work = vo2 ? 240 : 720, rest = vo2 ? 180 : 300;
    const target = (vo2 ? 300 : 265) * (1 + k * 0.006), fade = k === 6 ? 0.025 : 0.004;
    const power: number[] = [], heartRate: number[] = [];
    for (let t = 0; t < 900; t++) { power.push(160); heartRate.push(125); }
    for (let r = 0; r < reps; r++) {
      for (let t = 0; t < work; t++) { power.push(Math.round(target * (1 - fade * r))); heartRate.push(160 + r * 2 + Math.round(t / 60)); }
      for (let t = 0; t < rest; t++) { power.push(120); heartRate.push(130); }
    }
    for (let t = 0; t < 600; t++) { power.push(150); heartRate.push(122); }
    return { day: addDays("2026-03-31", -5 * (7 - k) - 1), source: "mywhoosh", sourceId: `i${k}`, power, heartRate, cadence: null };
  }), 285, "2026-03-31", 90, { cpW: 285, wPrimeKj: 20, source: "ftp" }),
  // Synthetische Fahrten: Grundlage mit langsam steigender Kadenz, dazu harte Blöcke mit höherer Kadenz.
  get_cadence_profile: cadenceReport(Array.from({ length: 10 }, (_, k) => {
    const n = 75 * 60, power: number[] = [], cadence: number[] = [];
    for (let t = 0; t < n; t++) {
      const hard = t % 900 >= 720, z = Math.sin(t / 7) * 4;
      power.push(hard ? 300 : t % 900 >= 600 ? 240 : 185);
      cadence.push(t % 600 === 0 ? 0 : Math.round((hard ? 94 : t % 900 >= 600 ? 82 : 78 + k * 0.6) + z));
    }
    return { day: addDays("2026-03-31", -7 * (9 - k) - 1), source: "mywhoosh", sourceId: `c${k}`, power, heartRate: null, cadence };
  }), 285, "2026-03-31", 90),
  // Synthetische Leistungskurve: guter Antritt, schwächerer Sprint.
  get_rider_profile: riderProfile({
    curve: { "5": 980, "60": 640, "300": 355, "1200": 300 }, previousCurve: { "5": 1000, "60": 610, "300": 340, "1200": 292 },
    ftpW: 285, ftpOrigin: "user", weightKg: 76,
  }, "2026-03-31", 90),
  // Synthetische Krafteinheiten: zweimal pro Woche, viel Drücken und Beinstrecker, wenig Rücken und Beinbeuger.
  get_muscle_balance: muscleBalance(Array.from({ length: 8 }, (_, k) => {
    const set = (exercise: string, n: number, reps: number, weightKg: number) => Array.from({ length: n }, () => ({ exercise, exerciseName: exercise, reps, weightKg }));
    return {
      id: `m${k}`, day: addDays("2026-03-31", -3.5 * k | 0), startTime: null, durationMin: 50, rpe: 7, name: null, notes: null, linkedSource: null, linkedSourceId: null,
      sets: k % 2
        ? [...set("bench_press", 4, 8, 70), ...set("overhead_press", 3, 8, 40), ...set("triceps_extension", 3, 12, 25), ...set("lat_pulldown", 2, 10, 55)]
        : [...set("back_squat", 4, 6, 90), ...set("leg_extension", 3, 12, 45), ...set("leg_curl", 1, 12, 35), ...set("plank", 2, 1, 0)],
    };
  }), "2026-03-31", 4),
  // Synthetische Bestwerte: eine harte Fahrt pro Woche, Form steigt über 26 Wochen um etwa 8 %.
  get_eftp_trend: eftpTrend({
    rows: Array.from({ length: 32 }, (_, k) => {
      const day = addDays("2026-03-31", -7 * (31 - k) - 2), f = 1 + k * 0.0026 + (rnd() - 0.5) * 0.02;
      return ([[180, 360], [300, 330], [600, 305], [1200, 290], [3600, 262]] as const).map(([d, w]) => ({ source: "mywhoosh", source_id: `e${k}`, day, duration_s: d, watts: Math.round(w * f) }));
    }).flat(),
    ftpW: 280, tests: [{ day: "2026-01-20", ftpW: 280 }], weightKg: 76,
  }, "2026-03-31", 26),
  // Synthetische Fahrten: Rolle im Winter mit höherem Puls und höherer Kadenz, draußen ab März.
  get_indoor_outdoor: indoorOutdoor(Array.from({ length: 30 }, (_, k) => {
    const out = k % 3 === 0, p = 180 + (k % 5) * 12;
    return { day: addDays("2026-03-31", -5 * k - 1), source: out ? "wahoo" : "mywhoosh", sport: "cycling", duration_s: out ? 7200 : 3600, distance_m: out ? 60000 : 30000,
      avg_hr: Math.round(p / (out ? 1.48 : 1.4)), avg_power_w: p - 8, normalized_power_w: p, avg_cadence_rpm: out ? 84 : 91 };
  }), 285, "2026-03-31", 180),
  get_ride_weather: (() => {
    // Synthetische Vorhersage (kein Abruf): heute mild bis 15 Uhr, danach Regen; morgen kühl und windig.
    const time: string[] = [], t: number[] = [], p: number[] = [], mm: number[] = [], w: number[] = [], c: number[] = [], d: number[] = [];
    for (const [k, day] of ["2026-03-31", "2026-04-01"].entries()) for (let h = 0; h < 24; h++) {
      time.push(`${day}T${String(h).padStart(2, "0")}:00`); t.push(k ? 7 + h / 4 : 9 + Math.min(h, 14) / 1.5);
      const rain = !k && h >= 15; p.push(rain ? 70 : 10); mm.push(rain ? 0.8 : 0); w.push(k ? 24 : 9); c.push(rain ? 61 : 2); d.push(h >= 7 && h <= 19 ? 1 : 0);
    }
    const hours = parseForecast({ hourly: { time, temperature_2m: t, precipitation_probability: p, precipitation: mm, wind_speed_10m: w, wind_gusts_10m: w.map((x) => x * 1.6), weather_code: c, is_day: d } });
    const plans = [{ type: "endurance" as const, title: "Grundlage", durationMin: 90 }, { type: "threshold" as const, title: "Schwelle", durationMin: 75 }];
    return { location: { name: "Graz, Österreich (Beispiel)", lat: 47.1, lon: 15.4 }, timezone: "Europe/Vienna", fetchedAt: "2026-03-31T07:10:00Z", source: "Open-Meteo",
      days: ["2026-03-31", "2026-04-01"].map((day, i) => { const best = bestWindow(hours, day, Math.ceil(plans[i].durationMin / 60), i ? undefined : "2026-03-31T09:00");
        return { day, planned: plans[i], best, advice: rideAdvice(best, plans[i], "moderate"), clothing: best && best.rating !== "schlecht" ? clothingAdvice(best, hours.filter((h) => h.time.startsWith(day))) : null,
          hours: hours.filter((h) => h.time.startsWith(day)) }; }) };
  })(),
  get_ftp_tests: await (async () => {
    const c = await ctx(7);
    await saveFtpTest(db, { day: "2026-01-12", source: "mywhoosh", source_id: "t1", protocol: "ramp", basis_w: 310, ftp_w: 233, weight_kg: 77.4, applied: 0 });
    await saveFtpTest(db, { day: "2026-02-23", source: "mywhoosh", source_id: "t2", protocol: "20min", basis_w: 255, ftp_w: 242, weight_kg: 76.8, applied: 1 });
    const tests = ftpHistory(await readFtpTests(db));
    return { today: c.today, current: { ftpW: c.settings.ftpW, origin: c.settings.origin.ftpW, estimate: c.ftpEstimate }, tests, suggestion: ftpTestSuggestion(4, tests.at(-1)!.day, c.today), notes: [] };
  })(),
  get_period_summaries: Object.fromEntries(await Promise.all((["week", "month", "year"] as const).map(async (p) => [p, periodSummariesView(await ctx(365), p)]))),
}));
