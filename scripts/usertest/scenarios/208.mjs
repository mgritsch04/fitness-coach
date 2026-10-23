// #208 W′-Bilanz im Workout-Detail / Intervall-Qualität.
import { res, dev, unit } from "./_q.mjs";
export default {
  issue: 208, feature: 208, title: "W′-Bilanz (#208)", name: "W′-Bilanz", device: "desktop",
  steps: [
    { nr: 1, action: "Training › „Intervall-Qualität“: in „Letzte Intervalltrainings“ unter der Durchschnittsleistung „W′ min … %“ ansehen.", expected: "W′ min steht in der Tabelle.",
      async run(t) { const iq = await t.tool("get_interval_quality", {}); const u = unit("wbal.test.ts", "Intervall-Qualität zeigt den tiefsten W′-Stand");
        await t.open("training"); const sec = await t.section("intervals");
        return u.pass && iq.sessions.length === 0 ? { status: "device", observed: `In den Testdaten erkennt die Auswertung keine Intervallfahrt (Sessions: 0). Der Eintrag „W′ min“ ist per Unit-Test „Intervall-Qualität zeigt den tiefsten W′-Stand“ ${u.pass ? "bestanden" : "nicht bestanden"}; die Anzeige braucht eine echte Intervall-FIT-Datei.`, locator: sec } : res(/W′ min/.test(await sec.innerText()), "W′ min in der Tabelle geprüft.", sec); } },
    { nr: 2, action: "Prüfen, ob sich die Einheit am Limit angefühlt hat.", expected: "Am Limit niedrig (unter ca. 20 %), lockere/Schwellen-Einheiten hoch (über 70 %).",
      async run() { const u = unit("wbal.test.ts", "handgerechnetes Beispiel"); return dev(`Gefühl nur am echten Training. Modell gegen handgerechnetes Beispiel per Unit-Test: ${u.pass ? "bestanden" : "nicht bestanden"}.`); } },
    { nr: 3, action: "Optional: Im Coach-Chat nach dem W′-Wert fragen.", expected: "Die Antwort nennt den W′-Wert der letzten Fahrt.",
      async run() { return dev("Die Chat-Antwort schreibt Claude (in der Testumgebung nur Beispielantworten)."); } },
  ],
};
