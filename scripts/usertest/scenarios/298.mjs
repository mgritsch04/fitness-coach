// #298 Doppeltage: Reihenfolge und Abstand von Kraft und Rad am selben Tag (Heute dran › Agenda).
import { res, dev, unit } from "./_q.mjs";
const para = async (t) => (await t.page.locator("#sec-agenda .ag-both").allInnerTexts()).map((s) => s.replace(/\s+/g, " "));
export default {
  issue: 298, feature: 298, title: "Doppeltage: Reihenfolge und Abstand (#298)", name: "Doppeltage", device: "desktop",
  steps: [
    { nr: 1, action: "Agenda öffnen und einen Tag mit Rad und Kraft wählen.", expected: "Absatz „Doppeltag: …“ oder „Doppeltag, besser trennen: …“ mit Reihenfolge und Abstand.",
      async run(t) { await t.open("heute"); await t.section("agenda"); t.days = [];
        const btns = t.page.locator("#sec-agenda .ag-day");
        for (let i = 0; i < await btns.count(); i++) { await btns.nth(i).click(); await t.page.waitForTimeout(150); const p = await para(t); t.days.push({ i, label: await btns.nth(i).getAttribute("aria-label"), p }); }
        const both = t.days.filter((d) => d.p.length);
        return res(both.length > 0 && both.every((d) => /^Doppeltag/.test(d.p[0])), `Tage mit Doppeltag-Absatz: ${both.map((d) => `${d.label.split(":")[0]}: „${d.p[0]}“`).join(" · ")}`, t.page.locator("#sec-agenda")); } },
    { nr: 2, action: "Optional: Tag mit harter Radeinheit plus Beinen.", expected: "„Doppeltag, besser trennen“: Rad zuerst, etwa 6 h Abstand.",
      async run(t) { const u = unit("same-day.test.ts", "harte Radeinheit zuerst, Beine sind ein Konflikt");
        const hit = t.days.find((d) => /besser trennen/.test(d.p[0] ?? ""));
        return hit ? res(true, `In der Woche vorhanden: „${hit.p[0]}“`, t.page.locator("#sec-agenda")) : res(u.pass, `Diese Woche gibt es in den Testdaten keinen solchen Tag. Regel per Unit-Test „harte Radeinheit zuerst, Beine sind ein Konflikt“: ${u.pass ? "bestanden" : "nicht bestanden"}.`); } },
    { nr: 3, action: "Optional: Tag mit harter Radeinheit plus Oberkörper.", expected: "„Doppeltag“: Rad zuerst, etwa 3 h Abstand.",
      async run(t) { const hit = t.days.find((d) => /Rad zuerst|Lange Fahrt zuerst|Intervalle zuerst/i.test(d.p[0] ?? ""));
        return hit ? res(true, `Beispiel: „${hit.p[0]}“`, t.page.locator("#sec-agenda")) : res(false, "Kein passender Tag gefunden."); } },
    { nr: 4, action: "Optional: Tag mit lockerer Fahrt plus Beinen.", expected: "Kraft zuerst, die lockere Fahrt danach.",
      async run(t) { const hit = t.days.find((d) => /Beinkraft zuerst/.test(d.p[0] ?? ""));
        return hit ? res(true, `Beispiel: „${hit.p[0]}“`, t.page.locator("#sec-agenda")) : res(false, "Kein passender Tag gefunden."); } },
    { nr: 5, action: "Einen Tag nur mit Rad oder nur mit Kraft wählen.", expected: "Kein Doppeltag-Absatz.",
      async run(t) { const single = t.days.filter((d) => !d.p.length);
        return res(single.length > 0, `Tage ohne Absatz: ${single.map((d) => d.label.split(",")[0]).join(" · ")}`, t.page.locator("#sec-agenda")); } },
    { nr: 6, action: "Connector-Werkzeug `get_dashboard` aufrufen.", expected: "`training.sameDay` enthält `days` (order, gapH, conflict, text) und `note`; Texte als Faustregel.",
      async run(t) { const s = (await t.tool("get_dashboard", { days: 7 })).training.sameDay;
        const ok = Array.isArray(s.days) && s.days.length > 0 && s.days.every((d) => "order" in d && "gapH" in d && "conflict" in d && d.text) && /Faustregel/.test(s.note);
        return res(ok, `sameDay: ${s.days.length} Tage, Felder order/gapH/conflict/text vorhanden. Hinweis: „${s.note}“`); } },
  ],
};
