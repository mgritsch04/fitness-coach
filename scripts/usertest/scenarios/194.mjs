// #194 Wochenplan: ausgefallene Schlüsseleinheit sinnvoll nachholen.
import { res, look, dev, unit } from "./_q.mjs";
export default {
  issue: 194, feature: 194, title: "Ausgefallene Schlüsseleinheit nachholen (#194)", name: "Nachholen", device: "desktop",
  steps: [
    { nr: 1, action: "Dashboard › Training › Wochenplan öffnen und in der Zusammenfassung nachsehen.", expected: "Nach einer ausgefallenen Einheit steht in der Zusammenfassung ein Satz „Nachholen: …“ oder „… nicht nachholen“.",
      async run(t) { await t.open("training"); const sec = await t.section("plan");
        const mk = (await t.tool("get_dashboard", { days: 7 })).training.makeUp;
        const txt = (await sec.innerText()).replace(/\s+/g, " ");
        const u = unit("make-up.test.ts", "holt heute nach, wenn die Tagesform passt");
        if (mk) return res(/nachholen/i.test(txt), `makeUp: „${mk.text}“; im Wochenplan sichtbar: ${/nachholen/i.test(txt) ? "ja" : "nein"}.`, sec);
        return res(u.pass, `In den Testdaten ist keine Schlüsseleinheit ausgefallen (training.makeUp = null), der Plan zeigt dann keinen Nachholen-Satz (Plan-Text enthält „Nachholen“: ${/nachholen/i.test(txt) ? "ja" : "nein"}). Regel per Unit-Test „holt heute nach, wenn die Tagesform passt und die Nachbartage locker sind“: ${u.pass ? "bestanden" : "nicht bestanden"}.`, sec); } },
    { nr: 2, action: "Optional: Falls ein Tag vorgeschlagen ist, darauf tippen.", expected: "Das Detail zeigt „Vorschlag: … nachholen“, der Tag ist mit „Nachholen“ markiert.",
      async run(t) { const u = [unit("make-up.test.ts", "kein Tag direkt nach einem harten Tag oder mit schweren Beinen"), unit("make-up.test.ts", "nur die wichtigste Einheit nachholen")];
        return dev(`In den Testdaten gibt es keinen Vorschlag zum Antippen. Regeln (Abstand zu harten Tagen und Beinen, nur die wichtigste Einheit) per Unit-Test: ${u.map((x) => (x.pass ? "bestanden" : "nicht bestanden")).join(", ")}. Die Anzeige im Detail braucht eine echt ausgefallene Einheit.`); } },
    { nr: 3, action: "Im Coach-Chat fragen: „Soll ich die ausgefallene Einheit nachholen?“", expected: "Die Antwort passt zum Vorschlag.",
      async run(t) { return dev("Die Chat-Antwort schreibt Claude (in der Testumgebung nur Beispielantworten); der Kontext `training.makeUp` ist per Werkzeug abrufbar."); } },
  ],
};
