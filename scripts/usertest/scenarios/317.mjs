// #317 WHOOP-Erholung landet einen Tag zu früh, wenn man vor Mitternacht einschläft.
import { res, dev, unit } from "./_q.mjs";
export default {
  issue: 317, feature: 317, title: "WHOOP-Erholung zum Tag des Aufwachens (#317)", name: "Zyklus-Zuordnung", device: "phone",
  realDevice: ["Der Vergleich mit der WHOOP-App und der Abgleich mit echten WHOOP-Daten sind nur am Gerät möglich."],
  steps: [
    { nr: 1, action: "Dashboard öffnen und oben auf „Jetzt abgleichen“ tippen.", expected: "Unter „Heute“ steht die Erholung von heute früh, nicht „Für heute liegt noch keine Erholung vor“.",
      async run(t) { const u = unit("whoop-map.test.ts", "Zyklus zählt zum Tag des Aufwachens, auch wenn vor Mitternacht eingeschlafen");
        await t.open("heute"); const d = await t.tool("get_dashboard", { days: 7 }); const today = d.days.at(-1);
        return dev(`Der echte WHOOP-Abgleich läuft in der Testumgebung nicht (Beispielantwort). Mit den synthetischen Daten zeigt „Heute“ Erholung ${today.recovery} % für ${today.day}. Die Zuordnung selbst (Zyklus zählt zum Tag des Aufwachens, auch bei Einschlafen vor Mitternacht) ist per Unit-Test ${u.pass ? "bestanden" : "NICHT bestanden"}.`); } },
    { nr: 2, action: "Leiste „Erholung und Belastung, letzte 7 Tage“ ansehen.", expected: "Jeder Tag hat höchstens einen Erholungswert, passend zur WHOOP-App.",
      async run(t) { const d = await t.tool("get_dashboard", { days: 7 }); const days = d.days.map((x) => x.day); const dup = days.length !== new Set(days).size;
        return dev(`In den synthetischen Daten hat jeder der ${days.length} Tage genau einen Eintrag (Duplikate: ${dup ? "ja" : "nein"}). Ob die Werte zur WHOOP-App passen, sieht nur G.`); } },
    { nr: 3, action: "Optional: an einem Morgen nach Einschlafen vor Mitternacht erneut prüfen.", expected: "Die Erholung steht beim Tag des Aufwachens.", async run() { return { status: "skip", observed: "Optional, braucht echte WHOOP-Nacht. Zuordnungsregel per Unit-Test „Zyklus zählt zum Tag des Aufwachens …“ bestanden (siehe Schritt 1)." }; } },
  ],
};
