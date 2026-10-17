// eFTP-Verlauf (#200): laufende FTP-Schätzung aus normalen Fahrten, Woche für Woche aus der Leistungskurve der
// jeweils letzten 42 Tage. Critical Power (3–20 min) wenn das Modell passt, sonst 95 % der besten 20 min, sonst
// 90 % der besten 10 min. Vergleich mit der eingestellten FTP und Testvorschlag bei Abweichung. Reine Funktionen.
import { addDays, weekStart } from "./analysis";
import { criticalPower } from "./endurance";
import { powerCurve, type PowerBestRow } from "./performance";

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

/** Fenster der Leistungskurve je Wochenpunkt. */
export const WINDOW_DAYS = 42;
/** Ab dieser Abweichung von der eingestellten FTP (zwei Wochen in Folge) wird ein Test vorgeschlagen. */
export const TEST_DEVIATION = 0.05;
/** Bestwerte, die älter sind, gelten als veraltet. */
export const STALE_DAYS = 28;

export type EftpMethod = "cp" | "20min" | "10min";

/** Schätzung aus einer Leistungskurve; Spanne aus allen verfügbaren Ansätzen. */
export function eftpFromRows(rows: readonly PowerBestRow[], fromDay: string, toDay: string) {
  const curve = powerCurve(rows.filter((r) => r.day <= toDay), fromDay);
  const at = (d: number) => curve.find((c) => c.durationS === d);
  const cp = criticalPower(curve);
  const c20 = at(1200), c10 = at(600), c60 = at(3600);
  const cands: { method: EftpMethod | "60min"; watts: number; day: string }[] = [];
  if (cp && cp.confidence !== "low") cands.push({ method: "cp", watts: cp.cpW, day: cp.points.reduce((a, p) => (p.day > a ? p.day : a), "") });
  if (c20) cands.push({ method: "20min", watts: c20.watts * 0.95, day: c20.day });
  if (c60) cands.push({ method: "60min", watts: c60.watts, day: c60.day });
  if (c10) cands.push({ method: "10min", watts: c10.watts * 0.9, day: c10.day });
  const main = (["cp", "20min", "10min"] as const).map((m) => cands.find((c) => c.method === m)).find(Boolean);
  if (!main) return null;
  // 60 min ist eine Untergrenze der FTP: liegt sie höher, gilt sie.
  const floor = cands.find((c) => c.method === "60min");
  const pick = floor && floor.watts > main.watts ? { ...floor, method: main.method } : main;
  const ws = cands.map((c) => c.watts);
  return {
    eftpW: Math.round(pick.watts),
    low: Math.round(Math.min(...ws)),
    high: Math.round(Math.max(...ws)),
    method: pick.method as EftpMethod,
    basisDay: pick.day,
    cpConfidence: cp?.confidence ?? null,
  };
}

export interface EftpInput {
  rows: readonly PowerBestRow[];
  /** Eingestellte FTP (nur vom Nutzer gesetzt, nicht geschätzt). */
  ftpW: number | null;
  tests: readonly { day: string; ftpW: number }[];
  weightKg: number | null;
}

export function eftpTrend(x: EftpInput, today: string, weeks: number) {
  const thisWeek = weekStart(today);
  const points = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i));
    const end = i === weeks - 1 ? today : addDays(start, 6);
    const est = eftpFromRows(x.rows, addDays(end, -(WINDOW_DAYS - 1)), end);
    const test = [...x.tests].reverse().find((t) => t.day >= start && t.day <= end);
    return { week: start, day: end, ...(est ?? { eftpW: null, low: null, high: null, method: null, basisDay: null, cpConfidence: null }), testW: test?.ftpW ?? null };
  });
  const range = { from: points[0].week, to: today, weeks };
  const valid = points.filter((p) => p.eftpW != null);
  const notes = [
    `Je Woche aus den Bestwerten der ${WINDOW_DAYS} Tage davor: Critical Power (3–20 min), sonst 95 % der besten 20 min, sonst 90 % der besten 10 min; die beste 60-min-Leistung gilt als Untergrenze.`,
    "Schätzung: Nur echte harte Anstrengungen ergeben eine gute eFTP. Ein FTP-Test bleibt genauer.",
  ];
  if (!valid.length)
    return { today, range, available: false as const, reason: "Noch keine Fahrten mit Leistungsmesser. Lade eine FIT-Datei hoch (MyWhoosh) oder verbinde Wahoo.", points, notes };

  const cur = points.at(-1)!;
  const current = cur.eftpW != null
    ? { eftpW: cur.eftpW, low: cur.low!, high: cur.high!, method: cur.method!, basisDay: cur.basisDay!, wattsPerKg: x.weightKg ? round(cur.eftpW / x.weightKg, 2) : null,
        stale: cur.basisDay! < addDays(today, -STALE_DAYS) }
    : null;
  const ago = points.at(-7);
  const change = current && ago?.eftpW != null ? { weeks: 6, w: current.eftpW - ago.eftpW, pct: round(((current.eftpW - ago.eftpW) / ago.eftpW) * 100, 1)! } : null;
  const direction = change ? (change.pct >= 2 ? "up" : change.pct <= -2 ? "down" : "flat") : null;
  const dev = (p: (typeof points)[number]) => (p.eftpW != null && x.ftpW ? p.eftpW / x.ftpW - 1 : null);
  const d1 = dev(cur), d2 = dev(points.at(-2) ?? cur);
  const deviationPct = d1 == null ? null : round(d1 * 100, 1);
  const suggestTest = d1 != null && d2 != null && Math.abs(d1) >= TEST_DEVIATION && Math.abs(d2) >= TEST_DEVIATION && Math.sign(d1) === Math.sign(d2) && !current?.stale;

  const hints: string[] = [];
  if (!current) hints.push(`In den letzten ${WINDOW_DAYS} Tagen keine Fahrt mit Leistung; die letzte Schätzung ist älter.`);
  else {
    const m = { cp: "aus deinem Critical-Power-Modell", "20min": "aus 95 % deiner besten 20 min", "10min": "grob aus deinen besten 10 min" }[current.method];
    hints.push(`Geschätzte FTP aktuell etwa ${current.eftpW} W (${current.low}–${current.high} W), ${m}.` + (current.stale ? " Der Bestwert ist älter als 4 Wochen, die Schätzung hinkt also vermutlich hinterher." : ""));
    if (change && direction !== "flat")
      hints.push(`In den letzten 6 Wochen ${direction === "up" ? "gestiegen" : "gefallen"}: ${change.w > 0 ? "+" : "−"}${Math.abs(change.w)} W (${change.pct > 0 ? "+" : "−"}${String(Math.abs(change.pct)).replace(".", ",")} %).`);
    if (suggestTest)
      hints.push(d1! > 0
        ? `Seit zwei Wochen liegt die Schätzung ${Math.round(d1! * 100)} % über deiner eingestellten FTP (${x.ftpW} W). Ein FTP-Test lohnt sich, damit Zonen und Workouts wieder passen.`
        : `Seit zwei Wochen liegt die Schätzung ${Math.round(-d1! * 100)} % unter deiner eingestellten FTP (${x.ftpW} W). Wenn du dich nicht voll ausbelastet hast, ist das normal; sonst einen FTP-Test einplanen.`);
    else if (!x.ftpW) hints.push("Keine FTP eingestellt. Übernimm die Schätzung in den Einstellungen oder mach einen FTP-Test.");
  }

  return {
    today, range, available: true as const,
    ftpW: x.ftpW,
    current,
    change,
    direction,
    deviationPct,
    suggestTest,
    points,
    hints,
    notes,
  };
}
