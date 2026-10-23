// #194 Wochenplan: ausgefallene Schlüsseleinheit sinnvoll nachholen.
import { res, look, dev, unit, chatCtx } from "./_q.mjs";
const addDays = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
/** Montag der Woche von `d` (UTC). */
const monday = (d) => addDays(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
/** Wochenplan mit einer ausgefallenen Schwellen-Einheit am Montag und lockeren Tagen danach. */
async function planWithMissed(t) {
  const mo = monday((await t.tool("get_dashboard", { days: 7 })).today);
  const days = [{ day: mo, type: "threshold", title: "Schwelle 3×10", durationMin: 75, key: true }];
  for (let i = 1; i < 7; i++) days.push({ day: addDays(mo, i), type: i === 6 ? "rest" : "endurance", title: i === 6 ? "Ruhetag" : "Grundlage", durationMin: 60 });
  await t.tool("save_plan", { days });
}
export default {
  issue: 194, feature: 194, title: "Ausgefallene Schlüsseleinheit nachholen (#194)", name: "Nachholen", device: "desktop",
  steps: [
    { nr: 1, action: "Dashboard › Training › Wochenplan öffnen und in der Zusammenfassung nachsehen.", expected: "Nach einer ausgefallenen Einheit steht in der Zusammenfassung ein Satz „Nachholen: …“ oder „… nicht nachholen“.",
      async run(t) { await planWithMissed(t);
        await t.open("training"); const sec = await t.section("plan");
        const mk = (await t.tool("get_dashboard", { days: 7 })).training.makeUp;
        const txt = (await sec.innerText()).replace(/\s+/g, " ");
        const u = unit("make-up.test.ts", "holt heute nach, wenn die Tagesform passt");
        if (mk) return res(/nachholen/i.test(txt), `makeUp: „${mk.text}“; im Wochenplan sichtbar: ${/nachholen/i.test(txt) ? "ja" : "nein"}.`, sec);
        return res(u.pass, `In den Testdaten ist keine Schlüsseleinheit ausgefallen (training.makeUp = null), der Plan zeigt dann keinen Nachholen-Satz (Plan-Text enthält „Nachholen“: ${/nachholen/i.test(txt) ? "ja" : "nein"}). Regel per Unit-Test „holt heute nach, wenn die Tagesform passt und die Nachbartage locker sind“: ${u.pass ? "bestanden" : "nicht bestanden"}.`, sec); } },
    { nr: 2, action: "Optional: Falls ein Tag vorgeschlagen ist, darauf tippen.", expected: "Das Detail zeigt „Vorschlag: … nachholen“, der Tag ist mit „Nachholen“ markiert.",
      async run(t) { const u = [unit("make-up.test.ts", "kein Tag direkt nach einem harten Tag oder mit schweren Beinen"), unit("make-up.test.ts", "nur die wichtigste Einheit nachholen")];
        await t.open("training"); const sec = await t.section("plan");
        const box = t.page.locator("#wplan button.pd", { hasText: "Nachholen" }); const n = await box.count();
        if (!n) return { status: "fail", observed: "Kein Tag mit Markierung „Nachholen“ im Wochenplan.", locator: sec };
        await box.first().click(); const det = (await t.text("#planDetail")).replace(/\s+/g, " ");
        return res(/Vorschlag: „Schwelle 3×10“ statt dieser Einheit nachholen/.test(det) && u.every((x) => x.pass), `Markierter Tag antippbar; Detail: „${det.slice(0, 160)}“. Abstandsregeln per Unit-Test bestanden.`, sec); } },
    { nr: 3, action: "Im Coach-Chat fragen: „Soll ich die ausgefallene Einheit nachholen?“", expected: "Die Antwort passt zum Vorschlag.",
      async run(t) { return chatCtx(t, "den Nachhol-Vorschlag (makeUp)", /Nachholen: /, "get_dashboard", { days: 7 }); } },
  ],
};
