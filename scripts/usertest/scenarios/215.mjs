// #215 Leistungskurve: Zeitraum gegen Zeitraum vergleichen (Training › Fahrertyp › „Leistungskurve im Vergleich“).
import { unit } from "./_unit.mjs";
export default {
  issue: 215,
  feature: 215,
  title: "Leistungskurve im Zeitraumvergleich (#215)",
  name: "Leistungskurve vergleichen",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Reiter „Training“, Abschnitt „Fahrertyp“ aufklappen.",
      expected: "Unter dem Trainingsvorschlag steht „Leistungskurve im Vergleich“ mit den Knöpfen „vorige 90 Tage“ und „Vorjahr“.",
      async run(t) {
        await t.open("training");
        await t.section("riderprofile");
        const head = (await t.text("#rpCmpBox h3")).trim(), btns = await t.page.locator("#rpCmpMode button").allInnerTexts();
        const below = await t.page.evaluate(() => { const a = document.querySelector("#rpFocus,#rpHints"), b = document.querySelector("#rpCmpBox"); return !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); });
        return { status: /Leistungskurve im Vergleich/.test(head) && btns.join("|") === "vorige 90 Tage|Vorjahr" && below ? "ok" : "fail", observed: `Überschrift „${head}“, Knöpfe: ${btns.join(", ")}; steht unter dem Trainingsvorschlag: ${below}.`, locator: t.page.locator("#rpCmpBox") };
      },
    },
    {
      nr: 2,
      action: "Den Block ansehen, solange keine FIT-Datei mit Leistung hochgeladen ist.",
      expected: "„Im aktuellen Zeitraum gibt es noch keine Fahrt mit Leistung.“ Das ist richtig.",
      async run(t) {
        const u = unit("power-compare.test.ts", "ohne Daten");
        return { status: u.pass ? "ok" : "fail", observed: `Die Testdaten enthalten bereits MyWhoosh-Fahrten mit Leistung, der Leerzustand ist in der Oberfläche nicht herstellbar. Belegt über den Unit-Test „ohne Daten“ (Hinweis „…noch keine Fahrt mit Leistung“): ${u.pass ? "bestanden" : "nicht bestanden"} (${u.line}).` };
      },
    },
    {
      nr: 3,
      action: "Nach dem Hochladen einiger MyWhoosh-Fahrten die Tabelle prüfen.",
      expected: "Die Tabelle zeigt Dauer, jetzt, davor und die Änderung in W und %. Grün = mindestens 3 % besser, rot = mindestens 3 % schlechter.",
      async run(t) {
        await t.page.waitForTimeout(1500);
        const vis = await t.page.locator("#rpCmpTab").isVisible();
        const ths = (await t.page.locator("#rpCmpTab th").allInnerTexts()).map((x) => x[0] + x.slice(1).toLowerCase());
        const cells = await t.page.locator("#rpCmpTab tbody tr td:last-child").evaluateAll((cs) => cs.map((c) => ({ pct: Number((c.innerText.match(/\(([+\-−]?[\d,]+) %\)/) ?? [])[1]?.replace("−", "-").replace(",", ".")), cls: c.className })));
        const colorOk = cells.every((c) => (c.pct >= 3 ? c.cls === "rp-up" : c.pct <= -3 ? c.cls === "rp-down" : !/rp-(up|down)/.test(c.cls)));
        const rows = await t.page.locator("#rpCmpTab tbody tr").evaluateAll((rs) => rs.map((r) => [...r.children].map((c) => c.innerText.trim()).join(" / ")));
        const ok = vis && ths.join("|").toLowerCase().startsWith("dauer|jetzt|davor") && /Änderung/.test(ths.join()) && rows.length >= 3 && rows.some((r) => /%/.test(r) && /W/.test(r)) && colorOk;
        return { status: ok ? "ok" : "fail", observed: `Spalten: ${ths.join(", ")}. ${rows.length} Zeilen, Farbregel (grün ab +3 %, rot ab −3 %) eingehalten: ${colorOk}; z. B. ${rows.slice(0, 3).join(" | ")}.`, locator: t.page.locator("#rpCmpBox") };
      },
    },
    {
      nr: 4,
      action: "Auf „Vorjahr“ tippen.",
      expected: "Der Vergleich wechselt auf dieselbe Zeit im Vorjahr.",
      async run(t) {
        await t.page.locator("#rpCmpMode button[data-m=year], #rpCmpMode button:has-text('Vorjahr')").first().click();
        await t.page.waitForTimeout(1500);
        const ref = (await t.text("#rpCmpRef")).trim(), hints = (await t.text("#rpCmpHints")).replace(/\s+/g, " ");
        const pressed = await t.page.locator("#rpCmpMode button[aria-pressed=true]").innerText();
        return { status: /Vorjahr/.test(pressed) && (/Vorjahr/i.test(ref) || /Vorjahr/i.test(hints)) ? "ok" : "fail", observed: `Aktiv: ${pressed}. Spaltenkopf „${ref}“. Hinweise: ${hints.slice(0, 220)}`, locator: t.page.locator("#rpCmpBox") };
      },
    },
  ],
};
