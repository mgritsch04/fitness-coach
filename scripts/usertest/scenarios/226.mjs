// #226 Auswertung: Training nach der Erholungsampel (Verlauf).
export default {
  issue: 226,
  feature: 226,
  title: "Training nach der Erholungsampel (#226)",
  name: "Erholungsampel-Auswertung",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Tab „Verlauf“, Abschnitt „Training nach der Erholungsampel“ aufklappen.",
      expected: "Oben ein Hinweis, darunter drei Zahlen: Passend, Hart an roten Tagen, Grüne Tage genutzt.",
      async run(t) {
        await t.open("verlauf");
        await t.section("readiness");
        await t.page.locator("#raKpis b").first().waitFor({ timeout: 15_000 });
        const hints = await t.page.locator("#raHints li").allInnerTexts();
        const kpis = await t.page.locator("#raKpis > div").evaluateAll((ds) => ds.map((d) => d.innerText.replace(/\s+/g, " ")));
        const ok = hints.length >= 1 && kpis.length === 3 && /Passend/i.test(kpis[0]) && /Hart an roten Tagen/i.test(kpis[1]) && /Grüne Tage genutzt/i.test(kpis[2]);
        return { status: ok ? "ok" : "fail", observed: `Hinweis: „${hints[0]}“. Zahlen: ${kpis.map((k) => `„${k}“`).join(", ")}.`, locator: t.page.locator("#sec-readiness") };
      },
    },
    {
      nr: 2,
      action: "Tabelle ansehen: Tage je Zone (Grün/Gelb/Rot) und Strain (leicht/moderat/hart).",
      expected: "Die Größenordnungen stimmen mit dem eigenen Gefühl überein.",
      async run(t) {
        const rows = await t.page.locator("#raTab tr").evaluateAll((rs) => rs.map((r) => [...r.children].map((c) => c.innerText.trim()).join(" / ")));
        return { status: "look", observed: `Tabelle (synthetische Daten, 90 Tage): ${rows.join(" | ")}. Ob die Größenordnungen zu deinem Gefühl passen, kannst nur du mit echten Daten beurteilen.`, locator: t.page.locator("#raDetail") };
      },
    },
    {
      nr: 3,
      action: "Streifen „Letzte 14 Tage“ ansehen.",
      expected: "Farbe = Erholung am Morgen, graue Höhe = Strain des Tages.",
      async run(t) {
        const days = await t.page.locator("#raStrip .ra-day").evaluateAll((ds) => ds.map((d) => ({ cls: d.className, title: d.title, h: d.querySelector("span").style.height })));
        const ok = days.length === 14 && days.every((d) => /ra-(green|yellow|red)/.test(d.cls) && /Erholung \d+ %, Strain/.test(d.title) && parseFloat(d.h) >= 0);
        return { status: ok ? "ok" : "fail", observed: `${days.length} Tage; z. B. „${days[0]?.title}“ Klasse ${days[0]?.cls}, graue Höhe ${days[0]?.h}.`, locator: t.page.locator("#raStrip") };
      },
    },
  ],
};
