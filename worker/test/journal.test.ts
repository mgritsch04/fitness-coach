import { describe, expect, it } from "vitest";
import { addDays, type DayPoint } from "../src/core/analysis";
import type { CoachAdvice } from "../src/core/coach";
import { buildDashboard } from "../src/core/dashboard";
import { applyJournal, readJournal, readRpe, saveJournal, saveRpe, sessionRpe, tagEffects, type JournalEntry } from "../src/core/journal";
import { runBatched, upsertWorkout } from "../src/core/repository";
import { fakeD1 } from "./fake-d1";

// Alle Werte synthetisch, keine echten Messwerte.

const advice = (readiness: CoachAdvice["readiness"], o: Partial<CoachAdvice> = {}): CoachAdvice => ({
  day: "2026-03-04", readiness, score: 80, headline: "x", suggestion: "x", targetLoad: { min: 60, max: 90 }, reasons: [], warnings: [], disclaimer: "", ...o,
});
const entry = (o: Partial<JournalEntry>): JournalEntry => ({ day: "2026-03-04", feeling: null, energy: null, soreness: null, stress: null, motivation: null, notes: null, tags: [], ...o });

describe("Tagebuch → Tagesempfehlung", () => {
  it("setzt bei „krank“ auf Ruhe mit Warnung", () => {
    const a = applyJournal(advice("hard"), entry({ tags: ["Krank"] }));
    expect(a.readiness).toBe("rest");
    expect(a.warnings.join(" ")).toContain("ärztlich");
    expect(a.targetLoad!.max).toBeLessThan(90);
  });
  it("macht bei starkem Muskelkater eine Stufe leichter, nie härter", () => {
    expect(applyJournal(advice("hard"), entry({ soreness: 5 })).readiness).toBe("moderate");
    expect(applyJournal(advice("easy"), entry({ feeling: 5, energy: 5, soreness: 1 })).readiness).toBe("easy");
    expect(applyJournal(advice("hard"), entry({ soreness: 5, energy: 1 })).readiness).toBe("easy");
  });
  it("ändert ohne Eintrag nichts", () => {
    const a = advice("moderate");
    expect(applyJournal(a, null)).toBe(a);
  });
});

describe("Tags und Erholung", () => {
  it("vergleicht die Erholung am Folgetag", () => {
    const series: DayPoint[] = [];
    const entries: JournalEntry[] = [];
    for (let i = 0; i < 20; i++) {
      const day = addDays("2026-03-01", i);
      const drank = i % 4 === 0;
      entries.push(entry({ day, tags: drank ? ["alkohol"] : [] }));
      series.push({ day, recovery: null, hrv: 60, rhr: null, spo2: null, skinTemp: null, strain: null, sleepH: null, sleepPerf: null, sleepEff: null, deepH: null, remH: null, respRate: null, load: 0, ctl: 0, atl: 0, tsb: 0, workouts: 0, trainingMin: 0 });
    }
    // Folgetag nach Alkohol: Erholung 40, sonst 70.
    series.forEach((p, i) => (p.recovery = (i - 1) % 4 === 0 ? 40 : 70));
    const fx = tagEffects(entries, series);
    expect(fx[0]).toMatchObject({ tag: "alkohol", recoveryWith: 40, recoveryWithout: 70 });
    expect(fx[0].deltaPct).toBe(-43);
  });
});

describe("Tagebuch in D1", () => {
  it("speichert Check-in teilweise und RPE je Workout", async () => {
    const db = fakeD1();
    await saveJournal(db, { day: "2026-03-04", feeling: 4, tags: [" Reise ", "reise", "Alkohol"] });
    const e = await saveJournal(db, { day: "2026-03-04", soreness: 3 });
    expect(e).toMatchObject({ feeling: 4, soreness: 3, tags: ["reise", "alkohol"] });
    expect((await saveJournal(db, { day: "2026-03-04", feeling: null })).feeling).toBeNull();
    expect(await readJournal(db, "2026-03-01")).toHaveLength(1);

    await runBatched(db, [
      upsertWorkout(db, {
        source: "whoop", sourceId: "k1", day: "2026-03-04", startTime: "2026-03-04T17:00:00.000Z", endTime: "2026-03-04T18:00:00.000Z",
        sport: "weightlifting", durationS: 3600, distanceM: null, energyKj: null, avgHr: 110, maxHr: 150, avgPowerW: null, normalizedPowerW: null, strain: 8,
      } as never),
    ]);
    expect((await saveRpe(db, { source: "whoop", sourceId: "k1", rpe: 7 }))?.rpe).toBe(7);
    await expect(saveRpe(db, { source: "whoop", sourceId: "gibtsnicht", rpe: 5 })).rejects.toThrow();
    expect(await readRpe(db, "2026-03-01")).toHaveLength(1);
    expect(sessionRpe(60, 7)).toBe(420);

    const dash = await buildDashboard(db, { days: 7, now: Date.parse("2026-03-04T19:00:00Z") });
    expect(dash.journal.today?.soreness).toBe(3);
    const w = dash.workouts.find((x) => x.sourceId === "k1")!;
    expect(w.rpe).toBe(7);
    expect(w.sessionRpe).toBe(420);
  });
});
