import { scenario, sectionStep, deviceStep, D } from "./_auto.mjs";
export default scenario(20, "Schlaf-Detail", "Schlaf im Detail", [
  sectionStep({ nr: 1, action: "Tab „Verlauf“: Kennzahlen oben (Ø Schlaf, Einschlafen, Aufwachen, Schlafschuld, Tief/REM, Wochenende).", expected: "Werte passen ungefähr zur WHOOP-App.", tab: "verlauf", id: "sleep", has: [/Ø SCHLAF/i, /EINSCHLAFEN/i, /AUFWACHEN/i, /SCHLAFSCHULD/i, /TIEF/i, /WOCHENENDE/i] }),
  { action: "Diagramm „Schlafphasen je Nacht“ ansehen, eine Nacht antippen.", expected: "Tief/REM/Leicht je Nacht; Antippen zeigt Einschlaf- und Aufwachzeit.",
    async run(t) { await t.open("verlauf"); const sec = await t.section("sleep"); const bars = sec.locator("svg rect, svg path, [data-day]"); const n = await bars.count(); const box = await sec.locator("svg").first().boundingBox(); await t.page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5); await t.page.waitForTimeout(500); const txt = (await sec.innerText()).replace(/\s+/g, " "); return { status: n > 20 && /\d{2}:\d{2}/.test(txt) ? "ok" : "fail", observed: `${n} Diagrammelemente; Text nach Tippen enthält Uhrzeiten: ${/\d{2}:\d{2}/.test(txt)}`, locator: sec }; } },
  sectionStep({ nr: 3, action: "Diagramm „Schlafschuld (7 Nächte)“.", expected: "Wirkt plausibel, steigt nach kurzen Nächten.", tab: "verlauf", id: "sleep", has: [/Schlafschuld/i] }),
  sectionStep({ nr: 4, action: "Tipps lesen.", expected: "Verständlich; „Ins Bett gegen“ als Schätzung gekennzeichnet.", tab: "verlauf", id: "sleep", has: [/INS BETT GEGEN/i, /Schätzung/i] }),
  deviceStep(5, "Plausibilität gegen WHOOP-App.", "Werte plausibel.", D.whoop),
]);
