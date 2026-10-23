import { scenario, sectionStep, seedFits, deviceStep, D } from "./_auto.mjs";
export default scenario(92, "Ausdauer-Profil: Critical Power und W′", "Ausdauer-Profil", [
  { action: "Reiter „Training“ › „Ausdauer-Profil“.", expected: "Abschnitt zu sehen.",
    async run(t) { await t.open("training"); const sec = await t.section("endurance"); return { status: (await sec.isVisible()) && /Ausdauer-Profil/.test(await sec.innerText()) ? "ok" : "fail", observed: "Abschnitt „Ausdauer-Profil“ sichtbar", locator: sec }; } },
  sectionStep({ nr: 2, action: "Critical Power (CP) und W′ angezeigt?", expected: "CP und W′ sind zu sehen.", tab: "training", id: "endurance", has: [/Critical Power/, /CP \d+ W/, /W′ [\d,]+ kJ/] }),
  sectionStep({ nr: 3, action: "Tabelle: wie lange Wattzahlen haltbar.", expected: "Passt grob zum Gefühl.", tab: "training", id: "endurance", has: [/LEISTUNG ETWA HALTBAR/i, /\d+ min/] }),
  { action: "Effizienz-Kurve (Watt pro Herzschlag) bei lockeren Fahrten.", expected: "Kurve nur bei genug lockeren Fahrten mit Leistung und Puls.",
    async run(t) { await seedFits(t); await t.open("training"); const sec = await t.section("endurance"); const txt = (await sec.innerText()).replace(/\s+/g, " "); const noData = /Noch zu wenige lockere Fahrten/.test(txt); return { status: noData || (await sec.locator("svg").count()) > 0 ? "ok" : "fail", observed: noData ? "Mit nur wenigen synthetischen lockeren Fahrten steht korrekt der Hinweis „Noch zu wenige lockere Fahrten …“ statt einer Kurve." : "Kurve vorhanden", locator: sec }; } },
  deviceStep(5, "Werte gegen eigenes Gefühl halten.", "Plausibel.", D.feel),
]);
