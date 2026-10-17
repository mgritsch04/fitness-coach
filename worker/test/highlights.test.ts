import { describe, expect, it } from "vitest";
import { analysisHighlights } from "../src/core/highlights";
import { analysisHighlightsView } from "../src/core/analytics";
import { fakeD1 } from "./fake-d1";

// Synthetische Berichtsausschnitte, keine echten Messwerte.
describe("Analyse-Highlights", () => {
  it("Auffälliges zuerst, je Thema ein Satz, Grenze", () => {
    const r = analysisHighlights({
      forecast: { available: true, forecast: { recovery: 72, low: 60, high: 84, zone: "green" } },
      hrv: { available: true, pattern: "fatigue", label: "Ermüdung", advice: "Zwei lockere Tage einplanen." },
      aerobic: { current: { medianPct: 3.1, band: "good" }, trend: { direction: "better", text: "Besser als zuvor." }, verdict: "Gute aerobe Basis." },
      intervals: { totalSessions: 2, sessions: [{ execution: "strong" }], hints: ["Zu hart angegangen."] },
      durability: { rides: 0, verdict: "Noch keine Fahrten.", table: [] },
      rider: { available: true, label: "Puncheur", focus: { training: "Sprints." } },
      muscles: { sessions: 3, hints: ["Ausgewogen: alle großen Muskelgruppen liegen im Zielbereich."] },
      timing: { hints: ["Noch zu wenige Einheiten in verschiedenen Zeitfenstern für eine Aussage."] },
      interference: { suggestion: { hours: null, text: "–" } },
      cadence: { pedalingMinutes: 300, hints: ["An der Schwelle trittst du im Mittel nur 76 U/min."] },
    }, 4);
    expect(r.highlights.map((h) => h.topic)).toEqual(["hrv", "intervals", "cadence", "forecast"]);
    expect(r.highlights[0].text).toBe("Ermüdung. Zwei lockere Tage einplanen.");
    expect(r.more).toBe(3);
    expect(r.highlights.every((h) => h.tool.startsWith("get_"))).toBe(true);
  });

  it("leere Datenbank: nur der Kraft-Hinweis, kein Fehler", async () => {
    const r = await analysisHighlightsView(fakeD1(), 6);
    expect(r.highlights.map((h) => [h.topic, h.tone])).toEqual([["muscles", "neutral"]]);
  });
});
