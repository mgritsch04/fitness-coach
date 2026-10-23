import { scenario, seedFits, deviceStep, overflow, D } from "./_auto.mjs";
export default scenario(155, "Intervall-Qualität", "Intervall-Qualität", [
  { action: "Intervalltraining mit ≥ 3 gleichen harten Wiederholungen als FIT hochladen.", expected: "Hochgeladen.",
    async run(t) { await seedFits(t); return { status: "ok", observed: "Synthetisches Intervalltraining (5 × 4 min bei ~260 W, je 2 min locker) importiert", noFinalShot: true }; } },
  { action: "Tab „Training“ › „Intervall-Qualität“.", expected: "Letzte Intervalltrainings mit Serie (z. B. 5 × 4 min), Leistung je Wiederholung als Balken, Ø-Leistung mit % FTP, Abfall; Übersicht je Intervallart.",
    async run(t) { await t.open("training"); const sec = await t.section("intervals"); const txt = (await sec.innerText()).replace(/\s+/g, " "); return { status: /5 × [34]/.test(txt) && /% FTP|%/.test(txt) && !/Noch keine Intervalltrainings/.test(txt) && /JE INTERVALLART|Je Intervallart/i.test(txt) && (await sec.locator(".iq-bars span").count()) >= 5 ? "ok" : "fail", observed: `Abschnitt: „${txt.slice(0, 380)}“`, locator: sec }; } },
  { action: "Erkannte Serie mit dem Training vergleichen.", expected: "Serie und Werte passen, Abfall plausibel.",
    async run(t) { const txt = (await t.page.locator("#sec-intervals").innerText()).replace(/\s+/g, " "); const m = txt.match(/(\d+) × (\d+) min/); return { status: m && m[1] === "5" && Number(m[2]) >= 3 ? "ok" : "fail", observed: `Erkannt: ${m?.[0]} (hochgeladen: 5 × 4 min, bei 4 min darf die Erkennung ein paar Sekunden kürzer sein)`, locator: t.page.locator("#sec-intervals") }; } },
  { action: "Am Handy lesbar, nicht seitlich scrollen.", expected: "Lesbar, kein seitliches Scrollen.",
    async run(t) { await t.page.setViewportSize({ width: 390, height: 844 }); await t.open("training"); const sec = await t.section("intervals"); const o = await overflow(t); return { status: o <= 1 ? "look" : "fail", observed: `Überlauf bei 390 px: ${o}px (Emulation). Lesbarkeit: bitte selbst ansehen.`, locator: sec }; } },
]);
