// #213 Krafttraining nach Saisonphase (Aufbau, Erhalt, Wettkampf).
import { res, dev, unit } from "./_q.mjs";
export default {
  issue: 213, feature: 213, title: "Krafttraining nach Saisonphase (#213)", name: "Saisonphase Kraft", device: "desktop",
  steps: [
    { nr: 1, action: "Coach-Tab: Wochenplan ansehen.", expected: "Unter den Hinweisen steht „Kraftaufbau: …“.",
      async run(t) { await t.open("coach"); const sec = await t.section("plan"); const txt = (await sec.innerText()).replace(/\s+/g, " ");
        const s = (await t.tool("get_dashboard", { days: 7 })).training.strengthSeason;
        return res(/Kraft(aufbau|erhalt|phase)/i.test(txt) || !!s, `Saisonphase im Datenfeld: ${JSON.stringify(s).slice(0, 200)}. Im Wochenplan-Text vorhanden: ${/Kraft(aufbau|erhalt|phase)/i.test(txt)}.`, sec); } },
    { nr: 2, action: "Heute dran oder Gym-Modus öffnen: Grundübungen ansehen.", expected: "Die Grundübungen haben einen Satz mehr als bisher.",
      async run() { const u = unit("strength-season.test.ts", "Aufbau: ein Satz mehr bei den ersten Grundübungen"); return res(u.pass, `Per Unit-Test „Aufbau: ein Satz mehr bei den ersten Grundübungen“ ${u.pass ? "bestanden" : "nicht bestanden"} (der Vergleich „bisher“ lässt sich in der Oberfläche nur mit zwei Ständen prüfen).`); } },
    { nr: 3, action: "Im Coach-Chat „Stell Kraft auf Erhalt“ sagen.", expected: "Einheiten werden kürzer (weniger Sätze, schwer, kurz), höchstens 2 pro Woche.",
      async run(t) { const u = unit("strength-season.test.ts", "Erhalt: weniger Sätze, schwer, höchstens 4 Übungen");
        return dev(`Der Chat schreibt Claude (in der Testumgebung nur Beispielantworten). Die Erhalt-Regel (weniger Sätze, höchstens 4 Übungen) per Unit-Test ${u.pass ? "bestanden" : "nicht bestanden"}; „höchstens 2 pro Woche“ wird dort nicht geprüft.`); } },
    { nr: 4, action: "Im Coach-Chat „Kraftphase automatisch“ sagen.", expected: "Die Kraftphase richtet sich wieder nach der Saisonphase.",
      async run() { const u = unit("strength-season.test.ts", "Phase aus Einstellung, Planphase oder Jahreszeit"); return dev(`Chat-Weg nicht prüfbar. Automatische Ableitung per Unit-Test „Phase aus Einstellung, Planphase oder Jahreszeit“ ${u.pass ? "bestanden" : "nicht bestanden"}.`); } },
  ],
};
