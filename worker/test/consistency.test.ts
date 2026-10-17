import { describe, expect, it } from "vitest";
import { addDays } from "../src/core/analysis";
import { consistency, weekCounts } from "../src/core/consistency";

// Synthetische Workouts; heute ist Mittwoch, 2026-03-25 (Woche ab Montag 2026-03-23).
const today = "2026-03-25", cur = "2026-03-23";
const gym = (day: string) => ({ day, sport: "weightlifting", durationMin: 60 });
const ride = (day: string, min = 60) => ({ day, sport: "cycling", durationMin: min });
/** Woche mit n Kraft- und m Radeinheiten (Kraft Mo, Mi, …; Rad Di, Do, …). */
const week = (ws: string, n: number, m: number) => [
  ...Array.from({ length: n }, (_, i) => gym(addDays(ws, i * 2))),
  ...Array.from({ length: m }, (_, i) => ride(addDays(ws, 1 + i * 2))),
];

describe("Konstanz und Serien (#209)", () => {
  it("zählt Kraft einmal pro Tag und Rad erst ab 20 min", () => {
    const w = [gym(cur), gym(cur), ride(cur, 15), ride(addDays(cur, 1)), { day: addDays(cur, 2), sport: "running", durationMin: 40 }];
    expect(weekCounts(w, cur)).toEqual({ strength: 1, rides: 1 });
  });

  it("Serie mit festem Wochenziel, laufende Woche bricht sie nicht ab", () => {
    const workouts = [
      ...week(addDays(cur, -28), 1, 1), // verfehlt
      ...week(addDays(cur, -21), 2, 3),
      ...week(addDays(cur, -14), 2, 3),
      ...week(addDays(cur, -7), 3, 3),
      gym(cur), // diese Woche erst 1× Kraft
    ];
    const r = consistency({ today, workouts, prefs: { strengthPerWeek: 2, ridesPerWeek: 3 } });
    expect(r.target).toMatchObject({ strength: 2, rides: 3, strengthSource: "prefs" });
    expect(r.weeks).toHaveLength(12);
    expect(r.streak).toBe(3);
    expect(r.bestStreak).toBe(3);
    expect(r.weeks.at(-1)).toMatchObject({ current: true, met: false, strength: 1 });
    expect(r.ratePct).toBe(75); // 3 von 4 abgeschlossenen Wochen seit Beginn der Aufzeichnung
    expect(r.text).toContain("3 Wochen in Folge 2× Kraft + 3× Rad");
    expect(r.text).toContain("fehlen noch 1× Kraft und 3× Rad");
  });

  it("schätzt das Ziel aus den letzten Wochen und kennzeichnet es", () => {
    const workouts = [...week(addDays(cur, -21), 4, 2), ...week(addDays(cur, -14), 4, 2), ...week(addDays(cur, -7), 3, 1)];
    const r = consistency({ today, workouts, prefs: { strengthPerWeek: null } });
    expect(r.target).toMatchObject({ strength: 4, rides: 2, strengthSource: "estimate", ridesSource: "estimate" });
    expect(r.streak).toBe(0);
    expect(r.bestStreak).toBe(2);
    expect(r.note).toContain("geschätzt");
  });

  it("Plan-Treue aus gespeicherten Plänen, ohne Daten keine Quote", () => {
    const r = consistency({ today, workouts: [], prefs: {}, plans: [{ week: addDays(cur, -7), planned: 5, done: 4 }, { week: cur, planned: 2, done: 1 }] });
    expect(r.planAdherencePct).toBe(71);
    expect(r.ratePct).toBeNull();
    expect(r.text).toContain("Noch keine Einheiten");
  });
});
