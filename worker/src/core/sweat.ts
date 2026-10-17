// Schweißrate (#282): (Gewicht vorher − nachher + getrunken) / Stunden. Auf der Rolle fehlt der Fahrtwind,
// daher getrennt nach indoor/outdoor. Trinkempfehlung etwa 75 % des Verlusts (nicht alles ersetzen,
// aber unter ~2 % Gewichtsverlust bleiben). Schätzung, keine medizinische Beratung.
import { addDays } from "./analysis";
import type { Fueling } from "./fueling";

export interface SweatInput { day: string; durationMin: number; weightBeforeKg: number; weightAfterKg: number; drankL: number; indoor: boolean; note?: string | null }
export interface SweatTest extends SweatInput { id: number; rateLph: number; lossPct: number }

export interface SweatGroup { tests: number; rateLph: number; drinkLph: number; lastDay: string }
export interface SweatSummary {
  indoor: SweatGroup | null;
  outdoor: SweatGroup | null;
  tests: SweatTest[];
  text: string;
  note: string;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Prüft eine Messung; liefert Rate und Gewichtsverlust oder einen Fehlertext. */
export function sweatRate(m: SweatInput): { rateLph: number; lossPct: number } | { error: string } {
  if (m.durationMin < 30) return { error: "Für eine brauchbare Messung mindestens 30 min fahren." };
  const lossKg = m.weightBeforeKg - m.weightAfterKg + m.drankL;
  const lossPct = r1(((m.weightBeforeKg - m.weightAfterKg) / m.weightBeforeKg) * 100);
  if (Math.abs(m.weightBeforeKg - m.weightAfterKg) > m.weightBeforeKg * 0.06) return { error: "Mehr als 6 % Gewichtsunterschied – bitte die Werte prüfen." };
  const rate = r2(lossKg / (m.durationMin / 60));
  if (rate < 0.1 || rate > 3.5) return { error: `Ergibt ${rate.toLocaleString("de-DE")} l/h – unplausibel, bitte die Werte prüfen (gleiche Waage, ohne Kleidung, nach dem Abtrocknen).` };
  return { rateLph: rate, lossPct };
}

/** Trinkempfehlung je Stunde: ~75 % der Rate, auf 0,1 l gerundet, zwischen 0,4 und 1,5 l. */
export const drinkFor = (rateLph: number) => r1(Math.min(1.5, Math.max(0.4, rateLph * 0.75)));

export function sweatSummary(tests: SweatTest[], today: string): SweatSummary {
  // Die letzten 10 Messungen der letzten 12 Monate je Gruppe; Sommer und Winter unterscheiden sich, daher nicht ewig mitteln.
  const recent = tests.filter((t) => t.day >= addDays(today, -365)).sort((a, b) => b.day.localeCompare(a.day));
  const group = (indoor: boolean): SweatGroup | null => {
    const g = recent.filter((t) => t.indoor === indoor).slice(0, 10);
    if (!g.length) return null;
    const rate = r2(g.reduce((s, t) => s + t.rateLph, 0) / g.length);
    return { tests: g.length, rateLph: rate, drinkLph: drinkFor(rate), lastDay: g[0].day };
  };
  const indoor = group(true), outdoor = group(false);
  const de = (v: number) => v.toLocaleString("de-DE");
  const part = (label: string, g: SweatGroup | null) => (g ? `${label} ${de(g.rateLph)} l/h Schweiß, etwa ${de(g.drinkLph)} l pro Stunde trinken (${g.tests} ${g.tests === 1 ? "Messung" : "Messungen"})` : null);
  const parts = [part("Rolle:", indoor), part("Draußen:", outdoor)].filter(Boolean);
  return {
    indoor, outdoor, tests: recent.slice(0, 20),
    text: parts.length ? `${parts.join(". ")}.` : "Noch keine Schweißraten-Messung. Vor und nach einer Fahrt von mindestens 45 min wiegen und die getrunkene Menge notieren.",
    note: "Ohne Kleidung wiegen, nach dem Abtrocknen, vor dem Essen. Toilettengang zwischendurch verfälscht. Empfehlung ≈ 75 % des Verlusts. Schätzung, keine medizinische Beratung.",
  };
}

/** Ersetzt die Trink-Faustregel einer Radeinheit durch die persönliche Menge (Rolle bevorzugt, da G meist indoor fährt). */
export function personalizeFueling(f: Fueling, s: SweatSummary | null, indoor = true): Fueling {
  const g = (indoor ? s?.indoor ?? s?.outdoor : s?.outdoor ?? s?.indoor) ?? null;
  if (!g || !f.during || f.during === "Wasser reicht.") return f;
  const de = (v: number) => v.toLocaleString("de-DE");
  const during = f.during.replace(/[0-9,–]+ l pro Stunde trinken(, auf der Rolle eher [0-9,–]+ l)?/, `etwa ${de(g.drinkLph)} l pro Stunde trinken (deine Schweißrate ${de(g.rateLph)} l/h)`);
  const short = f.short.replace(/[0-9,–]+ l\/h$/, `${de(g.drinkLph)} l/h`);
  return { ...f, during, short };
}

interface Row { id: number; day: string; duration_min: number; weight_before_kg: number; weight_after_kg: number; drank_l: number; indoor: number; note: string | null }

const toTest = (r: Row): SweatTest => {
  const m: SweatInput = { day: r.day, durationMin: r.duration_min, weightBeforeKg: r.weight_before_kg, weightAfterKg: r.weight_after_kg, drankL: r.drank_l, indoor: !!r.indoor, note: r.note };
  const v = sweatRate(m);
  return { id: r.id, ...m, rateLph: "rateLph" in v ? v.rateLph : 0, lossPct: "lossPct" in v ? v.lossPct : 0 };
};

export async function readSweatTests(db: D1Database): Promise<SweatTest[]> {
  const { results } = await db.prepare("SELECT * FROM sweat_tests ORDER BY day DESC, id DESC LIMIT 50").all<Row>();
  return (results ?? []).map(toTest).filter((t) => t.rateLph > 0);
}

export async function saveSweatTest(db: D1Database, m: SweatInput): Promise<SweatTest> {
  const r = await db
    .prepare("INSERT INTO sweat_tests (day, duration_min, weight_before_kg, weight_after_kg, drank_l, indoor, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now')) RETURNING *")
    .bind(m.day, Math.round(m.durationMin), m.weightBeforeKg, m.weightAfterKg, m.drankL, m.indoor ? 1 : 0, m.note ?? null)
    .first<Row>();
  return toTest(r!);
}

export async function deleteSweatTest(db: D1Database, id: number): Promise<boolean> {
  return Boolean(await db.prepare("DELETE FROM sweat_tests WHERE id = ? RETURNING id").bind(id).first());
}
