// #324 Ruhetag: Empfehlung, ob locker ausfahren mit dem Rad sinnvoll ist.
// Synthetisch: Der Tag wird über den Check-in (Tagebuch) zum Ruhetag gemacht. Die Erholung selbst lässt sich in den Testdaten nicht ändern.
import { execSync } from "node:child_process";

const dash = async (t) => (await t.tool("get_dashboard", { days: 7 })).coach;

export default {
  issue: 324,
  feature: 324,
  title: "Ruhetag: locker ausfahren ja oder nein (#324)",
  name: "Ruhetag und lockeres Ausfahren",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Im Reiter „Heute“ die Tagesempfehlung ansehen (Ruhetag über den Check-in: Gefühl, Energie, Motivation schlecht, Stress hoch).",
      expected: "Unter dem Ruhe-Hinweis steht „Locker ausfahren: ja.“ oder „Locker ausfahren: heute nicht.“ mit Begründung und Hinweis, dass es eine Faustregel ist.",
      async run(t) {
        await t.tool("save_journal", { feeling: 1, energy: 1, motivation: 1, stress: 5, soreness: 1, tags: [] });
        const c = await dash(t);
        await t.open("heute");
        const txt = (await t.text("#readyRide")).replace(/\s+/g, " ");
        const vis = await t.page.locator("#readyRide").isVisible();
        t.step1 = txt;
        const ok = c.readiness === "rest" && vis && /^Locker ausfahren: (ja|heute nicht)\./.test(txt) && /Faustregel/.test(txt);
        return { status: ok ? "ok" : "fail", observed: `Empfehlung heute: ${c.readiness}. Text: „${txt}“.`, locator: t.page.locator("#readyRide") };
      },
    },
    {
      nr: 2,
      action: "Werte so ändern, dass die Erholung gut ist und Schlaf und Ruhepuls unauffällig sind.",
      expected: "„ja“ mit 30–45 min Zone 1.",
      async run(t) {
        if (/30–45 min/.test(t.step1 ?? "") && /Die Werte sprechen nicht dagegen/.test(t.step1)) return { status: "ok", observed: `Bei gutem Schlaf, unauffälligem Ruhepuls und normaler Belastung zeigt die Oberfläche bereits: „${t.step1.slice(0, 160)}…“ (30–45 min Zone 1).`, locator: t.page.locator("#readyRide") };
        // In den Cloud-Testdaten ist die Belastung der letzten 3 Tage hoch und die Erholung nicht änderbar; die Regel wird deshalb über den Unit-Test geprüft.
        let out = "";
        try { out = execSync("npx vitest run test/rest-ride.test.ts --reporter=verbose 2>&1", { cwd: new URL("../../../worker", import.meta.url).pathname, encoding: "utf8" }); } catch (e) { out = String(e.stdout ?? e); }
        const line = out.split("\n").find((l) => /unauffällige Werte: 30–45 min Zone 1/.test(l)) ?? "";
        const pass = /✓|√|passed/.test(line) && !/failed|✗|×/.test(line) && /Tests\s+\d+ passed/.test(out);
        return { status: pass ? "ok" : "fail", observed: `In der Oberfläche mit den Testdaten nicht herstellbar (hohe Belastung der letzten 3 Tage, Erholung fest). Prüfung der Regel per Unit-Test „unauffällige Werte: 30–45 min Zone 1“: ${pass ? "bestanden" : "nicht bestanden"} (${line.trim().slice(0, 100)}).` };
      },
    },
    {
      nr: 3,
      action: "Im Check-in „krank“ eintragen.",
      expected: "„heute nicht“, ganz frei, mit dem Grund.",
      async run(t) {
        await t.tool("save_journal", { tags: ["krank"] });
        await t.open("heute");
        const txt = (await t.text("#readyRide")).replace(/\s+/g, " ");
        const ok = /Locker ausfahren: heute nicht\./.test(txt) && /ganz frei/.test(txt) && /krank/.test(txt);
        return { status: ok ? "ok" : "fail", observed: `Text: „${txt}“.`, locator: t.page.locator("#readyRide") };
      },
    },
    {
      nr: 4,
      action: "Optional: Im Coach-Chat fragen, ob heute locker ausfahren sinnvoll ist.",
      expected: "Die Antwort passt zur Aussage im Dashboard.",
      async run() {
        return { status: "skip", observed: "Optional; die Antwort schreibt Claude (in der Testumgebung nur Beispielantworten). Die Aussage steht als restRide im Coach-Kontext." };
      },
    },
  ],
};
