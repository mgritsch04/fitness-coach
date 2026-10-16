// Gedächtnis des Coachs in D1: Ziele, Trainingsvorlieben, gespeicherte Wochenpläne, Coach-Notizen.
import { DEFAULT_PREFS, type Goal, type GoalKind, type GoalPriority, type GoalStatus, type TrainingPrefs, type WeekPlan } from "./plan";

interface GoalRow {
  id: number;
  kind: string;
  title: string;
  target_date: string | null;
  metric: string | null;
  target_value: number | null;
  unit: string | null;
  sport: string | null;
  priority: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  kind: r.kind as GoalKind,
  title: r.title,
  targetDate: r.target_date,
  metric: r.metric,
  targetValue: r.target_value,
  unit: r.unit,
  sport: r.sport,
  priority: r.priority as GoalPriority,
  status: r.status as GoalStatus,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function readGoals(db: D1Database, opts: { status?: GoalStatus | "all" } = {}): Promise<Goal[]> {
  const status = opts.status ?? "active";
  const q =
    status === "all"
      ? db.prepare("SELECT * FROM goals ORDER BY status, COALESCE(target_date, '9999'), priority, id")
      : db.prepare("SELECT * FROM goals WHERE status = ? ORDER BY COALESCE(target_date, '9999'), priority, id").bind(status);
  const { results } = await q.all<GoalRow>();
  return results.map(toGoal);
}

export interface GoalInput {
  id?: number;
  kind?: GoalKind;
  title?: string;
  targetDate?: string | null;
  metric?: string | null;
  targetValue?: number | null;
  unit?: string | null;
  sport?: string | null;
  priority?: GoalPriority;
  status?: GoalStatus;
  notes?: string | null;
}

/** Legt ein Ziel an (ohne id) oder ändert die übergebenen Felder (mit id). */
export async function saveGoal(db: D1Database, g: GoalInput): Promise<Goal> {
  if (g.id == null) {
    if (!g.title || !g.kind) throw new Error("Neues Ziel braucht title und kind.");
    const row = await db
      .prepare(
        `INSERT INTO goals (kind, title, target_date, metric, target_value, unit, sport, priority, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      )
      .bind(g.kind, g.title, g.targetDate ?? null, g.metric ?? null, g.targetValue ?? null, g.unit ?? null, g.sport ?? null, g.priority ?? "B", g.status ?? "active", g.notes ?? null)
      .first<GoalRow>();
    return toGoal(row!);
  }
  const cols: Record<keyof Omit<GoalInput, "id">, string> = {
    kind: "kind", title: "title", targetDate: "target_date", metric: "metric", targetValue: "target_value", unit: "unit",
    sport: "sport", priority: "priority", status: "status", notes: "notes",
  };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, col] of Object.entries(cols) as [keyof typeof cols, string][]) {
    if (g[k] === undefined) continue;
    sets.push(`${col} = ?`);
    vals.push(g[k]);
  }
  sets.push("updated_at = datetime('now')");
  const row = await db.prepare(`UPDATE goals SET ${sets.join(", ")} WHERE id = ? RETURNING *`).bind(...vals, g.id).first<GoalRow>();
  if (!row) throw new Error(`Ziel ${g.id} nicht gefunden.`);
  return toGoal(row);
}

export async function deleteGoal(db: D1Database, id: number): Promise<boolean> {
  const row = await db.prepare("DELETE FROM goals WHERE id = ? RETURNING id").bind(id).first();
  return row != null;
}

// --- Trainingsvorlieben (in der Tabelle settings unter einem eigenen Schlüssel) --------------

const PREFS_KEY = "trainingPrefs";

export async function readPrefs(db: D1Database): Promise<TrainingPrefs> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(PREFS_KEY).first<{ value: string }>();
  return { ...DEFAULT_PREFS, ...(row ? (JSON.parse(row.value) as Partial<TrainingPrefs>) : {}) };
}

/** Setzt die übergebenen Felder; `null` setzt ein Feld auf den Standard zurück. */
export async function writePrefs(db: D1Database, patch: Partial<Record<keyof TrainingPrefs, unknown>>): Promise<TrainingPrefs> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(PREFS_KEY).first<{ value: string }>();
  const stored: Record<string, unknown> = row ? JSON.parse(row.value) : {};
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof TrainingPrefs)[]) {
    if (!(k in patch) || patch[k] === undefined) continue;
    if (patch[k] === null) delete stored[k];
    else stored[k] = patch[k];
  }
  await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(PREFS_KEY, JSON.stringify(stored))
    .run();
  return readPrefs(db);
}

// --- Wochenpläne ------------------------------------------------------------------------------

export async function readPlan(db: D1Database, week: string): Promise<(WeekPlan & { savedAt: string }) | null> {
  const row = await db.prepare("SELECT plan, updated_at FROM training_plans WHERE week_start = ?").bind(week).first<{ plan: string; updated_at: string }>();
  return row ? { ...(JSON.parse(row.plan) as WeekPlan), savedAt: row.updated_at } : null;
}

export async function writePlan(db: D1Database, plan: WeekPlan): Promise<void> {
  await db
    .prepare(
      `INSERT INTO training_plans (week_start, source, plan, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT (week_start) DO UPDATE SET source = excluded.source, plan = excluded.plan, updated_at = excluded.updated_at`,
    )
    .bind(plan.weekStart, plan.source, JSON.stringify(plan))
    .run();
}

export async function deletePlan(db: D1Database, week: string): Promise<boolean> {
  return (await db.prepare("DELETE FROM training_plans WHERE week_start = ? RETURNING week_start").bind(week).first()) != null;
}

// --- Coach-Notizen ------------------------------------------------------------------------------

export type NoteKind = "daily" | "weekly_review" | "insight" | "chat";

export interface CoachNote {
  id: number;
  kind: NoteKind;
  day: string;
  title: string | null;
  body: string;
  data: unknown;
  createdAt: string;
}

interface NoteRow {
  id: number;
  kind: string;
  day: string;
  title: string | null;
  body: string;
  data: string | null;
  created_at: string;
}

const toNote = (r: NoteRow): CoachNote => ({
  id: r.id,
  kind: r.kind as NoteKind,
  day: r.day,
  title: r.title,
  body: r.body,
  data: r.data ? JSON.parse(r.data) : null,
  createdAt: r.created_at,
});

/** Tageshinweis und Wochenrückblick gibt es je Tag nur einmal: ein neuer ersetzt den alten. */
export async function saveNote(db: D1Database, n: { kind: NoteKind; day: string; title?: string | null; body: string; data?: unknown }): Promise<CoachNote> {
  const data = n.data === undefined || n.data === null ? null : JSON.stringify(n.data);
  if (n.kind === "daily" || n.kind === "weekly_review") {
    await db.prepare("DELETE FROM coach_notes WHERE kind = ? AND day = ?").bind(n.kind, n.day).run();
  }
  const row = await db
    .prepare("INSERT INTO coach_notes (kind, day, title, body, data) VALUES (?, ?, ?, ?, ?) RETURNING *")
    .bind(n.kind, n.day, n.title ?? null, n.body, data)
    .first<NoteRow>();
  return toNote(row!);
}

export async function readNotes(db: D1Database, opts: { fromDay: string; kind?: NoteKind; limit?: number }): Promise<CoachNote[]> {
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const q = opts.kind
    ? db.prepare("SELECT * FROM coach_notes WHERE day >= ? AND kind = ? ORDER BY day DESC, id DESC LIMIT ?").bind(opts.fromDay, opts.kind, limit)
    : db.prepare("SELECT * FROM coach_notes WHERE day >= ? ORDER BY day DESC, id DESC LIMIT ?").bind(opts.fromDay, limit);
  const { results } = await q.all<NoteRow>();
  return results.map(toNote);
}

export async function deleteNote(db: D1Database, id: number): Promise<boolean> {
  return (await db.prepare("DELETE FROM coach_notes WHERE id = ? RETURNING id").bind(id).first()) != null;
}
