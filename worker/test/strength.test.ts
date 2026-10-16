import { describe, expect, it } from "vitest";
import type { MergedWorkout, WorkoutLoad } from "../src/core/analysis";
import { buildDashboard } from "../src/core/dashboard";
import { runBatched, upsertDaily, upsertWorkout } from "../src/core/repository";
import {
  applyStrengthLoads,
  deleteStrengthSession,
  estimate1RM,
  exerciseKey,
  exerciseProgress,
  findLinkedWorkout,
  isStrengthSport,
  muscleVolume,
  readStrengthSessions,
  saveStrengthSession,
  srpeLoad,
  strengthCoachNotes,
  suggestFromTemplate,
  weeklyVolume,
  type StrengthSession,
  type StrengthSet,
} from "../src/core/strength";
import { fakeD1 } from "./fake-d1";

// Synthetische Trainingsdaten.
const set = (exercise: string, reps: number, weightKg: number): StrengthSet => {
  const { key } = exerciseKey(exercise);
  return { exercise: key, exerciseName: exercise, reps, weightKg };
};
const session = (day: string, sets: StrengthSet[], extra: Partial<StrengthSession> = {}): StrengthSession => ({
  id: `s-${day}`,
  day,
  startTime: null,
  durationMin: 60,
  rpe: 7,
  name: null,
  notes: null,
  linkedSource: null,
  linkedSourceId: null,
  sets,
  ...extra,
});
const times = (n: number, s: StrengthSet) => Array.from({ length: n }, () => s);

describe("Übungskatalog", () => {
  it("erkennt deutsche und englische Namen", () => {
    expect(exerciseKey("Kniebeuge")).toEqual({ key: "back_squat", known: true });
    expect(exerciseKey("  Bench Press ")).toEqual({ key: "bench_press", known: true });
    expect(exerciseKey("RDL").key).toBe("romanian_deadlift");
    expect(exerciseKey("Zercher Carry")).toEqual({ key: "zercher carry", known: false });
  });

  it("erkennt WHOOP-Krafttrainings", () => {
    expect(isStrengthSport("weightlifting")).toBe(true);
    expect(isStrengthSport("functional-fitness")).toBe(true);
    expect(isStrengthSport("cycling")).toBe(false);
    expect(isStrengthSport(null)).toBe(false);
  });
});

describe("1RM und Volumen", () => {
  it("schätzt das 1RM nach Epley, nicht über 12 Wiederholungen", () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 5)).toBe(116.7);
    expect(estimate1RM(100, 15)).toBeNull();
    expect(estimate1RM(0, 10)).toBeNull();
  });

  it("zählt Hauptmuskeln ganz und Hilfsmuskeln halb", () => {
    const v = muscleVolume([...times(3, set("Bankdrücken", 8, 80)), set("Zercher Carry", 1, 50)]);
    expect(v.find((m) => m.muscle === "chest")).toMatchObject({ sets: 3, tonnageKg: 1920 });
    expect(v.find((m) => m.muscle === "triceps")?.sets).toBe(1.5);
    expect(v.find((m) => m.muscle === "other")?.sets).toBe(1);
  });

  it("fasst Wochen zusammen, neueste zuerst", () => {
    const w = weeklyVolume([session("2026-03-02", times(3, set("Kniebeuge", 5, 100))), session("2026-03-10", times(2, set("Kniebeuge", 5, 100)))]);
    expect(w.map((x) => [x.week, x.sets])).toEqual([["2026-03-09", 2], ["2026-03-02", 3]]);
  });
});

