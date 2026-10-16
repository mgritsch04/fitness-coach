import { describe, expect, it } from "vitest";
import { fuelingFor } from "../src/core/fueling";

const s = (type: Parameters<typeof fuelingFor>[0]["type"], durationMin: number, strength: { durationMin: number; focus: string } | null = null) => ({ day: "2026-03-07", type, durationMin, strength });

describe("fuelingFor", () => {
  it("Ruhetag ohne Hinweis, kurze lockere Fahrt nur Wasser", () => {
    expect(fuelingFor(s("rest", 0), 70)).toBeNull();
    const f = fuelingFor(s("recovery", 45), 70)!;
    expect(f.short).toBe("nur Wasser");
    expect(f.before).toBeNull();
    expect(f.after).toBeNull();
  });
  it("lange Fahrt: Kohlenhydrate je Stunde, Mengen nach Gewicht", () => {
    const f = fuelingFor(s("long", 180), 65)!;
    expect(f.short).toBe("70–90 g KH/h · 0,6–1 l/h");
    expect(f.before).toContain("100 g");
    expect(f.after).toContain("65 g Kohlenhydrate und 20 g Eiweiß");
  });
  it("Intervalle unter einer Stunde brauchen trotzdem etwas", () => {
    expect(fuelingFor(s("vo2max", 50), null)!.short).toBe("30–60 g KH/h · 0,5–0,8 l/h");
  });
  it("Kraft: Eiweiß danach", () => {
    const f = fuelingFor(s("strength", 40, { durationMin: 40, focus: "Beine" }), 80)!;
    expect(f.short).toBe("danach 25 g Eiweiß");
    expect(fuelingFor(s("endurance", 45, { durationMin: 40, focus: "Oberkörper" }), 80)!.after).toContain("Nach der Kraft");
  });
});
