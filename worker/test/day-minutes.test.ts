import { describe, expect, it } from "vitest";
import { addDays, type WeekSummary } from "../src/core/analysis";
import type { CoachAdvice } from "../src/core/coach";
import { writePrefs, readPrefs } from "../src/core/goals";
import { DEFAULT_PREFS, applyDayLimit, buildWeekPlan, dayCaps, type PlanInput, type TrainingPrefs } from "../src/core/plan";
import { ftpTestPlan, type TrainingInputs } from "../src/core/training";
import { fakeD1 } from "./fake-d1";

// Alle Werte synthetisch (#336: Radzeit je Wochentag).
const MONDAY = "2026-03-02";
const week = (w: string): WeekSummary => ({
  week: w, workouts: 4, trainingH: 6, load: 300, distanceKm: 0, bySport: {}, avgRecovery: 60, avgHrv: 50, avgRhr: 50,
  avgSleepH: 7.5, avgStrain: 10, sleepDebtH: 2, ctlEnd: 45, ctlChange: 0,
});
const input = (prefs: Partial<TrainingPrefs> = {}): PlanInput => ({
  weekStart: MONDAY, goals: [], prefs: { ...DEFAULT_PREFS, weeklyHours: 8, strengthPerWeek: 0, ...prefs }, weeks: [week(addDays(MONDAY, -7))],
  ctl: 60, tsb: -5, ftpW: 250, thresholdHr: 165, maxHr: 185,
});
const min = (p: ReturnType<typeof buildWeekPlan>, i: number) => p.days[i].durationMin;

describe("Radzeit je Wochentag (#336)", () => {
  it("dayCaps: Datum-Ausnahme schlägt Wochenmuster, null = nicht angegeben", () => {
    const caps = dayCaps({ ...DEFAULT_PREFS, dayMinutes: [0, 60, null, null, 120, null, null], dayOverrides: { [addDays(MONDAY, 1)]: 30 } }, MONDAY);
    expect(caps).toEqual([0, 30, null, null, 120, null, null]);
  });
  it("0 min = Ruhetag, andere Tage bleiben unter ihrer Grenze", () => {
    const p = buildWeekPlan(input({ dayMinutes: [0, 45, null, 60, null, null, null] }));
    expect(p.days[0].type).toBe("rest");
    expect(min(p, 1)).toBeLessThanOrEqual(45);
    if (p.days[3].type !== "rest") expect(min(p, 3)).toBeLessThanOrEqual(60);
  });
  it("Freitag darf trotz maxWeekdayMin länger sein", () => {
    const p = buildWeekPlan(input({ maxWeekdayMin: 60, dayMinutes: [null, null, null, null, 120, null, null], longDay: 6 }));
    if (p.days[4].type !== "rest") expect(min(p, 4)).toBeGreaterThan(60);
    expect(min(p, 4)).toBeLessThanOrEqual(120);
  });
  it("lockerer Montag statt Ruhetag, auch wenn er als fester Ruhetag eingetragen ist", () => {
    const p = buildWeekPlan(input({ restDays: [0], easyDays: [0] }));
    expect(p.days[0].type).toBe("recovery");
    expect(min(p, 0)).toBeGreaterThanOrEqual(30);
    expect(min(p, 0)).toBeLessThanOrEqual(45);
    expect(p.days[0].key).toBe(false);
  });
  it("0 min schlägt „locker“", () => {
    expect(buildWeekPlan(input({ easyDays: [0], dayMinutes: [0, null, null, null, null, null, null] })).days[0].type).toBe("rest");
  });
  it("Summe der Tageswerte wird zum Wochenbudget, wenn alle gesetzt sind", () => {
    const p = buildWeekPlan(input({ weeklyHours: null, dayMinutes: [0, 60, 60, 0, 60, 120, 0] }));
    const total = p.days.reduce((a, d) => a + d.durationMin, 0);
    expect(total).toBeLessThanOrEqual(300);
    expect(p.notes.join(" ")).toMatch(/Tageswerten/);
  });
  it("kurze Tage bekommen keine Schlüsseleinheit", () => {
    const p = buildWeekPlan(input({ dayMinutes: [30, 30, 30, 30, 30, 90, 120], longDay: 6 }));
    for (let i = 0; i < 5; i++) expect(["tempo", "threshold", "vo2max"]).not.toContain(p.days[i].type);
  });
  it("Ausnahme für ein Datum begrenzt nur diesen Tag", () => {
    const base = buildWeekPlan(input());
    const day = base.days.findIndex((d) => d.durationMin >= 60 && d.type !== "race");
    const p = buildWeekPlan(input({ dayOverrides: { [addDays(MONDAY, day)]: 40 } }));
    expect(min(p, day)).toBeLessThanOrEqual(40);
  });
});

