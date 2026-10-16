// Tagebuch: täglicher Check-in (Befinden, Energie, Muskelkater, Stress, Motivation, Notiz, Tags)
// und Anstrengung (RPE) je Workout. Fließt in die Tagesempfehlung ein. Trainingsempfehlungen,
// keine medizinische Diagnose; Zusammenhänge zwischen Tags und Erholung sind Beobachtungen, keine Ursachen.
import { addDays, type DayPoint } from "./analysis";
import type { CoachAdvice, Readiness } from "./coach";

/** Skalen 1–5 (1 = schlecht/niedrig, 5 = sehr gut/hoch); Muskelkater und Stress: 1 = keiner, 5 = stark. */
export interface JournalEntry {
  day: string;
  feeling: number | null;
  energy: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
  notes: string | null;
  tags: string[];
  updatedAt?: string;
}

export interface WorkoutRpe {
  source: string;
  sourceId: string;
  day: string;
  /** Anstrengung 1–10 (Borg CR10). */
  rpe: number;
  notes: string | null;
  updatedAt?: string;
}

/** Vorgeschlagene Tags für die schnelle Eingabe; eigene sind erlaubt. */
export const SUGGESTED_TAGS = ["krank", "erkältet", "verletzt", "reise", "alkohol", "spät gegessen", "koffein spät", "stress arbeit", "wenig getrunken", "hitze", "periode", "gut geschlafen"];

const SICK = ["krank", "erkältet", "fieber", "infekt", "sick"];
const INJURED = ["verletzt", "schmerzen", "injury"];

export const normalizeTag = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 30);

// --- D1 ----------------------------------------------------------------------------------------

interface JournalRow {
  day: string;
  feeling: number | null;
  energy: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
  notes: string | null;
  tags: string | null;
  updated_at: string;
}

const toEntry = (r: JournalRow): JournalEntry => ({
  day: r.day, feeling: r.feeling, energy: r.energy, soreness: r.soreness, stress: r.stress, motivation: r.motivation,
  notes: r.notes, tags: r.tags ? (JSON.parse(r.tags) as string[]) : [], updatedAt: r.updated_at,
});

export async function readJournal(db: D1Database, fromDay: string, toDay = "9999-12-31"): Promise<JournalEntry[]> {
  const { results } = await db.prepare("SELECT * FROM journal WHERE day >= ? AND day <= ? ORDER BY day DESC").bind(fromDay, toDay).all<JournalRow>();
  return results.map(toEntry);
}

/** Speichert die übergebenen Felder eines Tages (fehlende bleiben, `null` löscht). */
export async function saveJournal(db: D1Database, e: Partial<JournalEntry> & { day: string }): Promise<JournalEntry> {
  const prev = (await db.prepare("SELECT * FROM journal WHERE day = ?").bind(e.day).first<JournalRow>()) ?? null;
  const old = prev ? toEntry(prev) : { day: e.day, feeling: null, energy: null, soreness: null, stress: null, motivation: null, notes: null, tags: [] };
  const pick = <K extends keyof JournalEntry>(k: K) => (e[k] === undefined ? old[k] : e[k]);
  const tags = e.tags === undefined ? old.tags : [...new Set((e.tags ?? []).map(normalizeTag).filter(Boolean))].slice(0, 15);
  const row = await db
    .prepare(
      `INSERT INTO journal (day, feeling, energy, soreness, stress, motivation, notes, tags, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (day) DO UPDATE SET feeling = excluded.feeling, energy = excluded.energy, soreness = excluded.soreness,
         stress = excluded.stress, motivation = excluded.motivation, notes = excluded.notes, tags = excluded.tags, updated_at = excluded.updated_at
       RETURNING *`,
    )
    .bind(e.day, pick("feeling"), pick("energy"), pick("soreness"), pick("stress"), pick("motivation"), pick("notes"), JSON.stringify(tags))
    .first<JournalRow>();
  return toEntry(row!);
}

export async function deleteJournal(db: D1Database, day: string): Promise<boolean> {
  return (await db.prepare("DELETE FROM journal WHERE day = ? RETURNING day").bind(day).first()) != null;
}

