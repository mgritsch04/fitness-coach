import { describe, expect, it } from "vitest";
import type { CoachAdvice } from "../src/core/coach";
import { applyHrvTrend } from "../src/core/hrv-cap";

const advice = (readiness: CoachAdvice["readiness"]): CoachAdvice => ({
  day: "2026-03-28", readiness, score: 85, headline: "", suggestion: "Intervalle", targetLoad: { min: 80, max: 120 }, reasons: [], warnings: [], disclaimer: "",
});

describe("applyHrvTrend", () => {
  it("Ermüdung begrenzt auf locker und nennt den Grund", () => {
    const r = applyHrvTrend(advice("hard"), { pattern: "fatigue", label: "Ermüdung baut sich auf", advice: "1–2 lockere Tage." });
    expect(r.readiness).toBe("easy");
    expect(r.targetLoad).toEqual({ min: 48, max: 72 });
    expect(r.reasons.at(-1)).toMatchObject({ factor: "hrv_trend", effect: "down" });
    expect(r.warnings.join(" ")).toContain("HRV-Trend");
  });
  it("niedrig begrenzt nur auf normal, macht nie härter", () => {
    expect(applyHrvTrend(advice("hard"), { pattern: "low", label: "Unter deinem Normalbereich", advice: "" }).readiness).toBe("moderate");
    expect(applyHrvTrend(advice("rest"), { pattern: "fatigue", label: "x", advice: "" }).readiness).toBe("rest");
  });
  it("stabil oder ohne Daten: unverändert; hoch nur als Begründung", () => {
    const a = advice("moderate");
    expect(applyHrvTrend(a, null)).toBe(a);
    expect(applyHrvTrend(a, { pattern: "stable", label: "", advice: "" })).toBe(a);
    const h = applyHrvTrend(a, { pattern: "high", label: "Über deinem Normalbereich", advice: "" });
    expect(h.readiness).toBe("moderate");
    expect(h.reasons.at(-1)?.effect).toBe("up");
  });
});
