import { describe, expect, it } from "vitest";
import { addDays, type WeekSummary } from "../src/core/analysis";
import type { CoachAdvice } from "../src/core/coach";
import { buildDashboard } from "../src/core/dashboard";
import { deleteGoal, readGoals, readNotes, readPlan, readPrefs, saveGoal, saveNote, writePlan, writePrefs } from "../src/core/goals";
import { DEFAULT_PREFS, buildWeekPlan, choosePhase, comparePlan, isHard, normalizePlan, type Goal, type PlanInput } from "../src/core/plan";
import { todayCheck } from "../src/core/training";
import { fakeD1 } from "./fake-d1";

// Alle Werte synthetisch, keine echten Messwerte.

const MONDAY = "2026-03-02";

const goal = (o: Partial<Goal>): Goal => ({
  id: 1, kind: "event", title: "Radmarathon", targetDate: null, metric: null, targetValue: null, unit: null, sport: "cycling",
  priority: "A", status: "active", notes: null, createdAt: "", updatedAt: "", ...o,
});

const week = (w: string, o: Partial<WeekSummary> = {}): WeekSummary => ({
  week: w, workouts: 4, trainingH: 6, load: 300, distanceKm: 0, bySport: {}, avgRecovery: 60, avgHrv: 50, avgRhr: 50,
  avgSleepH: 7.5, avgStrain: 10, sleepDebtH: 2, ctlEnd: 45, ctlChange: 0, ...o,
});

const input = (o: Partial<PlanInput> = {}): PlanInput => ({
  weekStart: MONDAY, goals: [], prefs: { ...DEFAULT_PREFS, weeklyHours: 7 }, weeks: [week(addDays(MONDAY, -7))], ctl: 45, tsb: -5,
  ftpW: 250, thresholdHr: 165, maxHr: 185, ...o,
});

const advice = (readiness: CoachAdvice["readiness"]): CoachAdvice => ({
  day: MONDAY, readiness, score: 50, headline: "", suggestion: "", targetLoad: null, reasons: [], warnings: [], disclaimer: "",
});

describe("Phase", () => {
  const at = (weeks: number) => [goal({ targetDate: addDays(MONDAY, weeks * 7 + 5) })];
  it("rechnet vom Termin rückwärts", () => {
    expect(choosePhase(MONDAY, at(0), [], 0).phase).toBe("race");
    expect(choosePhase(MONDAY, at(1), [], 0).phase).toBe("taper");
    expect(choosePhase(MONDAY, at(2), [], 0).phase).toBe("peak");
    expect(choosePhase(MONDAY, at(8), [], 0).phase).toBe("build");
    expect(choosePhase(MONDAY, at(20), [], 0).phase).toBe("base");
    expect(choosePhase(MONDAY, [], [], 0).phase).toBe("maintain");
  });
  it("legt nach drei Aufbauwochen eine Erholungswoche ein", () => {
    const weeks = [1, 2, 3].map((i) => week(addDays(MONDAY, -7 * i), { ctlChange: 3 }));
    expect(choosePhase(MONDAY, at(8), weeks, 0).phase).toBe("recovery");
    // In der Woche vor dem Termin geht Tapering vor.
    expect(choosePhase(MONDAY, at(1), weeks, 0).phase).toBe("taper");
  });
  it("erholt bei sehr niedriger Form", () => {
    expect(choosePhase(MONDAY, at(8), [], -30).phase).toBe("recovery");
  });
  it("ignoriert erledigte und vergangene Ziele", () => {
    expect(choosePhase(MONDAY, [goal({ targetDate: addDays(MONDAY, 30), status: "done" }), goal({ targetDate: addDays(MONDAY, -3) })], [], 0).phase).toBe("maintain");
  });
});

