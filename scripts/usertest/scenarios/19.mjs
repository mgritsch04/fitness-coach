import { scenario, sectionStep, deviceStep, toolOk, D } from "./_auto.mjs";
export default scenario(19, "Pulszonen: Zeit in Zonen je Workout und Woche", "Pulszonen und Intensitätsverteilung", [
  { action: "get_dashboard (14 Tage): Minuten je Pulszone je Workout.", expected: "Je Workout sechs Werte (Zone 0–5).",
    async run(t) { return toolOk(t, "get_dashboard", { days: 14 }, (p) => { const ws = JSON.stringify(p).match(/"hrZoneMin":\[[^\]]*\]/g) ?? []; const ok = ws.filter((x) => JSON.parse("{" + x + "}").hrZoneMin.length === 6); return ok.length ? `${ok.length} Workouts mit sechs Zonenwerten, z. B. ${ok[0]} (Minuten)` : null; }); } },
  { action: "Intensitätsverteilung locker/mittel/hart je Woche.", expected: "Anteile je Woche, Hinweis zum 80/20-Prinzip, Zone 0 zählt nicht.",
    async run(t) { return toolOk(t, "get_dashboard", { days: 60 }, (p) => { const w = p.hrZones?.weeks ?? p.zones?.weeks ?? p.hrZones; const s = JSON.stringify(p.hrZones ?? p.zones ?? {}); return s.length > 50 ? `Zonen-Auswertung vorhanden (${s.length} Zeichen): ${s.slice(0, 160)}` : null; }); } },
  sectionStep({ nr: 3, action: "Dashboard: Abschnitt Pulszonen, gestapelte Wochenbalken.", expected: "Dieselben Werte wie in Schritt 2.", tab: "training", id: "hrzones", has: [/locker/, /mittel/, /hart/, /80\/20/] }),
  deviceStep(4, "Zonenwerte mit der WHOOP-App vergleichen.", "Passen ungefähr zur WHOOP-App.", D.whoop),
]);
