import { scenario, deviceStep, D } from "./_auto.mjs";
export default scenario(63, "Rad-Workouts für MyWhoosh exportieren", "Workout für MyWhoosh (.zwo)", [
  { action: "Tag wählen, Einheit „Schwelle“ und Dauer wählen.", expected: "Intervallprofil (% FTP und Watt) angezeigt.",
    async run(t) { await t.open("training"); const sec = await t.section("bikewo"); await sec.locator("#bwType").selectOption({ label: "Schwelle" }); await sec.locator("#bwMin").fill("60"); await sec.locator("#bwMin").dispatchEvent("change"); await t.page.waitForTimeout(1500); const txt = (await sec.locator("#bwOut").innerText()).replace(/\s+/g, " "); return { status: /%/.test(txt) && /W\b/.test(txt) ? "ok" : "fail", observed: `Profil: „${txt.slice(0, 200)}“`, locator: sec }; } },
  { action: "„Als .zwo herunterladen“.", expected: "Datei wird heruntergeladen.",
    async run(t) { const sec = t.page.locator("#sec-bikewo"); await t.page.waitForFunction(() => !document.getElementById("bwGet").disabled, null, { timeout: 8000 }); await sec.locator("#bwGet").click(); const saved = await t.poll(() => t.page.evaluate(() => window.__saved), 6000); return { status: saved && /<workout_file>/.test(saved.text) && /<(SteadyState|IntervalsT|Warmup)/.test(saved.text) ? "ok" : "fail", observed: saved ? `Datei „${saved.filename}“, ${saved.size} Bytes, enthält workout_file und Intervallblöcke` : "Kein Download ausgelöst", locator: sec }; } },
  deviceStep(3, "Auf workout.mywhoosh.com hochladen, „Export to MyWhoosh“.", "Export gelingt.", "Fremdes Portal (MyWhoosh) mit Konto: nicht automatisierbar."),
  deviceStep(4, "In der MyWhoosh-App unter „MyWorkouts“ starten.", "Einheit lässt sich starten.", "MyWhoosh-App: nur am Gerät."),
  deviceStep(5, "Aufbau/Watt vergleichen, Härte beurteilen.", "Stimmt mit dem Dashboard überein; Härte passt.", "Vergleich in der MyWhoosh-App und Härte nach Gefühl: nur der Nutzer."),
]);
