// #280 Gym-Modus: Reserve je Satz (RIR) passt das Gewicht des nächsten Satzes an.
import { gymStart, res, look, unit } from "./_q.mjs";
const nextKg = (t) => t.page.locator(".gy-set").nth(1).locator("input").nth(1).inputValue();
export default {
  issue: 280, feature: 280, title: "Gym-Modus: Reserve je Satz (#280)", name: "Reserve je Satz", device: "phone",
  steps: [
    { nr: 1, action: "Gym-Modus starten und einen Satz abhaken.", expected: "Der Satz ist abgehakt; darunter steht „Noch drin: 0 / 1–2 / 3+“.",
      async run(t) { await gymStart(t, "Kniebeuge", 2, 60);
        await t.page.locator(".gy-set").first().locator("button.ok").click(); await t.page.waitForTimeout(300);
        const row = (await t.text(".gy-rir")).replace(/\s+/g, " ");
        return res(/Noch drin:\s*0\s*1–2\s*3\+/.test(row), `Satz 1 abgehakt, darunter: „${row}“.`, t.page.locator("#sec-gym")); } },
    { nr: 2, action: "Unter dem Satz „Noch drin: 0 / 1–2 / 3+“ antippen.", expected: "Die gewählte Angabe ist markiert.",
      async run(t) { await t.page.locator(".gy-rir button", { hasText: /^1–2$/ }).click(); await t.page.waitForTimeout(200);
        const p = await t.page.locator(".gy-rir button", { hasText: /^1–2$/ }).getAttribute("aria-pressed");
        return res(p === "true", `„1–2“ ist markiert (aria-pressed=${p}).`, t.page.locator("#sec-gym")); } },
    { nr: 3, action: "Prüfen, ob sich das Gewicht des nächsten Satzes sinnvoll ändert (3+ schwerer, 0 leichter, 1–2 gleich).", expected: "3+ etwas schwerer, 0 etwas leichter, 1–2 gleich.",
      async run(t) { const r = {};
        for (const [k, lab] of [["1-2", "1–2"], ["0", "0"], ["3+", "3+"]]) {
          await t.page.locator(".gy-rir button", { hasText: new RegExp(`^${lab.replace("+", "\\+")}$`) }).click(); await t.page.waitForTimeout(200);
          r[k] = await nextKg(t);
        }
        await t.page.locator(".gy-rir button", { hasText: /^1–2$/ }).click(); await t.page.waitForTimeout(200);
        const again = await nextKg(t);
        const ok = +r["3+"] > 60 && +r["0"] < 60 && +r["1-2"] === 60;
        return res(ok, `Start 60 kg (Satz 1 hat 60 kg, jede Angabe wird vom Ausgangsgewicht gerechnet) → nächster Satz: bei 3+ ${r["3+"]} kg, bei 0 ${r["0"]} kg, bei 1–2 ${r["1-2"]} kg. Beobachtung: wird nach 3+ nachträglich „1–2“ angetippt, bleibt der nächste Satz bei ${again} kg (wird nicht auf 60 kg zurückgesetzt). Ob die Schritte sich im Training stimmig anfühlen, beurteilt G.`, t.page.locator("#sec-gym")); } },
    { nr: 4, action: "Nach zwei Einheiten mit Angaben prüfen, ob der Coach je Übung zeigt, ob die Reserve passt.", expected: "Der Coach zeigt je Übung, ob die Reserve passt.",
      async run(t) { const u = unit("autoregulation.test.ts", "bewertet die Reserve über mehrere Einheiten");
        return { status: "device", observed: `Anzeige im Coach braucht echte Einheiten mit Reserve über Tage. Die Bewertung über mehrere Einheiten ist per Unit-Test „bewertet die Reserve über mehrere Einheiten“ ${u.pass ? "bestanden" : "NICHT bestanden"}.` }; } },
  ],
};
