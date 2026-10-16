import { describe, expect, it } from "vitest";
import type { CoachAdvice, Readiness } from "../src/core/coach";
import { applyWarning } from "../src/core/warning-cap";

const advice = (readiness: Readiness): CoachAdvice => ({
  day: "2026-03-04", readiness, score: 80, headline: "x", suggestion: "x", targetLoad: { min: 60, max: 90 }, reasons: [], warnings: [], disclaimer: "",
});
const w = (level: "none" | "watch" | "caution" | "alert") => ({ level, headline: "H", advice: "Rat" });

describe("applyWarning (Frühwarnung → Empfehlung)", () => {
  it("lässt none/watch unverändert", () => {
    expect(applyWarning(advice("hard"), w("watch"))).toEqual(advice("hard"));
  });
  it("caution begrenzt auf locker", () => {
    const a = applyWarning(advice("hard"), w("caution"));
    expect(a.readiness).toBe("easy");
    expect(a.targetLoad).toEqual({ min: 36, max: 54 });
    expect(a.reasons.at(-1)).toMatchObject({ factor: "warning", effect: "down", text: "Rat" });
  });
  it("alert → Ruhe", () => {
    expect(applyWarning(advice("moderate"), w("alert")).readiness).toBe("rest");
  });
  it("macht nie härter", () => {
    expect(applyWarning(advice("rest"), w("caution")).readiness).toBe("rest");
  });
});
