import { scenario, seedFits, deviceStep, overflow, D } from "./_auto.mjs";
export default scenario(164, "Fahrertyp", "Fahrertyp", [
  { action: "Tab „Training“ › „Fahrertyp“.", expected: "Typ (Sprinter, Puncheur, Kletterer, Zeitfahrer, Allrounder) mit Sprint/Antritt/VO2max als Punkte gegenüber typisch (100) und Trainingsvorschlag.",
    async run(t) { await t.open("training"); const sec = await t.section("riderprofile"); const txt = (await sec.innerText()).replace(/\s+/g, " "); return { status: /(Sprinter|Puncheur|Kletterer|Zeitfahrer|Allrounder)/.test(txt) && /Sprint \(5 s\)/.test(txt) && /Antritt \(1 min\)/.test(txt) && /VO2max \(5 min\)/.test(txt) && /\d+ Punkte/.test(txt) && /typisch/.test(txt) && /Trainingsvorschlag/.test(txt) ? "ok" : "fail", observed: `„${txt.slice(0, 380)}“`, locator: sec }; } },
  { action: "Typ zum Gefühl, Watt und W/kg ungefähr richtig?", expected: "Plausibel; ohne echten Maximalsprint wirkt der Sprint schwächer.",
    async run(t) { const r = await t.tool("get_rider_profile"); const txt = (await t.page.locator("#sec-riderprofile").innerText()).replace(/\s+/g, " "); return { status: "device", observed: `Angezeigte Watt-Werte stammen aus der Leistungskurve (5 s ${JSON.stringify(r).match(/"w(?:atts)?":\d+/)?.[0] ?? ""}); ob der Typ zu dir passt, nur mit echten Fahrten.`, noFinalShot: true }; } },
  { action: "Am Handy lesbar, nicht seitlich scrollen.", expected: "Lesbar, kein seitliches Scrollen.",
    async run(t) { await t.page.setViewportSize({ width: 390, height: 844 }); await t.open("training"); const sec = await t.section("riderprofile"); const o = await overflow(t); return { status: o <= 1 ? "look" : "fail", observed: `Überlauf bei 390 px: ${o}px (Emulation). Lesbarkeit: bitte selbst ansehen.`, locator: sec }; } },
]);