describe("applyDayLimit", () => {
  const plan = () => buildWeekPlan(input({ restDays: [2], easyDays: null }));
  it("kürzt eine zu lange Einheit und merkt es an", () => {
    const p = plan();
    const i = p.days.findIndex((d) => d.durationMin >= 90);
    const r = applyDayLimit(p, p.days[i].day, 45, MONDAY);
    expect(r.days[i].durationMin).toBe(45);
    expect(r.days[i].targetLoad).toBeLessThan(p.days[i].targetLoad);
    expect(r.notes.at(-1)).toMatch(/nur 45 min/);
    if (p.days[i].type === "long") expect(r.days[i].type).toBe("endurance");
  });
  it("verschiebt eine Schlüsseleinheit bei 0 min auf den nächsten freien Tag", () => {
    const p = plan();
    const i = p.days.findIndex((d, k) => d.key && p.days.some((x, j) => j > k && x.type === "rest"));
    expect(i).toBeGreaterThanOrEqual(0);
    const r = applyDayLimit(p, p.days[i].day, 0, MONDAY);
    expect(r.days[i].type).toBe("rest");
    expect(r.days.filter((d) => d.key).length).toBe(p.days.filter((d) => d.key).length);
  });
  it("lässt Einheiten innerhalb der Zeit und vergangene Tage unverändert", () => {
    const p = plan();
    const i = p.days.findIndex((d) => d.durationMin > 0);
    expect(applyDayLimit(p, p.days[i].day, 600, MONDAY)).toBe(p);
    expect(applyDayLimit(p, p.days[i].day, 10, addDays(p.days[i].day, 1))).toBe(p);
  });
  it("behält die Krafteinheit am Tag", () => {
    const p = plan();
    const i = p.days.findIndex((d) => d.durationMin >= 60);
    p.days[i].strength = { durationMin: 30, focus: "Oberkörper" };
    p.days[i].targetLoad += 25;
    const r = applyDayLimit(p, p.days[i].day, 0, MONDAY);
    expect(r.days[i].strength).toEqual({ durationMin: 30, focus: "Oberkörper" });
    expect(r.days[i].type).toBe("strength");
  });
});

describe("Prefs speichern", () => {
  it("speichert Tageszeiten, locker-Tage und Ausnahmen", async () => {
    const db = fakeD1();
    await writePrefs(db, { dayMinutes: [0, 60, null, null, 120, null, null], easyDays: [0], dayOverrides: { "2026-03-03": 45 }, noFtpTest: true });
    const p = await readPrefs(db);
    expect(p.dayMinutes?.[4]).toBe(120);
    expect(p.easyDays).toEqual([0]);
    expect(p.dayOverrides).toEqual({ "2026-03-03": 45 });
    expect(p.noFtpTest).toBe(true);
    await writePrefs(db, { dayOverrides: null });
    expect((await readPrefs(db)).dayOverrides).toBeNull();
  });
});

describe("Kraft-Vorlage je Wochentag (#370)", () => {
  it("speichert sieben Felder, null setzt zurück", async () => {
    const db = fakeD1();
    expect((await readPrefs(db)).templateByDay ?? null).toBeNull();
    await writePrefs(db, { templateByDay: ["Beine", null, null, "Oberkörper", null, null, null] });
    expect((await readPrefs(db)).templateByDay).toEqual(["Beine", null, null, "Oberkörper", null, null, null]);
    await writePrefs(db, { templateByDay: null });
    expect((await readPrefs(db)).templateByDay ?? null).toBeNull();
  });
});

describe("FTP-Test bei von Hand gesetzter FTP", () => {
  const coach = { day: "2026-03-24", readiness: "moderate", score: 80, headline: "", suggestion: "", targetLoad: null, reasons: [], warnings: [], disclaimer: "" } as CoachAdvice;
  const inp = (origin: "user" | "data"): TrainingInputs => ({
    today: "2026-03-24", days: [{ day: "2026-03-24", tsb: 5 } as TrainingInputs["days"][number]], weeks: [], coach,
    settings: { ftpW: 250, thresholdHr: 170, maxHr: 190, origin: { ftpW: origin } as never }, workouts: [],
  });
  const plan = { weekStart: "2026-03-23", phase: "build", phaseReason: "", goalId: null, targetLoad: 300, targetHours: 6, notes: [], source: "rule",
    days: [{ day: "2026-03-26", type: "threshold", title: "Schwelle", durationMin: 60, targetLoad: 50, intensity: "", description: "", key: true, strength: null }] } as never;
  it("schlägt keinen Test vor, wenn die FTP von Hand steht", () => {
    expect(ftpTestPlan(inp("user"), plan, null)).toBeNull();
  });
  it("schlägt weiter vor, wenn die FTP nur geschätzt ist, außer noFtpTest", () => {
    expect(ftpTestPlan(inp("data"), plan, null)).not.toBeNull();
    expect(ftpTestPlan(inp("data"), plan, null, undefined, { noFtpTest: true })).toBeNull();
  });
});
