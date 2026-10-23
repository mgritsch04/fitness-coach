import { scenario, deviceStep, toolOk, D } from "./_auto.mjs";
export default scenario(114, "Coach-Kontext: Erholungs-Prognose für morgen", "Erholungs-Prognose im Coach-Kontext", [
  { action: "Fragen: „Soll ich heute Abend noch eine Stunde auf der Rolle fahren? Wie wird meine Erholung morgen?“", expected: "Erwartete Erholung mit Spanne, als Schätzung gekennzeichnet.",
    async run(t) { const p = await t.tool("get_coach_context"); const f = p.recoveryForecast ?? p.forecast; return { status: f ? "ok" : "fail", observed: `Coach-Kontext enthält Prognose: ${JSON.stringify(f).slice(0, 300)}`, noFinalShot: true }; } },
  { action: "Optional: zu wenig Daten → Claude sagt das, keine Zahl.", expected: "Hinweis statt Zahl.",
    async run(t) { const f = (await t.tool("get_coach_context")); const r = f.recoveryForecast ?? f.forecast; return { status: r && r.available === false ? "ok" : "skip", observed: `Prognose available=${r?.available}; Grund: ${JSON.stringify(r?.reason ?? r?.note ?? r?.notes ?? "").slice(0, 200)}`, noFinalShot: true }; } },
  deviceStep(3, "Antwort im echten Chat zu deinem Gefühl.", "Passt.", D.chat),
]);
