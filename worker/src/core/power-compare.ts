// Leistungskurve Zeitraum gegen Zeitraum (#215): beste Leistung je Dauer jetzt gegen den Zeitraum davor oder dieselbe
// Zeit im Vorjahr, Differenz in W und %. Reine Funktion auf den Bestwerten je Fahrt (PowerBestRow).
import { addDays } from "./analysis";
import { powerCurve, type PowerBestRow } from "./performance";

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

/** Dauern für den Vergleich (5 s bis 60 min). */
export const COMPARE_DURATIONS_S = [5, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600] as const;
export type CompareMode = "previous" | "lastYear";
/** Ab dieser Änderung zählt eine Dauer als deutlich besser oder schlechter. */
const CLEAR_PCT = 3;

const label = (s: number) => (s < 60 ? `${s} s` : `${s / 60} min`);

export function compareWindows(mode: CompareMode, today: string, days: number) {
  const current = { from: addDays(today, -(days - 1)), to: today };
  const shift = mode === "previous" ? days : 365;
  return { current, reference: { from: addDays(current.from, -shift), to: addDays(current.to, -shift) } };
}

export function comparePowerCurves(rows: readonly PowerBestRow[], mode: CompareMode, today: string, days: number) {
  const { current, reference } = compareWindows(mode, today, days);
  const curve = (w: { from: string; to: string }) => new Map(powerCurve(rows.filter((r) => r.day <= w.to), w.from).map((p) => [p.durationS, p]));
  const a = curve(current), b = curve(reference);
  const durations = COMPARE_DURATIONS_S.map((s) => {
    const now = a.get(s), then = b.get(s);
    const diffW = now && then ? Math.round(now.watts - then.watts) : null;
    return {
      durationS: s, label: label(s),
      currentW: now ? Math.round(now.watts) : null, currentDay: now?.day ?? null,
      referenceW: then ? Math.round(then.watts) : null, referenceDay: then?.day ?? null,
      diffW, diffPct: now && then ? round(((now.watts - then.watts) / then.watts) * 100, 1) : null,
    };
  });
  const both = durations.filter((d) => d.diffPct != null);
  const refName = mode === "previous" ? `den ${days} Tagen davor` : "derselben Zeit im Vorjahr";
  const hints: string[] = [];
  if (!a.size) hints.push("Im aktuellen Zeitraum gibt es noch keine Fahrt mit Leistung.");
  else if (!b.size) hints.push(`Zum Vergleich mit ${refName} fehlen Fahrten mit Leistung.`);
  else if (both.length) {
    const up = both.filter((d) => d.diffPct! >= CLEAR_PCT), down = both.filter((d) => d.diffPct! <= -CLEAR_PCT);
    const best = both.reduce((x, d) => (d.diffPct! > x.diffPct! ? d : x)), worst = both.reduce((x, d) => (d.diffPct! < x.diffPct! ? d : x));
    if (up.length && !down.length) hints.push(`Stärker als in ${refName}: am meisten über ${best.label} (+${String(best.diffPct).replace(".", ",")} %).`);
    else if (down.length && !up.length) hints.push(`Schwächer als in ${refName}, vor allem über ${worst.label} (−${String(Math.abs(worst.diffPct!)).replace(".", ",")} %). Oft fehlen nur harte Anstrengungen über diese Dauer.`);
    else if (up.length && down.length) hints.push(`Gemischt gegenüber ${refName}: besser über ${up.map((d) => d.label).join(", ")}, schwächer über ${down.map((d) => d.label).join(", ")}.`);
    else hints.push(`Etwa gleich stark wie in ${refName} (alle Dauern innerhalb ±${CLEAR_PCT} %).`);
  }
  return {
    mode, today, days, current, reference,
    durations,
    hints,
    notes: ["Beste Durchschnittsleistung je Dauer aus Fahrten mit Sekundenwerten (FIT-Import). Fehlt eine Dauer, war im Zeitraum keine so lange Fahrt mit Leistung dabei. Bestwerte hängen davon ab, ob du die Dauer wirklich voll gefahren bist."],
  };
}
