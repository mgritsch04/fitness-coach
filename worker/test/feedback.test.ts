import { describe, expect, it } from "vitest";
import type { CoachAdvice } from "../src/core/coach";
import { applyFeedback, feedbackAdjust, type FeedbackEntry, type FeedbackVerdict } from "../src/core/feedback";
import { addDays } from "../src/core/analysis";

// Synthetische Rückmeldungen und Empfehlung.
const today = "2026-03-20";
const fb = (...v: FeedbackVerdict[]): FeedbackEntry[] => v.map((verdict, i) => ({ day: addDays(today, -(i + 1)), verdict, readiness: "moderate", note: null }));
const advice = (readiness: CoachAdvice["readiness"], score: number, warnings: string[] = []): CoachAdvice =>
  ({ day: today, readiness, score, headline: "x", suggestion: "y", targetLoad: { min: 50, max: 100 }, reasons: [], warnings, disclaimer: "" });

describe("Rückmeldung zur Tagesempfehlung (#216)", () => {
  it("unter 4 Rückmeldungen keine Anpassung", () => {
    const a = feedbackAdjust(fb("too_hard", "too_hard", "too_hard"), today);
    expect(a.scoreDelta).toBe(0);
  });

  it("häufig zu hart: begrenzt vorsichtiger, höchstens eine Stufe", () => {
    const a = feedbackAdjust(fb("too_hard", "too_hard", "too_hard", "too_hard", "too_hard"), today);
    expect(a.factor).toBe(-1);
    expect(a.scoreDelta).toBe(-10);
    const r = applyFeedback(advice("hard", 76), a);
    expect(r.readiness).toBe("moderate");
    expect(r.targetLoad).toEqual({ min: 40, max: 80 });
    expect(r.reasons.at(-1)!.factor).toBe("feedback");
    // Selbst bei großem Abstand nie mehr als eine Stufe.
    expect(applyFeedback(advice("hard", 80), { ...a, scoreDelta: -60 }).readiness).toBe("moderate");
  });

  it("gemischt: keine Anpassung", () => {
    expect(feedbackAdjust(fb("ok", "ok", "too_hard", "too_easy", "ok"), today).scoreDelta).toBe(0);
  });

  it("zu leicht hebt wenig und nie bei Warnungen oder Ruhe", () => {
    const a = feedbackAdjust(fb("too_easy", "too_easy", "too_easy", "too_easy"), today);
    expect(a.scoreDelta).toBe(5);
    expect(applyFeedback(advice("moderate", 72), a).readiness).toBe("hard");
    expect(applyFeedback(advice("moderate", 72, ["Warnung"]), a).readiness).toBe("moderate");
    expect(applyFeedback(advice("rest", 33), a).readiness).toBe("rest");
  });

  it("heutige Rückmeldung zählt nicht in die Korrektur", () => {
    const rows = [...fb("ok", "ok", "ok"), { day: today, verdict: "too_hard" as const, readiness: null, note: null }];
    const a = feedbackAdjust(rows, today);
    expect(a.count).toBe(3);
    expect(a.today).toBe("too_hard");
  });
});
