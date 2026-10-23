// Ruhetag: lockeres Ausfahren ja oder nein (#324). Wenn die Tagesempfehlung „Ruhe“ lautet, sagt der Coach dazu,
// ob 20–45 min Zone 1 auf dem Rad (aktive Erholung) passt oder heute ganz frei besser ist.
// Faustregeln aus Erholungsampel, Ruhepuls, Schlaf, Belastung der letzten Tage, Frühwarnung und Tagebuch;
// Schätzung für Training, keine medizinische Aussage.
import { addDays, type DayPoint, type Trend } from "./analysis";
import { workoutForSession, type WorkoutSuggestion } from "./bike-workout";
import type { CoachAdvice } from "./coach";
import type { JournalEntry } from "./journal";
import type { ReturnToTraining } from "./return-to-training";
import type { EarlyWarning } from "./warnings";

export interface RestRide {
  /** spin = locker ausfahren passt, off = heute ganz frei. */
  verdict: "spin" | "off";
  /** Dauer in Minuten, nur bei spin. */
  minutes: { min: number; max: number } | null;
  text: string;
  /** Gründe in Kurzform (für Oberfläche und Coach-Chat). */
  reasons: string[];
  /** Passende lockere Einheit zum Import in MyWhoosh (#337), nur bei spin. */
  workout?: WorkoutSuggestion | null;
  disclaimer: string;
}

export interface RestRideInput {
  coach: CoachAdvice;
  series: DayPoint[];
  today: string;
  rhrTrend: Trend;
  sleepNeedH: number;
  warning?: EarlyWarning | null;
  comeback?: ReturnToTraining | null;
  journalToday?: JournalEntry | null;
  /** Winterbetrieb (#326): Ausfahren auf der Rolle. */
  indoor?: boolean;
}

const SICK = ["krank", "erkältet", "fieber", "infekt", "verletzt", "schmerzen"];
const DISCLAIMER = "Faustregel aus deinen Daten, keine medizinische Aussage. Bei Krankheitszeichen ganz pausieren.";

/** null, wenn heute kein Ruhetag empfohlen ist. */
export function restRideAdvice(x: RestRideInput): RestRide | null {
  if (x.coach.readiness !== "rest") return null;
  const t = x.series.find((p) => p.day === x.today);
  const off: string[] = [];
  const soft: string[] = [];

  // Klare Gründe für ganz frei.
  if (x.comeback?.status === "sick") off.push("heute als krank eingetragen");
  const tags = (x.journalToday?.tags ?? []).map((s) => s.toLowerCase());
  if (x.comeback?.status !== "sick" && tags.some((tg) => SICK.some((s) => tg.includes(s)))) off.push("im Tagebuch krank oder verletzt eingetragen");
  if (x.warning?.level === "alert") off.push("Frühwarnung: mehrere Körpersignale deutlich daneben");
  if (t?.rhr != null && x.rhrTrend.baseline != null && t.rhr >= x.rhrTrend.baseline + 8) off.push(`Ruhepuls ${Math.round(t.rhr - x.rhrTrend.baseline)} Schläge über deiner Basis`);
  if (t?.recovery != null && t.recovery < 20) off.push(`Erholung nur ${Math.round(t.recovery)} %`);
  if (t?.sleepH != null && t.sleepH < 5) off.push(`nur ${t.sleepH.toFixed(1)} h geschlafen`);

  // Gründe für eher kurz.
  if (t?.recovery != null && t.recovery < 34 && t.recovery >= 20) soft.push(`Erholung ${Math.round(t.recovery)} % (rot)`);
  if (x.warning?.level === "caution") soft.push("Frühwarnung: einige Körpersignale daneben");
  if (t?.sleepH != null && t.sleepH >= 5 && t.sleepH < x.sleepNeedH - 1.5) soft.push(`${t.sleepH.toFixed(1)} h Schlaf`);
  const last3 = x.series.filter((p) => p.day > addDays(x.today, -4) && p.day < x.today);
  const load3 = last3.reduce((a, p) => a + (p.load ?? 0), 0);
  const ctl = t?.ctl ?? last3.at(-1)?.ctl ?? 0;
  if (ctl > 0 && load3 > ctl * 4) soft.push("viel Belastung in den letzten 3 Tagen");
  const sore = x.journalToday?.soreness;
  if (sore != null && sore >= 4) soft.push("starker Muskelkater laut Tagebuch");

  const where = x.indoor ? "auf der Rolle (MyWhoosh frei fahren oder ERG sehr niedrig)" : "auf dem Rad";
  if (off.length) {
    return {
      verdict: "off",
      minutes: null,
      text: `Heute ganz frei, auch kein lockeres Ausfahren: ${off.join(", ")}. Höchstens ein kurzer Spaziergang.`,
      reasons: off,
      disclaimer: DISCLAIMER,
    };
  }
  const minutes = soft.length ? { min: 20, max: 30 } : { min: 30, max: 45 };
  const why = soft.length ? ` Eher kurz, weil ${soft.join(", ")}.` : " Die Werte sprechen nicht dagegen.";
  return {
    verdict: "spin",
    minutes,
    text: `Locker ausfahren ist okay: ${minutes.min}–${minutes.max} min ${where} in Zone 1, Puls deutlich unter der Grundlage, ohne Intervalle.${why} Fühlt es sich schwer an, abbrechen.`,
    reasons: soft,
    workout: workoutForSession("recovery", minutes.max, x.today, t?.recovery ?? null),
    disclaimer: DISCLAIMER,
  };
}
