// Training nach der Erholungsampel (#226): passt der Strain eines Tages zur Erholung am Morgen? Grüne Tage für harte
// Einheiten genutzt, rote Tage ruhig gehalten, und was hartes Training an roten Tagen am Morgen danach kostet.
// Nur Tageswerte (WHOOP). Reine Funktion ohne D1; Trainingsempfehlungen, keine Diagnose.
import { addDays, type DayPoint } from "./analysis";

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** WHOOP-Zonen der Erholung: grün ab 67, rot unter 34. */
export const GREEN = 67;
export const RED = 34;
/** Strain-Stufen: leicht unter 10, hart ab 14. */
export const LIGHT = 10;
export const HARD = 14;
/** Mindestanzahl Tage mit Erholung und Strain. */
export const MIN_DAYS = 14;

export type Zone = "green" | "yellow" | "red";
export type Level = "light" | "moderate" | "hard";
/** aligned: passt zur Ampel; against: hart an rotem Tag; missed: locker an grünem Tag; neutral: alles andere. */
export type Verdict = "aligned" | "against" | "missed" | "neutral";

export const zoneOf = (recovery: number): Zone => (recovery >= GREEN ? "green" : recovery < RED ? "red" : "yellow");
export const levelOf = (strain: number): Level => (strain >= HARD ? "hard" : strain < LIGHT ? "light" : "moderate");
export function verdictOf(zone: Zone, level: Level): Verdict {
  if (zone === "red") return level === "hard" ? "against" : level === "light" ? "aligned" : "neutral";
  if (zone === "green") return level === "light" ? "missed" : "aligned";
  return "neutral";
}

const ZONES: Zone[] = ["green", "yellow", "red"];
const LEVELS: Level[] = ["light", "moderate", "hard"];
const ZONE_LABEL: Record<Zone, string> = { green: "Grün", yellow: "Gelb", red: "Rot" };

export function readinessAlignment(series: readonly DayPoint[], today: string, days: number) {
  const from = addDays(today, -(days - 1));
  const byDay = new Map(series.map((p) => [p.day, p]));
  // Heute zählt nicht: der Strain des Tages ist noch nicht fertig.
  const list = series
    .filter((p) => p.day >= from && p.day < today && p.recovery != null && p.strain != null)
    .map((p) => {
      const zone = zoneOf(p.recovery!), level = levelOf(p.strain!);
      return { day: p.day, recovery: p.recovery!, strain: round(p.strain, 1)!, zone, level, verdict: verdictOf(zone, level), nextRecovery: byDay.get(addDays(p.day, 1))?.recovery ?? null };
    });
  const range = { from, to: today, days };
  if (list.length < MIN_DAYS)
    return { today, range, available: false as const, reason: `Erst ${list.length} Tage mit Erholung und Strain im Zeitraum; ab ${MIN_DAYS} gibt es eine Auswertung.`, days: list.length };

  const matrix = ZONES.map((zone) => ({
    zone, label: ZONE_LABEL[zone],
    counts: Object.fromEntries(LEVELS.map((l) => [l, list.filter((d) => d.zone === zone && d.level === l).length])) as Record<Level, number>,
    total: list.filter((d) => d.zone === zone).length,
  }));
  const count = (v: Verdict) => list.filter((d) => d.verdict === v).length;
  const judged = list.filter((d) => d.zone !== "yellow").length;
  const score = judged ? round((count("aligned") / judged) * 100) : null;

  // Folge harter Tage an roten Tagen: Erholung am Morgen danach gegen ruhige rote Tage.
  const red = list.filter((d) => d.zone === "red" && d.nextRecovery != null);
  const redHard = red.filter((d) => d.level === "hard").map((d) => d.nextRecovery!);
  const redCalm = red.filter((d) => d.level !== "hard").map((d) => d.nextRecovery!);
  const redCost = redHard.length >= 2 && redCalm.length >= 2 ? round(mean(redCalm)! - mean(redHard)!) : null;
  const green = matrix[0], redRow = matrix[2];
  const greenUsedPct = green.total ? round(((green.counts.moderate + green.counts.hard) / green.total) * 100) : null;
  const greenHardPct = green.total ? round((green.counts.hard / green.total) * 100) : null;
  // Wie viele harte Tage lagen auf grünen Tagen?
  const hardDays = list.filter((d) => d.level === "hard");
  const hardOnGreenPct = hardDays.length ? round((hardDays.filter((d) => d.zone === "green").length / hardDays.length) * 100) : null;

  const hints: string[] = [];
  const against = count("against");
  if (against)
    hints.push(`An ${against} von ${redRow.total} roten Tagen hast du trotzdem hart trainiert (Strain ab ${HARD}).` +
      (redCost != null && redCost >= 3 ? ` Am Morgen danach lag deine Erholung im Schnitt ${redCost} Punkte tiefer als nach ruhigen roten Tagen.` : " An roten Tagen lieber locker bleiben oder ruhen."));
  if (green.total >= 5 && greenUsedPct != null && greenUsedPct < 50)
    hints.push(`Nur ${greenUsedPct} % deiner ${green.total} grünen Tage hast du für Training ab Strain ${LIGHT} genutzt. Harte Einheiten am besten auf grüne Tage legen.`);
  if (hardDays.length >= 4 && hardOnGreenPct != null && hardOnGreenPct < 40)
    hints.push(`Nur ${hardOnGreenPct} % deiner harten Tage fielen auf grüne Erholung. Wenn möglich, harte Einheiten nach der Morgenerholung verschieben.`);
  if (!hints.length)
    hints.push(score != null && score >= 75
      ? `Du richtest dein Training gut nach der Erholung aus: ${score} % deiner grünen und roten Tage passen zur Ampel.`
      : "Kein deutliches Muster: Training und Erholung passen meist zusammen.");

  return {
    today,
    range,
    available: true as const,
    days: list.length,
    matrix,
    score,
    counts: { aligned: count("aligned"), against, missed: count("missed"), neutral: count("neutral") },
    greenUsedPct,
    greenHardPct,
    hardOnGreenPct,
    redCost,
    recent: list.slice(-14).map(({ day, recovery, strain, zone, level, verdict }) => ({ day, recovery, strain, zone, level, verdict })),
    hints,
    notes: [
      `Zonen wie bei WHOOP: grün ab ${GREEN} %, rot unter ${RED} %. Strain leicht unter ${LIGHT}, hart ab ${HARD}. Passend: an grünen Tagen ab Strain ${LIGHT}, an roten unter ${LIGHT}. Gelbe Tage zählen nicht zur Quote.`,
      "Heute zählt nicht, weil der Tag noch läuft. Trainingsempfehlungen aus deinen Daten, keine Diagnose.",
    ],
  };
}
