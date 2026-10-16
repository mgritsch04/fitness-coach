import { describe, expect, it } from "vitest";
import { addDays, type DayPoint, type SleepRow, type WorkoutRow } from "../src/core/analysis";
import { recoveryFactors } from "../src/core/insights";

// Synthetische Verläufe mit eingebauten Zusammenhängen, keine echten Messwerte.

const point = (day: string, o: Partial<DayPoint> = {}): DayPoint => ({
  day, recovery: null, hrv: null, rhr: null, spo2: null, skinTemp: null, strain: null, sleepH: null, sleepPerf: null, sleepEff: null,
  deepH: null, remH: null, respRate: null, load: 0, ctl: 0, atl: 0, tsb: 0, workouts: 0, trainingMin: 0, ...o,
});

/** Deterministischer Zufall (LCG), damit die Tests stabil sind. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

const FROM = "2026-01-05"; // Montag
const N = 84;

function scenario() {
  const r = rng(42);
  const sleepH: number[] = [], late: boolean[] = [];
  for (let i = 0; i < N; i++) {
    sleepH.push(5.5 + r() * 3); // 5,5–8,5 h
    late.push(i % 4 === 1); // jeden 4. Tag spätes Training am Abend
  }
  const series: DayPoint[] = [];
  const sleeps: SleepRow[] = [];
  const workouts: WorkoutRow[] = [];
  for (let i = 0; i < N; i++) {
    const day = addDays(FROM, i);
    const lateYesterday = i > 0 && late[i - 1];
    // Eingebaut: +10 Punkte je Stunde Schlaf, −15 nach spätem Training am Vorabend, etwas Rauschen.
    const recovery = Math.round(Math.min(99, Math.max(1, 20 + 10 * (sleepH[i] - 5.5) + 30 - (lateYesterday ? 15 : 0) + (r() - 0.5) * 8)));
    series.push(point(day, { recovery, hrv: 50 + recovery / 4, sleepH: Number(sleepH[i].toFixed(2)), deepH: 1.5, strain: 10, load: late[i] ? 60 : 30, workouts: 1 }));
    // Einschlafen so, dass um 07:00 Berlin (06:00 UTC im Winter) aufgewacht wird.
    const end = Date.parse(`${day}T06:00:00Z`);
    sleeps.push({
      day, source: "whoop", start_time: new Date(end - sleepH[i] * 3600_000).toISOString(), end_time: new Date(end).toISOString(), is_nap: 0,
      in_bed_s: null, asleep_s: Math.round(sleepH[i] * 3600), awake_s: null, light_s: null, deep_s: null, rem_s: null,
      performance_pct: null, efficiency_pct: null, consistency_pct: null, respiratory_rate: null,
    });
    const endUtcH = late[i] ? 20 : 15; // 21 bzw. 16 Uhr Berlin
    workouts.push({
      day, source: "whoop", source_id: `w${i}`, start_time: `${day}T${String(endUtcH - 1).padStart(2, "0")}:00:00.000Z`,
      end_time: `${day}T${String(endUtcH).padStart(2, "0")}:00:00.000Z`, sport: "cycling", duration_s: 3600, distance_m: null,
      energy_kj: null, avg_hr: 130, max_hr: 160, avg_power_w: null, normalized_power_w: null, strain: 10,
    });
  }
  return { series, sleeps, workouts };
}

describe("Einflussfaktoren auf die Erholung", () => {
  const { series, sleeps, workouts } = scenario();
  const today = addDays(FROM, N - 1);
  const rep = recoveryFactors(series, sleeps, workouts, "Europe/Berlin", FROM, today);
  const f = (key: string, target = "recovery") => rep.factors.find((x) => x.key === key && x.target === target)!;

  it("findet den eingebauten Schlaf-Zusammenhang", () => {
    const s = f("sleep_duration");
    expect(s.n).toBe(N);
    expect(s.r!).toBeGreaterThan(0.5);
    expect(s.strength).toMatch(/moderate|strong/);
    expect(s.effect!).toBeGreaterThan(15);
    expect(s.text).toContain("Mehr Schlaf: Erholung im Mittel");
    expect(s.text).toContain("höher");
  });

  it("späteres Einschlafen hängt hier mit weniger Erholung zusammen (kürzerer Schlaf)", () => {
    const b = f("bedtime");
    expect(b.r!).toBeLessThan(-0.5);
    expect(b.groups[0].label).toMatch(/^bis \d\d:\d\d$/);
    expect(b.text).toContain("niedriger");
  });

  it("erkennt spätes Training am Vorabend als Ja/Nein-Faktor", () => {
    const l = f("late_workout");
    expect(l.groups.find((g) => g.label === "ja")!.n).toBe(21);
    expect(l.effect!).toBeLessThan(-8);
    expect(l.strength).not.toBe("none");
    expect(l.text).toContain("Nach spätem Training am Vorabend");
  });

  it("ohne Unterschied kein Satz", () => {
    expect(f("sleep_deep").strength).toBe("none"); // überall gleich
    expect(f("sleep_deep").text).toBeNull();
    expect(f("rest_day_prev").text).toBeNull(); // nie Ruhetag → zu kleine Gruppe
  });

  it("wertet auch die HRV aus und sortiert nach Stärke", () => {
    expect(f("sleep_duration", "hrv").r!).toBeGreaterThan(0.5);
    const ranks = rep.factors.map((x) => ({ none: 0, weak: 1, moderate: 2, strong: 3 })[x.strength]);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    expect(rep.highlights.length).toBeGreaterThan(0);
    expect(rep.highlights.length).toBeLessThanOrEqual(5);
    expect(rep.enoughData).toBe(true);
  });

  it("Wochentage nur mit genug Daten", () => {
    expect(f("weekday").groups).toHaveLength(7);
    const short = recoveryFactors(series.slice(0, 20), sleeps, workouts, "Europe/Berlin", FROM, addDays(FROM, 19));
    expect(short.enoughData).toBe(false);
    expect(short.factors.every((x) => x.text == null)).toBe(true);
  });
});
