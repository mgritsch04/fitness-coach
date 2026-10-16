// HRV-Trend nach Plews (#125): 7-Tage-Mittel der logarithmierten HRV (lnRMSSD) gegen das eigene Normalband
// (60-Tage-Mittel ± 0,5 SD = kleinste bedeutsame Änderung) und die Schwankung von Tag zu Tag (CV).
// Deutung als Trainingshinweis, keine Diagnose. Reine Funktionen ohne D1.
import { addDays, type DayPoint } from "./analysis";

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: readonly number[]) => {
  const m = mean(xs);
  return m == null || xs.length < 2 ? null : Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};

export const ROLL_DAYS = 7;
export const BASELINE_DAYS = 60;
/** Mindestanzahl Tage mit HRV im Basiszeitraum, damit ein Normalband berechnet wird. */
export const MIN_BASELINE = 20;
/** Mindestanzahl Werte im 7-Tage-Fenster. */
export const MIN_ROLL = 4;
/** Normalband = Mittel ± SWC_FACTOR · Standardabweichung. */
export const SWC_FACTOR = 0.5;

export interface HrvPoint {
  day: string;
  /** HRV dieses Morgens in ms (RMSSD laut WHOOP). */
  hrv: number | null;
  /** 7-Tage-Mittel, in ms zurückgerechnet (geometrisches Mittel). */
  avg7: number | null;
  bandLow: number | null;
  bandHigh: number | null;
  /** Schwankung von Tag zu Tag: Variationskoeffizient der lnRMSSD im 7-Tage-Fenster, in %. */
  cv7: number | null;
}

interface Raw {
  day: string;
  ln: number | null;
  roll: number | null;
  lo: number | null;
  hi: number | null;
  cv: number | null;
}

function compute(series: readonly DayPoint[], from: string, to: string): Raw[] {
  const lnByDay = new Map(series.filter((p) => p.hrv != null && p.hrv > 0).map((p) => [p.day, Math.log(p.hrv!)]));
  const window = (end: string, n: number) => {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = lnByDay.get(addDays(end, -i));
      if (v != null) xs.push(v);
    }
    return xs;
  };
  const out: Raw[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const w = window(day, ROLL_DAYS);
    const roll = w.length >= MIN_ROLL ? mean(w) : null;
    const s = w.length >= MIN_ROLL ? sd(w) : null;
    const base = window(addDays(day, -1), BASELINE_DAYS);
    const bm = base.length >= MIN_BASELINE ? mean(base) : null, bs = base.length >= MIN_BASELINE ? sd(base) : null;
    out.push({
      day, ln: lnByDay.get(day) ?? null, roll,
      lo: bm != null && bs != null ? bm - SWC_FACTOR * bs : null,
      hi: bm != null && bs != null ? bm + SWC_FACTOR * bs : null,
      cv: roll && s != null ? (s / roll) * 100 : null,
    });
  }
  return out;
}

export type HrvState = "within" | "above" | "below";
export type HrvPattern = "stable" | "fatigue" | "saturation" | "low" | "high" | "unsettled";

const PATTERN_TEXT: Record<HrvPattern, { label: string; advice: string }> = {
  stable: { label: "Stabil im Normalbereich", advice: "Du kommst mit dem Training gut zurecht. Plan wie vorgesehen fortsetzen." },
  high: { label: "Über deinem Normalbereich", advice: "Gut erholt: ein guter Zeitraum für harte Einheiten oder einen Test." },
  unsettled: { label: "Unruhiger als sonst", advice: "Die HRV schwankt stärker als üblich. Häufige Gründe: Schlaf, Stress, Alkohol, Reisen oder ein beginnender Infekt. Harte Einheiten nur, wenn du dich gut fühlst." },
  fatigue: { label: "Ermüdung baut sich auf", advice: "Mittel unter dem Normalbereich und stärkere Schwankung. 1–2 lockere Tage oder ein Ruhetag helfen meist, dann neu bewerten." },
  saturation: { label: "Niedrig und sehr gleichförmig", advice: "Mittel unter dem Normalbereich bei auffällig gleichmäßigen Werten. Das kann nach längerer hoher Belastung auftreten (Schätzung). Belastung einige Tage senken und auf Schlaf achten." },
  low: { label: "Unter deinem Normalbereich", advice: "Locker trainieren und die nächsten Tage beobachten. Bleibt es so, Belastung reduzieren." },
};

