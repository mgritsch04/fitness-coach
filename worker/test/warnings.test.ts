import { describe, expect, it } from "vitest";
import { addDays, type DayPoint } from "../src/core/analysis";
import { earlyWarning, signalsFor } from "../src/core/warnings";

// Synthetische Verläufe, keine echten Messwerte.

const point = (day: string, o: Partial<DayPoint> = {}): DayPoint => ({
  day, recovery: null, hrv: null, rhr: null, spo2: null, skinTemp: null, strain: null, sleepH: null, sleepPerf: null, sleepEff: null,
  deepH: null, remH: null, respRate: null, load: 0, ctl: 0, atl: 0, tsb: 0, workouts: 0, trainingMin: 0, ...o,
});

const FROM = "2026-01-01";
const TODAY = addDays(FROM, 40);
/** 40 normale Tage mit kleinen Schwankungen, dann `last` für die letzten Tage. */
function series(last: Partial<DayPoint>, lastDays = 1, todayMissing = false): DayPoint[] {
  return Array.from({ length: 41 }, (_, i) => {
    const day = addDays(FROM, i);
    const wiggle = (i % 3) - 1; // −1, 0, 1
    const normal = { rhr: 50 + wiggle, hrv: 70 + 3 * wiggle, respRate: 15 + 0.2 * wiggle, skinTemp: 33.5 + 0.1 * wiggle, spo2: 96 + 0.3 * wiggle, recovery: 65 };
    if (todayMissing && day === TODAY) return point(day);
    return point(day, i > 40 - lastDays ? { ...normal, ...last } : normal);
  });
}

describe("Frühwarnung", () => {
  it("alles normal → keine Warnung", () => {
    const w = earlyWarning(series({}), TODAY);
    expect(w).toMatchObject({ day: TODAY, level: "none", flaggedCount: 0 });
    expect(w.signals).toHaveLength(5);
    expect(w.disclaimer).toContain("keine medizinische Diagnose");
  });

  it("ein Signal → beobachten", () => {
    const w = earlyWarning(series({ rhr: 57 }), TODAY);
    expect(w.level).toBe("watch");
    const rhr = w.signals.find((s) => s.key === "rhr")!;
    expect(rhr.flagged).toBe(true);
    expect(rhr.baseline).toBeCloseTo(50, 0);
    expect(w.advice).toContain("Ruhepuls 7 Schläge über deiner Basis");
  });

  it("zwei Signale → schonen, drei → Ruhetag", () => {
    expect(earlyWarning(series({ rhr: 57, hrv: 55 }), TODAY).level).toBe("caution");
    const w = earlyWarning(series({ rhr: 57, hrv: 55, respRate: 16.5, skinTemp: 34.2 }), TODAY);
    expect(w.level).toBe("alert");
    expect(w.flaggedCount).toBe(4);
    expect(w.advice).toContain("Atemfrequenz 1,5 Atemzüge/min");
    expect(w.advice).toContain("Ruhetag");
  });

  it("zwei Signale über zwei Tage → Ruhetag", () => {
    const w = earlyWarning(series({ rhr: 57, hrv: 55 }, 2), TODAY);
    expect(w).toMatchObject({ level: "alert", consecutiveDays: 2 });
    expect(w.advice).toContain("seit 2 Tagen");
  });

  it("günstige Abweichungen zählen nicht (HRV hoch, Ruhepuls niedrig)", () => {
    expect(earlyWarning(series({ rhr: 44, hrv: 90, spo2: 99 }), TODAY).level).toBe("none");
  });

  it("kleine Abweichungen unter der Mindestschwelle zählen nicht", () => {
    expect(signalsFor(series({ rhr: 53 }), TODAY).find((s) => s.key === "rhr")!.flagged).toBe(false);
  });

  it("nimmt gestern, wenn heute noch nichts gemessen ist", () => {
    expect(earlyWarning(series({ rhr: 57, hrv: 55 }, 2, true), TODAY)).toMatchObject({ day: addDays(TODAY, -1), level: "caution" });
  });

  it("fehlende Werte von heute kommen von gestern", () => {
    const sr = series({ rhr: 57, hrv: 55 }, 2);
    const today = sr.at(-1)!;
    Object.assign(today, { rhr: null, hrv: null }); // Erholung heute noch nicht ausgewertet
    const w = earlyWarning(sr, TODAY);
    expect(w).toMatchObject({ day: TODAY, level: "caution", flaggedCount: 2 });
    expect(w.signals.find((s) => s.key === "rhr")).toMatchObject({ flagged: true, fromDay: addDays(TODAY, -1) });
  });

  it("ohne Basis keine Aussage", () => {
    const w = earlyWarning(series({}).slice(-5), TODAY);
    expect(w).toMatchObject({ day: null, level: "none" });
    expect(w.headline).toContain("zu wenig Daten");
  });
});