describe("Wochenplan", () => {
  it("hat 7 Tage, hält Ruhetage ein und legt die lange Fahrt auf Samstag", () => {
    const plan = buildWeekPlan(input({ goals: [goal({ targetDate: addDays(MONDAY, 60) })], prefs: { ...DEFAULT_PREFS, weeklyHours: 7, restDays: [0, 4] } }));
    expect(plan.days).toHaveLength(7);
    expect(plan.days[0].day).toBe(MONDAY);
    expect(plan.phase).toBe("build");
    expect(plan.days[0].type).toBe("rest");
    expect(plan.days[4].type).toBe("rest");
    expect(plan.days[5].type).toBe("long");
    expect(plan.days.some((d) => d.type === "threshold")).toBe(true);
  });

  it("lässt auch bei täglicher Kraft-Gewohnheit einen Tag ganz frei", () => {
    for (const hours of [4, 6, 9]) {
      const plan = buildWeekPlan(input({ prefs: { ...DEFAULT_PREFS, weeklyHours: hours, strengthPerWeek: 6, strengthMin: 40 } }));
      expect(plan.days.filter((d) => d.type === "rest").length, `${hours} h`).toBeGreaterThanOrEqual(1);
    }
  });

  it("legt harte Einheiten nicht auf Nachbartage und Kraft nie vor harte Tage", () => {
    for (const hours of [4, 6, 8, 10]) {
      const plan = buildWeekPlan(input({ goals: [goal({ targetDate: addDays(MONDAY, 50) })], prefs: { ...DEFAULT_PREFS, weeklyHours: hours, strengthPerWeek: 2 } }));
      const heavy = (i: number) => i >= 0 && i < 7 && (isHard(plan.days[i].type) || plan.days[i].type === "long");
      plan.days.forEach((d, i) => {
        if (isHard(d.type)) expect(heavy(i - 1) || heavy(i + 1), `${hours} h, Tag ${i}`).toBe(false);
        if (d.strength && !d.strength.focus.startsWith("Oberkörper")) expect(heavy(i + 1), `Beinkraft vor hartem Tag (${hours} h, Tag ${i})`).toBe(false);
      });
      const strengthDays = plan.days.map((d, i) => (d.strength ? i : -1)).filter((i) => i >= 0);
      expect(strengthDays.length).toBe(2);
      expect(strengthDays[1] - strengthDays[0]).toBeGreaterThanOrEqual(2);
    }
  });

  it("übernimmt feste Krafttage unverändert und plant Rad drumherum (#323)", () => {
    const fixedStrength = [{ day: 0, focus: "Beine" }, { day: 3, focus: "Oberkörper" }];
    for (const hours of [4, 6, 8, 10]) {
      const plan = buildWeekPlan(input({ goals: [goal({ targetDate: addDays(MONDAY, 50) })], prefs: { ...DEFAULT_PREFS, weeklyHours: hours, strengthPerWeek: 4, restDays: [0], fixedStrength } }));
      const strengthDays = plan.days.map((d, i) => (d.strength ? i : -1)).filter((i) => i >= 0);
      expect(strengthDays, `${hours} h`).toEqual([0, 3]);
      expect(plan.days[0].strength?.focus).toBe("Beine");
      expect(plan.days[3].strength?.focus).toBe("Oberkörper");
      expect(plan.days[0].type).not.toBe("rest"); // fester Krafttag geht vor festem Ruhetag
      // Keine harte Radeinheit und kein Langtag direkt neben dem Beintag (Sonntag davor, Dienstag danach).
      for (const i of [1, 6]) expect(isHard(plan.days[i].type) || plan.days[i].type === "long", `${hours} h, Tag ${i}`).toBe(false);
      expect(plan.notes.join(" ")).toMatch(/festen Tagen: Montag \(Beine\), Donnerstag \(Oberkörper\)/);
    }
  });

  it("ohne feste Tage verteilt der Coach die Kraft wie bisher", () => {
    const a = buildWeekPlan(input({ prefs: { ...DEFAULT_PREFS, weeklyHours: 6, strengthPerWeek: 2 } }));
    const b = buildWeekPlan(input({ prefs: { ...DEFAULT_PREFS, weeklyHours: 6, strengthPerWeek: 2, fixedStrength: [] } }));
    expect(b.days).toEqual(a.days);
  });

  it("plant ohne Lastdaten nach der Zeit und nennt Watt-Bereiche", () => {
    const plan = buildWeekPlan(input({ ctl: 0, tsb: null, prefs: { ...DEFAULT_PREFS, weeklyHours: 5 } }));
    expect(plan.notes.join(" ")).toContain("wenig Belastungsdaten");
    const total = plan.days.reduce((a, d) => a + d.durationMin, 0);
    expect(total).toBeGreaterThan(200);
    expect(total).toBeLessThanOrEqual(5 * 60 + 130); // + Krafteinheiten
    expect(plan.days.find((d) => d.type === "endurance")!.intensity).toMatch(/\d+–\d+ W/);
  });

  it("schätzt das Zeitbudget aus den letzten Wochen, wenn keins eingetragen ist", () => {
    const plan = buildWeekPlan(input({ prefs: { ...DEFAULT_PREFS }, weeks: [week(addDays(MONDAY, -7), { trainingH: 4 })], ctl: 0 }));
    expect(plan.notes[0]).toContain("4 h geschätzt");
  });

  it("setzt in der Wettkampfwoche den Termin auf den richtigen Tag mit Aktivierung davor und ohne Kraft", () => {
    const race = goal({ targetDate: addDays(MONDAY, 6), title: "Zeitfahren" });
    const plan = buildWeekPlan(input({ goals: [race] }));
    expect(plan.phase).toBe("race");
    expect(plan.days[6]).toMatchObject({ type: "race", title: "Zeitfahren" });
    expect(plan.days[5].type).toBe("opener");
    expect(plan.days.some((d) => d.strength)).toBe(false);
  });

  it("macht die Erholungswoche leichter und ohne Intervalle", () => {
    const normal = buildWeekPlan(input());
    const rec = buildWeekPlan(input({ tsb: -30 }));
    expect(rec.phase).toBe("recovery");
    expect(rec.targetLoad).toBeLessThan(normal.targetLoad);
    expect(rec.days.some((d) => ["threshold", "vo2max", "tempo"].includes(d.type))).toBe(false);
    expect(rec.days.filter((d) => d.strength).length).toBeLessThanOrEqual(1);
  });
});

