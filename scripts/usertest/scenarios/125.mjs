import { scenario, sectionStep, deviceStep, D } from "./_auto.mjs";
export default scenario(125, "HRV-Trend nach Plews", "HRV-Trend", [
  { action: "Reiter „Verlauf“ › „HRV-Trend“.", expected: "Einordnung (z. B. „Stabil im Normalbereich“) mit Trainingshinweis, keine Diagnose.",
    async run(t) { await t.open("verlauf"); const sec = await t.section("hrvtrend"); const txt = (await sec.innerText()).replace(/\s+/g, " "); const h = await t.tool("get_hrv_trend"); return { status: txt.includes(h.label) && txt.includes(h.advice) ? "ok" : "fail", observed: `Einordnung „${h.label}“ + Hinweis „${h.advice}“ stehen im Abschnitt (aus get_hrv_trend)`, locator: sec }; } },
  deviceStep(2, "Passt die Einordnung zu deinem Gefühl der letzten Tage?", "Passt.", "Eigenes Gefühl: nur der Nutzer."),
  { action: "Linie (7-Tage-Mittel) im Diagramm.", expected: "Folgt ungefähr der WHOOP-App; Fläche = Normalbereich.",
    async run(t) { const sec = t.page.locator("#sec-hrvtrend"); const svg = await sec.locator("svg path, svg polyline").count(); return { status: svg > 0 ? "device" : "fail", observed: `Diagramm gezeichnet (${svg} Pfade). Vergleich mit WHOOP-App: ${D.whoop}`, locator: sec }; } },
  { action: "Wert „Schwankung“ ansehen.", expected: "Über „üblich“: HRV springt gerade stärker.",
    async run(t) { const txt = (await t.page.locator("#sec-hrvtrend").innerText()).replace(/\s+/g, " "); const h = await t.tool("get_hrv_trend"); const cv = String(h.current.cv7).replace(".", ","); return { status: /SCHWANKUNG/i.test(txt) && txt.includes(cv) && /üblich/.test(txt) ? "ok" : "fail", observed: `Schwankung ${cv} % neben „üblich ${String(h.current.cvTypical).replace(".", ",")} %“ angezeigt`, locator: t.page.locator("#sec-hrvtrend") }; } },
]);
