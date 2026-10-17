import { describe, expect, it } from "vitest";
import { MOBILITY_KINDS, mobilityKindFor, mobilityRoutine } from "../src/core/mobility";

// Synthetische Planeinheiten.
const s = (type: string, durationMin: number, focus?: string) => ({ type, durationMin, strength: focus ? { durationMin: 40, focus } : null }) as never;

describe("Mobility nach der Einheit (#223)", () => {
  it("wählt die Routine nach Einheit und Kraftfokus", () => {
    expect(mobilityKindFor(s("long", 150))).toBe("ride_long");
    expect(mobilityKindFor(s("threshold", 75))).toBe("ride_intervals");
    expect(mobilityKindFor(s("tempo", 70, "Beine + Rumpf (schwer)"))).toBe("legs");
    expect(mobilityKindFor(s("strength", 40, "Oberkörper (Zug)"))).toBe("upper");
    expect(mobilityKindFor(s("rest", 0))).toBe("general");
    expect(mobilityKindFor(null)).toBe("general");
  });

  it("jede Routine dauert 5–10 min", () => {
    for (const k of MOBILITY_KINDS) {
      const r = mobilityRoutine(k);
      expect(r.minutes).toBeGreaterThanOrEqual(5);
      expect(r.minutes).toBeLessThanOrEqual(10);
      expect(r.exercises.every((e) => e.seconds >= 15 && e.cue)).toBe(true);
    }
  });
});
