// Analyse-Highlights (#175): die wichtigsten Befunde aller Analysen in wenigen Sätzen, für Coach und Briefing.
// Nimmt die fertigen Berichte entgegen und wählt je Thema höchstens einen Satz. Reine Funktion ohne D1.

export type Tone = "warn" | "good" | "neutral";
export interface Highlight {
  topic: string;
  title: string;
  text: string;
  tone: Tone;
  /** MCP-Tool mit den Details. */
  tool: string;
}

/** Nur die Felder, die hier gebraucht werden (die Berichte haben mehr). */
export interface HighlightInputs {
  forecast?: { available: boolean; forecast?: { recovery: number; low: number; high: number; zone: string } } | null;
  hrv?: { available: boolean; pattern?: string; label?: string; advice?: string } | null;
  aerobic?: { current: { medianPct: number | null; band: string | null }; trend: { direction: string; text: string } | null; verdict: string } | null;
  intervals?: { totalSessions: number; sessions: { execution: string }[]; hints: string[] } | null;
  durability?: { rides: number; verdict: string; table: { levels: { pctOfFresh: number | null }[] }[] } | null;
  rider?: { available: boolean; label?: string; focus?: { training: string } } | null;
  muscles?: { sessions: number; hints: string[] } | null;
  timing?: { hints: string[] } | null;
  interference?: { suggestion?: { hours: number | null; text: string } } | null;
  cadence?: { pedalingMinutes: number; hints: string[] } | null;
}

const ORDER: Record<Tone, number> = { warn: 0, good: 1, neutral: 2 };

export function analysisHighlights(x: HighlightInputs, limit = 6) {
  const all: Highlight[] = [];
  const add = (h: Highlight) => all.push(h);

  const f = x.forecast;
  if (f?.available && f.forecast)
    add({ topic: "forecast", title: "Erholung morgen", tool: "get_recovery_forecast", tone: f.forecast.zone === "red" ? "warn" : f.forecast.zone === "green" ? "good" : "neutral",
      text: `Voraussichtlich etwa ${f.forecast.recovery} % (${f.forecast.low}–${f.forecast.high} %), Schätzung aus deinen Daten.` });

  const h = x.hrv;
  if (h?.available && h.label)
    add({ topic: "hrv", title: "HRV-Trend", tool: "get_hrv_trend", text: `${h.label}. ${h.advice ?? ""}`.trim(),
      tone: ["fatigue", "saturation", "low", "unsettled"].includes(h.pattern ?? "") ? "warn" : ["stable", "high"].includes(h.pattern ?? "") ? "good" : "neutral" });

  const a = x.aerobic;
  if (a && a.current.medianPct != null)
    add({ topic: "aerobic", title: "Aerobe Basis", tool: "get_aerobic_decoupling", text: [a.verdict, a.trend?.text].filter(Boolean).join(" "),
      tone: a.current.band === "high" || a.trend?.direction === "worse" ? "warn" : a.current.band === "good" || a.trend?.direction === "better" ? "good" : "neutral" });

  const i = x.intervals;
  if (i && i.totalSessions && i.hints.length) {
    const last = i.sessions[0]?.execution;
    add({ topic: "intervals", title: "Intervalle", tool: "get_interval_quality", text: i.hints[0], tone: last === "strong" ? "warn" : last === "even" || last === "building" ? "good" : "neutral" });
  }

  const d = x.durability;
  if (d && d.rides && /^(Sehr|Solide|Ausbaufähig)/.test(d.verdict))
    add({ topic: "durability", title: "Ermüdungsresistenz", tool: "get_durability", text: d.verdict, tone: d.verdict.startsWith("Ausbau") ? "warn" : d.verdict.startsWith("Sehr") ? "good" : "neutral" });

  const r = x.rider;
  if (r?.available && r.label && r.focus)
    add({ topic: "rider", title: `Fahrertyp: ${r.label}`, tool: "get_rider_profile", tone: "neutral", text: `Trainingsvorschlag: ${r.focus.training}` });

  const m = x.muscles;
  if (m && m.hints.length)
    add({ topic: "muscles", title: "Muskelbalance", tool: "get_muscle_balance", text: m.hints[0], tone: !m.sessions ? "neutral" : m.hints[0].startsWith("Ausgewogen") ? "good" : "warn" });

  const t = x.timing?.hints[0];
  if (t && !t.startsWith("Noch zu wenige") && !t.startsWith("Keine deutlichen"))
    add({ topic: "timing", title: "Trainingszeit", tool: "get_training_timing", text: t, tone: t.startsWith("Nach Training") ? "warn" : "neutral" });

  const s = x.interference?.suggestion;
  if (s && s.hours != null)
    add({ topic: "interference", title: "Kraft und Rad", tool: "get_strength_cycling_interference", text: s.text, tone: "neutral" });

  const c = x.cadence;
  if (c && c.pedalingMinutes && c.hints.length && !c.hints[0].includes("unauffällig") && !c.hints[0].startsWith("Ohne FTP"))
    add({ topic: "cadence", title: "Trittfrequenz", tool: "get_cadence_profile", text: c.hints[0], tone: c.hints[0].includes("nur") ? "warn" : "neutral" });

  const sorted = all.map((h, k) => ({ h, k })).sort((p, q) => ORDER[p.h.tone] - ORDER[q.h.tone] || p.k - q.k).map((p) => p.h);
  return {
    highlights: sorted.slice(0, limit),
    more: Math.max(0, sorted.length - limit),
    notes: ["Je Analyse höchstens ein Satz, Auffälliges zuerst. Details im jeweiligen Tool. Schätzungen und Trainingshinweise, keine Diagnose."],
  };
}
