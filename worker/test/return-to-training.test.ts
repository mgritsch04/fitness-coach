import { describe, expect, it } from "vitest";
import { addDays, type DayPoint } from "../src/core/analysis";
import type { CoachAdvice } from "../src/core/coach";
import type { JournalEntry } from "../src/core/journal";
import { applyReturn, returnToTraining } from "../src/core/return-to-training";

const TODAY = "2026-03-30";
/** Synthetische Tage: 40 Tage, an `off` kein Training; Ruhepuls 50, HRV 70 (heute optional anders). */
function series(off: (day: string) => boolean, today?: Partial<DayPoint>): DayPoint[] {
  const out: DayPoint[] = [];
  for (let i = 39; i >= 0; i--) {
    const day = addDays(TODAY, -i);
    out.push({ day, recovery: 60, hrv: 70, rhr: 50, spo2: null, skinTemp: null, strain: 10, sleepH: 7.5, sleepPerf: null, sleepEff: null, deepH: null, remH: null, respRate: null,
      load: 40, ctl: 40, atl: 40, tsb: 0, workouts: off(day) ? 0 : 1, trainingMin: off(day) ? 0 : 60, ...(day === TODAY ? today : {}) });
  }
  return out;
}
const j = (day: string, tags: string[]): JournalEntry => ({ day, feeling: null, energy: null, soreness: null, stress: null, motivation: null, notes: null, tags });
const advice = (readiness: CoachAdvice["readiness"]) => ({ day: TODAY, readiness, score: 85, headline: "", suggestion: "", targetLoad: { min: 80, max: 120 }, reasons: [], warnings: [], disclaimer: "" }) as CoachAdvice;

describe("returnToTraining", () => {
  it("null bei regelmäßigem Training mit einzelnen Ruhetagen", () => {
    expect(returnToTraining(series((d) => d === "2026-03-27" || d === "2026-03-24"), [], TODAY)).toBeNull();
  });
  it("erkennt 5 Tage Pause und startet mit Stufe 1", () => {
    // Pause 24.–28.3., gestern (29.) wieder trainiert → heute Tag 2 von 5.
    const r = returnToTraining(series((d) => d >= "2026-03-24" && d <= "2026-03-28"), [], TODAY)!;
    expect(r.reason).toBe("pause");
    expect(r.breakDays).toBe(5);
    expect(r.day).toBe(2);
    expect(r.totalDays).toBe(5);
    expect(r.stage!.stage).toBe(1);
    expect(r.text).toContain("Wiedereinstieg nach 5 Tagen Pause");
  });
  it("nach dem Ende des Wiedereinstiegs wieder null", () => {
    expect(returnToTraining(series((d) => d >= "2026-03-15" && d <= "2026-03-19"), [], TODAY)).toBeNull();
  });
  it("Krankheit aus dem Tagebuch: heute krank → erst gesund werden, danach vorsichtiger und länger", () => {
    const tags = ["2026-03-26", "2026-03-27", "2026-03-28"].map((d) => j(d, ["krank"]));
    const sick = returnToTraining(series(() => false), [...tags, j(TODAY, ["erkältet"])], TODAY)!;
    expect(sick.status).toBe("sick");
    expect(sick.stage).toBeNull();
    const back = returnToTraining(series(() => false), tags, TODAY)!;
    expect(back.status).toBe("return");
    expect(back.reason).toBe("sick");
    expect(back.totalDays).toBe(6);
    expect(back.day).toBe(2);
    expect(back.stage!.stage).toBe(1);
    expect(back.disclaimer).toContain("Fieber");
  });
  it("Abbruchregel bei erhöhtem Ruhepuls", () => {
    const r = returnToTraining(series((d) => d >= "2026-03-24" && d <= "2026-03-28", { rhr: 57 }), [], TODAY)!;
    expect(r.abort).toContain("Ruhepuls 7 Schläge");
    expect(applyReturn(advice("hard"), r).readiness).toBe("rest");
  });
  it("applyReturn deckelt je Stufe und macht nie härter", () => {
    const r = returnToTraining(series((d) => d >= "2026-03-24" && d <= "2026-03-28"), [], TODAY)!;
    const capped = applyReturn(advice("hard"), r);
    expect(capped.readiness).toBe("easy");
    expect(capped.targetLoad).toEqual({ min: 40, max: 60 });
    expect(capped.reasons.at(-1)!.factor).toBe("return");
    expect(applyReturn(advice("rest"), r).readiness).toBe("rest");
    expect(applyReturn(advice("hard"), null).readiness).toBe("hard");
  });
});