interface RpeRow {
  source: string;
  source_id: string;
  day: string;
  rpe: number;
  notes: string | null;
  updated_at: string;
}

const toRpe = (r: RpeRow): WorkoutRpe => ({ source: r.source, sourceId: r.source_id, day: r.day, rpe: r.rpe, notes: r.notes, updatedAt: r.updated_at });

export async function readRpe(db: D1Database, fromDay: string): Promise<WorkoutRpe[]> {
  const { results } = await db.prepare("SELECT * FROM workout_rpe WHERE day >= ? ORDER BY day DESC").bind(fromDay).all<RpeRow>();
  return results.map(toRpe);
}

/** RPE zu einem gespeicherten Workout; das Workout muss existieren. */
export async function saveRpe(db: D1Database, r: { source: string; sourceId: string; rpe: number | null; notes?: string | null }): Promise<WorkoutRpe | null> {
  const w = await db.prepare("SELECT day FROM workouts WHERE source = ? AND source_id = ?").bind(r.source, r.sourceId).first<{ day: string }>();
  if (!w) throw new Error(`Workout ${r.source}/${r.sourceId} nicht gefunden.`);
  if (r.rpe == null) {
    await db.prepare("DELETE FROM workout_rpe WHERE source = ? AND source_id = ?").bind(r.source, r.sourceId).run();
    return null;
  }
  const row = await db
    .prepare(
      `INSERT INTO workout_rpe (source, source_id, day, rpe, notes, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (source, source_id) DO UPDATE SET rpe = excluded.rpe, notes = excluded.notes, day = excluded.day, updated_at = excluded.updated_at
       RETURNING *`,
    )
    .bind(r.source, r.sourceId, w.day, r.rpe, r.notes ?? null)
    .first<RpeRow>();
  return toRpe(row!);
}

/** Session-RPE nach Foster: Dauer (min) × RPE. Eigene Skala („AU“), nicht mit TSS gleichsetzen. */
export const sessionRpe = (durationMin: number, rpe: number) => Math.round(durationMin * rpe);

// --- Einfluss auf die Tagesempfehlung -------------------------------------------------------

const LEVELS: Readiness[] = ["rest", "easy", "moderate", "hard"];
const HEADLINE: Record<Readiness, string> = {
  rest: "Heute Ruhe oder nur lockere Bewegung",
  easy: "Locker trainieren",
  moderate: "Normales Training",
  hard: "Bereit für eine harte Einheit",
};

/**
 * Passt die Tagesempfehlung an den Check-in an. Das subjektive Gefühl zählt: Krankheitszeichen →
 * Ruhe; starker Muskelkater, hoher Stress oder sehr niedrige Energie → eine Stufe leichter.
 */
