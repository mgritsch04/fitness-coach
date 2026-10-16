// Einflussfaktoren auf die Erholung: Zusammenhänge zwischen dem, was an einem Tag passiert (Strain,
// Belastung, Schlaf, Uhrzeit), und der Erholung/HRV am Folgetag. Beobachtungen, keine Ursache-Wirkung.
// Reine Funktionen ohne D1.
import { addDays, type DayPoint, type SleepRow, type WorkoutRow } from "./analysis";
import { hhmm, localMinutes } from "./performance";

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: number[]) => {
  const m = mean(xs);
  if (m == null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));

// --- Strain gegen Erholung -----------------------------------------------------------------------

export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs.slice(0, n))!, my = mean(ys.slice(0, n))!;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

const STRAIN_BUCKETS = [
  { key: "light", label: "leicht (< 10)", min: 0, max: 10 },
  { key: "moderate", label: "moderat (10–14)", min: 10, max: 14 },
  { key: "high", label: "hoch (14–18)", min: 14, max: 18 },
  { key: "all_out", label: "sehr hoch (≥ 18)", min: 18, max: Infinity },
] as const;

const LOAD_BUCKETS = [
  { key: "rest", label: "Ruhetag", min: 0, max: 1 },
  { key: "easy", label: "1–50", min: 1, max: 50 },
  { key: "medium", label: "50–100", min: 50, max: 100 },
  { key: "hard", label: "> 100", min: 100, max: Infinity },
] as const;

export interface StrainRecoveryReport {
  /** Je Tag: Strain bzw. Belastung und die Erholung am Folgetag. */
  pairs: { day: string; strain: number | null; load: number; nextRecovery: number; nextHrv: number | null }[];
  byStrain: { key: string; label: string; days: number; avgNextRecovery: number | null; avgNextHrv: number | null }[];
  byLoad: { key: string; label: string; days: number; avgNextRecovery: number | null; avgNextHrv: number | null }[];
  correlation: { strainToNextRecovery: number | null; loadToNextRecovery: number | null; n: number };
  /** Letzte 7 Tage gegen die 28 Tage davor. */
  balance: { strain7d: number | null; strain28d: number | null; recovery7d: number | null; recovery28d: number | null } | null;
  insights: string[];
}

export function strainRecovery(series: readonly DayPoint[], today: string, fromDay: string): StrainRecoveryReport {
  const byDay = new Map(series.map((p) => [p.day, p]));
  const pairs: StrainRecoveryReport["pairs"] = [];
  for (const p of series) {
    if (p.day < fromDay || p.day >= today) continue;
    const next = byDay.get(addDays(p.day, 1));
    if (!next || next.recovery == null) continue;
    pairs.push({ day: p.day, strain: p.strain, load: p.load, nextRecovery: next.recovery, nextHrv: next.hrv });
  }
  const bucket = <B extends { key: string; label: string; min: number; max: number }>(buckets: readonly B[], val: (x: (typeof pairs)[number]) => number | null) =>
    buckets.map((b) => {
      const inB = pairs.filter((x) => {
        const v = val(x);
        return v != null && v >= b.min && v < b.max;
      });
      return {
        key: b.key,
        label: b.label,
        days: inB.length,
        avgNextRecovery: round(mean(inB.map((x) => x.nextRecovery)), 0),
        avgNextHrv: round(mean(nums(inB.map((x) => x.nextHrv)))),
      };
    });
  const withStrain = pairs.filter((x) => x.strain != null);
  const rStrain = pearson(withStrain.map((x) => x.strain!), withStrain.map((x) => x.nextRecovery));
  const rLoad = pearson(pairs.map((x) => x.load), pairs.map((x) => x.nextRecovery));
  const byStrain = bucket(STRAIN_BUCKETS, (x) => x.strain);
  const byLoad = bucket(LOAD_BUCKETS, (x) => x.load);

  const win = (from: number, to: number, key: "strain" | "recovery") =>
    round(mean(nums(series.filter((p) => p.day >= addDays(today, from) && p.day <= addDays(today, to)).map((p) => p[key]))));
  const balance = series.length
    ? { strain7d: win(-6, 0, "strain"), strain28d: win(-34, -7, "strain"), recovery7d: win(-6, 0, "recovery"), recovery28d: win(-34, -7, "recovery") }
    : null;

  const insights: string[] = [];
  const low = byStrain[0], high = [byStrain[2], byStrain[3]].filter((b) => b.days > 0);
  const highDays = high.reduce((a, b) => a + b.days, 0);
  if (low.days >= 5 && highDays >= 5 && low.avgNextRecovery != null) {
    const highAvg = high.reduce((a, b) => a + (b.avgNextRecovery ?? 0) * b.days, 0) / highDays;
    const diff = Math.round(low.avgNextRecovery - highAvg);
    if (Math.abs(diff) >= 5)
      insights.push(
        diff > 0
          ? `Nach Tagen mit hohem Strain (≥ 14) liegt deine Erholung am Folgetag im Mittel ${diff} Punkte niedriger als nach leichten Tagen.`
          : `Auch nach Tagen mit hohem Strain (≥ 14) erholst du dich im Mittel gut (${-diff} Punkte über leichten Tagen).`,
      );
  }
  if (balance?.strain7d != null && balance.strain28d != null && balance.recovery7d != null && balance.recovery28d != null) {
    if (balance.strain7d > balance.strain28d * 1.15 && balance.recovery7d < balance.recovery28d - 5)
      insights.push("Die letzten 7 Tage: mehr Strain als üblich bei niedrigerer Erholung. Ein lockerer Tag hilft beim Aufholen.");
  }
  if (pairs.length < 14) insights.push(`Erst ${pairs.length} Tagespaare – die Zusammenhänge werden ab etwa 4 Wochen Daten aussagekräftig.`);
  return {
    pairs,
    byStrain,
    byLoad,
    correlation: { strainToNextRecovery: round(rStrain, 2), loadToNextRecovery: round(rLoad, 2), n: pairs.length },
    balance,
    insights,
  };
}

