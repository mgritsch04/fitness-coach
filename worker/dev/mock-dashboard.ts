// Erzeugt synthetische Dashboard-Daten (keine echten Messwerte) für die Vorschau des Artefakts:
//   cd worker && npx vite-node dev/mock-dashboard.ts > ../artifact/dev/mock-dashboard.json
import { addDays } from "../src/core/analysis";
import { buildDashboard } from "../src/core/dashboard";
import { runBatched, updateRecovery, upsertBody, upsertDaily, upsertSleep, upsertWorkout } from "../src/core/repository";
import { setSyncState } from "../src/core/repository";
import { fakeD1 } from "../test/fake-d1";

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
      distanceM: null, energyKj: 600, avgHr: 115 + Math.round(rnd() * 25), maxHr: 160, avgPowerW: null, normalizedPowerW: null, strain: 9 }));
    if (i % 6 === 0) stmts.push(upsertWorkout(db, { source: "mywhoosh", sourceId: `m${i}`, day, startTime: `${day}T16:01:00.000Z`, endTime: new Date(Date.parse(`${day}T16:01:00.000Z`) + dur * 1000).toISOString(), sport: "cycling", durationS: dur,
      distanceM: 25000, energyKj: 650, avgHr: null, maxHr: null, avgPowerW: 180, normalizedPowerW: 195, strain: null }));
  }
}
stmts.push(upsertBody(db, { source: "whoop", measuredAt: "2026-03-31", heightM: 1.8, weightKg: 75, maxHr: 188 }));
await runBatched(db, stmts);
await setSyncState(db, "whoop", true, null, new Date(now - 20 * 60_000).toISOString());
process.stdout.write(JSON.stringify(await buildDashboard(db, { days: 180, now })));
