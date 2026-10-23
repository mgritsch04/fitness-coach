import { scenario, seedFits, deviceStep, overflow, D } from "./_auto.mjs";
export default scenario(145, "Aerobe Basis: Entkopplung lockerer Fahrten", "Aerobe Basis", [
  { action: "Ruhige, gleichmäßige Fahrt ab 50 min als FIT hochladen.", expected: "Fahrt hochgeladen.",
    async run(t) { await seedFits(t); const w = await t.tool("get_workouts", { days: 14 }); return { status: w.some((x) => x.duration_s >= 3500 && x.duration_s <= 3700) ? "ok" : "fail", observed: "Gleichmäßige synthetische Fahrt (60 min, 150 W) importiert", noFinalShot: true }; } },
  { action: "Tab „Training“ › „Aerobe Basis“.", expected: "Einordnung, „Aktuell“, „Davor“, „Längste unter 5 %“; Diagramm mit Punkt je Fahrt.",
    async run(t) { await t.open("training"); const sec = await t.section("aerobic"); const txt = (await sec.innerText()).replace(/\s+/g, " "); const a = await t.tool("get_aerobic_decoupling"); return { status: !/Noch keine gleichmäßige Fahrt/.test(txt) && /Aktuell/i.test(txt) && /Längste unter 5/i.test(txt) && (await sec.locator("svg circle").count()) >= 1 ? "ok" : "fail", observed: `Abschnitt: „${txt.slice(0, 300)}“; Punkte im Diagramm: ${await sec.locator("svg circle").count()}`, locator: sec }; } },
  { action: "Am Handy lesbar, nicht seitlich scrollen.", expected: "Lesbar, kein seitliches Scrollen.",
    async run(t) { await t.page.setViewportSize({ width: 390, height: 844 }); await t.open("training"); const sec = await t.section("aerobic"); const o = await overflow(t); return { status: o <= 1 ? "look" : "fail", observed: `Überlauf bei 390 px: ${o}px (Emulation). Lesbarkeit: bitte selbst ansehen.`, locator: sec }; } },
]);
