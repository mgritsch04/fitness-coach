// FTP-Test-Assistent (#64): erkennt Ramp- und 20-min-Tests in Sekundenwerten (FIT-Import), rechnet die
// FTP nach dem jeweiligen Protokoll aus, speichert den Verlauf und schlägt in ausgeruhten Phasen einen Test vor.
// Rechnen ohne D1, Lesen/Schreiben in eigenen Funktionen unten. Alle FTP-Werte sind Schätzungen.
import { addDays, daysBetween } from "./analysis";

export type FtpProtocol = "ramp" | "20min";

const round = (v: number, digits = 0) => Number(v.toFixed(digits));

/** Ramp: 75 % der besten 1-min-Leistung. 20-min-Test: 95 % der besten 20 min. */
export const PROTOCOLS: Record<FtpProtocol, { label: string; windowS: number; factor: number }> = {
  ramp: { label: "Ramp-Test", windowS: 60, factor: 0.75 },
  "20min": { label: "20-min-Test", windowS: 1200, factor: 0.95 },
};

/** Beste mittlere Leistung über `windowS` Sekunden und wo sie beginnt (Lücken zählen als 0 W). */
export function bestWindow(power: readonly (number | null)[], windowS: number): { watts: number; startS: number } | null {
  if (power.length < windowS) return null;
  let sum = 0;
  for (let i = 0; i < windowS; i++) sum += power[i] ?? 0;
  let best = sum, start = 0;
  for (let i = windowS; i < power.length; i++) {
    sum += (power[i] ?? 0) - (power[i - windowS] ?? 0);
    if (sum > best) [best, start] = [sum, i - windowS + 1];
  }
  return { watts: best / windowS, startS: start };
}

const avg = (xs: readonly (number | null)[]) => (xs.length ? xs.reduce<number>((a, b) => a + (b ?? 0), 0) / xs.length : 0);

/**
 * Ramp erkannt, wenn die 1-min-Mittel vor dem Spitzenwert mindestens 8 Minuten lang stetig steigen
 * (je Minute mehr als vorher, ein Ausreißer erlaubt) und die Leistung danach einbricht oder die Fahrt endet.
 */
export function detectRamp(power: readonly (number | null)[]) {
  const blocks: number[] = [];
  for (let i = 0; i + 60 <= power.length; i += 60) blocks.push(avg(power.slice(i, i + 60)));
  if (blocks.length < 9) return { ok: false, steps: 0 };
  const peak = blocks.indexOf(Math.max(...blocks));
  let steps = 0, misses = 0;
  for (let i = peak; i > 0; i--) {
    if (blocks[i] > blocks[i - 1] + 3) steps++;
    else if (++misses > 1) break;
  }
  const after = blocks.slice(peak + 1, peak + 3);
  const ends = after.length === 0 || Math.min(...after) < blocks[peak] * 0.6;
  return { ok: steps >= 8 && ends, steps };
}

/** 20-min-Test erkannt, wenn die besten 20 min gleichmäßig (Schwankung unter 15 %) und klar über dem Rest der Fahrt liegen. */
export function detect20(power: readonly (number | null)[]) {
  const b = bestWindow(power, 1200);
  if (!b || b.watts <= 0) return { ok: false, cv: null as number | null };
  const win = power.slice(b.startS, b.startS + 1200).map((x) => x ?? 0);
  const sd = Math.sqrt(win.reduce((a, x) => a + (x - b.watts) ** 2, 0) / win.length);
  const cv = sd / b.watts;
  const rest = [...power.slice(0, b.startS), ...power.slice(b.startS + 1200)].filter((x): x is number => x != null && x > 0);
  const restAvg = rest.length ? rest.reduce((a, x) => a + x, 0) / rest.length : 0;
  return { ok: cv < 0.15 && b.watts >= restAvg * 1.2, cv: round(cv, 3) };
}

export interface FtpTestResult {
  protocol: FtpProtocol | null;
  /** auto = aus der Struktur erkannt, manual = Protokoll vorgegeben. */
  detection: "auto" | "manual" | "none";
  label: string | null;
  basisW: number | null;
  basisStartS: number | null;
  factor: number | null;
  ftpW: number | null;
  message: string;
}

