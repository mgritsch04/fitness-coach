// Wahoo-Webhook „workout_summary“: kommt, wenn ein Workout fertig ist oder sich ändert.
// Wahoo prüft keine Signatur, sondern schickt den Webhook-Token der App im Body mit.
import type { WahooWorkoutRaw } from "./map";

export interface WahooWebhookPayload {
  event_type?: string;
  webhook_token?: string;
  user?: { id?: number | string };
  workout_summary?: (NonNullable<WahooWorkoutRaw["workout_summary"]> & { workout?: Omit<WahooWorkoutRaw, "workout_summary"> | null }) | null;
  workout?: Omit<WahooWorkoutRaw, "workout_summary"> | null;
}

/** Vergleich in konstanter Zeit, damit die Antwortzeit nichts über den Token verrät. */
export function tokensMatch(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

/** Workout samt Zusammenfassung aus der Meldung, oder null, wenn sie keins enthält. */
export function workoutFromWebhook(p: WahooWebhookPayload): WahooWorkoutRaw | null {
  // Laut Doku liegen Workout und Zusammenfassung nebeneinander; manche Beispiele schachteln das Workout.
  const workout = p.workout ?? p.workout_summary?.workout;
  if (p.event_type !== "workout_summary" || !workout?.id || !workout.starts) return null;
  return { ...workout, workout_summary: p.workout_summary ?? null };
}
