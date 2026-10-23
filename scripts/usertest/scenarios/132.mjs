import { scenario, deviceStep, D } from "./_auto.mjs";
export default scenario(132, "Tagesempfehlung berücksichtigt den HRV-Trend", "Tagesempfehlung und HRV-Trend", [
  { action: "Unter den Gründen der Tagesempfehlung die Zeile „HRV-Trend: …“ ansehen.", expected: "Zeile „HRV-Trend: …“ (Stand Test: „Unter deinem Normalbereich“).",
    async run(t) { await t.open("heute"); const sec = await t.section("today"); const txt = (await sec.innerText()).replace(/\s+/g, " "); const h = await t.tool("get_hrv_trend"); return { status: new RegExp(`HRV-Trend: ${h.label}`).test(txt) ? "ok" : "fail", observed: `Zeile: „HRV-Trend: ${h.label}“ (aktueller Stand der Testdaten ist „${h.label}“, nicht „Unter deinem Normalbereich“ wie am 17.10.)`, locator: sec }; } },
  { action: "Bei „Ermüdung“ oder „Sättigung“: höchstens „Locker trainieren“.", expected: "Empfehlung gedeckelt.",
    async run(t) { return { status: "device", observed: "Mit den Testdaten steht der HRV-Trend auf „Über Normalbereich“ – der Deckel greift nur bei Ermüdung/Sättigung. Die Regel ist durch Unit-Tests belegt (worker/test/hrv-cap.test.ts); Gegenprobe im Alltag nur mit echter HRV-Lage.", noFinalShot: true }; } },
  { action: "Bei „unter dem Normalbereich“: höchstens „Normales Training“.", expected: "Empfehlung gedeckelt.",
    async run(t) { return { status: "device", observed: "Siehe Schritt 2: braucht echte HRV-Lage „unter Normalbereich“.", noFinalShot: true }; } },
  deviceStep(4, "Passt die Einschätzung zum Gefühl?", "Passt.", D.feel),
]);