/** Deutung aus Lage des 7-Tage-Mittels und Veränderung der Schwankung (letzte 7 gegen die 7 Tage davor). */
export function classify(state: HrvState, cvNow: number | null, cvBefore: number | null, cvTypical: number | null): HrvPattern {
  // Steigend: gegenüber der Vorwoche oder deutlich über deinem üblichen Wert (ein Abfall des Mittels in der Vorwoche bläht deren CV auf).
  const rising = (cvNow != null && cvBefore != null && cvNow - cvBefore >= 1) || (cvNow != null && cvTypical != null && cvNow >= cvTypical * 1.3);
  const falling = cvNow != null && cvBefore != null && cvBefore - cvNow >= 1;
  const unusual = cvNow != null && cvTypical != null && cvNow >= cvTypical * 1.5;
  if (state === "below") return rising ? "fatigue" : falling || (cvNow != null && cvTypical != null && cvNow <= cvTypical * 0.6) ? "saturation" : "low";
  if (unusual) return "unsettled";
  return state === "above" ? "high" : "stable";
}

export function hrvTrend(series: readonly DayPoint[], today: string, days = 90) {
  const from = addDays(today, -(days - 1));
  const raw = compute(series, addDays(from, -7), today);
  const exp = (v: number | null) => (v == null ? null : round(Math.exp(v), 0));
  const points: HrvPoint[] = raw.filter((r) => r.day >= from).map((r) => ({
    day: r.day, hrv: exp(r.ln), avg7: exp(r.roll), bandLow: exp(r.lo), bandHigh: exp(r.hi), cv7: round(r.cv, 1),
  }));
  const notes = [
    "Nach Plews u. a.: Statt einzelner Morgen zählt das 7-Tage-Mittel der logarithmierten HRV. Normalbereich = Mittel deiner 60 Tage davor ± 0,5 Standardabweichungen (kleinste bedeutsame Änderung).",
    "Schwankung (CV) = wie stark die HRV von Tag zu Tag springt. Steigt sie bei sinkendem Mittel, deutet das auf Ermüdung hin.",
    "Trainingshinweis, keine Diagnose. HRV reagiert auch auf Schlaf, Stress, Alkohol, Hitze und Infekte.",
  ];
  const last = [...raw].reverse().find((r) => r.roll != null && r.lo != null && r.hi != null);
  if (!last || last.day < addDays(today, -2))
    return { today, range: { from, to: today, days }, available: false as const, reason: `Noch zu wenige Tage mit HRV (mindestens ${MIN_BASELINE} in den letzten ${BASELINE_DAYS} Tagen und ${MIN_ROLL} in der letzten Woche).`, points, notes };

  const state: HrvState = last.roll! < last.lo! ? "below" : last.roll! > last.hi! ? "above" : "within";
  const cvAt = (d: string) => raw.find((r) => r.day === d)?.cv ?? null;
  const cvNow = last.cv, cvBefore = cvAt(addDays(last.day, -7));
  const cvTypical = mean(raw.filter((r) => r.day > addDays(last.day, -BASELINE_DAYS) && r.cv != null).map((r) => r.cv!));
  const before = raw.find((r) => r.day === addDays(last.day, -14))?.roll ?? null;
  const pattern = classify(state, cvNow, cvBefore, cvTypical);
  return {
    today,
    range: { from, to: today, days },
    available: true as const,
    current: {
      day: last.day,
      avg7: exp(last.roll), bandLow: exp(last.lo), bandHigh: exp(last.hi), state,
      /** Abstand zur Bandmitte in % (über das logarithmierte Mittel gerechnet). */
      vsBaselinePct: round((Math.exp(last.roll! - (last.lo! + last.hi!) / 2) - 1) * 100, 1),
      change14dPct: before != null ? round((Math.exp(last.roll! - before) - 1) * 100, 1) : null,
      cv7: round(cvNow, 1), cv7WeekBefore: round(cvBefore, 1), cvTypical: round(cvTypical, 1),
    },
    pattern,
    ...PATTERN_TEXT[pattern],
    points,
    notes,
  };
}
