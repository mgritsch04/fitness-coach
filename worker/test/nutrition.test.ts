import { describe, expect, it } from "vitest";
import { dailyNutrition, dayLevel } from "../src/core/nutrition";

// Synthetische Planeinheiten.
const s = (type: string, durationMin: number, strength: unknown = null) => ({ day: "2026-01-05", type, durationMin, strength }) as never;

describe("Eiweiß und Kohlenhydrate je Tag (#222)", () => {
  it("stuft den Tag nach Einheit und Dauer ein", () => {
    expect(dayLevel(s("rest", 0))).toBe("rest");
    expect(dayLevel(s("strength", 45))).toBe("light");
    expect(dayLevel(s("endurance", 60))).toBe("moderate");
    expect(dayLevel(s("endurance", 120))).toBe("hard");
    expect(dayLevel(s("threshold", 75))).toBe("hard");
    expect(dayLevel(s("long", 180))).toBe("very_hard");
  });

  it("senkt die Stufe nach der Tagesform", () => {
    expect(dayLevel(s("long", 180), "rest")).toBe("rest");
    expect(dayLevel(s("threshold", 75), "easy")).toBe("light");
    expect(dayLevel(s("threshold", 75), "hard")).toBe("hard");
  });

  it("rechnet Gramm aus dem Gewicht, mehr Eiweiß an Krafttagen", () => {
    const long = dailyNutrition(s("long", 180), 75);
    expect(long.carbsG).toEqual({ min: 600, max: 750 });
    expect(long.proteinG).toEqual({ min: 120, max: 135 });
    expect(long.text).toContain("vor, während und nach");
    const kraft = dailyNutrition(s("endurance", 60, { durationMin: 40 }), 75);
    expect(kraft.proteinPerKg.max).toBe(2);
    expect(kraft.proteinG).toEqual({ min: 120, max: 150 });
  });

  it("ohne Gewicht nur g/kg", () => {
    const r = dailyNutrition(s("rest", 0), null);
    expect(r.carbsG).toBeNull();
    expect(r.short).toBe("KH 3–4 g/kg · Eiweiß 1,6–1,8 g/kg");
  });
});
