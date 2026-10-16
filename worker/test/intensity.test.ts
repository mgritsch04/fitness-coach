import { describe, expect, it } from "vitest";
import type { CoachAdvice } from "../src/core/coach";
import { intensityCheck, type TrainingInputs } from "../src/core/training";

const coach = { day: "2026-03-28", readiness: "moderate", score: 60, headline: "", suggestion: "", targetLoad: null, reasons: [], warnings: [], disclaimer: "" } as CoachAdvice;
const input = (hrs: number[], origin: "default" | "user" = "default"): TrainingInputs => ({
  today: "2026-03-28",
  days: [],
  weeks: [],
  coach,
  settings: { ftpW: null, thresholdHr: 170, maxHr: 190, origin: { ftpW: "none", maxHr: "data", restingHr: "data", thresholdHr: origin, sleepNeedH: "default", timezone: "default" } },
  workouts: hrs.map((avgHr, i) => ({ day: `2026-03-${String(10 + i).padStart(2, "0")}`, sport: "spin", durationMin: 45, load: 20, avgHr })),
});

describe("intensityCheck", () => {
  it("erkennt zu lockere Grundlage und weist auf die geschätzte Schwelle hin", () => {
    const r = intensityCheck(input([105, 110, 100, 112]))!;
    expect(r.verdict).toBe("below");
    expect(r.zone2).toEqual({ min: 136, max: 151 });
    expect(r.text).toContain("geschätzt");
  });
  it("ok im Bereich, ohne Hinweis bei eigener Schwelle", () => {
    const r = intensityCheck(input([140, 145, 130, 150], "user"))!;
    expect(r.verdict).toBe("ok");
    expect(r.text).not.toContain("geschätzt");
  });
  it("zu hart", () => {
    expect(intensityCheck(input([160, 158, 155, 140]))!.verdict).toBe("above");
  });
  it("null bei zu wenig Einheiten oder Kraft", () => {
    expect(intensityCheck(input([105, 110]))).toBeNull();
    const k = input([105, 110, 100]);
    k.workouts.forEach((w) => (w.sport = "bodybuilding"));
    expect(intensityCheck(k)).toBeNull();
  });
});