describe("Soll/Ist", () => {
  const plan = normalizePlan(MONDAY, {
    days: [
      { day: MONDAY, type: "endurance", durationMin: 60 },
      { day: addDays(MONDAY, 1), type: "threshold", durationMin: 60, key: true },
      { day: addDays(MONDAY, 2), type: "strength", durationMin: 60 },
      { day: addDays(MONDAY, 4), type: "endurance", durationMin: 60, strength: { durationMin: 45 } },
      { day: addDays(MONDAY, 5), type: "long", durationMin: 180 },
    ],
  });

  it("vergleicht geplante mit echten Einheiten", () => {
    const today = addDays(MONDAY, 4);
    const cmp = comparePlan(
      plan,
      [
        { day: MONDAY, load: 48, minutes: 62, sports: ["cycling"], strength: false },
        { day: addDays(MONDAY, 2), load: 20, minutes: 55, sports: ["weightlifting"], strength: true },
        { day: addDays(MONDAY, 3), load: 30, minutes: 40, sports: ["cycling"], strength: false },
      ],
      today,
    );
    expect(cmp.days.map((d) => d.status)).toEqual(["done", "missed", "done", "extra", "today", "upcoming", "upcoming"]);
    expect(cmp.keySessionsMissed).toHaveLength(1);
    expect(cmp.sessionsPlannedToDate).toBe(3);
    expect(cmp.sessionsDoneToDate).toBe(2);
    expect(cmp.days[4].strengthDone).toBe(false);
    expect(cmp.days[0].strengthDone).toBeNull();
    expect(cmp.summary).toContain("2 von 3");
  });

  it("lehnt Tage außerhalb der Woche ab", () => {
    expect(() => normalizePlan(MONDAY, { days: [{ day: addDays(MONDAY, 7), type: "rest" }] })).toThrow();
  });
});

