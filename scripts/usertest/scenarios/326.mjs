// #326 Winterbetrieb: Coach berücksichtigt, dass auf der Rolle gefahren wird.
import { res, dev, unit } from "./_q.mjs";
export default {
  issue: 326, feature: 326, title: "Winterbetrieb: nur Rolle (#326)", name: "Winterbetrieb", device: "desktop",
  steps: [
    { nr: 1, action: "Mehr › Einstellungen › Winterbetrieb: „Winter: nur Rolle“ einschalten, „Speichern“.", expected: "Gespeichert; der Hinweis darunter sagt „aktiv“.",
      async run(t) { await t.open("mehr"); const sec = await t.section("settings");
        await t.page.check("#sIndoor"); await t.page.click("#saveSettings");
        await t.poll(async () => /Gespeichert/.test(await t.text("#settingsMsg")));
        await t.page.waitForTimeout(800);
        const hint = (await t.text("#hIndoor")).trim(), dash = (await t.tool("get_dashboard", { days: 7 })).indoor;
        return res(dash.on && dash.active && /^aktiv/.test(hint), `Meldung: „${(await t.text("#settingsMsg")).trim()}“. Hinweis: „${hint}“. Gespeichert (get_dashboard.indoor): ${JSON.stringify(dash)}.`, sec); } },
    { nr: 2, action: "Radwetter ansehen.", expected: "Neben dem Ort „Winterbetrieb: nur Rolle“, Empfehlung „Rolle“, keine Kleidungsempfehlung.",
      async run(t) { const u = unit("weather.test.ts", "Winter"); const w = await t.section("weather"); const txt = (await w.innerText()).replace(/\s+/g, " ").slice(0, 200);
        return dev(`Das Wetter ist in der Testumgebung eine Beispielantwort (Netz). Angezeigt wird: „${txt}…“. Winterlogik im Radwetter kann hier nicht live geprüft werden.`); } },
    { nr: 3, action: "Wochenplan (Vorschlag) ansehen.", expected: "Radeinheiten für die Rolle beschrieben (ERG, Ventilator, trinken), kein „oder draußen“.",
      async run(t) { await t.open("coach"); const sec = await t.section("plan"); const days = (await t.tool("get_dashboard", { days: 7 })).training.thisWeek.plan.days ?? [];
        const all = JSON.stringify((await t.tool("get_dashboard", { days: 7 })).training.thisWeek); const txt = (await sec.innerText()).replace(/\s+/g, " ");
        const ok = /Auf der Rolle: ERG-Modus, Ventilator/.test(all) && !/oder draußen/.test(all);
        return res(ok, `Plan-Daten enthalten „Auf der Rolle: ERG-Modus, Ventilator, genug trinken“: ${/Auf der Rolle: ERG-Modus, Ventilator/.test(all)}; „oder draußen“ kommt vor: ${/oder draußen/.test(all)}.`, sec); } },
    { nr: 4, action: "Tagesempfehlung im Reiter „Heute“ ansehen (Tag ohne „Ruhe“).", expected: "Der Vorschlag enthält den Hinweis zur Rolle.",
      async run(t) { await t.open("heute"); const c = (await t.tool("get_dashboard", { days: 7 })).coach; const txt = (await t.page.locator("#sec-today").innerText()).replace(/\s+/g, " ");
        return res(/Rolle/i.test(`${c.suggestion} ${txt}`), `Empfehlung heute (${c.readiness}): „${c.suggestion}“. „Rolle“ in der Empfehlung/Heute-Karte: ${/Rolle/i.test(`${c.suggestion} ${txt}`)}.`, t.page.locator("#sec-today")); } },
    { nr: 5, action: "Im Coach-Chat fragen, wo heute gefahren werden soll.", expected: "Die Antwort nennt die Rolle.",
      async run() { return dev("Die Chat-Antwort schreibt Claude (in der Testumgebung nur Beispielantworten)."); } },
    { nr: 6, action: "Winterbetrieb wieder ausschalten und speichern.", expected: "Radwetter rät wieder je nach Wetter.",
      async run(t) { await t.open("mehr"); await t.section("settings"); await t.page.uncheck("#sIndoor"); await t.page.click("#saveSettings");
        await t.poll(async () => /Gespeichert/.test(await t.text("#settingsMsg"))); await t.page.waitForTimeout(800);
        const dash = (await t.tool("get_dashboard", { days: 7 })).indoor;
        return { status: "device", observed: `Ausgeschaltet und gespeichert: indoor = ${JSON.stringify(dash)}, Hinweis „${(await t.text("#hIndoor")).trim()}“. Dass das Radwetter wieder je nach Wetter rät, ist mit Beispielwetter nicht prüfbar.` }; } },
  ],
};
