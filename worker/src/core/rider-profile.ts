// Fahrertyp (#164): beste 5 s, 1 min und 5 min der Leistungskurve im Verhältnis zur FTP, verglichen mit den typischen
// Verhältnissen aus Coggans Leistungsprofil (Mitte der Tabelle). Gewichtsunabhängig; W/kg nur zur Anzeige. Reine Funktionen.

const round = (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(digits)));

/** Typisches Verhältnis Bestleistung / FTP (Mitte der Coggan-Tabelle: 17,1 / 8,6 / 5,0 / 4,1 W/kg). */
export const REFERENCE = [
  { durationS: 5, key: "sprint", label: "Sprint (5 s)", ratio: 4.14 },
  { durationS: 60, key: "anaerobic", label: "Antritt (1 min)", ratio: 2.07 },
  { durationS: 300, key: "vo2", label: "VO2max (5 min)", ratio: 1.2 },
] as const;
type Key = (typeof REFERENCE)[number]["key"];

/** Ab hier gilt eine Dauer als Stärke bzw. Schwäche (Punkte, 100 = typisch). */
export const STRONG = 106;
export const WEAK = 94;

export type RiderType = "sprinter" | "puncheur" | "climber" | "timetrialist" | "allrounder";
export const TYPE_TEXT: Record<RiderType, { label: string; text: string }> = {
  sprinter: { label: "Sprinter", text: "Deine Stärke ist die Spitzenleistung über Sekunden: Antritte, Zielsprints, kurze Rampen." },
  puncheur: { label: "Puncheur", text: "Du bist stark bei kurzen, harten Belastungen um eine Minute: kurze Anstiege, Attacken, Positionskämpfe." },
  climber: { label: "Kletterer / VO2max-stark", text: "Deine Stärke liegt bei harten Belastungen von einigen Minuten: längere Rampen und Anstiege." },
  timetrialist: { label: "Zeitfahrer / Ausdauertyp", text: "Im Verhältnis zur FTP sind deine kurzen Spitzen eher klein: Du bist stark bei langer, gleichmäßiger Leistung." },
  allrounder: { label: "Allrounder", text: "Deine Leistung ist über alle Dauern ausgeglichen." },
};

const TRAINING: Record<Key | "ftp", string> = {
  sprint: "Sprints: 6–8 × 10 s maximal aus mittlerem Tempo, dazwischen 3–5 min locker, einmal pro Woche.",
  anaerobic: "Kurze, sehr harte Intervalle: 6–8 × 30–60 s all-out mit 3–4 min Pause.",
  vo2: "VO2max-Intervalle: 4–6 × 3–5 min bei 106–120 % der FTP mit gleich langer Pause.",
  ftp: "Schwellenarbeit für mehr FTP: 2–3 × 12–20 min bei 91–105 % der FTP; das hebt alle Dauern mit.",
};

export function classifyRider(scores: Record<Key, number>): RiderType {
  const s = REFERENCE.map((r) => scores[r.key]);
  if (s.every((v) => v < WEAK)) return "timetrialist";
  if (s.every((v) => v >= WEAK && v < STRONG)) return "allrounder";
  const top = REFERENCE[s.indexOf(Math.max(...s))].key;
  return top === "sprint" ? "sprinter" : top === "anaerobic" ? "puncheur" : "climber";
}

export interface RiderProfileInput {
  /** Beste Leistung je Dauer in Sekunden im Zeitraum (Schlüssel als Text, wie in der Leistungskurve). */
  curve: Record<string, number>;
  /** Dieselbe Kurve im Vorzeitraum (gleich lang), für die Veränderung. */
  previousCurve: Record<string, number>;
  ftpW: number | null;
  ftpOrigin: string | null;
  weightKg: number | null;
}

export function riderProfile(input: RiderProfileInput, today: string, days: number) {
  const { curve, previousCurve, ftpW, weightKg } = input;
  const base = { today, days, ftpW, ftpOrigin: input.ftpOrigin, weightKg };
  if (!ftpW) return { ...base, available: false as const, reason: "Ohne FTP kein Fahrertyp. Trage eine FTP ein oder mache einen FTP-Test." };
  const missing = REFERENCE.filter((r) => !curve[String(r.durationS)]);
  if (missing.length)
    return { ...base, available: false as const, reason: `Noch keine Bestleistung über ${missing.map((m) => m.label.replace(/^.*\((.*)\)$/, "$1")).join(", ")} im Zeitraum. Ein paar kurze Maximalbelastungen (FIT-Upload) liefern sie.` };

  const durations = REFERENCE.map((r) => {
    const watts = curve[String(r.durationS)];
    const prev = previousCurve[String(r.durationS)] ?? null;
    const score = Math.round(((watts / ftpW) / r.ratio) * 100);
    return {
      durationS: r.durationS, key: r.key, label: r.label,
      watts: Math.round(watts),
      wattsPerKg: weightKg ? round(watts / weightKg, 2) : null,
      ratioToFtp: round(watts / ftpW, 2)!,
      typicalRatio: r.ratio,
      score,
      level: score >= STRONG ? ("strong" as const) : score < WEAK ? ("weak" as const) : ("typical" as const),
      changePct: prev ? round(((watts - prev) / prev) * 100, 1) : null,
    };
  });
  const scores = Object.fromEntries(durations.map((d) => [d.key, d.score])) as Record<Key, number>;
  const type = classifyRider(scores);
  const weakest = durations.reduce((a, d) => (d.score < a.score ? d : a));
  // Training für die schwächste Dauer, wenn sie wirklich schwach ist; sonst Schwelle, die alle Dauern mitnimmt.
  const focus: Key | "ftp" = weakest.level === "weak" ? weakest.key : "ftp";

  // Plausibilität: 20 min deutlich über der FTP heißt meist, dass die FTP zu niedrig eingestellt ist.
  const twenty = curve["1200"];
  const notes = [
    "Verglichen wird das Verhältnis deiner Bestleistung zur FTP mit dem typischen Verhältnis aus Coggans Leistungsprofil (100 Punkte = typisch, ab 106 Stärke, unter 94 Schwäche). Das ist gewichtsunabhängig.",
    "Nur aussagekräftig, wenn du in jeder Dauer schon einmal wirklich voll gefahren bist; sonst wirkt die Dauer schwächer, als sie ist. Schätzung, keine Diagnose.",
  ];
  const hints: string[] = [];
  if (twenty && twenty * 0.95 > ftpW * 1.05)
    hints.push(`Deine beste 20-min-Leistung (${Math.round(twenty)} W) spricht für eine FTP um ${Math.round(twenty * 0.95)} W, eingestellt sind ${ftpW} W. Mit zu niedriger FTP wirken die kurzen Dauern stärker, als sie sind.`);
  if (input.ftpOrigin && input.ftpOrigin !== "user") hints.push("Die FTP ist geschätzt; ein FTP-Test macht die Einordnung genauer.");

  return {
    ...base,
    available: true as const,
    type,
    label: TYPE_TEXT[type].label,
    text: TYPE_TEXT[type].text,
    durations,
    strengths: durations.filter((d) => d.level === "strong").map((d) => d.label),
    weaknesses: durations.filter((d) => d.level === "weak").map((d) => d.label),
    focus: { key: focus, training: TRAINING[focus] },
    hints,
    notes,
  };
}
