// #198 Wochenplan: Schlüsseleinheit bei schlechter Tagesform verschieben.
import { res, dev, unit } from "./_q.mjs";
export default {
  issue: 198, feature: 198, title: "Schlüsseleinheit bei schlechter Tagesform verschieben (#198)", name: "Verschieben", device: "desktop",
  steps: [
    { nr: 1, action: "Training › Wochenplan: an einem Tag mit schlechter Erholung und geplanter langer Fahrt die Zusammenfassung ansehen.", expected: "„Heute lieber Ruhe: …“ mit späterem Tag oder Rat, sie ausfallen zu lassen.",
      async run(t) { const u = unit("make-up.test.ts", "verschiebt die heutige lange Fahrt bei schlechter Tagesform auf einen leichten Krafttag");
        await t.open("training"); const sec = await t.section("plan");
        const mk = (await t.tool("get_dashboard", { days: 7 })).training.makeUp;
        return res(u.pass, `Die Testdaten haben heute gute Erholung (kein Ruhetag mit langer Fahrt), makeUp = ${mk ? `„${mk.text}“` : "null"}. Die Regel per Unit-Test „verschiebt die heutige lange Fahrt bei schlechter Tagesform auf einen leichten Krafttag“: ${u.pass ? "bestanden" : "nicht bestanden"}.`, sec); } },
    { nr: 2, action: "Optional: Wenn ein Tag vorgeschlagen ist, auf den Tag tippen.", expected: "Das Detail nennt die verschobene Einheit („Verschoben“).",
      async run() { return dev("Braucht einen echten Ruhetag mit geplanter Schlüsseleinheit; in den Testdaten nicht herstellbar (Erholung fest)."); } },
    { nr: 3, action: "Im Coach-Chat fragen: „Kann ich die lange Fahrt morgen machen?“", expected: "Die Antwort berücksichtigt die Abstandsregel.",
      async run() { return dev("Die Chat-Antwort schreibt Claude (in der Testumgebung nur Beispielantworten)."); } },
  ],
};
