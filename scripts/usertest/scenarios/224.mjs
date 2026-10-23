// #224 Radwetter: Kleidungsempfehlung für die Ausfahrt.
import { res, dev, look, unit } from "./_q.mjs";
export default {
  issue: 224, feature: 224, title: "Kleidungsempfehlung im Radwetter (#224)", name: "Kleidung", device: "phone",
  steps: [
    { nr: 1, action: "Abschnitt „Radwetter“ aufklappen.", expected: "Unter jedem Tag steht „Anziehen: …, gefühlt X °C“ mit kurzer Liste.",
      async run(t) { await t.open("heute"); const w = await t.section("weather"); const txt = (await w.innerText()).replace(/\s+/g, " ");
        const u = unit("clothing.test.ts", "Schichten bei steigender Temperatur, Licht am Abend, Glätte, Hitze");
        return look(`Mit Beispielwetter (kein Netz) steht in der Oberfläche: „${(txt.match(/(Anziehen|Falls du rausfährst):[^.]{0,140}/) ?? ["–"])[0]}“. Die Stufenlogik ist per Unit-Test „Schichten bei steigender Temperatur, Licht am Abend, Glätte, Hitze“ ${u.pass ? "bestanden" : "nicht bestanden"}. Wie es aussieht, beurteilt G.`, w); } },
    { nr: 2, action: "Bei Regen, Dämmerung, Kälte um 0 °C oder Hitze die Hinweise ansehen.", expected: "Zusätzliche Hinweise (Regenjacke, Licht, Glätte, Flaschen).",
      async run() { const u = [unit("clothing.test.ts", "Regen: Jacke an oder einstecken"), unit("clothing.test.ts", "Fahrtwind kühlt deutlich, mehr Wind kühlt mehr")];
        return dev(`Echtes Wetter nötig. Regeln per Unit-Test: Regen-Jacke ${u[0].pass ? "bestanden" : "nicht bestanden"}, Fahrtwind ${u[1].pass ? "bestanden" : "nicht bestanden"}.`); } },
    { nr: 3, action: "Nach einer Ausfahrt prüfen, ob die Empfehlung gepasst hat.", expected: "Ergebnis lässt sich als ok, zu warm oder zu kalt einordnen und kommentieren.", async run() { return dev("Nur nach einer echten Ausfahrt zu beurteilen."); } },
  ],
};
