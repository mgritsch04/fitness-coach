// #209 Konstanz und Serien: Wochen mit erreichtem Trainingsziel.
import { res, dev, unit } from "./_q.mjs";
export default {
  issue: 209, feature: 209, title: "Konstanz und Serien (#209)", name: "Konstanz", device: "desktop",
  steps: [
    { nr: 1, action: "Coach-Tab öffnen und die Karte „Konstanz und Serien“ suchen.", expected: "Die Karte ist vorhanden.",
      async run(t) { await t.open("coach"); const sec = await t.section("consistency"); const tiles = await sec.locator(".cs-week, .cs-w, [class*=week]").count();
        return res(await sec.isVisible(), `Karte „Konstanz und Serien“ sichtbar. Inhalt: „${(await sec.innerText()).replace(/\s+/g, " ").slice(0, 160)}…“`, sec); } },
    { nr: 2, action: "Prüfen, ob das Wochenziel stimmt.", expected: "Das Wochenziel ist aus den letzten Wochen geschätzt und stimmt mit der eigenen Planung überein.",
      async run(t) { const c = await t.tool("get_consistency", {}); t.c0 = c; const u = unit("consistency.test.ts", "schätzt das Ziel aus den letzten Wochen und kennzeichnet es");
        return dev(`Angezeigtes Ziel: ${c.target.strength}× Kraft + ${c.target.rides}× Rad (Quelle: ${c.target.strengthSource}/${c.target.ridesSource}). Ob das zur eigenen Planung passt, weiß nur G. Schätzung und Kennzeichnung per Unit-Test: ${u.pass ? "bestanden" : "nicht bestanden"}.`); } },
    { nr: 3, action: "Optional: Falls das Ziel nicht stimmt, dem Coach das Wochenziel sagen.", expected: "Das Ziel wird übernommen (strengthPerWeek / ridesPerWeek).",
      async run(t) { await t.tool("set_training_prefs", { strengthPerWeek: 3, ridesPerWeek: 5 });
        const c = await t.tool("get_consistency", {});
        return res(c.target.strength === 3 && c.target.rides === 5, `Nach set_training_prefs {strengthPerWeek:3, ridesPerWeek:5}: Ziel ${c.target.strength}× Kraft + ${c.target.rides}× Rad (Quelle ${c.target.strengthSource}). Der Chat-Weg schreibt Claude; hier das Werkzeug dahinter.`); } },
    { nr: 4, action: "Die 12 Wochenkacheln (grün = erreicht) und die Serie ansehen.", expected: "Sie passen zum eigenen Gefühl.",
      async run(t) { await t.open("coach"); const sec = await t.section("consistency"); const c = t.c0;
        return { status: "look", observed: `(Stand vor dem Ändern des Ziels in Schritt 3) ${c.weeks.length} Wochenkacheln, Serie ${c.streak}, beste Serie ${c.bestStreak}, ${c.ratePct} % der Wochen erreicht. Ob das zum eigenen Gefühl passt, beurteilt G.`, locator: sec }; } },
  ],
};