describe("Heute: Plan und Tagesform", () => {
  const plan = buildWeekPlan(input({ goals: [goal({ targetDate: addDays(MONDAY, 60) })] }));
  const hard = plan.days.find((d) => d.type === "threshold")!;
  it("schlägt bei schlechter Erholung Tauschen oder Ruhe vor", () => {
    expect(todayCheck(hard, advice("hard"), plan).verdict).toBe("ok");
    expect(["swap", "reduce"]).toContain(todayCheck(hard, advice("easy"), plan).verdict);
    expect(todayCheck(hard, advice("rest"), plan).verdict).toBe("rest");
    expect(todayCheck(null, advice("easy"), plan).verdict).toBe("none");
  });
});

describe("Gedächtnis in D1", () => {
  it("speichert, ändert und löscht Ziele", async () => {
    const db = fakeD1();
    const g = await saveGoal(db, { kind: "event", title: "Alpenrunde", targetDate: "2026-07-01", priority: "A" });
    expect(g.id).toBeGreaterThan(0);
    const g2 = await saveGoal(db, { id: g.id, title: "Alpenrunde 200 km" });
    expect(g2).toMatchObject({ title: "Alpenrunde 200 km", targetDate: "2026-07-01", priority: "A" });
    await saveGoal(db, { kind: "fitness", title: "FTP 280", metric: "ftpW", targetValue: 280, unit: "W", status: "done" });
    expect(await readGoals(db)).toHaveLength(1);
    expect(await readGoals(db, { status: "all" })).toHaveLength(2);
    await expect(saveGoal(db, { title: "ohne Art" })).rejects.toThrow();
    expect(await deleteGoal(db, g.id)).toBe(true);
    expect(await readGoals(db)).toHaveLength(0);
  });

  it("speichert Vorlieben, Pläne und Notizen", async () => {
    const db = fakeD1();
    expect((await readPrefs(db)).strengthPerWeek).toBeNull();
    const p = await writePrefs(db, { weeklyHours: 8, restDays: [0], strengthPerWeek: 3 });
    expect(p).toMatchObject({ weeklyHours: 8, restDays: [0], strengthPerWeek: 3 });
    expect((await writePrefs(db, { weeklyHours: null })).weeklyHours).toBeNull();

    const plan = buildWeekPlan(input());
    await writePlan(db, plan);
    await writePlan(db, { ...plan, source: "coach" });
    expect((await readPlan(db, MONDAY))?.source).toBe("coach");

    await saveNote(db, { kind: "daily", day: MONDAY, body: "erst" });
    await saveNote(db, { kind: "daily", day: MONDAY, body: "neu", data: { a: 1 } });
    await saveNote(db, { kind: "insight", day: MONDAY, body: "HRV steigt" });
    const notes = await readNotes(db, { fromDay: "2026-01-01" });
    expect(notes.map((n) => n.body).sort()).toEqual(["HRV steigt", "neu"]);
    expect(notes.find((n) => n.kind === "daily")?.data).toEqual({ a: 1 });
  });

  it("liefert die Trainingsübersicht im Dashboard", async () => {
    const db = fakeD1();
    await saveGoal(db, { kind: "event", title: "Rennen", targetDate: "2026-05-10", priority: "A" });
    const dash = await buildDashboard(db, { days: 28, now: Date.parse("2026-03-04T10:00:00Z") });
    expect(dash.training.thisWeek.week).toBe(MONDAY);
    expect(dash.training.thisWeek.stored).toBe(false);
    expect(dash.training.thisWeek.plan.days).toHaveLength(7);
    expect(dash.training.goals[0].daysLeft).toBe(67);
    expect(dash.training.nextWeek.week).toBe("2026-03-09");
    expect(dash.training.today.planned?.day).toBe("2026-03-04");
  });
});

