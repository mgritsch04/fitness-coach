// #206 4-Wochen-Blockplanung mit Entlastungswoche.
import { res, dev, look, unit } from "./_q.mjs";
export default {
  issue: 206, feature: 206, title: "4-Wochen-Blockplanung (#206)", name: "Trainingsblock", device: "desktop",
  steps: [
    { nr: 1, action: "Coach-Tab öffnen und den Abschnitt „Trainingsblock“ ansehen.", expected: "Wochen mit Soll/Ist: 3 Aufbauwochen mit steigendem Ziel, 1 Entlastungswoche.",
      async run(t) { await t.open("coach"); const sec = await t.section("block");
        const b = await t.tool("get_training_block", {});
        const w = b.weeks, up = w[1].targetLoad > w[0].targetLoad && w[2].targetLoad > w[1].targetLoad;
        const n = await t.page.locator("#bkWeeks > *").count();
        return res(w.length === 4 && up && w[3].deload && !w[0].deload && n === 4, `4 Wochen, Ziele ${w.map((x) => x.targetLoad).join(" → ")} (Woche 4 Entlastung: ${w[3].deload}). Auf der Seite ${n} Wochenzeilen.`, sec); } },
    { nr: 2, action: "„Block starten“ drücken.", expected: "Block wird gespeichert, der Wochenplan der nächsten Woche nutzt das Blockziel.",
      async run(t) { await t.page.click("#bkSave"); await t.page.waitForTimeout(1200);
        const b = await t.tool("get_training_block", {});
        const u = unit("periodization.test.ts", "Wochenplan übernimmt Blockziel und Entlastung");
        return res(b.saved === true && u.pass, `Block gespeichert: ${b.saved}. Meldung: „${(await t.text("#bkMsg")).trim()}“. Übernahme ins Wochenplan-Ziel per Unit-Test „Wochenplan übernimmt Blockziel und Entlastung“: ${u.pass ? "bestanden" : "nicht bestanden"}.`, t.page.locator("#sec-block")); } },
    { nr: 3, action: "Prüfen, ob die Entlastung bei den aktuellen Werten vorgezogen steht.", expected: "Bei Warnzeichen wird die Entlastung vorgezogen; bei zu wenig geschafft wird das Ziel gehalten.",
      async run(t) { const u = unit("periodization.test.ts", "Warnzeichen ziehen die Entlastung vor"); const v = unit("periodization.test.ts", "Soll/Ist: zu wenig geschafft");
        return { status: "device", observed: `Ob heute Warnzeichen anliegen und die Entlastung vorzieht, ist eine Frage an die echten Werte. Regeln per Unit-Test: Warnzeichen ziehen Entlastung vor ${u.pass ? "bestanden" : "nicht bestanden"}, zu wenig geschafft hält Ziel ${v.pass ? "bestanden" : "nicht bestanden"}.` }; } },
    { nr: 4, action: "Im Coach-Chat fragen: „Wie sieht mein Block aus?“", expected: "Die Antwort passt zum Abschnitt.",
      async run() { return dev("Die Chat-Antwort schreibt Claude (in der Testumgebung nur Beispielantworten)."); } },
  ],
};
