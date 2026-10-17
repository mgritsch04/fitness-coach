// Rolle gegen Straße (#207): Leistung, Puls und Trittfrequenz von Indoor-Fahrten (MyWhoosh, Rolle) gegen Fahrten
// draußen. Effizienz (NP pro Herzschlag), Puls bei gleicher Leistung, Kadenz. Nur Zusammenfassungswerte der Einheiten,
// keine Sekundenwerte. Reine Funktion; Beobachtungen und Trainingshinweise, keine Diagnose.
import { addDays, type MergedWorkout } from "./analysis";
import { isRide } from "./records";

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const median = (xs: readonly number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Quellen, deren Fahrten immer drinnen stattfinden (virtuelle Strecke zählt nicht als draußen). */
export const INDOOR_SOURCES = ["mywhoosh"];
/** Mindestdauer einer Fahrt und Mindestanzahl je Umgebung für einen Vergleich. */
export const MIN_RIDE_S = 1200;
export const MIN_RIDES = 3;
/** Ab diesem Unterschied im Puls bei gleicher Leistung (Schläge/min) gibt es einen Hinweis. */
export const HR_GAP = 4;

export type Env = "indoor" | "outdoor";

/** Drinnen: Indoor-Quelle oder Sportart mit Rolle/Indoor/virtuell; draußen: Strecke ab 1 km; sonst unbekannt. */
export function environmentOf(w: Pick<MergedWorkout, "sport" | "distance_m"> & { sources?: string[]; source: string }): Env | null {
  const sources = w.sources ?? [w.source];
  if (sources.some((s) => INDOOR_SOURCES.includes(s)) || /indoor|virtual|trainer|rolle|spin/i.test(w.sport ?? "")) return "indoor";
  if ((w.distance_m ?? 0) >= 1000) return "outdoor";
  return null;
}

type Ride = Pick<MergedWorkout, "day" | "source" | "sport" | "duration_s" | "distance_m" | "avg_hr" | "avg_power_w" | "normalized_power_w" | "avg_cadence_rpm"> & { sources?: string[] };

export function indoorOutdoor(workouts: readonly Ride[], ftpW: number | null, today: string, days: number) {
  const from = addDays(today, -(days - 1));
  const rides = workouts
    .filter((w) => w.day >= from && w.day <= today && isRide(w.sport) && (w.duration_s ?? 0) >= MIN_RIDE_S)
    .map((w) => ({ ...w, env: environmentOf(w), power: w.normalized_power_w ?? w.avg_power_w ?? null }));

  const side = (env: Env) => {
    const rs = rides.filter((r) => r.env === env);
    const withEf = rs.filter((r) => r.power != null && r.power > 0 && r.avg_hr != null && r.avg_hr > 0);
    const cad = rs.flatMap((r) => (r.avg_cadence_rpm != null && r.avg_cadence_rpm > 0 ? [r.avg_cadence_rpm] : []));
    const hr = rs.flatMap((r) => (r.avg_hr != null ? [r.avg_hr] : []));
    const pw = rs.flatMap((r) => (r.power != null && r.power > 0 ? [r.power] : []));
    return {
      env,
      rides: rs.length,
      hours: round(rs.reduce((a, r) => a + (r.duration_s ?? 0), 0) / 3600, 1)!,
      powerRides: withEf.length,
      /** Effizienz: Leistung (NP) pro Herzschlag, Median. */
      ef: round(median(withEf.map((r) => r.power! / r.avg_hr!)), 2),
      medianPowerW: round(median(pw)),
      medianIf: ftpW && pw.length ? round(median(pw)! / ftpW, 2) : null,
      medianHr: round(median(hr)),
      medianCadence: round(median(cad)),
      lastDay: rs.reduce<string | null>((a, r) => (a == null || r.day > a ? r.day : a), null),
    };
  };
  const indoor = side("indoor"), outdoor = side("outdoor");
  const unknown = rides.filter((r) => r.env == null).length;

  // Puls bei gleicher Leistung: Bezugsleistung = Median beider Seiten, Puls = Leistung / Effizienz.
  const comparable = indoor.powerRides >= MIN_RIDES && outdoor.powerRides >= MIN_RIDES && indoor.ef != null && outdoor.ef != null;
  const refPowerW = comparable ? round(median([indoor.medianPowerW!, outdoor.medianPowerW!].filter((x) => x != null))) : null;
  const comparison = comparable && refPowerW
    ? {
        refPowerW,
        hrIndoor: round(refPowerW / indoor.ef!),
        hrOutdoor: round(refPowerW / outdoor.ef!),
        hrGap: round(refPowerW / indoor.ef! - refPowerW / outdoor.ef!),
        efGapPct: round((indoor.ef! / outdoor.ef! - 1) * 100, 1),
        cadenceGap: indoor.medianCadence != null && outdoor.medianCadence != null ? indoor.medianCadence - outdoor.medianCadence : null,
      }
    : null;

  const hints: string[] = [];
  if (!comparison) {
    const few = [indoor, outdoor].filter((s) => s.powerRides < MIN_RIDES).map((s) => (s.env === "indoor" ? "auf der Rolle" : "draußen"));
    hints.push(`Für einen Vergleich fehlen Fahrten mit Leistung und Puls ${few.join(" und ")} (je mindestens ${MIN_RIDES} ab ${MIN_RIDE_S / 60} min; bisher drinnen ${indoor.powerRides}, draußen ${outdoor.powerRides}).`);
    if (indoor.rides && !outdoor.rides) hints.push("Sobald du wieder draußen fährst (Wahoo), zeigt der Vergleich, ob deine Pulszonen auf der Rolle angepasst werden sollten.");
  } else {
    const g = comparison.hrGap!;
    if (g >= HR_GAP)
      hints.push(`Auf der Rolle ist dein Puls bei gleicher Leistung (${refPowerW} W) etwa ${g} Schläge höher als draußen. Das ist typisch (Wärme, kein Fahrtwind): Ein starker Ventilator hilft, und drinnen nach Leistung statt nach Puls steuern.`);
    else if (g <= -HR_GAP)
      hints.push(`Draußen ist dein Puls bei gleicher Leistung (${refPowerW} W) etwa ${-g} Schläge höher als auf der Rolle, etwa durch Hitze, Höhenmeter oder Wind. Pulszonen passen drinnen gut.`);
    else hints.push(`Puls bei gleicher Leistung ist drinnen und draußen fast gleich (Unterschied ${Math.abs(g)} Schläge). Deine Zonen passen für beide.`);
    if (comparison.cadenceGap != null && Math.abs(comparison.cadenceGap) >= 5)
      hints.push(`Auf der Rolle trittst du ${Math.abs(comparison.cadenceGap)} U/min ${comparison.cadenceGap > 0 ? "schneller" : "langsamer"} als draußen.`);
    if (indoor.medianIf != null && outdoor.medianIf != null && indoor.medianIf - outdoor.medianIf >= 0.08)
      hints.push("Drinnen fährst du deutlich intensiver als draußen; lockere Grundlage lässt sich auf der Rolle gut ergänzen.");
  }

  return {
    today,
    range: { from, to: today, days },
    indoor,
    outdoor,
    unknown,
    comparison,
    hints,
    notes: [
      `Drinnen: Fahrten aus MyWhoosh oder mit Sportart Rolle/Indoor; draußen: Fahrten mit Strecke ab 1 km. Nur Fahrten ab ${MIN_RIDE_S / 60} min.`,
      "Effizienz = Leistung (NP) pro Herzschlag; Puls bei gleicher Leistung daraus geschätzt. Beobachtungen, keine Diagnose.",
    ],
  };
}