describe("Fortschritt je Übung", () => {
  const today = "2026-03-30";
  it("erkennt Fortschritt", () => {
    const ss = [0, 7, 14, 21, 28].map((d, i) => session(`2026-03-${String(2 + d).padStart(2, "0")}`, times(3, set("Kniebeuge", 5, 90 + i * 5))));
    const p = exerciseProgress(ss, today)[0];
    expect(p).toMatchObject({ exercise: "back_squat", sessions: 5, status: "progress", bestDay: "2026-03-30" });
    expect(p.history.at(-1)!.topSet).toEqual({ reps: 5, weightKg: 110 });
  });

  it("erkennt ein Plateau", () => {
    const ss = ["2026-02-20", "2026-03-06", "2026-03-13", "2026-03-20", "2026-03-27"].map((d) => session(d, times(3, set("Bankdrücken", 5, 80))));
    expect(exerciseProgress(ss, today)[0].status).toBe("plateau");
  });

  it("erkennt einen Rückgang und neue Übungen", () => {
    const ss = [session("2026-02-20", [set("Kreuzheben", 3, 150)]), session("2026-03-25", [set("Kreuzheben", 3, 120), set("Klimmzug", 8, 0)])];
    const p = exerciseProgress(ss, today);
    expect(p.find((x) => x.exercise === "deadlift")!.status).toBe("decline");
    expect(p.find((x) => x.exercise === "pull_up")!.status).toBe("unknown"); // Körpergewicht: kein 1RM
  });
});

describe("Belastung", () => {
  it("rechnet Dauer × Anstrengung in den TSS-Maßstab um", () => {
    expect(srpeLoad(60, 7)).toBe(70);
    expect(srpeLoad(45, 8.5)).toBe(67.5);
    expect(srpeLoad(60, null)).toBeNull();
    expect(srpeLoad(null, 7)).toBeNull();
  });

  const whoop = (extra: Partial<MergedWorkout & WorkoutLoad> = {}): MergedWorkout & WorkoutLoad => ({
    day: "2026-03-10", source: "whoop", source_id: "w1", start_time: "2026-03-10T17:00:00.000Z", end_time: "2026-03-10T18:00:00.000Z",
    sport: "weightlifting", duration_s: 3600, distance_m: null, energy_kj: null, avg_hr: 110, max_hr: 150, avg_power_w: null,
    normalized_power_w: null, strain: 8, sources: ["whoop"], load: 35, method: "hr", intensity: 0.6, ...extra,
  });

  it("verknüpft mit dem WHOOP-Krafttraining und ersetzt die Puls-Schätzung", () => {
    const out = applyStrengthLoads([whoop()], [session("2026-03-10", [set("Kniebeuge", 5, 100)], { durationMin: null, rpe: 8 })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ load: 80, method: "srpe" });
  });

  it("lässt die Puls-Schätzung stehen, wenn sie höher ist oder RPE fehlt", () => {
    expect(applyStrengthLoads([whoop({ load: 90 })], [session("2026-03-10", [], { rpe: 5 })])[0]).toMatchObject({ load: 90, method: "hr" });
    expect(applyStrengthLoads([whoop()], [session("2026-03-10", [], { rpe: null })])[0]).toMatchObject({ load: 35, method: "hr" });
  });

  it("ergänzt Einheiten ohne passendes Workout", () => {
    const out = applyStrengthLoads([whoop({ sport: "cycling" })], [session("2026-03-10", [], { durationMin: 45, rpe: 7 })]);
    expect(out).toHaveLength(2);
    expect(out.find((w) => w.source === "manual")).toMatchObject({ sport: "strength", duration_s: 2700, load: 52.5, method: "srpe" });
  });

  it("wählt bei Startzeit das nächste Kraft-Workout, höchstens 90 Minuten daneben", () => {
    const a = whoop({ source_id: "a", start_time: "2026-03-10T07:00:00.000Z" });
    const b = whoop({ source_id: "b", start_time: "2026-03-10T18:00:00.000Z" });
    const s = { day: "2026-03-10", linkedSource: null, linkedSourceId: null };
    expect(findLinkedWorkout({ ...s, startTime: "2026-03-10T17:30:00.000Z" }, [a, b])?.source_id).toBe("b");
    expect(findLinkedWorkout({ ...s, startTime: "2026-03-10T12:00:00.000Z" }, [a, b])).toBeNull();
    expect(findLinkedWorkout({ ...s, startTime: null, linkedSource: "whoop", linkedSourceId: "b" }, [a, b])?.source_id).toBe("b");
  });
});

