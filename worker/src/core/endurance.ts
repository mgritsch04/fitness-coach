// Ausdauer-Profil (#92): Critical Power und W′ aus der Leistungskurve (2-Parameter-Modell) und der
// Effizienz-Faktor (NP pro Herzschlag) lockerer Fahrten im Wochenverlauf. Reine Funktionen, Schätzungen.
import { addDays, weekStart, type MergedWorkout, type WorkoutLoad } from "./analysis";
import type { CurvePoint } from "./performance";

type LoadedWorkout = MergedWorkout & WorkoutLoad;

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

/** Dauern für das CP-Modell: kürzere sind anaerob verzerrt, längere oft nicht ausgefahren. */
export const CP_DURATIONS_S = [180, 300, 600, 1200] as const;

export interface CpModel {
  cpW: number;
  wPrimeKj: number;
  /** Bestimmtheitsmaß der Geraden Arbeit = CP · t + W′ (nahe 1 = Werte passen zum Modell). */
  r2: number;
  points: { durationS: number; watts: number; day: string }[];
  confidence: "high" | "medium" | "low";
  note: string;
}

/**
 * 2-Parameter-Modell (Monod & Scherrer): Arbeit(t) = CP · t + W′, lineare Regression über die besten
 * Leistungen von 3 bis 20 min. Braucht mindestens 3 Dauern; nur echte Ausbelastungen ergeben ein gutes Modell.
 */
export function criticalPower(curve: readonly CurvePoint[]): CpModel | null {
  const pts = CP_DURATIONS_S.map((d) => curve.find((c) => c.durationS === d)).filter((c): c is CurvePoint => !!c && c.watts > 0);
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p.durationS), ys = pts.map((p) => p.watts * p.durationS);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) [sxy, sxx, syy] = [sxy + (xs[i] - mx) * (ys[i] - my), sxx + (xs[i] - mx) ** 2, syy + (ys[i] - my) ** 2];
  const cp = sxy / sxx, wPrime = my - cp * mx;
  if (!(cp > 0) || !(wPrime > 0)) return null;
  const r2 = syy ? (sxy * sxy) / (sxx * syy) : 1;
  const wPrimeKj = wPrime / 1000;
  // Übliche W′-Werte liegen etwa zwischen 6 und 35 kJ; außerhalb davon sind die Bestwerte meist keine Ausbelastungen.
  const plausible = wPrimeKj >= 6 && wPrimeKj <= 35;
  const confidence = pts.length >= 4 && r2 >= 0.998 && plausible ? "high" : plausible && r2 >= 0.99 ? "medium" : "low";
  return {
    cpW: Math.round(cp),
    wPrimeKj: round(wPrimeKj, 1)!,
    r2: round(r2, 4)!,
    points: pts.map((p) => ({ durationS: p.durationS, watts: Math.round(p.watts), day: p.day })),
    confidence,
    note:
      confidence === "low"
        ? "Die Bestwerte passen schlecht zum Modell (vermutlich keine voll ausgefahrenen 3-, 5- oder 20-min-Anstrengungen). CP und W′ sind nur grobe Schätzungen."
        : "Schätzung aus deinen besten 3–20-min-Leistungen der letzten 90 Tage.",
  };
}

/** Wie lange eine Leistung über CP haltbar ist: W′ / (P − CP), in Sekunden. Unter CP: null (theoretisch sehr lange). */
export function timeToExhaustionS(model: Pick<CpModel, "cpW" | "wPrimeKj">, watts: number): number | null {
  return watts > model.cpW ? Math.round((model.wPrimeKj * 1000) / (watts - model.cpW)) : null;
}

export interface EfRide {
  day: string;
  source: string;
  sourceId: string;
  durationMin: number;
  npW: number;
  avgHr: number;
  ef: number;
}

