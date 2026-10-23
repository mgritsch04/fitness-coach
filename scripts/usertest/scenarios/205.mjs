// #205 Schlafziel für heute Nacht (Karte auf „Heute“ ab 18 Uhr).
import { res, dev, unit } from "./_q.mjs";
export default {
  issue: 205, feature: 205, title: "Schlafziel für heute Nacht (#205)", name: "Schlafziel", device: "phone",
  steps: [
    { nr: 1, action: "Abends Dashboard › Heute öffnen und die Karte „Schlafziel heute Nacht“ ansehen.", expected: "Dauer, Uhrzeit und Aufschlüsselung (Grundbedarf, Zuschläge für Belastung, Schlafschuld, harte Einheit morgen).",
      async run(t) { const d = new Date(); d.setHours(19, 30, 0, 0); await t.context.clock.install({ time: d });
        await t.open("heute"); const sec = await t.section("sleeptarget");
        const txt = (await sec.innerText()).replace(/\s+/g, " "); const tool = await t.tool("get_sleep_target", {});
        const parts = tool.parts.map((p) => p.label).join(", ");
        return res(sec && (await sec.isVisible()) && /\d h/.test(txt) && /Licht aus bis \d/.test(txt), `Uhr auf 19:30 gestellt. Karte: „${txt.slice(0, 260)}“. Werkzeug: ${tool.targetText}, Aufschlüsselung: ${parts}.`, sec); } },
    { nr: 2, action: "Prüfen, ob die übliche Aufstehzeit stimmt.", expected: "Wochenende und Wochentage werden getrennt gerechnet.",
      async run() { const u = unit("sleep-need.test.ts", "Wochenende: Aufwachzeit aus Wochenend-Nächten");
        return dev(`Ob die errechnete Aufstehzeit zu deinem Alltag passt, kann nur G sagen. Die getrennte Rechnung Wochenende/Wochentag ist per Unit-Test „Wochenende: Aufwachzeit aus Wochenend-Nächten“ ${u.pass ? "bestanden" : "nicht bestanden"}.`); } },
    { nr: 3, action: "Im Coach-Chat fragen: „Wann sollte ich heute ins Bett?“", expected: "Der Coach kennt das Schlafziel.",
      async run() { return dev("Die Chat-Antwort schreibt Claude (in der Testumgebung nur Beispielantworten). Das Schlafziel steht im Kontext von get_dashboard."); } },
  ],
};
