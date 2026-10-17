// W′-Bilanz (#208): wie weit die anaerobe Reserve W′ während einer Fahrt geleert wurde. Differenzielles Modell nach
// Skiba (2015): über CP sinkt W′bal um (P − CP) je Sekunde, darunter füllt es sich mit (W′ − W′bal) · (CP − P) / W′ wieder.
// CP und W′ aus dem Ausdauer-Profil (Critical Power); ohne gutes Modell CP = FTP und W′ = 20 kJ. Reine Funktionen, Schätzung.
import type { CpModel } from "./endurance";

type Series = readonly (number | null)[] | null | undefined;
const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

/** Annahme für W′, wenn kein passendes CP-Modell vorliegt (typischer Wert trainierter Radfahrer). */
export const DEFAULT_WPRIME_KJ = 20;

export interface WbalModel {
  cpW: number;
  wPrimeKj: number;
  /** cp: aus den eigenen Bestwerten; ftp: CP = FTP, W′ angenommen. */
  source: "cp" | "ftp";
}

export function wbalModel(cp: Pick<CpModel, "cpW" | "wPrimeKj" | "confidence"> | null, ftpW: number | null): WbalModel | null {
  if (cp && cp.confidence !== "low") return { cpW: cp.cpW, wPrimeKj: cp.wPrimeKj, source: "cp" };
  if (ftpW && ftpW > 0) return { cpW: ftpW, wPrimeKj: DEFAULT_WPRIME_KJ, source: "ftp" };
  return null;
}

/** W′bal je Sekunde in Joule (fehlende Werte = 0 W). */
export function wbalSeries(power: readonly (number | null)[], model: Pick<WbalModel, "cpW" | "wPrimeKj">): number[] {
  const wp = model.wPrimeKj * 1000, cp = model.cpW;
  let bal = wp;
  return power.map((p) => {
    const w = p ?? 0;
    bal = w > cp ? bal - (w - cp) : bal + ((wp - bal) * (cp - w)) / wp;
    return Math.max(0, Math.min(wp, bal));
  });
}

export function wbalReport(power: Series, model: WbalModel | null, stepS = 1) {
  if (!power?.length || !model) return null;
  const s = wbalSeries(power, model);
  const wp = model.wPrimeKj * 1000;
  let minI = 0;
  for (let i = 1; i < s.length; i++) if (s[i] < s[minI]) minI = i;
  const minPct = round((s[minI] / wp) * 100)!;
  const step = Math.max(1, stepS);
  // Für das Diagramm: tiefster Wert je Abschnitt (so geht kein kurzes Tief verloren), in kJ.
  const series: number[] = [];
  for (let t = 0; t < s.length; t += step) series.push(round(Math.min(...s.slice(t, t + step)) / 1000, 1)!);
  const below25S = s.filter((v) => v < wp * 0.25).length;
  const verdict =
    minPct < 10 ? "W′ fast vollständig geleert: am Limit dosiert. Für Ausbelastungs-Intervalle richtig, sonst etwas zu hart."
      : minPct < 40 ? "W′ deutlich genutzt, mit Reserve: typisch für harte Intervalle."
      : minPct < 75 ? "W′ moderat genutzt."
      : "W′ kaum genutzt: die Fahrt lag fast nur unter Critical Power.";
  return {
    cpW: model.cpW,
    wPrimeKj: model.wPrimeKj,
    modelSource: model.source,
    minKj: round(s[minI] / 1000, 1)!,
    minPct,
    minAtS: minI,
    below25PctS: below25S,
    stepS: step,
    series,
    verdict,
    note: model.source === "cp"
      ? "Modellschätzung (Skiba) mit CP und W′ aus deinen Bestwerten der letzten 90 Tage."
      : `Modellschätzung (Skiba) mit CP = FTP und angenommenem W′ von ${DEFAULT_WPRIME_KJ} kJ; mit harten 3–20-min-Bestwerten wird sie genauer.`,
  };
}
