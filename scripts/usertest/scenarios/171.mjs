import { scenario, seedStrength, overflow, deviceStep, D } from "./_auto.mjs";
export default scenario(171, "Muskelbalance", "Muskelbalance", [
  { action: "Tab „Training“ › „Muskelbalance“ (nach gespeicherten Krafteinheiten).", expected: "Sätze pro Woche je Muskelgruppe (Mittel 4 Wochen) mit grünem Zielbereich, Verhältnisse Ziehen : Drücken und hinten : vorne, Hinweise mit Übungen.",
    async run(t) { await seedStrength(t); await t.open("training"); const sec = await t.section("musclebalance"); const txt = (await sec.innerText()).replace(/\s+/g, " "); return { status: !/Keine Krafteinheit in den letzten 4 Wochen/.test(txt) && /Sätze pro Woche je Muskelgruppe/.test(txt) && /ziehen/i.test(txt) && /drücken/i.test(txt) && /hinten/i.test(txt) && /Zielbereich/i.test(txt) ? "ok" : "fail", observed: `„${txt.slice(0, 420)}“`, locator: sec }; } },
  { action: "Passen Sätze je Muskelgruppe zum Training, Hinweise sinnvoll?", expected: "Plausibel; Hilfsmuskeln zählen halb.",
    async run(t) { const m = await t.tool("get_muscle_balance"); return { status: "device", observed: `Werte kommen aus ${m.sessions ?? "den"} gespeicherten Einheiten (get_muscle_balance antwortet). Ob die Hinweise für dein echtes Training sinnvoll sind: ${D.feel}`, noFinalShot: true }; } },
  { action: "Am Handy lesbar.", expected: "Lesbar, ohne seitliches Scrollen.",
    async run(t) { await t.page.setViewportSize({ width: 390, height: 844 }); await t.open("training"); const sec = await t.section("musclebalance"); const o = await overflow(t); return { status: o <= 1 ? "look" : "fail", observed: `Überlauf bei 390 px: ${o}px (Emulation). Lesbarkeit: bitte selbst ansehen.`, locator: sec }; } },
]);
