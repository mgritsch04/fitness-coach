// Rückmeldung zur Tagesempfehlung (#216): Nach der Einheit „passt / war zu hart / war zu leicht“. Aus den
// letzten 30 Tagen ein begrenzter Korrekturfaktor: Häufen sich „zu hart“, wird die Empfehlung vorsichtiger
// (Punktzahl runter, höchstens eine Stufe). „Zu leicht“ hebt nur wenig und nie bei Warnzeichen oder Ruhetag.
import { addDays } from "./analysis";
import type { CoachAdvice, Readiness } from "./coach";

export type FeedbackVerdict = "ok" | "too_hard" | "too_easy";

export interface FeedbackEntry {
  day: string;
  verdict: FeedbackVerdict;
  readiness: Readiness | null;
  note: string | null;
}

export interface FeedbackAdjust {
  count: number;
  ok: number;
  tooHard: number;
  tooEasy: number;
  /** −1 (alles zu hart) … +1 (alles zu leicht); 0 bei zu wenig Rückmeldungen. */
  factor: number;
  /** Korrektur der Bereitschafts-Punktzahl (−10 … +5). */
  scoreDelta: number;
  today: FeedbackVerdict | null;
  text: string;
}

const MIN_ENTRIES = 4;
const LEVELS: Readiness[] = ["rest", "easy", "moderate", "hard"];
const levelFor = (score: number): Readiness => (score < 35 ? "rest" : score < 55 ? "easy" : score < 75 ? "moderate" : "hard");
const HEADLINE: Record<Readiness, string> = { rest: "Heute Ruhe oder nur lockere Bewegung", easy: "Locker trainieren", moderate: "Normales Training", hard: "Bereit für eine harte Einheit" };

export function feedbackAdjust(entries: FeedbackEntry[], today: string): FeedbackAdjust {
  const from = addDays(today, -30);
  // Nur Rückmeldungen vor heute zählen für die Korrektur (heute ist die Einheit evtl. noch nicht gelaufen).
  const recent = entries.filter((e) => e.day >= from && e.day < today);
  const n = recent.length;
  const tooHard = recent.filter((e) => e.verdict === "too_hard").length;
  const tooEasy = recent.filter((e) => e.verdict === "too_easy").length;
  const ok = n - tooHard - tooEasy;
  const todayV = entries.find((e) => e.day === today)?.verdict ?? null;
  if (n < MIN_ENTRIES)
    return { count: n, ok, tooHard, tooEasy, factor: 0, scoreDelta: 0, today: todayV,
      text: `${n} von mindestens ${MIN_ENTRIES} Rückmeldungen in 30 Tagen: noch keine Anpassung.` };
  const factor = Math.round(((tooEasy - tooHard) / n) * 100) / 100;
  // Erst ab einem deutlichen Überhang anpassen; begrenzt, „zu hart“ wirkt stärker als „zu leicht“.
  const scoreDelta = Math.abs(factor) < 0.25 ? 0 : factor < 0 ? Math.max(-10, Math.round(factor * 15)) : Math.min(5, Math.round(factor * 8));
  const text = scoreDelta < 0
    ? `${tooHard} von ${n} Einheiten waren dir zuletzt zu hart: Empfehlung etwas vorsichtiger (${scoreDelta} Punkte).`
    : scoreDelta > 0
      ? `${tooEasy} von ${n} Einheiten waren dir zuletzt zu leicht: Empfehlung etwas mutiger (+${scoreDelta} Punkte).`
      : `Rückmeldungen passen meist (${ok} von ${n} „passt“): keine Anpassung.`;
  return { count: n, ok, tooHard, tooEasy, factor, scoreDelta, today: todayV, text };
}

/** Korrektur anwenden: höchstens eine Stufe; nach oben nie bei Warnungen oder Ruhetag. */
export function applyFeedback(advice: CoachAdvice, adj: FeedbackAdjust | null): CoachAdvice {
  if (!adj || adj.scoreDelta === 0) return advice;
  if (adj.scoreDelta > 0 && (advice.readiness === "rest" || advice.warnings.length)) return advice;
  const score = Math.max(0, Math.min(100, advice.score + adj.scoreDelta));
  const from = LEVELS.indexOf(advice.readiness);
  const want = LEVELS.indexOf(levelFor(score));
  const to = Math.max(from - 1, Math.min(from + 1, want));
  const readiness = adj.scoreDelta < 0 ? LEVELS[Math.min(from, to)] : LEVELS[Math.max(from, to)];
  const out: CoachAdvice = { ...advice, score, reasons: [...advice.reasons, { factor: "feedback", effect: adj.scoreDelta < 0 ? "down" : "up", text: adj.text }] };
  if (readiness !== advice.readiness) {
    out.readiness = readiness;
    out.headline = HEADLINE[readiness];
    if (advice.targetLoad) {
      const f = adj.scoreDelta < 0 ? 0.8 : 1.1;
      out.targetLoad = { min: Math.round(advice.targetLoad.min * f), max: Math.round(advice.targetLoad.max * f) };
    }
  }
  return out;
}

// --- D1 ----------------------------------------------------------------------------------------

export async function readFeedback(db: D1Database, fromDay: string): Promise<FeedbackEntry[]> {
  const r = await db.prepare("SELECT day, verdict, readiness, note FROM recommendation_feedback WHERE day >= ? ORDER BY day").bind(fromDay).all<FeedbackEntry>();
  return r.results ?? [];
}

export async function saveFeedback(db: D1Database, e: FeedbackEntry): Promise<void> {
  await db
    .prepare("INSERT INTO recommendation_feedback (day, verdict, readiness, note, updated_at) VALUES (?, ?, ?, ?, datetime('now')) ON CONFLICT (day) DO UPDATE SET verdict = excluded.verdict, readiness = excluded.readiness, note = excluded.note, updated_at = excluded.updated_at")
    .bind(e.day, e.verdict, e.readiness, e.note)
    .run();
}