export function applyJournal(advice: CoachAdvice, entry: JournalEntry | null | undefined): CoachAdvice {
  if (!entry) return advice;
  const out: CoachAdvice = { ...advice, reasons: [...advice.reasons], warnings: [...advice.warnings] };
  const tags = entry.tags.map(normalizeTag);
  let level = LEVELS.indexOf(advice.readiness);
  let score = advice.score;
  const lower = (by: number, factorText: string, scoreDrop: number) => {
    level = Math.max(0, level - by);
    score -= scoreDrop;
    out.reasons.push({ factor: "journal", effect: "down", text: factorText });
  };

  if (tags.some((t) => SICK.some((s) => t.includes(s)))) {
    level = 0;
    score = Math.min(score, 20);
    out.reasons.push({ factor: "journal", effect: "down", text: "Du hast „krank“ eingetragen." });
    out.warnings.push("Bei Krankheitszeichen nicht trainieren. Bei Fieber oder Beschwerden unterhalb des Halses (Brust, Atmung) ganz pausieren und bei Bedarf ärztlich abklären lassen.");
  } else {
    if (tags.some((t) => INJURED.some((s) => t.includes(s)))) {
      lower(1, "Du hast eine Verletzung oder Schmerzen eingetragen.", 10);
      out.warnings.push("Mit Schmerzen nur schmerzfrei bewegen; anhaltende Schmerzen abklären lassen.");
    }
    if (entry.soreness != null && entry.soreness >= 4) lower(1, `Starker Muskelkater (${entry.soreness}/5).`, 8);
    if (entry.stress != null && entry.stress >= 4) lower(entry.stress >= 5 ? 1 : 0, `Hoher Stress (${entry.stress}/5) – zählt auch als Belastung.`, 5);
    if (entry.energy != null && entry.energy <= 2) lower(1, `Wenig Energie (${entry.energy}/5).`, 8);
    if (entry.feeling != null && entry.feeling <= 1) lower(1, "Du fühlst dich schlecht.", 8);
    if (tags.includes("alkohol")) lower(0, "Alkohol am Vorabend dämpft meist die Erholung.", 3);
    const good = (entry.feeling ?? 0) >= 4 && (entry.energy ?? 0) >= 4 && (entry.soreness ?? 1) <= 2;
    if (good) {
      score += 3;
      out.reasons.push({ factor: "journal", effect: "up", text: "Du fühlst dich gut und energiegeladen." });
    }
  }
  const readiness = LEVELS[Math.min(level, LEVELS.indexOf(advice.readiness))];
  out.score = Math.max(0, Math.min(100, Math.round(score)));
  if (readiness !== advice.readiness) {
    out.readiness = readiness;
    out.headline = HEADLINE[readiness];
    out.suggestion = readiness === "rest" ? "Heute frei oder nur Spaziergang. Erholung geht vor." : readiness === "easy" ? "Locker in Zone 1–2, kurz halten; Kraft heute leicht oder weglassen." : advice.suggestion;
    if (advice.targetLoad) {
      const f = readiness === "rest" ? 0.25 : readiness === "easy" ? 0.6 : 0.85;
      out.targetLoad = { min: Math.round(advice.targetLoad.min * f), max: Math.round(advice.targetLoad.max * f) };
    }
  }
  return out;
}

// --- Beobachtete Zusammenhänge ----------------------------------------------------------------

export interface TagEffect {
  tag: string;
  count: number;
  /** Mittlere Erholung am Folgetag mit und ohne Tag. */
  recoveryWith: number;
  recoveryWithout: number;
  deltaPct: number;
  hrvDeltaPct: number | null;
}

/** Erholung/HRV am Folgetag nach Tagen mit Tag vs. ohne (mindestens 3 Tage mit Tag). Beobachtung, keine Ursache. */
export function tagEffects(entries: JournalEntry[], series: DayPoint[]): TagEffect[] {
  const byDay = new Map(series.map((p) => [p.day, p]));
  const tagged = new Map<string, Set<string>>();
  for (const e of entries) for (const t of e.tags) (tagged.get(t) ?? tagged.set(t, new Set()).get(t)!).add(e.day);
  const journalDays = new Set(entries.map((e) => e.day));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const out: TagEffect[] = [];
  for (const [tag, days] of tagged) {
    const next = (ds: string[], k: "recovery" | "hrv") => ds.map((d) => byDay.get(addDays(d, 1))?.[k]).filter((v): v is number => v != null);
    const withD = [...days];
    const withoutD = [...journalDays].filter((d) => !days.has(d));
    const rw = next(withD, "recovery"), ro = next(withoutD, "recovery");
    if (rw.length < 3 || ro.length < 3) continue;
    const hw = next(withD, "hrv"), ho = next(withoutD, "hrv");
    const a = mean(rw), b = mean(ro);
    out.push({
      tag,
      count: rw.length,
      recoveryWith: Math.round(a),
      recoveryWithout: Math.round(b),
      deltaPct: b ? Math.round(((a - b) / b) * 100) : 0,
      hrvDeltaPct: hw.length >= 3 && ho.length >= 3 && mean(ho) ? Math.round(((mean(hw) - mean(ho)) / mean(ho)) * 100) : null,
    });
  }
  return out.sort((x, y) => Math.abs(y.deltaPct) - Math.abs(x.deltaPct));
}
