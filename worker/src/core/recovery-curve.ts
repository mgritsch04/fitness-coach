// Erholungskurve (#195): Erholung, HRV und Ruhepuls an den Tagen nach einem harten Tag gegenüber dem eigenen Mittel,
// Tage bis zur Rückkehr auf das Normalniveau und der Einfluss des Schlafs in der Nacht danach. Nutzt nur Tageswerte
// (WHOOP), keine Sekundenwerte. Reine Funktionen ohne D1; Beobachtungen, keine Ursache-Wirkung.
import { addDays, type DayPoint } from "./analysis";

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fmt = (v: number | null, digits = 0) => String(round(v, digits)).replace(".", ",");

/** Tage nach dem harten Tag, die betrachtet werden (0 = Morgen des harten Tags). */
export const HORIZON = 4;
/** Mindestanzahl harter Tage für eine Aussage. */
export const MIN_HARD = 4;
/** Ab hier gilt die Erholung wieder als normal (Punkte unter dem Mittel). */
export const BACK_WITHIN = 3;
const MIN_STRAIN = 14;

function percentile(xs: readonly number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

export function recoveryCurve(series: readonly DayPoint[], today: string, days: number) {
  const from = addDays(today, -(days - 1));
  const inRange = series.filter((p) => p.day >= from && p.day <= today);
  const byDay = new Map(series.map((p) => [p.day, p]));
  const nums = (f: (p: DayPoint) => number | null) => inRange.flatMap((p) => { const v = f(p); return v == null ? [] : [v]; });
  const base = { recovery: mean(nums((p) => p.recovery)), hrv: mean(nums((p) => p.hrv)), rhr: mean(nums((p) => p.rhr)), sleepH: mean(nums((p) => p.sleepH)) };
  const strains = nums((p) => p.strain);
  const threshold = strains.length ? Math.max(MIN_STRAIN, percentile(strains, 0.8)) : null;

  const empty = (reason: string) => ({ today, range: { from, to: today, days }, available: false as const, reason, threshold: round(threshold, 1), hardDays: 0 });
  if (threshold == null || base.recovery == null) return empty("Noch zu wenige Tage mit Strain und Erholung im Zeitraum.");

  // Harte Tage, deren Folgetage nicht selbst wieder hart sind (sonst vermischen sich die Kurven); zu wenige → alle.
  const hardAll = inRange.filter((p) => p.strain != null && p.strain >= threshold && p.day <= addDays(today, -1));
  const isolated = hardAll.filter((p) => [1, 2].every((k) => (byDay.get(addDays(p.day, k))?.strain ?? 0) < threshold));
  const hard = isolated.length >= MIN_HARD ? isolated : hardAll;
  if (hard.length < MIN_HARD) return { ...empty(`Erst ${hard.length} harte Tage (Strain ab ${fmt(threshold, 1)}) im Zeitraum; ab ${MIN_HARD} gibt es eine Kurve.`), hardDays: hard.length };

  const curve = Array.from({ length: HORIZON + 1 }, (_, k) => {
    const pts = hard.map((h) => byDay.get(addDays(h.day, k))).filter((p): p is DayPoint => !!p && p.day <= today);
    const rec = pts.flatMap((p) => (p.recovery == null ? [] : [p.recovery]));
    const hrv = pts.flatMap((p) => (p.hrv == null ? [] : [p.hrv]));
    const rhr = pts.flatMap((p) => (p.rhr == null ? [] : [p.rhr]));
    const strain = pts.flatMap((p) => (p.strain == null ? [] : [p.strain]));
    return {
      day: k,
      n: rec.length,
      recoveryVsAvg: rec.length ? round(mean(rec)! - base.recovery!, 1) : null,
      hrvVsAvgPct: hrv.length && base.hrv ? round(((mean(hrv)! - base.hrv) / base.hrv) * 100, 1) : null,
      rhrVsAvg: rhr.length && base.rhr != null ? round(mean(rhr)! - base.rhr, 1) : null,
      strain: round(mean(strain), 1),
    };
  });
  const backAt = curve.find((c) => c.day >= 1 && c.recoveryVsAvg != null && c.recoveryVsAvg >= -BACK_WITHIN)?.day ?? null;

  // Schlaf in der Nacht nach dem harten Tag: Erholung am nächsten Morgen bei mehr gegen weniger Schlaf als üblich.
  const next = hard.map((h) => byDay.get(addDays(h.day, 1))).filter((p): p is DayPoint => !!p && p.recovery != null && p.sleepH != null);
  const longer = next.filter((p) => p.sleepH! >= base.sleepH!).map((p) => p.recovery!);
  const shorter = next.filter((p) => p.sleepH! < base.sleepH!).map((p) => p.recovery!);
  const sleepEffect = longer.length >= 2 && shorter.length >= 2 ? round(mean(longer)! - mean(shorter)!, 0) : null;

  const day1 = curve[1].recoveryVsAvg;
  const hints: string[] = [];
  if (backAt === 1) hints.push(`Du erholst dich schnell: Schon am Morgen nach einem harten Tag liegt deine Erholung ${Math.abs(Math.round(day1 ?? 0)) <= 1 ? "kaum" : `nur ${fmt(Math.abs(day1 ?? 0))} Punkte`} unter deinem Mittel. Zwei harte Tage hintereinander sind für dich meist machbar.`);
  else if (backAt != null) hints.push(`Nach einem harten Tag (Strain ab ${fmt(threshold, 1)}) dauert es etwa ${backAt} Tage, bis deine Erholung wieder normal ist. Plane danach ${backAt - 1 === 1 ? "einen lockeren Tag" : `${backAt - 1} lockere Tage`} ein.`);
  else hints.push(`Auch ${HORIZON} Tage nach einem harten Tag liegt deine Erholung noch unter deinem Mittel. Harte Tage seltener setzen oder danach bewusst mehr Ruhe einplanen.`);
  if (sleepEffect != null && sleepEffect >= 5)
    hints.push(`Schläfst du nach einem harten Tag länger als üblich, ist deine Erholung am nächsten Morgen im Schnitt ${sleepEffect} Punkte höher.`);

  return {
    today,
    range: { from, to: today, days },
    available: true as const,
    threshold: round(threshold, 1),
    hardDays: hard.length,
    isolatedOnly: hard === isolated,
    averages: { recovery: round(base.recovery, 0), hrv: round(base.hrv, 0), rhr: round(base.rhr, 0), sleepH: round(base.sleepH, 1) },
    curve,
    backToNormalDays: backAt,
    sleepEffect,
    hints,
    notes: [
      `Harte Tage: Strain ab dem 80. Perzentil im Zeitraum (mindestens ${MIN_STRAIN}), möglichst ohne weiteren harten Tag in den zwei Tagen danach. Tag 0 ist der Morgen des harten Tags, Tag 1 der Morgen danach.`,
      `Wieder normal = Erholung höchstens ${BACK_WITHIN} Punkte unter deinem Mittel. Beobachtungen aus deinen Daten, keine Ursache-Wirkung.`,
    ],
  };
}
