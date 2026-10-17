// Schlafziel für heute Nacht (#205): Grundbedarf aus eigenen Daten (Schlaf vor Tagen mit guter Erholung),
// Zuschläge für die Belastung von heute, die Schlafschuld und eine harte Einheit morgen; Zubettgehzeit aus
// der üblichen Aufwachzeit und der eigenen Schlafeffizienz. Reine Funktion; alles Schätzungen.
import { addDays, type DayPoint } from "./analysis";
import type { PlannedSession } from "./plan";
import { isHard } from "./plan";
import { hhmm } from "./performance";
import type { Night } from "./sleep";

export interface SleepTarget {
  day: string;
  /** Schlafzeit (nicht Zeit im Bett) als Ziel. */
  targetAsleepH: number;
  targetText: string;
  inBedH: number;
  wake: string | null;
  /** Licht aus bis … (null ohne übliche Aufwachzeit). */
  bedtime: string | null;
  base: { hours: number; source: "own" | "setting"; nights: number };
  parts: { label: string; minutes: number }[];
  text: string;
  note: string;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const dur = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
const round5 = (m: number) => Math.round(m / 5) * 5;
/** Fr/Sa-Nacht: Aufwachen am Wochenende. */
const weekendWake = (day: string) => [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());

export interface SleepTargetInput {
  today: string;
  nights: Night[];
  series: DayPoint[];
  sleepNeedH: number;
  /** Einheit morgen aus dem Wochenplan (null = unbekannt oder frei). */
  tomorrow: PlannedSession | null;
}

export function sleepTarget(x: SleepTargetInput): SleepTarget {
  const tomorrow = addDays(x.today, 1);
  const recovery = new Map(x.series.map((p) => [p.day, p.recovery]));
  // Grundbedarf: Median-Schlaf der Nächte, nach denen die Erholung gut war (≥ 67 %), aus den letzten 60 Tagen.
  const good = x.nights.filter((n) => n.day > addDays(x.today, -60) && n.asleepH != null && (recovery.get(n.day) ?? 0) >= 67).map((n) => n.asleepH!);
  const own = good.length >= 10 ? median(good)! : null;
  // Eigener Wert begrenzt auf 7–9,5 h (unter 7 h ist für Sportler selten genug).
  const baseH = own != null ? Math.min(9.5, Math.max(7, own)) : x.sleepNeedH;
  const parts: { label: string; minutes: number }[] = [];
  const todayPt = x.series.find((p) => p.day === x.today);
  const load = todayPt?.load ?? 0, strain = todayPt?.strain ?? 0;
  if (load >= 100 || strain >= 15) parts.push({ label: "harte Belastung heute", minutes: 20 });
  else if (load >= 60 || strain >= 11) parts.push({ label: "Belastung heute", minutes: 10 });
  const last7 = x.series.filter((p) => p.day > addDays(x.today, -7) && p.day <= x.today && p.sleepH != null);
  const debtH = last7.length >= 4 ? last7.reduce((a, p) => a + (baseH - p.sleepH!), 0) : 0;
  // Schuld über mehrere Nächte abbauen: höchstens eine Stunde pro Nacht.
  if (debtH >= 1) parts.push({ label: `Schlafschuld ${debtH.toFixed(1).replace(".", ",")} h abbauen`, minutes: Math.min(60, round5((debtH / 4) * 60)) });
  if (x.tomorrow && (isHard(x.tomorrow.type) || x.tomorrow.type === "long")) parts.push({ label: `morgen ${x.tomorrow.title}`, minutes: 15 });

  const targetMin = round5(baseH * 60 + parts.reduce((a, p) => a + p.minutes, 0));
  // Zeit im Bett: Schlafzeit geteilt durch die eigene Effizienz (Standard 90 %).
  const recent = x.nights.filter((n) => n.day > addDays(x.today, -14));
  const eff = median(recent.flatMap((n) => (n.efficiencyPct != null ? [n.efficiencyPct] : [])));
  const effF = eff != null ? Math.min(0.98, Math.max(0.8, eff / 100)) : 0.9;
  const inBedMin = round5(targetMin / effF);
  // Übliche Aufwachzeit: Wochenende und Wochentage getrennt, wenn genug Nächte da sind.
  const wakes = recent.filter((n) => n.wake != null);
  const same = wakes.filter((n) => weekendWake(n.day) === weekendWake(tomorrow));
  const pool = same.length >= 3 ? same : wakes;
  const wakeMin = pool.length >= 3 ? median(pool.map((n) => toMin(n.wake!))) : null;
  const wake = wakeMin != null ? hhmm(round5(wakeMin)) : null;
  const bedtime = wakeMin != null ? hhmm(round5(wakeMin - inBedMin)) : null;

  const why = parts.length ? ` (Grundbedarf ${dur(round5(baseH * 60))}${parts.map((p) => ` + ${p.minutes} min ${p.label}`).join("")})` : "";
  return {
    day: x.today,
    targetAsleepH: Math.round((targetMin / 60) * 100) / 100,
    targetText: dur(targetMin),
    inBedH: Math.round((inBedMin / 60) * 100) / 100,
    wake,
    bedtime,
    base: { hours: Math.round(baseH * 100) / 100, source: own != null ? "own" : "setting", nights: good.length },
    parts,
    text: `Heute Nacht etwa ${dur(targetMin)} Schlaf${why}.${bedtime ? ` Bei Aufstehen um ${wake} Licht aus bis ${bedtime}.` : ""}`,
    note: own != null
      ? `Grundbedarf aus ${good.length} Nächten vor Tagen mit guter Erholung (mindestens 7 h). Schätzung, kein medizinischer Rat.`
      : `Grundbedarf aus den Einstellungen (${String(x.sleepNeedH).replace(".", ",")} h), noch zu wenige Nächte mit guter Erholung. Schätzung, kein medizinischer Rat.`,
  };
}
