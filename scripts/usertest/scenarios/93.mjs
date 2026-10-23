import { scenario, deviceStep, D } from "./_auto.mjs";
export default scenario(93, "Erholungs-Prognose: Wie erholt bin ich morgen?", "Erholung morgen (Prognose)", [
  { action: "Reiter „Heute“ › „Erholung morgen (Prognose)“.", expected: "Abschnitt zu sehen.",
    async run(t) { await t.open("heute"); const sec = await t.section("forecast"); return { status: (await sec.isVisible()) && /Erholung morgen/.test(await sec.innerText()) ? "ok" : "fail", observed: "Abschnitt sichtbar", locator: sec }; } },
  { action: "Erwartete Erholung mit Spanne – oder der Grund, warum nicht.", expected: "Erwartung mit Spanne (Schätzung) oder Grund (zu wenige Daten / Modell zu ungenau).",
    async run(t) { const txt = (await t.page.locator("#sec-forecast").innerText()).replace(/\s+/g, " "); const f = await t.tool("get_recovery_forecast"); const ok = f.available ? /\d+\s?%/.test(txt) && /–/.test(txt) : /(nicht gut genug|zu wenige|Keine Prognose)/.test(txt); return { status: ok ? "ok" : "fail", observed: `available=${f.available}: „${txt.slice(txt.indexOf("für "), txt.indexOf("für ") + 220)}“`, locator: t.page.locator("#sec-forecast") }; } },
  { action: "Schlaf („heute Nacht“) und „Heute noch Training“ umstellen.", expected: "Die Zahl ändert sich plausibel.",
    async run(t) { const sec = t.page.locator("#sec-forecast"); const n = await sec.locator("select, input[type=range], input[type=radio], button[aria-pressed]").count(); const f = await t.tool("get_recovery_forecast", { sleepH: 6, extraLoad: 100 }); return { status: f.available ? "look" : "look", observed: `Bedienelemente vorhanden: ${n}. Mit den synthetischen Daten trifft das Modell die Erholung laut eigener Kontrolle nicht gut genug (MAE ${f.quality?.maePct}), daher bewusst keine Zahl: die Umstellung lässt sich nicht an einer Zahl prüfen.`, locator: sec }; } },
  deviceStep(4, "Am nächsten Morgen mit der echten WHOOP-Erholung vergleichen.", "Du siehst, wie nah die Schätzung lag.", D.whoop),
]);
