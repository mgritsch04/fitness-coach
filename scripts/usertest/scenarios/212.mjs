// #212 Datenstand je Quelle sichtbar machen.
import { res, dev, unit } from "./_q.mjs";
export default {
  issue: 212, feature: 212, title: "Datenstand je Quelle (#212)", name: "Datenstand", device: "phone",
  steps: [
    { nr: 1, action: "Dashboard öffnen und unter dem Datum den Punkt mit Text je Quelle ansehen.", expected: "Grün = aktuell, orange mit dem Wort „veraltet“ = alt.",
      async run(t) { await t.open("heute"); const f = t.page.locator("#fresh"); await f.waitFor({ state: "visible", timeout: 8000 });
        const txt = (await f.innerText()).replace(/\s+/g, " "); const items = await f.locator("button").allInnerTexts();
        const u = unit("freshness.test.ts", "WHOOP seit zwei Tagen nicht abgeglichen: veraltet, mit Hinweis");
        return res(items.length >= 2 && /vor/.test(txt) && u.pass, `Kopfzeile: „${txt}“ (${items.length} Quellen). Regel „veraltet“ (WHOOP 2 Tage) per Unit-Test: ${u.pass ? "bestanden" : "nicht bestanden"}.`, f); } },
    { nr: 2, action: "Auf die Quellen-Angabe in der Kopfzeile tippen.", expected: "Es springt zu „Datenquellen“ (Tab „Mehr“).",
      async run(t) { await t.page.locator("#fresh button").first().click(); await t.page.waitForTimeout(700);
        const vis = await t.page.locator("#sec-sources").isVisible(); const inView = await t.page.locator("#sec-sources").evaluate((e) => { const r = e.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
        return res(vis && inView, `„Datenquellen“ sichtbar und im Bild: ${vis && inView}.`, t.page.locator("#sec-sources")); } },
    { nr: 3, action: "Prüfen, ob die Zeit ungefähr zu deinem letzten WHOOP-Abgleich bzw. FIT-Upload passt.", expected: "Die Zeit stimmt ungefähr überein.",
      async run(t) { return dev(`Vergleich mit dem echten WHOOP-Abgleich nur am Gerät. In den Testdaten steht: „${(await t.text("#fresh")).replace(/\s+/g, " ")}“ und bei den Datenquellen: „${(await t.text("#srcWhoop")).replace(/\s+/g, " ")}“.`); } },
    { nr: 4, action: "Optional: Wenn WHOOP länger als einen Tag nicht abgeglichen wurde, das Morgen-Briefing ansehen.", expected: "Briefing enthält „Achtung: Daten von WHOOP sind nicht aktuell …“.",
      async run() { const u = unit("freshness.test.ts", "WHOOP seit zwei Tagen nicht abgeglichen: veraltet, mit Hinweis"); return u.pass ? { status: "skip", observed: "Optional, in den Testdaten sind die Daten frisch. Briefing-Hinweis per Unit-Test „WHOOP seit zwei Tagen nicht abgeglichen: veraltet, mit Hinweis“ bestanden." } : res(false, "Unit-Test nicht bestanden."); } },
  ],
};
