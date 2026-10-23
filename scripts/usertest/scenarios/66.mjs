import { scenario, deviceStep, D } from "./_auto.mjs";
export default scenario(66, "Draußen fahren? Wetter-Empfehlung", "Radwetter", [
  { action: "Abschnitt „Radwetter“ auf „Heute“.", expected: "Zeitfenster für heute/morgen und Empfehlung draußen oder Rolle.",
    async run(t) { await t.open("heute"); const sec = await t.section("weather"); const txt = (await sec.innerText()).replace(/\s+/g, " "); return { status: /(Heute|Morgen)/.test(txt) && /(draußen|Rolle)/i.test(txt) && /Uhr/.test(txt) ? "ok" : "fail", observed: `„${txt.slice(0, 260)}“ (Beispieldaten, kein Live-Wetter in der Vorprüfung)`, locator: sec }; } },
  { action: "Ort eintragen und speichern.", expected: "Daten werden geladen; keine Fehlermeldung.",
    async run(t) { const sec = t.page.locator("#sec-weather"); await sec.getByRole("button", { name: /Ort ändern/ }).click(); await sec.locator("#wxName").fill("Graz"); await sec.locator("form button[type=submit], button.primary").first().click(); await t.page.waitForTimeout(1500); const txt = (await sec.innerText()).replace(/\s+/g, " "); return { status: !/Fehler|nicht erreichbar/i.test(txt) ? "look" : "fail", observed: `Nach Speichern: „${txt.slice(0, 200)}“. Die Wetter-Abfrage selbst (Open-Meteo, Netz) ist in der Vorprüfung nur eine Beispielantwort.`, locator: sec }; } },
  deviceStep(3, "Zeitfenster, Temperatur, Regen, Wind mit gewohnter Vorhersage vergleichen.", "Passt ungefähr zur Vorhersage.", "Echte Wetterdaten für den echten Ort: nur live prüfbar."),
  deviceStep(4, "Empfehlung prüfen: bei gutem Wetter Grundlage draußen, Intervalle auf der Rolle.", "Plausibel.", "Regeln sind in Unit-Tests des Workers abgedeckt; ob sie sich richtig anfühlen, entscheidet der Nutzer."),
]);