export function analyzeFtpTest(power: readonly (number | null)[] | null, protocol: FtpProtocol | "auto" = "auto"): FtpTestResult {
  const none = (message: string): FtpTestResult => ({ protocol: null, detection: "none", label: null, basisW: null, basisStartS: null, factor: null, ftpW: null, message });
  if (!power || !power.some((x) => x != null && x > 0)) return none("Diese Fahrt hat keine Leistungsdaten (Watt).");
  let p: FtpProtocol | null = protocol === "auto" ? null : protocol;
  if (!p) p = detectRamp(power).ok ? "ramp" : detect20(power).ok ? "20min" : null;
  if (!p) return none("Kein Ramp- oder 20-min-Test erkannt. Falls es ein Test war, das Protokoll angeben.");
  const def = PROTOCOLS[p];
  const b = bestWindow(power, def.windowS);
  if (!b) return none(`Die Fahrt ist kürzer als ${def.windowS / 60} min, ${def.label} nicht auswertbar.`);
  const ftpW = Math.round(b.watts * def.factor);
  return {
    protocol: p,
    detection: protocol === "auto" ? "auto" : "manual",
    label: def.label,
    basisW: Math.round(b.watts),
    basisStartS: b.startS,
    factor: def.factor,
    ftpW,
    message: `${def.label}: ${Math.round(def.factor * 100)} % von ${Math.round(b.watts)} W (${def.windowS === 60 ? "beste Minute" : "beste 20 min"}) = FTP etwa ${ftpW} W (Schätzung).`,
  };
}

/** Vorschlag: ausgeruht (Form/TSB ≥ 0) und letzter Test mindestens 6 Wochen her. */
export function ftpTestSuggestion(tsb: number | null, lastTestDay: string | null, today: string) {
  const since = lastTestDay ? daysBetween(lastTestDay, today) : null;
  const due = since == null || since >= 42;
  const rested = tsb != null && tsb >= 0;
  const suggest = due && rested;
  const reason = !due
    ? `Letzter Test vor ${since} Tagen; ein neuer lohnt sich frühestens nach etwa 6 Wochen (ab ${addDays(lastTestDay!, 42).split("-").reverse().join(".")}).`
    : !rested
      ? "Ein Test ist fällig, aber du bist gerade nicht ausgeruht (Form unter 0). Nach 1–2 lockeren Tagen testen."
      : since == null
        ? "Noch kein FTP-Test gespeichert und du bist ausgeruht: guter Zeitpunkt für einen Test."
        : `Letzter Test vor ${since} Tagen und du bist ausgeruht: guter Zeitpunkt für einen neuen Test.`;
  return {
    suggest,
    reason,
    daysSinceLastTest: since,
    tsb,
    howTo: [
      "Ramp-Test in MyWhoosh: Leistung steigt jede Minute, fahren bis nichts mehr geht. FTP ≈ 75 % der besten Minute.",
      "20-min-Test: gut aufwärmen, dann 20 min so hart wie gleichmäßig möglich. FTP ≈ 95 % der 20 min.",
      "Danach die FIT-Datei hochladen und den Test auswerten lassen.",
    ],
  };
}

// --- D1 ----------------------------------------------------------------------------------------

export interface FtpTestRow {
  day: string;
  source: string;
  source_id: string;
  protocol: FtpProtocol;
  basis_w: number;
  ftp_w: number;
  weight_kg: number | null;
  applied: number;
  created_at: string;
}

export async function readFtpTests(db: D1Database): Promise<FtpTestRow[]> {
  const { results } = await db.prepare("SELECT day, source, source_id, protocol, basis_w, ftp_w, weight_kg, applied, created_at FROM ftp_tests ORDER BY day, created_at").all<FtpTestRow>();
  return results;
}

export async function saveFtpTest(db: D1Database, t: Omit<FtpTestRow, "created_at">) {
  await db
    .prepare(
      `INSERT INTO ftp_tests (day, source, source_id, protocol, basis_w, ftp_w, weight_kg, applied, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (source, source_id) DO UPDATE SET protocol = excluded.protocol, basis_w = excluded.basis_w, ftp_w = excluded.ftp_w,
         weight_kg = excluded.weight_kg, applied = excluded.applied`,
    )
    .bind(t.day, t.source, t.source_id, t.protocol, t.basis_w, t.ftp_w, t.weight_kg, t.applied)
    .run();
}

export async function deleteFtpTest(db: D1Database, source: string, sourceId: string) {
  const found = await db.prepare("SELECT 1 FROM ftp_tests WHERE source = ? AND source_id = ?").bind(source, sourceId).first();
  if (!found) return false;
  await db.prepare("DELETE FROM ftp_tests WHERE source = ? AND source_id = ?").bind(source, sourceId).run();
  return true;
}

/** Verlauf mit W/kg und Veränderung zum vorigen Test. */
export function ftpHistory(rows: readonly FtpTestRow[]) {
  return rows.map((r, i) => ({
    day: r.day,
    source: r.source,
    sourceId: r.source_id,
    protocol: r.protocol,
    label: PROTOCOLS[r.protocol]?.label ?? r.protocol,
    basisW: r.basis_w,
    ftpW: r.ftp_w,
    weightKg: r.weight_kg,
    wattsPerKg: r.weight_kg ? round(r.ftp_w / r.weight_kg, 2) : null,
    changeW: i > 0 ? r.ftp_w - rows[i - 1].ftp_w : null,
    applied: !!r.applied,
  }));
}
