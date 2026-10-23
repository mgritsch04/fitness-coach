// #210 Diagramme am Handy: Tippen zeigt die Werte (FC.chart).
import { res, dev, look } from "./_q.mjs";
const chartTap = async (t, loc, fx = 0.5) => { await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); await t.page.touchscreen.tap(b.x + b.width * fx, b.y + b.height / 2); await t.page.waitForTimeout(450); };
const out = (t) => t.page.evaluate(() => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" })));
export default {
  issue: 210, feature: 210, title: "Diagramme am Handy: Tippen zeigt die Werte (#210)", name: "Diagramm antippen", device: "phone",
  steps: [
    { nr: 1, action: "Tab „Verlauf“ öffnen und im Diagramm „Erholung“ auf einen Balken tippen.", expected: "Box mit Datum und Wert, gestrichelte Linie markiert den Tag, die Box bleibt nach dem Loslassen stehen.",
      async run(t) { await t.open("verlauf"); await t.section("recovery");
        t.svg = t.page.locator("#sec-recovery .chart svg").first(); await t.svg.scrollIntoViewIfNeeded();
        t.tip = t.page.locator("#sec-recovery .chart .tip").first();
        await chartTap(t, t.svg);
        const vis = await t.tip.isVisible(), txt = (await t.tip.innerText()).replace(/\s+/g, " ");
        await t.page.waitForTimeout(800);
        const still = await t.tip.isVisible();
        const xh = await t.svg.locator("line[visibility=visible]").count();
        return res(vis && still && xh > 0 && /\d/.test(txt), `Box: „${txt}“, bleibt nach 0,8 s stehen: ${still}, Markierungslinie sichtbar: ${xh > 0}.`, t.page.locator("#sec-recovery")); } },
    { nr: 2, action: "Den Finger waagrecht über das Diagramm ziehen.", expected: "Die Box wandert Tag für Tag mit; senkrechtes Wischen scrollt weiter die Seite.",
      async run(t) { await out(t); await chartTap(t, t.svg, 0.8); const a = await t.tip.locator(".d").textContent();
        await chartTap(t, t.svg, 0.2); const b = await t.tip.locator(".d").textContent();
        return dev(`Echtes Ziehen mit dem Finger lässt sich in der Testumgebung nicht ausführen (nur Tippen). Tippen an zwei Stellen wechselt den Tag: „${a}“ → „${b}“ (${a !== b ? "verschieden" : "GLEICH"}). Ob Ziehen flüssig mitläuft und senkrechtes Wischen weiter scrollt, prüft G am Handy.`); } },
    { nr: 3, action: "Nochmal auf denselben Tag oder neben das Diagramm tippen.", expected: "Die Box verschwindet.",
      async run(t) { await out(t); await chartTap(t, t.svg, 0.3); const shown0 = await t.tip.isVisible();
        await chartTap(t, t.svg, 0.3); const h1 = !(await t.tip.isVisible());
        await chartTap(t, t.svg, 0.6); const shown = await t.tip.isVisible();
        await out(t); const h2 = !(await t.tip.isVisible());
        return res(shown0 && h1 && shown && h2, `Tippen: Box da = ${shown0}. Zweites Tippen auf denselben Tag: Box weg = ${h1}. Anderer Tag: Box da = ${shown}. Tippen neben das Diagramm: Box weg = ${h2}.`, t.page.locator("#sec-recovery")); } },
    { nr: 4, action: "Dasselbe bei den anderen Diagrammen (HRV, Schlaf, Trainingslast).", expected: "Verhalten gilt bei allen Linien- und Balkendiagrammen.",
      async run(t) { const out = [];
        for (const [tab, id] of [["verlauf", "hrvtrend"], ["verlauf", "sleep"], ["verlauf", "load"]]) {
          const sec = await t.section(id); const svg = sec.locator(".chart svg").first(); const tip = sec.locator(".chart .tip").first();
          if (!(await svg.count()) || !(await tip.count())) { out.push(`${id}: kein Diagramm mit Wertebox`); continue; }
          await svg.scrollIntoViewIfNeeded(); await chartTap(t, svg); out.push(`${id}: ${(await tip.isVisible()) ? "Box sichtbar" : "KEINE Box"}`); }
        return res(out.every((s) => /Box sichtbar/.test(s)), out.join(" · "), t.page.locator("#sec-load")); } },
  ],
};
