// Trittfrequenz-Profil (#161): Verteilung der Kadenz, bevorzugte Kadenz je Leistungszone (nach FTP) und Verlauf der
// Kadenz in Zone 2 je Woche, aus den Sekundenwerten der FIT-Dateien. Reine Funktionen; gelesen wird mit readIntervalRides.
import { addDays, weekStart } from "./analysis";
import type { IntervalRide } from "./intervals";

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

export const BANDS = [
  { key: "lt70", label: "unter 70", lo: 0, hi: 70 },
  { key: "70to80", label: "70–80", lo: 70, hi: 80 },
  { key: "80to90", label: "80–90", lo: 80, hi: 90 },
  { key: "90to100", label: "90–100", lo: 90, hi: 100 },
  { key: "gt100", label: "über 100", lo: 100, hi: Infinity },
] as const;

/** Leistungszonen nach Coggan in Anteilen der FTP (Obergrenze exklusiv). */
export const ZONES = [
  { zone: 1, label: "Z1 Erholung", hi: 0.56 },
  { zone: 2, label: "Z2 Grundlage", hi: 0.76 },
  { zone: 3, label: "Z3 Tempo", hi: 0.91 },
  { zone: 4, label: "Z4 Schwelle", hi: 1.06 },
  { zone: 5, label: "Z5+ hart", hi: Infinity },
] as const;

/** Mindestsekunden je Zone bzw. Woche für einen Wert. */
export const MIN_SECONDS = 300;

/** Median aus einem Histogramm ganzzahliger Kadenzen. */
function histMedian(hist: Map<number, number>, total: number): number | null {
  if (!total) return null;
  let acc = 0;
  for (const c of [...hist.keys()].sort((a, b) => a - b)) {
    acc += hist.get(c)!;
    if (acc >= total / 2) return c;
  }
  return null;
}

const zoneOf = (watts: number, ftpW: number) => ZONES.findIndex((z) => watts < z.hi * ftpW);

export function cadenceReport(rides: readonly IntervalRide[], ftpW: number | null, today: string, days: number) {
  const from = addDays(today, -(days - 1));
  const inRange = rides.filter((r) => r.day >= from && r.day <= today && r.cadence?.some((c) => (c ?? 0) > 0));

  const bandSecs = BANDS.map(() => 0);
  const zoneHist = ZONES.map(() => new Map<number, number>());
  const zoneSecs = ZONES.map(() => 0);
  const weekHist = new Map<string, { hist: Map<number, number>; secs: number }>();
  const allHist = new Map<number, number>();
  let total = 0;

  for (const r of inRange) {
    const cad = r.cadence!;
    const week = weekStart(r.day);
    for (let i = 0; i < Math.min(cad.length, r.power.length); i++) {
      const c = cad[i], p = r.power[i];
      if (c == null || c <= 0 || p == null || p <= 0) continue;
      const rc = Math.round(c);
      total++;
      allHist.set(rc, (allHist.get(rc) ?? 0) + 1);
      bandSecs[BANDS.findIndex((b) => rc < b.hi)]++;
      if (!ftpW) continue;
      const z = zoneOf(p, ftpW);
      zoneSecs[z]++;
      zoneHist[z].set(rc, (zoneHist[z].get(rc) ?? 0) + 1);
      if (z === 1) {
        const w = weekHist.get(week) ?? { hist: new Map(), secs: 0 };
        w.hist.set(rc, (w.hist.get(rc) ?? 0) + 1);
        w.secs++;
        weekHist.set(week, w);
      }
    }
  }

  const bands = BANDS.map((b, i) => ({ key: b.key, label: b.label, minutes: Math.round(bandSecs[i] / 60), sharePct: total ? round((bandSecs[i] / total) * 100, 1)! : 0 }));
  const zones = ftpW
    ? ZONES.map((z, i) => ({ zone: z.zone, label: z.label, minutes: Math.round(zoneSecs[i] / 60), medianRpm: zoneSecs[i] >= MIN_SECONDS ? histMedian(zoneHist[i], zoneSecs[i]) : null }))
    : null;
  const weeks = [...weekHist.entries()]
    .filter(([, w]) => w.secs >= MIN_SECONDS)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([week, w]) => ({ week, minutes: Math.round(w.secs / 60), medianRpm: histMedian(w.hist, w.secs) }));
  const overall = histMedian(allHist, total);

  const hints: string[] = [];
  const z2 = zones?.[1].medianRpm ?? null, z4 = zones?.[3].medianRpm ?? null, z5 = zones?.[4].medianRpm ?? null;
  if (z4 != null && z4 < 80)
    hints.push(`An der Schwelle trittst du im Mittel nur ${z4} U/min. Etwas höhere Kadenz (85–95) verteilt die Last mehr auf Herz-Kreislauf und schont die Beine; probiere es in den nächsten Schwellenintervallen.`);
  if (z2 != null && z2 < 75)
    hints.push(`In der Grundlage liegt deine Kadenz bei ${z2} U/min. Kurze Blöcke mit 95–105 U/min (z. B. 5 × 1 min) verbessern den runden Tritt.`);
  if (z2 != null && z5 != null && z5 - z2 >= 12)
    hints.push(`Bei harten Belastungen erhöhst du die Kadenz deutlich (${z2} → ${z5} U/min). Das ist typisch und in Ordnung.`);
  if (weeks.length >= 4) {
    const firstW = weeks.slice(0, 2).map((w) => w.medianRpm!), lastW = weeks.slice(-2).map((w) => w.medianRpm!);
    const d = lastW.reduce((a, b) => a + b, 0) / lastW.length - firstW.reduce((a, b) => a + b, 0) / firstW.length;
    if (Math.abs(d) >= 3) hints.push(`Deine Grundlagen-Kadenz ist im Zeitraum um etwa ${Math.round(Math.abs(d))} U/min ${d > 0 ? "gestiegen" : "gesunken"}.`);
  }
  if (!hints.length)
    hints.push(!total ? "Noch keine Fahrten mit Trittfrequenz (FIT-Upload) im Zeitraum."
      : !ftpW ? "Ohne FTP keine Auswertung nach Leistungszonen. Trage eine FTP ein oder mache einen FTP-Test."
      : "Deine Trittfrequenz wirkt in allen Bereichen unauffällig.");

  return {
    today,
    range: { from, to: today, days },
    rides: inRange.length,
    pedalingMinutes: Math.round(total / 60),
    medianRpm: overall,
    ftpW,
    bands,
    zones,
    weeks,
    hints,
    notes: [
      "Nur Sekunden mit Tritt und Leistung (Rollen ohne Treten zählt nicht). Zonen nach Coggan in Anteilen deiner FTP.",
      `Median-Kadenz je Zone bzw. Woche ab ${MIN_SECONDS / 60} min. Verlauf: Kadenz in Zone 2 je Woche. Trainingshinweise, keine Diagnose.`,
    ],
  };
}