describe("Tapering", () => {
  it("legt die kurze Intensität zur Wochenmitte", () => {
    const plan = buildWeekPlan(input({ goals: [goal({ targetDate: addDays(MONDAY, 12) })] }));
    expect(plan.phase).toBe("taper");
    const i = plan.days.findIndex((d) => d.type === "opener");
    expect(i).toBeGreaterThanOrEqual(1);
    expect(i).toBeLessThanOrEqual(3);
  });
});

describe("Kraft-Gewohnheit", () => {
  const strengthWeeks = [1, 2, 3, 4].map((i) =>
    week(addDays(MONDAY, -7 * i), { trainingH: 9, bySport: { bodybuilding: { count: 6, minutes: 210 }, spin: { count: 5, minutes: 330 } } }),
  );
  it("übernimmt Häufigkeit und Dauer aus den letzten Wochen und rechnet Kraft nicht ins Rad-Zeitbudget", () => {
    const plan = buildWeekPlan(input({ prefs: { ...DEFAULT_PREFS }, weeks: strengthWeeks, ctl: 0 }));
    const s = plan.days.filter((d) => d.strength);
    expect(s).toHaveLength(6);
    expect(s[0].strength!.durationMin).toBe(35);
    expect(plan.notes.join(" ")).toContain("5.5 h geschätzt");
    // Beine nie am Tag vor einer harten Einheit oder der langen Fahrt.
    const heavy = (i: number) => i < 7 && (isHard(plan.days[i].type) || plan.days[i].type === "long");
    plan.days.forEach((d, i) => {
      if (d.strength && /Beine|Ganzkörper/.test(d.strength.focus)) expect(heavy(i + 1)).toBe(false);
    });
  });
  it("Vorgabe geht vor", () => {
    const plan = buildWeekPlan(input({ prefs: { ...DEFAULT_PREFS, strengthPerWeek: 1, strengthMin: 60 }, weeks: strengthWeeks }));
    expect(plan.days.filter((d) => d.strength).map((d) => d.strength!.durationMin)).toEqual([60]);
  });
});

describe("Soll/Ist bei harten Einheiten", () => {
  it("zählt lockeres Fahren nicht als erledigte Intervalle", () => {
    const plan = normalizePlan(MONDAY, { days: [{ day: MONDAY, type: "threshold", durationMin: 60, targetLoad: 80 }] });
    const easy = comparePlan(plan, [{ day: MONDAY, load: 25, minutes: 90, sports: ["spin"], strength: false }], addDays(MONDAY, 1));
    expect(easy.days[0].status).toBe("partial");
    const hard = comparePlan(plan, [{ day: MONDAY, load: 70, minutes: 60, sports: ["cycling"], strength: false }], addDays(MONDAY, 1));
    expect(hard.days[0].status).toBe("done");
  });
});

describe("WHOOP-Zonen im Plan", () => {
  it("rechnet Puls in WHOOP-Zonen (Anteil HFmax) um", async () => {
    const { whoopZone, whoopZoneText } = await import("../src/core/plan");
    expect(whoopZone(117, 195)).toBe(2);
    expect(whoopZone(136, 195)).toBe(2);
    expect(whoopZone(137, 195)).toBe(3);
    expect(whoopZone(90, 195)).toBe(0);
    expect(whoopZone(200, 195)).toBe(5);
    expect(whoopZoneText(138, 154, 195)).toBe("WHOOP-Zone 3");
    expect(whoopZoneText(150, 165, 195)).toBe("WHOOP-Zone 3–4");
  });
});
