import { describe, expect, it } from "vitest";
import { makeUpPlan } from "../src/core/make-up";
import type { ComparedDay, DayStatus, PlanComparison, SessionType } from "../src/core/plan";

// Mo 23.3. – So 29.3.; heute ist Donnerstag, 26.3.
const TODAY = "2026-03-26";
const d = (day: string, type: SessionType, title: string, status: DayStatus, o: Partial<ComparedDay> = {}): ComparedDay => ({
  day, type, title, durationMin: 60, targetLoad: 50, intensity: "", description: "", key: type !== "endurance" && type !== "recovery" && type !== "rest",
  strength: null, actualLoad: 0, actualMin: 0, actualSports: [], status, strengthDone: null, ...o,
});
const cmp = (days: ComparedDay[]) => ({ days } as PlanComparison);
const base = () => [
  d("2026-03-23", "rest", "Ruhetag", "rest"),
  d("2026-03-24", "threshold", "Schwelle 3×10", "missed"),
  d("2026-03-25", "endurance", "Grundlage Mi", "done"),
  d("2026-03-26", "endurance", "Grundlage Do", "today"),
  d("2026-03-27", "endurance", "Grundlage Fr", "upcoming"),
  d("2026-03-28", "vo2max", "VO2max 5×4", "upcoming"),
  d("2026-03-29", "long", "Lange Fahrt", "upcoming"),
];

describe("makeUpPlan", () => {
  it("null ohne ausgefallene Schlüsseleinheit", () => {
    const days = base();
    days[1].status = "done";
    expect(makeUpPlan(cmp(days), TODAY, "moderate")).toBeNull();
  });
  it("holt heute nach, wenn die Tagesform passt und die Nachbartage locker sind", () => {
    const r = makeUpPlan(cmp(base()), TODAY, "moderate")!;
    expect(r.missed.title).toBe("Schwelle 3×10");
    expect(r.day).toBe(TODAY);
    expect(r.replaces).toBe("Grundlage Do");
    expect(r.text).toContain("heute");
  });
  it("nicht heute bei lockerer Tagesform; Freitag liegt vor VO2max und fällt aus → nicht nachholen", () => {
    const r = makeUpPlan(cmp(base()), TODAY, "easy")!;
    expect(r.day).toBeNull();
    expect(r.text).toContain("nicht nachholen");
  });
  it("kein Tag direkt nach einem harten Tag oder mit schweren Beinen", () => {
    const days = base();
    days[2] = d("2026-03-25", "tempo", "Tempo Mi", "done", { key: false });
    days[5] = d("2026-03-28", "endurance", "Grundlage Sa", "upcoming", { strength: { durationMin: 45, focus: "Beine + Rumpf" } });
    days[6] = d("2026-03-29", "endurance", "Grundlage So", "upcoming");
    // Do folgt auf Tempo, Fr liegt vor dem Beintag, Sa hat Beine, So folgt auf Beine: kein Tag passt.
    expect(makeUpPlan(cmp(days), TODAY, "moderate")!.day).toBeNull();
    // Ohne Beine am Samstag passt der Freitag (Do bleibt gesperrt).
    days[5] = d("2026-03-28", "endurance", "Grundlage Sa", "upcoming");
    const r = makeUpPlan(cmp(days), TODAY, "moderate")!;
    expect(r.day).toBe("2026-03-27");
    expect(r.text).toContain("am Freitag");
  });
  it("nur die wichtigste Einheit nachholen, weitere entfallen", () => {
    const days = base();
    days[0] = d("2026-03-23", "tempo", "Tempo Mo", "missed");
    const r = makeUpPlan(cmp(days), TODAY, "moderate")!;
    expect(r.missed.title).toBe("Schwelle 3×10");
    expect(r.dropped).toEqual(["Tempo Mo (Montag)"]);
    expect(r.text).toContain("entfällt");
  });
  it("Intervalle nur locker gefahren zählen als ausgefallen", () => {
    const days = base();
    days[1].status = "partial";
    expect(makeUpPlan(cmp(days), TODAY, "hard")?.missed.title).toBe("Schwelle 3×10");
  });
});
