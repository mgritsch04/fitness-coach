// Zeit-in-Zone-Ziele je Woche (#214): Soll-Minuten locker / mittel / hart aus den geplanten Einheiten gegen die
// gemessene Zeit in Pulszonen (WHOOP, locker = Zone 1–3, mittel = 4, hart = 5). Reine Funktion; die Anteile je
// Einheitstyp sind grobe Richtwerte (Ein- und Ausfahren, Pausen zwischen Intervallen zählen locker).
import type { PlannedSession, SessionType } from "./plan";
import type { HrZoneTime } from "./performance";

export type Bucket = "easy" | "moderate" | "hard";
const BUCKETS: Bucket[] = ["easy", "moderate", "hard"];

/** Anteil der Dauer je Bereich nach Einheitstyp; Kraft und Ruhe zählen nicht. */
export const SHARE: Partial<Record<SessionType, Record<Bucket, number>>> = {
  recovery: { easy: 1, moderate: 0, hard: 0 },
  endurance: { easy: 0.95, moderate: 0.05, hard: 0 },
  long: { easy: 0.9, moderate: 0.1, hard: 0 },
  tempo: { easy: 0.6, moderate: 0.4, hard: 0 },
  threshold: { easy: 0.6, moderate: 0.3, hard: 0.1 },
  vo2max: { easy: 0.65, moderate: 0.1, hard: 0.25 },
  opener: { easy: 0.8, moderate: 0.1, hard: 0.1 },
  race: { easy: 0.3, moderate: 0.4, hard: 0.3 },
};

const sumBy = (sessions: readonly Pick<PlannedSession, "type" | "durationMin">[]) => {
  const out = { easy: 0, moderate: 0, hard: 0 };
  for (const s of sessions) {
    const sh = SHARE[s.type];
    if (!sh) continue;
    for (const b of BUCKETS) out[b] += s.durationMin * sh[b];
  }
  return { easy: Math.round(out.easy), moderate: Math.round(out.moderate), hard: Math.round(out.hard) };
};

/** Ist-Minuten je Bereich aus der Wochenzeit in Pulszonen (Zone 0 zählt nicht). */
export function actualBuckets(z: Pick<HrZoneTime, "minutes"> | null) {
  if (!z) return null;
  const m = z.minutes;
  return { easy: (m[1] ?? 0) + (m[2] ?? 0) + (m[3] ?? 0), moderate: m[4] ?? 0, hard: m[5] ?? 0 };
}

export function zoneTargets(plan: { weekStart: string; days: readonly Pick<PlannedSession, "day" | "type" | "durationMin">[] }, actualWeek: Pick<HrZoneTime, "minutes"> | null, today: string) {
  const target = sumBy(plan.days);
  const soFar = sumBy(plan.days.filter((d) => d.day <= today));
  const actual = actualBuckets(actualWeek);
  const total = target.easy + target.moderate + target.hard;
  const pct = (v: number, t: number) => (t ? Math.round((v / t) * 100) : 0);
  const rows = BUCKETS.map((b) => ({
    bucket: b,
    label: { easy: "locker (Z1–3)", moderate: "mittel (Z4)", hard: "hart (Z5)" }[b],
    targetMin: target[b],
    targetSoFarMin: soFar[b],
    actualMin: actual?.[b] ?? null,
  }));

  const hints: string[] = [];
  if (!total) hints.push("Für diese Woche sind keine Ausdauereinheiten geplant.");
  else if (actual) {
    const over = actual.moderate - soFar.moderate;
    if (over >= 20 && actual.moderate > soFar.moderate * 1.5)
      hints.push(`Schon ${actual.moderate} min im mittleren Bereich, geplant waren bis heute etwa ${soFar.moderate}. Lockere Einheiten wirklich locker fahren (Zone 1–2), damit die harten wirken.`);
    if (soFar.hard >= 10 && actual.hard < soFar.hard * 0.5)
      hints.push(`Harte Minuten fehlen (${actual.hard} statt etwa ${soFar.hard}): In den Intervallen ruhig an die obere Grenze gehen.`);
    if (soFar.easy >= 60 && actual.easy < soFar.easy * 0.6)
      hints.push(`Bis heute ${actual.easy} min locker statt etwa ${soFar.easy}. Die Grundlage kommt zu kurz.`);
    if (!hints.length) hints.push("Die Verteilung locker / mittel / hart passt bisher zum Plan.");
  } else hints.push("Für diese Woche gibt es noch keine Pulszonen von WHOOP.");

  return {
    week: plan.weekStart,
    today,
    target: { ...target, totalMin: total, easyPct: pct(target.easy, total), moderatePct: pct(target.moderate, total), hardPct: pct(target.hard, total) },
    rows,
    hints,
    note: "Soll aus den geplanten Einheiten mit groben Anteilen je Typ (Ein- und Ausfahren und Pausen zählen locker); Ist aus WHOOP-Pulszonen aller Einheiten der Woche. Richtwerte, keine Vorgabe.",
  };
}
