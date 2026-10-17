import { describe, expect, it } from "vitest";
import { drinkFor, personalizeFueling, sweatRate, sweatSummary, type SweatTest } from "../src/core/sweat";

// Synthetische Messungen.
const t = (day: string, rateLph: number, indoor = true): SweatTest => ({ id: 1, day, durationMin: 60, weightBeforeKg: 70, weightAfterKg: 69, drankL: 0.5, indoor, rateLph, lossPct: 1.4 });

describe("Schweißrate (#282)", () => {
  it("rechnet Gewichtsverlust plus Getrunkenes je Stunde", () => {
    expect(sweatRate({ day: "2026-03-31", durationMin: 90, weightBeforeKg: 70, weightAfterKg: 68.8, drankL: 0.9, indoor: true })).toEqual({ rateLph: 1.4, lossPct: 1.7 });
    expect(sweatRate({ day: "2026-03-31", durationMin: 20, weightBeforeKg: 70, weightAfterKg: 69.5, drankL: 0, indoor: true })).toHaveProperty("error");
    expect(sweatRate({ day: "2026-03-31", durationMin: 60, weightBeforeKg: 70, weightAfterKg: 60, drankL: 0, indoor: true })).toHaveProperty("error");
    expect(sweatRate({ day: "2026-03-31", durationMin: 60, weightBeforeKg: 70, weightAfterKg: 70, drankL: 0, indoor: true })).toHaveProperty("error");
  });

  it("Trinkempfehlung ~75 %, begrenzt", () => {
    expect(drinkFor(1.6)).toBe(1.2);
    expect(drinkFor(3)).toBe(1.5);
    expect(drinkFor(0.3)).toBe(0.4);
  });

  it("mittelt je Rolle und draußen und ersetzt die Faustregel", () => {
    const s = sweatSummary([t("2026-03-30", 1.4), t("2026-03-20", 1.2), t("2026-03-25", 0.8, false), t("2024-01-01", 3)], "2026-03-31");
    expect(s.indoor).toMatchObject({ tests: 2, rateLph: 1.3, drinkLph: 1, lastDay: "2026-03-30" });
    expect(s.outdoor).toMatchObject({ tests: 1, rateLph: 0.8 });
    expect(s.text).toContain("Rolle: 1,3 l/h");
    const f = { day: "2026-03-31", short: "60–80 g KH/h · 0,6–1 l/h", before: null, after: null,
      during: "60–80 g Kohlenhydrate pro Stunde (Riegel, Gel, Getränk; ab der ersten halben Stunde regelmäßig), 0,6–0,8 l pro Stunde trinken, auf der Rolle eher 0,8–1 l, mit etwas Salz." };
    const p = personalizeFueling(f, s);
    expect(p.during).toContain("etwa 1 l pro Stunde trinken (deine Schweißrate 1,3 l/h), mit etwas Salz.");
    expect(p.short).toBe("60–80 g KH/h · 1 l/h");
    const short = personalizeFueling({ ...f, short: "30–60 g KH/h · 0,5–0,8 l/h", during: "30–60 g Kohlenhydrate pro Stunde (z. B. Sportgetränk oder ein Riegel), 0,5–0,8 l pro Stunde trinken." }, s);
    expect(short.during).toContain("etwa 1 l pro Stunde trinken");
    expect(personalizeFueling({ ...f, during: "Wasser reicht.", short: "nur Wasser" }, s).short).toBe("nur Wasser");
    expect(personalizeFueling(f, sweatSummary([], "2026-03-31"))).toEqual(f);
  });
});
