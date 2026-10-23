// #200 eFTP-Verlauf: FTP-Schätzung aus normalen Fahrten über die Zeit.
import { res, dev, look, unit } from "./_q.mjs";
export default {
  issue: 200, feature: 200, title: "eFTP-Verlauf (#200)", name: "FTP-Schätzung im Verlauf", device: "desktop",
  steps: [
    { nr: 1, action: "Verlauf › „FTP-Schätzung im Verlauf“ aufklappen.", expected: "Ohne Fahrten mit Leistung steht ein Hinweis, eine FIT-Datei hochzuladen.",
      async run(t) { const u = unit("eftp.test.ts", "veralteter Bestwert und keine Daten"); await t.open("verlauf"); const sec = await t.section("eftp");
        return res(u.pass && (await sec.isVisible()), `Die Testdaten enthalten Fahrten mit Leistung, daher kein Leer-Hinweis. Fall „keine Daten“ per Unit-Test „veralteter Bestwert und keine Daten“: ${u.pass ? "bestanden" : "nicht bestanden"}.`, sec); } },
    { nr: 2, action: "Mit Fahrten: eFTP, Veränderung über 6 Wochen und die Linie prüfen.", expected: "Die Werte wirken plausibel; die gestrichelte Linie zeigt die eingestellte FTP.",
      async run(t) { const e = await t.tool("get_eftp_trend", {}); const sec = t.page.locator("#sec-eftp");
        return look(`eFTP aktuell ${e.current.eftpW} W (${e.current.low}–${e.current.high} W), Veränderung ${e.change.w >= 0 ? "+" : ""}${e.change.w} W (${e.change.pct} %) über ${e.change.weeks} Wochen, ${e.points.length} Wochenpunkte. In den Testdaten ist keine FTP eingestellt, daher keine gestrichelte Linie. Ob die Werte plausibel wirken, beurteilt G.`, sec); } },
    { nr: 3, action: "Beobachten, ob die Schätzung zwei Wochen lang um mindestens 5 % abweicht.", expected: "Dann erscheint ein Testvorschlag (orange markiert).",
      async run(t) { const u = unit("eftp.test.ts", "steigende Form: Trend nach oben und Testvorschlag");
        return dev(`Braucht echte Fahrten über zwei Wochen. Die Regel (Abweichung → Testvorschlag) ist per Unit-Test „steigende Form: Trend nach oben und Testvorschlag“ ${u.pass ? "bestanden" : "nicht bestanden"}; die orange Markierung beurteilt G am Bild.`); } },
  ],
};
