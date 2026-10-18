import { describe, expect, it } from "vitest";
import { describeExercise } from "../src/core/exercise-describe";

const top = (text: string) => describeExercise(text).suggestions.map((s) => s.exercise);

describe("Übung beschreiben (#327)", () => {
  it("findet typische Übungen aus Alltagsbeschreibungen", () => {
    expect(top("Am Kabel sitzend von oben zur Brust runterziehen, Rücken breit")[0]).toBe("lat_pulldown");
    expect(top("Maschine, im Sitzen die Beine strecken, Polster am Unterschenkel")[0]).toBe("leg_extension");
    expect(top("auf der Schrägbank liegend mit der Langhantel drücken")[0]).toBe("incline_bench_press");
    expect(top("Kurzhanteln seitlich bis Schulterhöhe heben")[0]).toBe("lateral_raise");
    expect(top("an der Stange hängend die Knie zur Brust hochziehen, Bauch")[0]).toBe("hanging_leg_raise");
    expect(top("Schultern auf der Bank, Hüfte mit Stange nach oben drücken, Po")[0]).toBe("hip_thrust");
  });

  it("liefert höchstens drei Vorschläge mit Muskeln und Begründung", () => {
    const r = describeExercise("Rudern am Kabel sitzend zum Bauch ziehen");
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions.length).toBeLessThanOrEqual(3);
    expect(r.suggestions[0]).toMatchObject({ exercise: "cable_row", name: "Rudern am Kabel", match: 100 });
    expect(r.suggestions[0].muscles).toContain("Rücken");
    expect(r.suggestions[0].why.length).toBeGreaterThan(0);
  });

  it("bietet bei Unbekanntem eine eigene Übung an", () => {
    const r = describeExercise("Reifen umwerfen draußen");
    expect(r.suggestions).toEqual([]);
    expect(r.custom.name).toBe("Reifen umwerfen draußen");
    expect(r.note).toMatch(/eigene Übung/);
  });
});
