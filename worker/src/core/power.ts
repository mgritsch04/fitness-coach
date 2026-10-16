// Leistungskennzahlen aus Sekundenreihen (1 Wert pro Sekunde, Lücken = null = 0 W).

/** Dauern der Bestleistungskurve in Sekunden (5 s Sprint bis 2 h). */
export const CURVE_DURATIONS_S = [1, 5, 10, 15, 30, 60, 120, 180, 300, 600, 1200, 1800, 3600, 5400, 7200] as const;

const watts = (s: (number | null)[]) => s.map((v) => (v != null && v > 0 ? v : 0));

/** Normalized Power: 30-s-gleitender Mittelwert, 4. Potenz, Mittel, 4. Wurzel. Null unter 30 s. */
export function normalizedPower(series: (number | null)[]): number | null {
  const p = watts(series);
  if (p.length < 30) return null;
  let sum = 0, acc = 0, n = 0;
  for (let i = 0; i < p.length; i++) {
    sum += p[i];
    if (i >= 30) sum -= p[i - 30];
    if (i >= 29) {
      acc += (sum / 30) ** 4;
      n++;
    }
  }
  return (acc / n) ** 0.25;
}

/** Beste Durchschnittsleistung je Dauer (Mean-Max), z. B. {"5": 820, "300": 310}. Nur Dauern ≤ Fahrtlänge. */
export function meanMaxPower(series: (number | null)[]): Record<string, number> {
  const p = watts(series);
  const prefix = new Float64Array(p.length + 1);
  for (let i = 0; i < p.length; i++) prefix[i + 1] = prefix[i] + p[i];
  const out: Record<string, number> = {};
  for (const d of CURVE_DURATIONS_S) {
    if (d > p.length) break;
    let best = 0;
    for (let i = d; i <= p.length; i++) best = Math.max(best, prefix[i] - prefix[i - d]);
    out[d] = Math.round(best / d);
  }
  return out;
}

/** Kurve über mehrere Workouts: je Dauer der beste Wert. */
export function combineCurves(curves: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of curves) for (const [d, w] of Object.entries(c)) if (w > (out[d] ?? 0)) out[d] = w;
  return out;
}
