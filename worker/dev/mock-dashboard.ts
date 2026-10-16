// Erzeugt synthetische Antworten der Connector-Werkzeuge (keine echten Messwerte) für die Vorschau des Artefakts:
//   cd worker && npx vite-node dev/mock-dashboard.ts > ../artifact/dev/mock-dashboard.json
import { addDays } from "../src/core/analysis";
import { bodyReport, readBodyHistory, saveManualWeight } from "../src/core/body";
import { analysisContext, fitnessProfileView, recoveryFactorsView, sleepReportView, recordsView, healthTrendsView, periodSummariesView, strainRecoveryView, trainingLoadView } from "../src/core/analytics";
import { buildDashboard } from "../src/core/dashboard";
import { CURVE_DURATIONS_S, combineCurves } from "../src/core/power";
import { readPowerCurves } from "../src/core/repository";
import { runBatched, updateRecovery, upsertBody, upsertDaily, upsertSleep, upsertWorkout, upsertWorkoutStream } from "../src/core/repository";
import { setSyncState } from "../src/core/repository";
import { fakeD1 } from "../test/fake-d1";
import { saveGoal } from "../src/core/goals";
import { saveJournal } from "../src/core/journal";

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
// Gewichtsverlauf (#30): synthetische Werte, leicht fallend, jeder fünfte Tag als eigener Eintrag.
for (let i = 0; i < 120; i += 2) {
  const kg = Number((78 - i * 0.025 + (rnd() - 0.5) * 1.2).toFixed(1));
  if (i % 10) stmts.push(upsertBody(db, { source: "whoop", measuredAt: addDays("2026-03-31", i - 120), heightM: 1.8, weightKg: kg, maxHr: 188 }));
  else await saveManualWeight(db, addDays("2026-03-31", i - 120), kg);
}
await runBatched(db, stmts);
await setSyncState(db, "whoop", true, null, new Date(now - 20 * 60_000).toISOString());
const curves = await readPowerCurves(db, addDays("2026-03-31", -364));
// Coach: Beispielziel und Check-in für die Abschnitte Wochenplan und Tagebuch.
await saveGoal(db, { kind: "event", title: "Radmarathon (Beispiel)", targetDate: "2026-05-24", priority: "A" });
await saveJournal(db, { day: "2026-03-31", feeling: 4, energy: 3, soreness: 3, stress: 2, motivation: 4, tags: ["reise"] });
const ctx = (days: number) => analysisContext(db, { days, now });
process.stdout.write(JSON.stringify({
  get_dashboard: await buildDashboard(db, { days: 180, now }),
  get_power_curve: { best: combineCurves(curves.map((w) => w.power_curve)), workouts: curves },
  get_fitness_profile: fitnessProfileView(await ctx(28)),
  get_training_load: trainingLoadView(await ctx(365)),
  get_health_trends: healthTrendsView(await ctx(60)),
  get_strain_recovery: strainRecoveryView(await ctx(90)),
  get_recovery_factors: recoveryFactorsView(await ctx(90)),
  get_sleep_report: sleepReportView(await ctx(30)),
  get_body_history: await (async () => { const c = await ctx(30); return { today: c.today, ...bodyReport(await readBodyHistory(db, "2025-01-01"), addDays(c.today, -89), c.today, { watts: c.settings.ftpW, origin: c.settings.origin.ftpW }) }; })(),
  get_records: await recordsView(db, await ctx(14), 30),
  get_period_summaries: Object.fromEntries(await Promise.all((["week", "month", "year"] as const).map(async (p) => [p, periodSummariesView(await ctx(365), p)]))),
}));
