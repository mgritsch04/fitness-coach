import { describe, expect, it } from "vitest";
import { estimateMin, priorityOf, strengthExpress } from "../src/core/strength-express";

// Synthetische Oberkörper-/Ganzkörpereinheit, ungekürzt gut 70 min.
const session = [
  { name: "Kniebeuge", sets: 4, reps: 5, weightKg: 100 },
  { name: "Bankdrücken", sets: 4, reps: 6, weightKg: 70 },
  { name: "Kurzhantelrudern", sets: 3, reps: 10, weightKg: 26 },
  { name: "Schrägbankdrücken", sets: 3, reps: 10, weightKg: 50 },
  { name: "Bizepscurls", sets: 3, reps: 12, weightKg: 12 },
  { name: "Plank", sets: 3, reps: 45, unit: "s" as const },
];

describe("Express-Krafteinheit (#281)", () => {
  it("ordnet Übungen nach Vorrang", () => {
    expect(priorityOf("back_squat")).toBe(1);
    expect(priorityOf("dumbbell_row")).toBe(2);
    expect(priorityOf("biceps_curl")).toBe(3);
    expect(priorityOf("plank")).toBe(3);
  });

  it("lässt eine kurze Einheit unverändert", () => {
    const r = strengthExpress(session.slice(0, 2), 45);
    expect(r.fullMin).toBeLessThanOrEqual(45);
    expect(r.exercises.map((x) => x.sets)).toEqual([4, 4]);
    expect(r.changes).toEqual([]);
    expect(r.text).toContain("nichts gekürzt");
  });

  it("45 min: Supersätze und kürzere Pausen, Grundübungen bleiben", () => {
    const r = strengthExpress(session, 45);
    expect(r.fullMin).toBeGreaterThan(60);
    expect(r.fits).toBe(true);
    expect(r.estimatedMin).toBeLessThanOrEqual(45);
    expect(r.exercises.slice(0, 2).map((x) => x.name)).toEqual(["Kniebeuge", "Bankdrücken"]);
    const row = r.exercises.find((x) => x.exercise === "dumbbell_row"), incline = r.exercises.find((x) => x.exercise === "incline_bench_press");
    expect(row?.superset).toBeTruthy();
    expect(row?.superset).toBe(incline?.superset); // Ziehen mit Drücken gepaart
  });

  it("30 min: bleibt nur eine Hilfsübung, kein Supersatz-Hinweis und normale Pause", () => {
    const r = strengthExpress(session, 30);
    expect(r.exercises.filter((x) => x.priority === 2)).toHaveLength(1);
    expect(r.exercises.some((x) => x.superset)).toBe(false);
    expect(r.changes.join(" ")).not.toContain("Supersatz");
    expect(r.text).not.toContain("Supersatz");
    expect(r.exercises.find((x) => x.priority === 2)?.restS).toBe(75);
  });

  it("20 min: nur noch Grundübungen mit 2–3 Sätzen, Weggelassenes wird genannt", () => {
    const r = strengthExpress(session, 20);
    expect(r.exercises.every((x) => x.priority === 1)).toBe(true);
    expect(r.exercises.every((x) => x.sets <= 3)).toBe(true);
    expect(r.dropped).toEqual(expect.arrayContaining(["Bizepscurls", "Unterarmstütz", "Kurzhantelrudern"]));
    expect(r.text).toContain("Weggelassen");
    expect(estimateMin(r.exercises)).toBe(r.estimatedMin);
  });
  it("schreibt unbekannte Übungen auch aus einem kleingeschriebenen Schlüssel groß", () => {
    const r = strengthExpress(session.map((x) => (x.name === "Bizepscurls" ? { ...x, name: "bizepscurls" } : x)), 20);
    expect(r.dropped).toContain("Bizepscurls");
    expect(r.text).not.toContain("bizepscurls");
  });
});
