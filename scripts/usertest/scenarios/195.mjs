// #195 Erholungskurve: wie viele Tage du nach harten Tagen brauchst (Verlauf › Erholung nach harten Tagen).
import { unit } from "./_unit.mjs";
export default {
  issue: 195,
  feature: 195,
  title: "Erholungskurve nach harten Tagen (#195)",
  name: "Erholung nach harten Tagen",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Tab „Verlauf“, Abschnitt „Erholung nach harten Tagen“ aufklappen.",
      expected: "Oben stehen 1–2 Hinweise („etwa N Tage bis deine Erholung wieder normal ist“). Darunter eine Tabelle mit „harter Tag“, „+1 (Morgen danach)“, „+2“ … und Spalten Erholung / HRV / Ruhepuls.",
      async run(t) {
        await t.open("verlauf");
        await t.section("recoverycurve");
        await t.page.locator("#rcTab tr").first().waitFor({ timeout: 15_000 });
        const hints = await t.page.locator("#rcHints li").allInnerTexts();
        const ths = (await t.page.locator("#sec-recoverycurve thead th").allInnerTexts()).map((x) => x.toLowerCase());
        const rows = await t.page.locator("#rcTab tr").evaluateAll((rs) => rs.map((r) => r.children[0].innerText.replace(/\s+/g, " ").trim()));
        const ok = hints.length >= 1 && hints.length <= 2 && ths.join("|") === "tag|erholung|hrv|ruhepuls" && /harter Tag/i.test(rows[0]) && rows.some((r) => /\+1/.test(r)) && rows.some((r) => /\+2/.test(r));
        return { status: ok ? "ok" : "fail", observed: `Hinweise: ${hints.map((h) => `„${h}“`).join(" · ")}. Spalten: ${ths.join(", ")}. Zeilen: ${rows.join(" | ")}.`, locator: t.page.locator("#sec-recoverycurve") };
      },
    },
    {
      nr: 2,
      action: "Die Zahlen mit deinem Gefühl vergleichen.",
      expected: "Die Zahlen passen zu deinem Gefühl und wirken plausibel.",
      async run(t) {
        const cells = await t.page.locator("#rcTab tr").evaluateAll((rs) => rs.slice(0, 3).map((r) => [...r.children].map((c) => c.innerText.trim()).join(" / ")));
        return { status: "look", observed: `Zahlen (synthetische Daten): ${cells.join(" | ")}. Ob sie zu deinem Gefühl passen, kannst nur du mit echten Daten beurteilen.`, locator: t.page.locator("#sec-recoverycurve") };
      },
    },
    {
      nr: 3,
      action: "Bei zu wenigen harten Tagen prüfen, ob stattdessen eine kurze Erklärung steht, ab wann es eine Kurve gibt.",
      expected: "Eine kurze Erklärung, ab wann es eine Kurve gibt; das ist in Ordnung.",
      async run(t) {
        const u = unit("recovery-curve.test.ts", "zu wenige harte Tage");
        return { status: u.pass ? "ok" : "fail", observed: `In den Testdaten gibt es genug harte Tage; der Fall „zu wenige“ ist per Unit-Test „zu wenige harte Tage“ belegt: ${u.pass ? "bestanden" : "nicht bestanden"} (${u.line}).` };
      },
    },
  ],
};
