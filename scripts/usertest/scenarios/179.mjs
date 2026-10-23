import { scenario, deviceStep, D } from "./_auto.mjs";
export default scenario(179, "Coach-Kontext: Analyse-Highlights einbinden", "Coach-Kontext: Highlights", [
  { action: "Im Dashboard den Coach-Chat öffnen.", expected: "Coach-Chat ist offen.",
    async run(t) { await t.open("coach"); const sec = await t.section("coach"); return { status: (await sec.locator("#askInput").isVisible()) ? "ok" : "fail", observed: "Coach-Chat mit Eingabefeld sichtbar", locator: sec }; } },
  { action: "Fragen: „Was fällt dir in meinen Daten gerade auf?“", expected: "Coach nennt 1–3 konkrete Befunde (Auffälliges zuerst), Schätzungen gekennzeichnet, keine Diagnose.",
    async run(t) { const c = await t.tool("get_coach_context"); const h = c.highlights ?? c.analysisHighlights; const list = h?.highlights ?? h; return { status: "device", observed: `Der Coach-Kontext enthält ${Array.isArray(list) ? list.length : "?"} Highlights (z. B. ${(Array.isArray(list) ? list : []).slice(0, 3).map((x) => x.title).join(", ")}). Die Formulierung durch Claude gibt es nur im echten Chat (in der Vorschau nur Beispieltext).`, noFinalShot: true }; } },
]);
