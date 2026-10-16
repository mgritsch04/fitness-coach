// Schlaf-Detail (#20): Nächte mit Phasen und Uhrzeiten, Regelmäßigkeit, Schlafschuld-Verlauf,
// Wochenend-Verschiebung und empfohlene Schlafenszeit. Reine Funktionen ohne D1; Schätzungen.
import { addDays, type SleepRow } from "./analysis";
import { hhmm, localMinutes } from "./performance";

const round = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: number[]) => {
  const m = mean(xs);
  if (m == null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const nums = (xs: (number | null | undefined)[]) => xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
const h = (s: number | null | undefined) => (s == null ? null : round(s / 3600, 2));
/** Uhrzeit ab 12:00 gezählt, damit Zeiten um Mitternacht nah beieinander liegen (23:30 → 690, 00:30 → 750). */
const fromNoon = (m: number) => (m + 720) % 1440;

export interface Night {
  /** Tag des Aufwachens. */
  day: string;
  bedtime: string | null;
  wake: string | null;
  inBedH: number | null;
  asleepH: number | null;
  awakeH: number | null;
  lightH: number | null;
  deepH: number | null;
  remH: number | null;
  /** Anteile an der Schlafzeit in Prozent. */
  deepPct: number | null;
  remPct: number | null;
  efficiencyPct: number | null;
  performancePct: number | null;
  consistencyPct: number | null;
  respiratoryRate: number | null;
  napH: number;
  /** Schlafschuld der letzten 7 Nächte bis einschließlich dieser (Stunden, negativ = Überschuss). */
  debt7dH: number | null;
}

export interface SleepReport {
  nights: Night[];
  summary: {
    nights: number;
    avgAsleepH: number | null;
    avgInBedH: number | null;
    avgDeepPct: number | null;
    avgRemPct: number | null;
    avgEfficiencyPct: number | null;
    /** Anteil der Nächte, in denen der Schlafbedarf erreicht wurde. */
    needMetPct: number | null;
    avgBedtime: string | null;
    avgWake: string | null;
    bedtimeSdMin: number | null;
    wakeSdMin: number | null;
    /** Verschiebung der Schlafmitte Wochenende (Fr/Sa-Nacht) gegen Wochentage in Minuten („sozialer Jetlag“). */
    weekendShiftMin: number | null;
    debt7dH: number | null;
    /** Vorschlag: so spät ins Bett, um bei der üblichen Aufwachzeit den Schlafbedarf zu erreichen (Schätzung). */
    suggestedBedtime: string | null;
  };
  sleepNeedH: number;
  tips: string[];
}

/** Hauptschlaf (längster, kein Nickerchen) und Nickerchen-Summe je Aufwachtag. */
function byDay(sleeps: readonly SleepRow[]) {
  const map = new Map<string, { main: SleepRow; napS: number }>();
  for (const s of sleeps) {
    if (s.is_nap) continue;
    const e = map.get(s.day);
    if (!e) map.set(s.day, { main: s, napS: 0 });
    else if ((s.asleep_s ?? 0) > (e.main.asleep_s ?? 0)) e.main = s;
  }
  for (const s of sleeps) {
    const e = map.get(s.day);
    if (s.is_nap && e) e.napS += s.asleep_s ?? 0;
  }
  return map;
}

export function sleepReport(sleeps: readonly SleepRow[], timeZone: string, fromDay: string, today: string, sleepNeedH: number): SleepReport {
  const map = byDay(sleeps);
  const nights: Night[] = [];
  const bedMin: number[] = [], wakeMin: number[] = [];
  const mid: { weekend: boolean; m: number }[] = [];
  for (let day = fromDay; day <= today; day = addDays(day, 1)) {
    const e = map.get(day);
    if (!e) continue;
    const s = e.main;
    const b = localMinutes(s.start_time, timeZone), w = localMinutes(s.end_time, timeZone);
    if (b != null) bedMin.push(fromNoon(b));
    if (w != null) wakeMin.push(w);
    if (b != null && w != null) {
      // Schlafmitte ab 12:00 gezählt; Fr- und Sa-Nacht (Aufwachen Sa/So) gelten als Wochenende.
      const bn = fromNoon(b), wn = fromNoon(w) < bn ? fromNoon(w) + 1440 : fromNoon(w);
      const dow = new Date(day + "T00:00:00Z").getUTCDay();
      mid.push({ weekend: dow === 6 || dow === 0, m: (bn + wn) / 2 });
    }
    const last7 = nums(Array.from({ length: 7 }, (_, i) => map.get(addDays(day, -i))?.main.asleep_s).map((x) => (x == null ? null : x / 3600)));
    const asleep = s.asleep_s;
    nights.push({
      day,
      bedtime: b != null ? hhmm(b) : null,
      wake: w != null ? hhmm(w) : null,
      inBedH: h(s.in_bed_s),
      asleepH: h(asleep),
      awakeH: h(s.awake_s),
      lightH: h(s.light_s),
      deepH: h(s.deep_s),
      remH: h(s.rem_s),
      deepPct: asleep && s.deep_s != null ? round((s.deep_s / asleep) * 100) : null,
      remPct: asleep && s.rem_s != null ? round((s.rem_s / asleep) * 100) : null,
      efficiencyPct: round(s.efficiency_pct),
      performancePct: round(s.performance_pct, 0),
      consistencyPct: round(s.consistency_pct, 0),
      respiratoryRate: round(s.respiratory_rate),
      napH: h(e.napS) ?? 0,
      debt7dH: last7.length ? round(last7.reduce((a, x) => a + (sleepNeedH - x), 0)) : null,
    });
  }

  const asleepH = nums(nights.map((n) => n.asleepH));
  const latencyH = nums(nights.map((n) => (n.inBedH != null && n.asleepH != null ? n.inBedH - n.asleepH : null)));
  const mb = mean(bedMin), mw = mean(wakeMin);
  const wk = mean(mid.filter((x) => !x.weekend).map((x) => x.m)), we = mean(mid.filter((x) => x.weekend).map((x) => x.m));
  const weekendShiftMin = wk != null && we != null && mid.filter((x) => x.weekend).length >= 2 ? Math.round(we - wk) : null;
  const suggested = mw != null && nights.length >= 5 ? hhmm(mw - (sleepNeedH + (mean(latencyH) ?? 0.5)) * 60) : null;
  const summary: SleepReport["summary"] = {
    nights: nights.length,
    avgAsleepH: round(mean(asleepH), 2),
    avgInBedH: round(mean(nums(nights.map((n) => n.inBedH))), 2),
    avgDeepPct: round(mean(nums(nights.map((n) => n.deepPct)))),
    avgRemPct: round(mean(nums(nights.map((n) => n.remPct)))),
    avgEfficiencyPct: round(mean(nums(nights.map((n) => n.efficiencyPct)))),
    needMetPct: asleepH.length ? Math.round((asleepH.filter((x) => x >= sleepNeedH - 0.25).length / asleepH.length) * 100) : null,
    avgBedtime: mb != null ? hhmm(mb - 720) : null,
    avgWake: mw != null ? hhmm(mw) : null,
    bedtimeSdMin: round(sd(bedMin), 0),
    wakeSdMin: round(sd(wakeMin), 0),
    weekendShiftMin,
    debt7dH: nights.at(-1)?.debt7dH ?? null,
    suggestedBedtime: suggested,
  };

  const tips: string[] = [];
  if (summary.debt7dH != null && summary.debt7dH >= 5)
    tips.push(`Schlafschuld der letzten 7 Nächte etwa ${summary.debt7dH.toString().replace(".", ",")} h. Ein paar Nächte etwas früher ins Bett holen das auf.`);
  if (summary.bedtimeSdMin != null && summary.bedtimeSdMin > 60)
    tips.push(`Deine Einschlafzeit schwankt stark (± ${summary.bedtimeSdMin} min). Regelmäßige Zeiten helfen der Erholung.`);
  if (weekendShiftMin != null && Math.abs(weekendShiftMin) >= 60)
    tips.push(`Am Wochenende verschiebt sich dein Schlaf um etwa ${Math.round(Math.abs(weekendShiftMin) / 6) / 10} h. Kleinere Unterschiede erleichtern den Wochenstart.`);
  if (suggested && summary.avgAsleepH != null && summary.avgAsleepH < sleepNeedH - 0.25)
    tips.push(`Für ${sleepNeedH.toString().replace(".", ",")} h Schlaf bei deiner üblichen Aufwachzeit (${summary.avgWake}) etwa um ${suggested} ins Bett gehen (Schätzung).`);
  return { nights, summary, sleepNeedH, tips };
}
