// Krafttraining nach Saisonphase (#213): Für Radfahrer ändert sich das Krafttraining übers Jahr.
// Aufbau (Winter, ohne nahes Ziel): mehr Sätze. Erhalt (Saison, Aufbau auf ein Ziel): weniger Sätze, schwer und
// kurz. Wettkampf (Spitze, Tapering, Wettkampfwoche): nur kurz aktivieren. Automatisch aus der Planphase und
// der Jahreszeit oder fest eingestellt. Faustregeln, Trainingsempfehlung.
import type { Phase } from "./plan";

export type StrengthSeasonPhase = "build" | "maintain" | "race";

export interface StrengthSeason {
  phase: StrengthSeasonPhase;
  label: string;
  source: "setting" | "plan" | "season";
  /** Höchstens so viele Krafteinheiten pro Woche (null = keine Grenze), gilt nur ohne feste Häufigkeit. */
  maxPerWeek: number | null;
  text: string;
}

export const SEASON_LABEL: Record<StrengthSeasonPhase, string> = { build: "Kraftaufbau", maintain: "Krafterhalt", race: "Wettkampf" };
const TEXT: Record<StrengthSeasonPhase, string> = {
  build: "Kraftaufbau: ein Satz mehr bei den Grundübungen, 2–3 Einheiten pro Woche. Jetzt ist die Zeit, Kraft aufzubauen.",
  maintain: "Krafterhalt: 2 Einheiten pro Woche, weniger Sätze, dafür schwer und kurz (höchstens 6 Wiederholungen bei den Grundübungen).",
  race: "Wettkampfphase: höchstens 1 kurze Einheit, 2 Sätze, etwa 10 % leichter und explosiv, nichts bis zur Ermüdung.",
};

/** Phase: feste Einstellung, sonst aus der Planphase, sonst nach Jahreszeit (Oktober–Februar Aufbau). */
export function strengthSeason(planPhase: Phase, week: string, setting?: StrengthSeasonPhase | null): StrengthSeason {
  let phase: StrengthSeasonPhase, source: StrengthSeason["source"];
  if (setting) (phase = setting), (source = "setting");
  else if (planPhase === "peak" || planPhase === "taper" || planPhase === "race") (phase = "race"), (source = "plan");
  else if (planPhase === "build") (phase = "maintain"), (source = "plan");
  else {
    const m = Number(week.slice(5, 7));
    phase = m >= 10 || m <= 2 ? "build" : "maintain";
    source = "season";
  }
  const why = source === "setting" ? " (fest eingestellt)" : source === "plan" ? " (aus der Planphase)" : " (nach Jahreszeit; mit einem Ziel-Termin richtet es sich nach dem Plan)";
  return { phase, label: SEASON_LABEL[phase], source, // Die gewohnte Häufigkeit wird nur in der Wettkampfphase oder bei fest eingestelltem Erhalt gekürzt.
    maxPerWeek: phase === "race" ? 1 : phase === "maintain" && source === "setting" ? 2 : null, text: TEXT[phase] + why };
}

export interface SeasonItem { exercise: string; sets: number; reps: number; unit?: "s" }

/** Sätze, Wiederholungen und Übungszahl je Phase anpassen; Halteübungen bleiben. */
export function seasonItems<T extends SeasonItem>(items: T[], phase: StrengthSeasonPhase): T[] {
  if (phase === "build") return items.map((it, i) => (i < 2 && it.unit !== "s" ? { ...it, sets: Math.min(5, it.sets + 1) } : it));
  if (phase === "maintain")
    return items.slice(0, 4).map((it, i) => (it.unit === "s" ? it : { ...it, sets: Math.max(2, it.sets - 1), reps: i < 2 ? Math.min(it.reps, 6) : it.reps }));
  return items.slice(0, 3).map((it) => (it.unit === "s" ? { ...it, sets: 2 } : { ...it, sets: 2, reps: Math.min(it.reps, 5) }));
}

/** Gewichtsfaktor je Phase (Wettkampf etwas leichter). */
export const seasonWeightFactor = (phase: StrengthSeasonPhase) => (phase === "race" ? 0.9 : 1);
