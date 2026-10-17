// Muskelbalance (#171): Arbeitssätze je Muskelgruppe im Wochenmittel gegen einen Zielbereich für Radfahrer mit
// Krafttraining, Verhältnisse Drücken/Ziehen und Beinbeuger/Beinstrecker, vernachlässigte Gruppen mit Übungsvorschlägen.
// Reine Funktionen; Trainingsempfehlungen, keine Diagnose.
import { addDays } from "./analysis";
import { EXERCISES, LEG_MUSCLES, MUSCLE_LABEL, muscleVolume, type Muscle, type StrengthSession } from "./strength";

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

/** Zielbereich in Arbeitssätzen pro Woche (Hauptmuskel ganz, Hilfsmuskel halb), für 2 Krafteinheiten neben dem Radtraining. */
export const TARGETS: Partial<Record<Muscle, [number, number]>> = {
  quads: [6, 12], hamstrings: [6, 12], glutes: [6, 12], back: [6, 12], chest: [6, 12],
  shoulders: [4, 10], core: [4, 10], biceps: [2, 8], triceps: [2, 8], calves: [2, 8],
};
const PUSH: Muscle[] = ["chest", "shoulders", "triceps"];
const PULL: Muscle[] = ["back", "biceps"];
/** Untergrenzen der Verhältnisse: Ziehen/Drücken und Beinbeuger/Beinstrecker. */
export const MIN_PULL_PUSH = 0.8;
export const MIN_HAM_QUAD = 0.6;

/** Bis zu zwei Katalogübungen mit dieser Muskelgruppe als Hauptmuskel. */
export function exercisesFor(m: Muscle): string[] {
  return Object.values(EXERCISES).filter((e) => e.primary.includes(m)).slice(0, 2).map((e) => e.name);
}

export function muscleBalance(sessions: readonly StrengthSession[], today: string, weeks: number) {
  const from = addDays(today, -(7 * weeks - 1));
  const inRange = sessions.filter((s) => s.day >= from && s.day <= today);
  const volume = new Map(muscleVolume(inRange.flatMap((s) => s.sets)).map((v) => [v.muscle, v.sets]));
  const perWeek = (m: Muscle) => (volume.get(m) ?? 0) / weeks;

  const muscles = (Object.keys(TARGETS) as Muscle[]).map((m) => {
    const [lo, hi] = TARGETS[m]!;
    const sets = round(perWeek(m))!;
    return {
      muscle: m, label: MUSCLE_LABEL[m], setsPerWeek: sets, target: { lo, hi },
      status: sets === 0 ? ("none" as const) : sets < lo ? ("low" as const) : sets > hi ? ("high" as const) : ("ok" as const),
    };
  });
  const sum = (ms: Muscle[]) => ms.reduce((a, m) => a + perWeek(m), 0);
  const push = sum(PUSH), pull = sum(PULL);
  const ratios = {
    pullPush: push > 0 ? round(pull / push, 2) : null,
    hamQuad: perWeek("quads") > 0 ? round(perWeek("hamstrings") / perWeek("quads"), 2) : null,
  };

  const hints: string[] = [];
  if (!inRange.length) hints.push(`Keine Krafteinheit in den letzten ${weeks} Wochen gespeichert. Zwei kurze Einheiten pro Woche erhalten die Kraft auch in Radphasen.`);
  else {
    const none = muscles.filter((m) => m.status === "none" && m.target.lo >= 4);
    if (none.length)
      hints.push(`Gar nicht trainiert: ${none.map((m) => `${m.label} (z. B. ${exercisesFor(m.muscle).join(" oder ")})`).join(", ")}.`);
    const low = muscles.filter((m) => m.status === "low" && m.target.lo >= 4);
    if (low.length) hints.push(`Unter dem Zielbereich: ${low.map((m) => `${m.label} ${String(m.setsPerWeek).replace(".", ",")} statt ${m.target.lo}–${m.target.hi} Sätze/Woche`).join(", ")}.`);
    if (ratios.pullPush != null && ratios.pullPush < MIN_PULL_PUSH)
      hints.push(`Mehr Ziehen als Drücken einplanen (aktuell ${String(ratios.pullPush).replace(".", ",")} : 1). Rudern und Klimmzüge stärken den Rücken, der auf dem Rad in gebeugter Haltung arbeitet.`);
    if (ratios.hamQuad != null && ratios.hamQuad < MIN_HAM_QUAD)
      hints.push(`Die Oberschenkel-Rückseite kommt zu kurz (${String(ratios.hamQuad).replace(".", ",")} Sätze Beinbeuger je Satz Beinstrecker). Rumänisches Kreuzheben oder Beinbeuger gleichen das aus; Radfahren belastet ohnehin vor allem die Vorderseite.`);
    const high = muscles.filter((m) => m.status === "high" && LEG_MUSCLES.includes(m.muscle));
    if (high.length) hints.push(`Sehr viel Beinvolumen (${high.map((m) => m.label).join(", ")}); neben hartem Radtraining kann das die Erholung bremsen.`);
    if (!hints.length) hints.push("Ausgewogen: alle großen Muskelgruppen liegen im Zielbereich.");
  }

  return {
    today,
    range: { from, to: today, weeks },
    sessions: inRange.length,
    muscles,
    ratios: { ...ratios, minPullPush: MIN_PULL_PUSH, minHamQuad: MIN_HAM_QUAD },
    hints,
    notes: [
      `Arbeitssätze im Wochenmittel der letzten ${weeks} Wochen; Hauptmuskel zählt ganz, Hilfsmuskel halb (wie beim Volumen je Muskelgruppe).`,
      "Zielbereiche für zwei Krafteinheiten pro Woche neben dem Radtraining; wer Muskelaufbau priorisiert, darf darüber liegen. Trainingsempfehlungen, keine Diagnose.",
    ],
  };
}
