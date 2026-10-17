// 4-Wochen-Blockplanung (#206): 3 Aufbauwochen mit steigender Ziel-Belastung (CTL-Rampe) und 1 Entlastungswoche.
// Passt sich an die Ist-Werte an: zu wenig geschafft → Ziel halten statt steigern; Warnzeichen → Entlastung
// vorziehen. Der Wochenplan liest das Wochenziel. Belastungen im TSS-Maßstab sind Schätzungen.
import { addDays, weekStart, type WeekSummary } from "./analysis";

export interface BlockWeek {
  week: string;
  index: number;
  /** Ziel-Belastung der Woche (TSS-Maßstab, Schätzung). */
  targetLoad: number;
  deload: boolean;
  focus: string;
}

export interface TrainingBlock {
  startWeek: string;
  /** Fitness (CTL) zu Blockbeginn. */
  ctlStart: number;
  /** Steigerung je Aufbauwoche, z. B. 0.05 = +5 %. */
  rampPct: number;
  weeks: BlockWeek[];
  source: "rule" | "saved";
}

export interface BlockWeekStatus extends BlockWeek {
  actualLoad: number | null;
  /** Ist/Soll in Prozent (nur vergangene und laufende Wochen). */
  compliancePct: number | null;
  status: "done" | "short" | "current" | "upcoming";
  /** Was die Anpassung an dieser Woche geändert hat. */
  adjusted: string | null;
}

export interface BlockView {
  block: TrainingBlock;
  weeks: BlockWeekStatus[];
  current: BlockWeekStatus | null;
  text: string;
  note: string;
}

const NOTE = "Block nach Faustregeln (3:1-Rhythmus, +5 % je Aufbauwoche, Entlastung ~60 %). Belastungen sind Schätzungen.";
const FOCUS = ["Grundlage + Kraft aufbauen", "Aufbau: Schwelle, Kraft halten", "Aufbau: höchste Woche", "Entlastung: locker, Kraft leicht"];

export function buildBlock(startWeek: string, ctl: number, rampPct = 0.05): TrainingBlock {
  const ws = weekStart(startWeek);
  const base = Math.max(ctl, 15) * 7;
  const weeks: BlockWeek[] = [0, 1, 2, 3].map((i) => ({
    week: addDays(ws, 7 * i),
    index: i,
    targetLoad: Math.round(i < 3 ? base * (1 + rampPct * (i + 1)) : base * 0.6),
    deload: i === 3,
    focus: FOCUS[i],
  }));
  return { startWeek: ws, ctlStart: Math.round(ctl * 10) / 10, rampPct, weeks, source: "rule" };
}

/**
 * Soll/Ist je Woche und Anpassung: Erreicht eine abgeschlossene Aufbauwoche unter 70 % des Ziels, wird die
 * nächste nicht gesteigert (gleiches Ziel). Bei Warnzeichen wird die laufende bzw. nächste Woche zur Entlastung,
 * danach endet der Block.
 */
export function blockView(block: TrainingBlock, weeks: WeekSummary[], today: string, warn: string | null): BlockView {
  const cur = weekStart(today);
  const load = new Map(weeks.map((w) => [w.week, w.load]));
  const out: BlockWeekStatus[] = [];
  let ended = false;
  for (const w of block.weeks) {
    if (ended) break;
    const s: BlockWeekStatus = { ...w, actualLoad: null, compliancePct: null, status: w.week < cur ? "done" : w.week === cur ? "current" : "upcoming", adjusted: null };
    const prev = out.at(-1);
    if (prev && !s.deload && !prev.deload && prev.status !== "current" && prev.status !== "upcoming" && prev.compliancePct != null && prev.compliancePct < 70) {
      s.targetLoad = prev.targetLoad;
      s.adjusted = `Ziel gehalten: Vorwoche nur ${prev.compliancePct} % geschafft.`;
    }
    // Warnzeichen: Entlastung vorziehen (laufende Woche ab der zweiten Blockwoche, sonst die nächste).
    if (warn && !s.deload && s.status !== "done" && (s.status === "upcoming" || w.index >= 1)) {
      s.deload = true;
      s.targetLoad = Math.round(Math.max(block.ctlStart, 15) * 7 * 0.6);
      s.focus = FOCUS[3];
      s.adjusted = `Entlastung vorgezogen: ${warn}`;
      warn = null;
      ended = true;
    }
    if (s.status !== "upcoming") {
      s.actualLoad = Math.round(load.get(w.week) ?? 0);
      s.compliancePct = s.targetLoad > 0 ? Math.round((s.actualLoad / s.targetLoad) * 100) : null;
      if (s.status === "done" && s.compliancePct != null && s.compliancePct < 70) s.status = "short";
    }
    out.push(s);
  }
  const current = out.find((w) => w.status === "current") ?? null;
  const last = out.at(-1)!;
  let text: string;
  if (cur > last.week) text = "Der Block ist abgeschlossen. Ein neuer Block startet mit der aktuellen Fitness.";
  else if (!current) text = `Block startet in der Woche ab ${block.startWeek}.`;
  else {
    const early = out.find((w) => w.status === "upcoming" && w.adjusted?.startsWith("Entlastung"));
    text = `Woche ${current.index + 1} von ${out.length}: ${current.focus}, Ziel etwa ${current.targetLoad} Belastungspunkte${current.actualLoad != null ? ` (bisher ${current.actualLoad})` : ""}.${current.adjusted ? ` ${current.adjusted}` : ""}${early ? " Nächste Woche Entlastung (vorgezogen wegen Warnzeichen), danach neuer Block." : ""}`;
  }
  return { block, weeks: out, current, text, note: NOTE };
}

// --- D1 ----------------------------------------------------------------------------------------

export async function readBlock(db: D1Database, today: string): Promise<TrainingBlock | null> {
  // Jüngster Block, der höchstens 3 Wochen vor dieser Woche begonnen hat (also noch läuft).
  const from = addDays(weekStart(today), -21);
  const row = await db.prepare("SELECT block FROM training_blocks WHERE start_week >= ? AND start_week <= ? ORDER BY start_week DESC LIMIT 1").bind(from, weekStart(today)).first<{ block: string }>();
  return row ? { ...(JSON.parse(row.block) as TrainingBlock), source: "saved" } : null;
}

export async function saveBlock(db: D1Database, b: TrainingBlock): Promise<void> {
  await db
    .prepare("INSERT INTO training_blocks (start_week, block, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT (start_week) DO UPDATE SET block = excluded.block, updated_at = excluded.updated_at")
    .bind(b.startWeek, JSON.stringify({ ...b, source: "saved" }))
    .run();
}

export async function deleteBlock(db: D1Database, startWeek: string): Promise<boolean> {
  return (await db.prepare("DELETE FROM training_blocks WHERE start_week = ? RETURNING start_week").bind(weekStart(startWeek)).first()) != null;
}
