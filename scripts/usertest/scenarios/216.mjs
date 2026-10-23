// #216 Rückmeldung zur Tagesempfehlung (Heute dran: Passte / War zu hart / War zu leicht).
// Die Rückmeldung erscheint nur nach einer erledigten Einheit heute; dafür wird eine Radfahrt von heute importiert.
export default {
  issue: 216,
  feature: 216,
  title: "Rückmeldung zur Tagesempfehlung (#216)",
  name: "Empfehlung bewerten",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Nach dem Training in „Heute dran“ „Passte“, „War zu hart“ oder „War zu leicht“ tippen.",
      expected: "Die Antwort bleibt markiert; unten steht „Danke, gespeichert“.",
      async run(t) {
        await t.tool("set_training_prefs", { restDays: [0], ridesPerWeek: 6, weeklyHours: 10 }).catch(() => {});
        const imp = await t.tool("import_fit", { fileBase64: await t.fit({ start: new Date(Date.now() - 3600_000).toISOString(), seconds: 1800, watts: 200 }), fileName: "heute.fit" }).catch((e) => String(e));
        t.imp = typeof imp === "string" ? imp : "importiert";
        await t.open("heute");
        await t.section("agenda");
        const todayBtn = t.page.locator(".ag-week .ag-day.today");
        await todayBtn.click();
        const btn = t.page.locator(".ag-fb button", { hasText: "War zu hart" });
        const there = await btn.count();
        if (!there) return { status: "fail", observed: `Rückmelde-Knöpfe fehlen heute (Import: ${t.imp}; Status heute: ${await t.page.evaluate(() => { const d = window.FC.state.data; return JSON.stringify(d.training.thisWeek.comparison.days.find((x) => x.day === d.today)); })}).`, locator: t.page.locator("#sec-agenda") };
        await btn.click();
        await t.page.waitForTimeout(800);
        const pressed = await t.page.locator(".ag-fb button[aria-pressed=true]").allInnerTexts(), msg = (await t.text("#agMsg")).trim();
        return { status: pressed.join() === "War zu hart" && /Danke, gespeichert/.test(msg) ? "ok" : "fail", observed: `Markiert: ${pressed.join(", ")}. Meldung: „${msg}“.`, locator: t.page.locator("#sec-agenda") };
      },
    },
    {
      nr: 2,
      action: "Dashboard neu laden.",
      expected: "Die Auswahl ist noch markiert.",
      async run(t) {
        await t.page.reload();
        await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 });
        await t.page.waitForTimeout(1000);
        await t.section("agenda");
        await t.page.locator(".ag-week .ag-day.today").click();
        const pressed = await t.page.locator(".ag-fb button[aria-pressed=true]").allInnerTexts();
        return { status: pressed.join() === "War zu hart" ? "ok" : "fail", observed: `Nach dem Neuladen markiert: ${pressed.join(", ") || "nichts"}.`, locator: t.page.locator("#sec-agenda") };
      },
    },
    {
      nr: 3,
      action: "Nach ein paar Tagen mit Rückmeldungen die Tagesempfehlung ansehen.",
      expected: "Bei den Gründen steht ein Hinweis wie „… waren dir zuletzt zu hart“. Ab 4 Rückmeldungen in 30 Tagen passt der Coach die Empfehlung leicht an.",
      async run(t) {
        const add = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        for (let i = 1; i <= 4; i++) await t.tool("save_recommendation_feedback", { verdict: "too_hard", readiness: "hard", day: add(today, -i) }).catch(() => {});
        const c = (await t.tool("get_dashboard", { days: 7 })).coach;
        await t.open("heute");
        const reasons = (await t.page.locator("#readyReasons li").allInnerTexts()).map((s) => s.replace(/\s+/g, " "));
        const hit = reasons.find((r) => /zu hart/.test(r));
        return { status: hit ? "ok" : "fail", observed: `Gründe heute: ${reasons.map((r) => `„${r}“`).join(" · ")}. (Empfehlung ${c.readiness}).`, locator: t.page.locator("#sec-today") };
      },
    },
    {
      nr: 4,
      action: "Im Coach-Chat „Das war heute zu hart“ eingeben.",
      expected: "Der Coach speichert es.",
      async run(t) {
        return { status: "device", observed: "Der Chat-Weg läuft über Claude (in der Testumgebung nur Beispielantworten); das Speichern selbst (save_recommendation_feedback) ist in Schritt 1 geprüft." };
      },
    },
  ],
};