// --- Einflussfaktoren (#21) ---------------------------------------------------------------------

export type Strength = "none" | "weak" | "moderate" | "strong";
export type FactorTarget = "recovery" | "hrv";

export interface FactorResult {
  key: string;
  label: string;
  target: FactorTarget;
  kind: "numeric" | "yesno" | "weekday";
  /** Anzahl Tage mit Wert und Zielwert. */
  n: number;
  /** Pearson-Korrelation (nur numeric). */
  r: number | null;
  /** Unterschied im Zielwert: oberes gegen unteres Drittel bzw. ja gegen nein bzw. bester gegen schlechtester Wochentag. */
  effect: number | null;
  strength: Strength;
  /** Vergleichsgruppen für die Anzeige. */
  groups: { label: string; n: number; avg: number }[];
  /** Kurzer deutscher Satz, nur bei mindestens schwachem Zusammenhang. */
  text: string | null;
}

export interface RecoveryFactorsReport {
  /** Nach Stärke sortiert, stärkste zuerst. */
  factors: FactorResult[];
  /** Die verständlichsten Erkenntnisse als Sätze (höchstens 5). */
  highlights: string[];
  /** Tage mit Erholungswert im Zeitraum. */
  days: number;
  enoughData: boolean;
}

/** Mindestanzahl Tage, ab der ein Faktor ausgewertet wird, und je Vergleichsgruppe. */
export const MIN_DAYS = 21;
const MIN_GROUP = 5;

const strengthOfR = (r: number | null): Strength => {
  const a = Math.abs(r ?? 0);
  return a < 0.1 ? "none" : a < 0.3 ? "weak" : a < 0.5 ? "moderate" : "strong";
};
/** Stärke eines Gruppenunterschieds nach Cohens d. */
const strengthOfD = (diff: number, pooledSd: number | null): Strength => {
  if (!pooledSd) return "none";
  const d = Math.abs(diff) / pooledSd;
  return d < 0.2 ? "none" : d < 0.5 ? "weak" : d < 0.8 ? "moderate" : "strong";
};
const STRENGTH_TEXT: Record<Strength, string> = { none: "kein", weak: "schwacher", moderate: "deutlicher", strong: "starker" };
const TARGET_TEXT: Record<FactorTarget, { name: string; unit: string }> = {
  recovery: { name: "Erholung", unit: "Punkte" },
  hrv: { name: "HRV", unit: "ms" },
};
const RANK: Record<Strength, number> = { none: 0, weak: 1, moderate: 2, strong: 3 };

interface Obs {
  x: number;
  y: number;
}