describe("Coach und Vorlagen", () => {
  it("warnt nach schweren Beinen vor harten Intervallen", () => {
    const notes = strengthCoachNotes([session("2026-03-09", [...times(4, set("Kniebeuge", 5, 100)), ...times(3, set("RDL", 8, 80))])], "2026-03-10");
    expect(notes[0]).toMatchObject({ effect: "down" });
    expect(notes[0].text).toMatch(/Gestern schwere Beine/);
    expect(strengthCoachNotes([session("2026-03-09", times(6, set("Bankdrücken", 5, 80)))], "2026-03-10")).toEqual([]);
  });

  it("erinnert nach zwei Wochen ohne Kraft", () => {
    expect(strengthCoachNotes([session("2026-02-20", [set("Bankdrücken", 5, 80)])], "2026-03-10")[0].text).toMatch(/vor 18 Tagen/);
  });

  it("schlägt mehr Gewicht vor, wenn alle Sätze geschafft wurden", () => {
    const history = [session("2026-03-05", [...times(3, set("Kniebeuge", 5, 100)), set("Bankdrücken", 5, 80), set("Bankdrücken", 3, 80)])];
    const s = suggestFromTemplate(
      [{ exercise: "Kniebeuge", sets: 3, reps: 5 }, { exercise: "Bankdrücken", sets: 2, reps: 5 }, { exercise: "Klimmzug", sets: 3, reps: 8, weightKg: 0 }],
      history,
    );
    expect(s.map((x) => [x.exercise, x.weightKg, x.basis])).toEqual([["back_squat", 105, "increase"], ["bench_press", 80, "repeat"], ["pull_up", 0, "template"]]);
  });
});

describe("D1", () => {
  it("speichert, ersetzt und löscht Einheiten samt Sätzen", async () => {
    const db = fakeD1();
    await saveStrengthSession(db, session("2026-03-10", times(3, set("Kniebeuge", 5, 100))));
    await saveStrengthSession(db, session("2026-03-10", [set("Kniebeuge", 5, 105), { ...set("Zercher Carry", 1, 50), muscles: ["core"] }]));
    const read = await readStrengthSessions(db, "2026-01-01");
    expect(read).toHaveLength(1);
    expect(read[0].sets).toEqual([
      { exercise: "back_squat", exerciseName: "Kniebeuge", reps: 5, weightKg: 105, rpe: null, muscles: null },
      { exercise: "zercher carry", exerciseName: "Zercher Carry", reps: 1, weightKg: 50, rpe: null, muscles: ["core"] },
    ]);
    expect(await deleteStrengthSession(db, "s-2026-03-10")).toBe(true);
    expect(await readStrengthSessions(db, "2026-01-01")).toEqual([]);
    expect(await deleteStrengthSession(db, "s-2026-03-10")).toBe(false);
  });

  it("Dashboard zählt Kraft mit Session-RPE und liefert Kraft-Übersicht", async () => {
    const db = fakeD1();
    const day = "2026-03-19";
    await runBatched(db, [
      upsertDaily(db, { source: "whoop", sourceId: "c1", day, startTime: `${day}T05:00:00.000Z`, endTime: null, strain: 10, energyKj: 9000, avgHr: 60, maxHr: 180 }),
      upsertWorkout(db, {
        source: "whoop", sourceId: "w1", day, startTime: `${day}T17:00:00.000Z`, endTime: `${day}T18:00:00.000Z`, sport: "weightlifting", durationS: 3600,
        distanceM: null, energyKj: 1500, avgHr: 105, maxHr: 150, avgPowerW: null, normalizedPowerW: null, strain: 7,
      }),
    ]);
    await saveStrengthSession(db, session(day, [...times(4, set("Kniebeuge", 5, 100)), ...times(3, set("Beinpresse", 10, 150))], { rpe: 8, durationMin: null }));
    const d = await buildDashboard(db, { days: 7, now: Date.parse("2026-03-20T10:00:00Z") });
    expect(d.workouts[0]).toMatchObject({ sport: "weightlifting", load: 80, loadMethod: "srpe" });
    expect(d.strength.sessions).toHaveLength(1);
    expect(d.strength.weeks[0].muscles[0].muscle).toBe("quads");
    expect(d.coach.reasons.some((r) => r.factor === "strength")).toBe(true);
    expect(d.notes.join(" ")).toMatch(/Session-RPE/);
  });
});
