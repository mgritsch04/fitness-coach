// #208 W′-Bilanz im Workout-Detail / Intervall-Qualität.
import { res, dev, unit } from "./_q.mjs";
export default {
  issue: 208, feature: 208, title: "W′-Bilanz (#208)", name: "W′-Bilanz", device: "desktop",
  steps: [
    { nr: 1, action: "Training › „Intervall-Qualität“: in „Letzte Intervalltrainings“ unter der Durchschnittsleistung „W′ min … %“ ansehen.", expected: "W′ min steht in der Tabelle.",
      async run(t) { const u = unit("wbal.test.ts", "Intervall-Qualität zeigt den tiefsten W′-Stand");
        const today = (await t.tool("get_dashboard", { days: 7 })).today, day = new Date(Date.parse(`${today}T12:00:00Z`) - 3 * 864e5).toISOString().slice(0, 10);
        await t.tool("import_fit", { fileName: "ut-intervals-208.fit", fileBase64: await t.fit({ start: `${day}T16:00:00Z`, shape: "intervals" }) });
        const iq = await t.tool("get_interval_quality", {});
        await t.tool("get_dashboard", { days: 7 });
        await t.open("training"); const sec = await t.section("intervals");
        const txt = (await sec.innerText()).replace(/\s+/g, " ");
        return res(iq.sessions.length > 0 && /W′ min \d+ ?%/.test(txt) && u.pass, `Synthetische Intervall-FIT importiert (${iq.sessions.length} Intervalleinheit(en)); Tabelle zeigt: „${(txt.match(/W′ min[^A-Za-z]{0,12}/) ?? ["–"])[0].trim()}“. Unit-Test „Intervall-Qualität zeigt den tiefsten W′-Stand“: ${u.pass ? "bestanden" : "nicht bestanden"}.`, sec); } },
    { nr: 2, action: "Prüfen, ob sich die Einheit am Limit angefühlt hat.", expected: "Am Limit niedrig (unter ca. 20 %), lockere/Schwellen-Einheiten hoch (über 70 %).",
      async run() { const u = unit("wbal.test.ts", "handgerechnetes Beispiel"); return dev(`Gefühl nur am echten Training. Modell gegen handgerechnetes Beispiel per Unit-Test: ${u.pass ? "bestanden" : "nicht bestanden"}.`); } },
    { nr: 3, action: "Optional: Im Coach-Chat nach dem W′-Wert fragen.", expected: "Die Antwort nennt den W′-Wert der letzten Fahrt.",
      async run() { return dev("Die Chat-Antwort schreibt Claude (in der Testumgebung nur Beispielantworten)."); } },
  ],
};
