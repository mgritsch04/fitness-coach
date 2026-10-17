import { describe, expect, it } from "vitest";
import { sameDayAdvice } from "../src/core/same-day";

// Synthetische Plantage.
const d = (type: string, durationMin: number, focus?: string) => ({ day: "2026-03-31", type, durationMin, strength: focus ? { durationMin: 45, focus } : null }) as never;

describe("Doppeltage (#298)", () => {
  it("nur bei Rad plus Kraft", () => {
    expect(sameDayAdvice(d("endurance", 60))).toBeNull();
    expect(sameDayAdvice(d("strength", 0, "Beine + Rumpf (schwer)"))).toBeNull();
  });

  it("harte Radeinheit zuerst, Beine sind ein Konflikt", () => {
    expect(sameDayAdvice(d("vo2max", 75, "Beine + Rumpf (schwer)"))).toMatchObject({ order: "ride_first", gapH: 6, conflict: true });
    expect(sameDayAdvice(d("threshold", 75, "Oberkörper (Zug)"))).toMatchObject({ order: "ride_first", gapH: 3, conflict: false });
    expect(sameDayAdvice(d("long", 180, "Beine + Rumpf (schwer)"))).toMatchObject({ order: "ride_first", conflict: true });
  });

  it("Beinkraft vor lockerem Rad, Oberkörper egal", () => {
    expect(sameDayAdvice(d("endurance", 60, "Ganzkörper"))).toMatchObject({ order: "strength_first", gapH: 0 });
    expect(sameDayAdvice(d("recovery", 40, "Oberkörper (Druck)"))).toMatchObject({ order: "any", conflict: false });
    expect(sameDayAdvice(d("endurance", 60, "Ganzkörper leicht"))?.order).toBe("any");
  });
});