/**
 * Effizienz-Faktor = NP / mittlerer Puls, nur lockere, gleichmäßige Fahrten (IF unter 0,8, mindestens 30 min):
 * bei harten Einheiten hängt das Verhältnis zu sehr von der Intervallstruktur ab.
 */
export function efficiencyRides(workouts: readonly LoadedWorkout[], fromDay: string): EfRide[] {
  return workouts
    .filter((w) => w.day >= fromDay && w.normalized_power_w && w.avg_hr && (w.duration_s ?? 0) >= 1800 && (w.intensity == null || w.intensity < 0.8))
    .map((w) => ({
      day: w.day,
      source: w.source,
      sourceId: w.source_id,
      durationMin: Math.round((w.duration_s ?? 0) / 60),
      npW: Math.round(w.normalized_power_w!),
      avgHr: Math.round(w.avg_hr!),
      ef: round(w.normalized_power_w! / w.avg_hr!, 2)!,
    }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

export function efficiencyTrend(rides: readonly EfRide[], today: string) {
  const weeks = new Map<string, number[]>();
  for (const r of rides) weeks.set(weekStart(r.day), [...(weeks.get(weekStart(r.day)) ?? []), r.ef]);
  const weekly = [...weeks.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([week, xs]) => ({ week, rides: xs.length, ef: round(xs.reduce((a, b) => a + b, 0) / xs.length, 2)! }));
  const avgIn = (from: string, to: string) => {
    const xs = rides.filter((r) => r.day >= from && r.day <= to).map((r) => r.ef);
    return xs.length >= 2 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const recent = avgIn(addDays(today, -27), today), before = avgIn(addDays(today, -83), addDays(today, -28));
  const changePct = recent != null && before ? round(((recent - before) / before) * 100, 1) : null;
  const verdict =
    changePct == null ? "Noch zu wenige lockere Fahrten mit Leistung und Puls für einen Trend."
    : changePct >= 2 ? `Deine Effizienz ist in den letzten 4 Wochen um ${String(changePct).replace(".", ",")} % gestiegen: mehr Watt bei gleichem Puls, die Grundlage wird besser.`
    : changePct <= -2 ? `Deine Effizienz ist um ${String(Math.abs(changePct)).replace(".", ",")} % gesunken. Häufige Gründe: Ermüdung, Hitze, wenig Grundlagentraining oder Krankheit.`
    : "Deine Effizienz ist stabil.";
  return { weekly, recentEf: round(recent, 2), previousEf: round(before, 2), changePct, verdict };
}

export function enduranceProfile(curve90d: readonly CurvePoint[], workouts: readonly LoadedWorkout[], today: string, ftpW: number | null) {
  const cp = criticalPower(curve90d);
  const rides = efficiencyRides(workouts, addDays(today, -179));
  const targets = cp ? [0.9, 1, 1.05, 1.1, 1.2, 1.5].map((f) => Math.round(cp.cpW * f)) : [];
  return {
    today,
    criticalPower: cp,
    /** Zum Vergleich: CP liegt meist etwas über der FTP (typisch 3–8 %). */
    ftpW,
    cpVsFtpPct: cp && ftpW ? round(((cp.cpW - ftpW) / ftpW) * 100, 1) : null,
    holdTimes: cp ? targets.map((w) => ({ watts: w, seconds: timeToExhaustionS(cp, w) })) : [],
    efficiency: { rides: rides.slice(-30), ...efficiencyTrend(rides, today) },
    notes: [
      "Critical Power (CP): Leistung, die du sehr lange halten kannst; W′: Energievorrat für alles darüber, der sich unter CP wieder auflädt. 2-Parameter-Modell, Schätzung.",
      "Effizienz-Faktor (EF) = normierte Leistung / mittlerer Puls lockerer Fahrten (IF < 0,8, ab 30 min). Steigt er, wird die Grundlage besser. Puls und Leistung kommen oft aus zwei Geräten (Trainer und WHOOP).",
      "Trainingsempfehlung, keine Diagnose.",
    ],
  };
}
