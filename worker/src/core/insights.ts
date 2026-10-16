// Einflussfaktoren auf die Erholung: Zusammenhänge zwischen dem, was an einem Tag passiert (Strain,
// Belastung, Schlaf, Uhrzeit), und der Erholung/HRV am Folgetag. Beobachtungen, keine Ursache-Wirkung.
// Reine Funktionen ohne D1.
import { addDays, type DayPoint } from "./analysis";

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
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
