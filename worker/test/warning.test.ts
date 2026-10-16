import { describe, expect, it } from "vitest";
import { addDays, type DayPoint } from "../src/core/analysis";
import type { CoachAdvice } from "../src/core/coach";
import { applyWarning, earlyWarning } from "../src/core/warning";

// Synthetische Verläufe: 40 Tage leicht schwankende Basis, danach gezielte Abweichungen.
const START = "2026-02-01";
function series(days = 40, tweak: (i: number, p: DayPoint) => void = () => {}): DayPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const w = (i % 5) - 2; // −2 … +2
    const p: DayPoint = {
      day: addDays(START, i), recovery: 60, hrv: 70 + w, rhr: 50 + (w > 0 ? 1 : 0), spo2: 96 + w * 0.2, skinTemp: 33 + w * 0.05, strain: 10,
      sleepH: 7.5, sleepPerf: 85, sleepEff: 92, deepH: 1.5, remH: 1.5, respRate: 15 + w * 0.1, load: 50, ctl: 40, atl: 40, tsb: 0, workouts: 1, trainingMin: 60,
    };
    tweak(i, p);
    return p;
  });
}
const last = (s: DayPoint[]) => s.at(-1)!.day;
const advice = (readiness: CoachAdvice["readiness"]): CoachAdvice => ({
  day: "", readiness, score: 85, headline: "", suggestion: "", targetLoad: { min: 60, max: 90 }, reasons: [], warnings: [], disclaimer: "",
});

describe("Frühwarnung", () => {
  it("bleibt ruhig bei normalen Werten", () => {
    const s = series();
    expect(earlyWarning(s, last(s)).level).toBe("none");
  });

  it("meldet einen einzelnen Ausreißer nur zur Beobachtung", () => {
    const s = series(40, (i, p) => { if (i === 39) p.rhr = 58; });
    const w = earlyWarning(s, last(s));
    expect(w.level).toBe("watch");
    expect(w.signals[0].key).toBe("rhr");
    expect(applyWarning(advice("hard"), w).readiness).toBe("hard");
  });

  it("dämpft bei zwei Signalen auf locker", () => {
    const s = series(40, (i, p) => { if (i === 39) { p.rhr = 57; p.hrv = 55; } });
    const w = earlyWarning(s, last(s));
    expect(w.level).toBe("elevated");
    const a = applyWarning(advice("hard"), w);
    expect(a.readiness).toBe("easy");
    expect(a.warnings[0]).toContain("Ruhepuls");
    expect(a.reasons.at(-1)!.factor).toBe("warning");
  });

  it("schlägt bei drei Signalen deutlich an und rät zu Ruhe", () => {
    const s = series(40, (i, p) => { if (i === 39) { p.rhr = 58; p.hrv = 52; p.respRate = 16.5; p.skinTemp = 33.8; } });
    const w = earlyWarning(s, last(s));
    expect(w.level).toBe("high");
    expect(w.signals.map((x) => x.key).sort()).toEqual(["hrv", "respRate", "rhr", "skinTemp"]);
    expect(w.text).toContain("ärztlich");
    expect(applyWarning(advice("moderate"), w).readiness).toBe("rest");
  });

  it("wertet zwei Signale an zwei Tagen in Folge als deutlich", () => {
    const s = series(40, (i, p) => { if (i >= 38) { p.rhr = 57; p.hrv = 55; } });
    const w = earlyWarning(s, last(s));
    expect(w.level).toBe("high");
    expect(w.streak).toBe(2);
  });

  it("nimmt gestern, solange heute noch keine Erholungswerte da sind", () => {
    const s = series(40, (i, p) => {
      if (i === 38) { p.rhr = 58; p.hrv = 52; p.respRate = 16.5; }
      if (i === 39) { p.rhr = null; p.hrv = null; p.respRate = null; p.skinTemp = null; p.spo2 = null; }
    });
    expect(earlyWarning(s, last(s)).level).toBe("high");
  });

  it("macht die Empfehlung nie härter", () => {
    const s = series(40, (i, p) => { if (i === 39) { p.rhr = 57; p.hrv = 55; } });
    expect(applyWarning(advice("rest"), earlyWarning(s, last(s))).readiness).toBe("rest");
  });
});
