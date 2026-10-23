import { beforeAll, describe, expect, it } from "vitest";

// Der Zettel (#374) liegt im Dashboard-Artefakt; hier ohne Browser geprüft.
type Sheet = { compute: (i: Record<string, unknown>) => any };
let FS: Sheet;
beforeAll(async () => {
  // @ts-ignore reine JS-Datei des Artefakts
  await import("../../artifact/sections/fuelsheet.js");
  FS = (globalThis as any).FuelSheet;
});

const fuel = { day: "2026-03-07", short: "", before: "2–3 h vorher essen.", during: "x", after: "Danach essen." };
const ride = (type: string, durationMin: number) => ({ day: "2026-03-07", type, title: type, durationMin });
const sweat = { indoor: { tests: 2, rateLph: 1.4, drinkLph: 1.1, lastDay: "2026-03-01" }, outdoor: { tests: 1, rateLph: 1.0, drinkLph: 0.8, lastDay: "2026-03-02" } };
const wx = (verdict: string, t: number) => ({ day: "2026-03-07", advice: { verdict }, best: { tempMin: t - 1, tempMax: t + 1 } });

describe("Verpflegungszettel", () => {
  it("unter 75 min, Kraft und Ruhetag: kein Zettel", () => {
    expect(FS.compute({ session: ride("endurance", 70), fuel, sweat })).toBeNull();
    expect(FS.compute({ session: ride("strength", 90), fuel, sweat })).toBeNull();
    expect(FS.compute({ session: ride("rest", 0), fuel, sweat })).toBeNull();
  });
  it("lange Einheit: Mengen je Stunde und gesamt, persönliche Trinkmenge", () => {
    const z = FS.compute({ session: ride("long", 180), fuel, sweat });
    expect(z.perHour.carbsG).toEqual([70, 90]);
    expect(z.perHour.drinkL).toBe(1.1);
    expect(z.perHour.sodiumMg).toBe(550);
    expect(z.total.carbsG).toEqual([210, 270]);
    expect(z.total.drinkL).toBe(3.3);
    expect(z.before).toBe(fuel.before);
    expect(z.note).toMatch(/keine Ernährungsberatung/);
  });
  it("mehr Dauer oder Intensität erhöht die Kohlenhydrate", () => {
    const mid = FS.compute({ session: ride("endurance", 80), fuel, sweat }).perHour.carbsG;
    const longer = FS.compute({ session: ride("endurance", 120), fuel, sweat }).perHour.carbsG;
    const harder = FS.compute({ session: ride("threshold", 80), fuel, sweat }).perHour.carbsG;
    expect(mid).toEqual([40, 60]);
    expect(longer[0]).toBeGreaterThan(mid[0]);
    expect(harder[0]).toBeGreaterThan(mid[0]);
    expect(Math.max(...FS.compute({ session: ride("race", 240), fuel, sweat }).perHour.carbsG)).toBeLessThanOrEqual(90);
  });
  it("Hitze draußen: mehr Trinken und Natrium; Rolle ignoriert das Wetter", () => {
    const base = FS.compute({ session: ride("endurance", 120), fuel, sweat, weatherDay: wx("outside", 18) });
    const hot = FS.compute({ session: ride("endurance", 120), fuel, sweat, weatherDay: wx("outside", 32) });
    expect(hot.perHour.drinkL).toBeCloseTo(base.perHour.drinkL + 0.3, 1);
    expect(hot.perHour.sodiumMg).toBeGreaterThan(base.perHour.sodiumMg);
    expect(FS.compute({ session: ride("endurance", 120), fuel, sweat, weatherDay: wx("indoor", 32) }).perHour.drinkL).toBe(1.1);
  });
  it("ohne Schweißrate: Faustregel und Hinweis", () => {
    const z = FS.compute({ session: ride("endurance", 120), fuel, sweat: { indoor: null, outdoor: null } });
    expect(z.perHour.drinkL).toBe(0.9);
    expect(z.drinkBasis).toMatch(/Faustregel/);
  });
});

describe("Verpflegungszettel: vorher und danach", () => {
  it("auch bei 80 min locker mit Gewicht", () => {
    const z = FS.compute({ session: ride("endurance", 80), fuel: { ...fuel, before: null, after: null }, sweat, weightKg: 70 });
    expect(z.before).toContain("105 g");
    expect(z.after).toBe("Danach innerhalb von 1–2 h 70 g Kohlenhydrate und 20 g Eiweiß essen.");
  });
});