function numericFactor(key: string, label: string, target: FactorTarget, obs: Obs[], fmt: (x: number) => string, higherText: string): FactorResult {
  const base: FactorResult = { key, label, target, kind: "numeric", n: obs.length, r: null, effect: null, strength: "none", groups: [], text: null };
  if (obs.length < MIN_DAYS) return base;
  const sorted = [...obs].sort((a, b) => a.x - b.x);
  const third = Math.floor(sorted.length / 3);
  const low = sorted.slice(0, third), high = sorted.slice(-third);
  const r = pearson(obs.map((o) => o.x), obs.map((o) => o.y));
  const lowAvg = mean(low.map((o) => o.y))!, highAvg = mean(high.map((o) => o.y))!;
  const effect = round(highAvg - lowAvg)!;
  const strength = strengthOfR(r);
  const t = TARGET_TEXT[target];
  return {
    ...base,
    r: round(r, 2),
    effect,
    strength,
    groups: [
      { label: `bis ${fmt(low.at(-1)!.x)}`, n: low.length, avg: round(lowAvg)! },
      { label: `ab ${fmt(high[0].x)}`, n: high.length, avg: round(highAvg)! },
    ],
    text:
      strength === "none"
        ? null
        : `${higherText}: ${t.name} im Mittel ${Math.abs(Math.round(effect))} ${t.unit} ${effect >= 0 ? "höher" : "niedriger"} ` +
          `(ab ${fmt(high[0].x)} gegenüber bis ${fmt(low.at(-1)!.x)}; ${STRENGTH_TEXT[strength]} Zusammenhang, ${obs.length} Tage).`,
  };
}

function yesNoFactor(key: string, label: string, target: FactorTarget, yes: number[], no: number[], yesText: string): FactorResult {
  const n = yes.length + no.length;
  const base: FactorResult = { key, label, target, kind: "yesno", n, r: null, effect: null, strength: "none", groups: [], text: null };
  if (n < MIN_DAYS || yes.length < MIN_GROUP || no.length < MIN_GROUP) return base;
  const my = mean(yes)!, mn = mean(no)!;
  const sy = sd(yes) ?? 0, sn = sd(no) ?? 0;
  const pooled = Math.sqrt(((yes.length - 1) * sy ** 2 + (no.length - 1) * sn ** 2) / (n - 2));
  const effect = round(my - mn)!;
  const strength = strengthOfD(effect, pooled);
  const t = TARGET_TEXT[target];
  return {
    ...base,
    effect,
    strength,
    groups: [
      { label: "ja", n: yes.length, avg: round(my)! },
      { label: "nein", n: no.length, avg: round(mn)! },
    ],
    text:
      strength === "none"
        ? null
        : `${yesText}: ${t.name} im Mittel ${Math.abs(Math.round(effect))} ${t.unit} ${effect >= 0 ? "höher" : "niedriger"} als sonst ` +
          `(${STRENGTH_TEXT[strength]} Zusammenhang, ${yes.length} von ${n} Tagen).`,
  };
}

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function weekdayFactor(target: FactorTarget, obs: { day: string; y: number }[]): FactorResult {
  const base: FactorResult = { key: "weekday", label: "Wochentag", target, kind: "weekday", n: obs.length, r: null, effect: null, strength: "none", groups: [], text: null };
  if (obs.length < 28) return base;
  const by = WEEKDAYS.map(() => [] as number[]);
  for (const o of obs) by[(new Date(o.day + "T00:00:00Z").getUTCDay() + 6) % 7].push(o.y);
  const groups = WEEKDAYS.map((label, i) => ({ label, n: by[i].length, avg: round(mean(by[i]) ?? NaN) })).filter(
    (g): g is { label: string; n: number; avg: number } => g.avg != null && g.n >= 3,
  );
  if (groups.length < 5) return base;
  const best = groups.reduce((a, b) => (b.avg > a.avg ? b : a)), worst = groups.reduce((a, b) => (b.avg < a.avg ? b : a));
  const effect = round(best.avg - worst.avg)!;
  const strength = strengthOfD(effect, sd(obs.map((o) => o.y)));
  const t = TARGET_TEXT[target];
  return {
    ...base,
    effect,
    strength,
    groups,
    text:
      strength === "none"
        ? null
        : `${t.name} am ${worst.label} im Mittel am niedrigsten (${Math.round(worst.avg)} ${t.unit}), am ${best.label} am höchsten (${Math.round(best.avg)} ${t.unit}).`,
  };
}

/**
 * Was hängt mit deiner Erholung und HRV zusammen? Betrachtet je Tag den Morgenwert (Erholung/HRV nach
 * der Nacht) und was davor lag: Schlafdauer und Einschlafzeit dieser Nacht, Strain und Belastung des
 * Vortags, spätes Training am Vorabend, Ruhetag davor, Wochentag.
 */
export function recoveryFactors(
  series: readonly DayPoint[],
  sleeps: readonly SleepRow[],
  workouts: readonly WorkoutRow[],
  timeZone: string,
  fromDay: string,
  today: string,
): RecoveryFactorsReport {
  const byDay = new Map(series.map((p) => [p.day, p]));
  const days = series.filter((p) => p.day >= fromDay && p.day <= today);

  // Einschlafzeit der Hauptschlafphase je Aufwachtag, ab 12:00 gezählt (23:30 → 690, 00:30 → 750).
  const bedtime = new Map<string, number>();
  const longest = new Map<string, SleepRow>();
  for (const s of sleeps) {
    if (s.is_nap) continue;
    const cur = longest.get(s.day);
    if (!cur || (s.asleep_s ?? 0) > (cur.asleep_s ?? 0)) longest.set(s.day, s);
  }
  for (const [day, s] of longest) {
    const m = localMinutes(s.start_time, timeZone);
    if (m != null) bedtime.set(day, (m + 720) % 1440);
  }
  // Training, das am Vortag nach 19 Uhr endete.
  const lateWorkout = new Set<string>();
  for (const w of workouts) {
    const m = localMinutes(w.end_time, timeZone);
    if (m != null && m >= 19 * 60) lateWorkout.add(w.day);
  }

  const results: FactorResult[] = [];
  for (const target of ["recovery", "hrv"] as FactorTarget[]) {
    const y = (p: DayPoint | undefined) => (p ? (target === "recovery" ? p.recovery : p.hrv) : null);
    const withY = days.filter((p) => y(p) != null);
    const prev = (p: DayPoint) => byDay.get(addDays(p.day, -1));
    const obs = (f: (p: DayPoint) => number | null | undefined): Obs[] =>
      withY.flatMap((p) => {
        const x = f(p);
        return x == null || !Number.isFinite(x) ? [] : [{ x, y: y(p)! }];
      });
    const hours = (x: number) => `${x.toFixed(1).replace(".", ",")} h`;
    results.push(numericFactor("sleep_duration", "Schlafdauer", target, obs((p) => p.sleepH), hours, "Mehr Schlaf"));
    results.push(numericFactor("sleep_deep", "Tiefschlaf", target, obs((p) => p.deepH), hours, "Mehr Tiefschlaf"));
    results.push(numericFactor("bedtime", "Einschlafzeit", target, obs((p) => bedtime.get(p.day)), (m) => hhmm(m - 720), "Späteres Einschlafen"));
    results.push(numericFactor("strain_prev", "Strain am Vortag", target, obs((p) => prev(p)?.strain), (x) => x.toFixed(1).replace(".", ","), "Höherer Strain am Vortag"));
    results.push(numericFactor("load_prev", "Trainingsbelastung am Vortag", target, obs((p) => (prev(p) ? prev(p)!.load : null)), (x) => String(Math.round(x)), "Mehr Trainingsbelastung am Vortag"));
    const yesNo = (key: string, label: string, test: (p: DayPoint) => boolean | null, text: string) => {
      const yes: number[] = [], no: number[] = [];
      for (const p of withY) {
        const t = test(p);
        if (t == null) continue;
        (t ? yes : no).push(y(p)!);
      }
      results.push(yesNoFactor(key, label, target, yes, no, text));
    };
    yesNo("late_workout", "Training am Vorabend nach 19 Uhr", (p) => (prev(p) ? lateWorkout.has(addDays(p.day, -1)) : null), "Nach spätem Training am Vorabend");
    yesNo("rest_day_prev", "Ruhetag am Vortag", (p) => (prev(p) ? prev(p)!.workouts === 0 : null), "Nach einem Ruhetag");
    results.push(weekdayFactor(target, withY.map((p) => ({ day: p.day, y: y(p)! }))));
  }

  const factors = results.sort((a, b) => RANK[b.strength] - RANK[a.strength] || Math.abs(b.r ?? 0) - Math.abs(a.r ?? 0));
  const recoveryDays = days.filter((p) => p.recovery != null).length;
  return {
    factors,
    highlights: factors
      .filter((f) => f.text && f.strength !== "weak")
      .slice(0, 5)
      .map((f) => f.text!),
    days: recoveryDays,
    enoughData: recoveryDays >= MIN_DAYS,
  };
}
