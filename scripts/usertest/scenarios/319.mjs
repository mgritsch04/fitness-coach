// #319 Absolvierte Krafteinheit als Vorlage speichern (nach dem Gym-Modus und aus „Letzte Einheiten“).
// Synthetisch: Ausgangsvorlage mit Kniebeuge 3 × 5 @ 60 kg und Bankdrücken 2 × 8 @ 50 kg, alle Sätze abgehakt.
const SRC = "Quelle (synthetisch)";
const NEW = "Aus Gym-Einheit (Test)";
const OLD = "Aus Liste (Test)";
const add = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const structure = (t) => t.page.evaluate(() => (window.FC.state.gym.st?.exercises ?? []).map((x) => `${x.name} ${x.sets.length}`));

export default {
  issue: 319,
  feature: 319,
  title: "Krafteinheit als Vorlage speichern (#319)",
  name: "Einheit als Vorlage speichern",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Eine Krafteinheit im Gym-Modus beenden und speichern (hier: Kniebeuge 3 Sätze, Bankdrücken 2 Sätze, Anstrengung 7).",
      expected: "Es erscheint „Diese Einheit als Vorlage speichern?“ mit Namensfeld.",
      async run(t) {
        t.today = (await t.tool("get_dashboard", { days: 7 })).today;
        await t.tool("save_strength_template", { name: SRC, exercises: [{ exercise: "Kniebeuge", sets: 3, reps: 5, weightKg: 60 }, { exercise: "Bankdrücken", sets: 2, reps: 8, weightKg: 50 }] });
        await t.open("training");
        await t.section("gym");
        await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
        await t.page.selectOption("#gySrc", `t:${SRC}`);
        await t.page.click("#gyBody button.primary");
        await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
        for (let i = 0; i < 2; i++) {
          const card = t.page.locator(".gy-list .gy-ex").nth(i);
          const n = await card.locator(".gy-set").count();
          for (let j = 0; j < n; j++) { await t.page.locator(".gy-list .gy-ex").nth(i).locator(".gy-set").nth(j).locator("button.ok").click(); await t.page.waitForTimeout(200); }
        }
        t.done = await structure(t);
        await t.page.getByRole("button", { name: "Einheit beenden" }).click();
        await t.page.locator("#gyFinish .gy-rpe button", { hasText: /^7$/ }).click();
        await t.page.locator("#gyFinish button.primary").click();
        const h = await t.poll(async () => (await t.page.getByRole("heading", { name: "Diese Einheit als Vorlage speichern?" }).count()) > 0);
        const field = await t.page.locator("#gyTplName").count();
        return { status: h && field ? "ok" : "fail", observed: `Gespeichert: ${t.done.join(", ")} Sätze. Frage „Diese Einheit als Vorlage speichern?“ ${h ? "erscheint" : "fehlt"}, Namensfeld ${field ? "da" : "fehlt"}. Meldung: „${await t.text("#gyMsg")}“`, locator: t.page.locator("#sec-gym") };
      },
    },
    {
      nr: 2,
      action: `Einen Namen eingeben („${NEW}“) und „Als Vorlage speichern“ tippen.`,
      expected: "Meldung „Vorlage … gespeichert“.",
      async run(t) {
        await t.page.fill("#gyTplName", NEW);
        await t.page.getByRole("button", { name: "Als Vorlage speichern" }).click();
        const msg = await t.poll(async () => { const s = await t.text("#gyMsg"); return /Vorlage .* gespeichert/.test(s) && s; });
        const tpl = (await t.tool("get_strength", { weeks: 1 })).templates.find((x) => x.name === NEW);
        return { status: msg && tpl ? "ok" : "fail", observed: `Meldung: „${msg || (await t.text("#gyMsg"))}“. Vorlage gespeichert: ${tpl ? JSON.stringify(tpl.exercises.map((e) => `${e.name ?? e.exercise} ${e.sets}×${e.reps}`)) : "nein"}.`, locator: t.page.locator("#sec-gym") };
      },
    },
    {
      nr: 3,
      action: "Im Gym-Modus unter „Was trainierst du?“ die neue Vorlage wählen und starten.",
      expected: "Übungen und Satzzahlen der alten Einheit sind vorbelegt.",
      async run(t) {
        const has = await t.page.$$eval("#gySrc option", (o, n) => o.some((x) => x.value === `t:${n}`), NEW);
        if (!has) return { status: "fail", observed: "Die neue Vorlage steht nicht in der Auswahl.", locator: t.page.locator("#sec-gym") };
        await t.page.selectOption("#gySrc", `t:${NEW}`);
        await t.page.click("#gyBody button.primary");
        await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
        const now = await structure(t);
        const ok = now.join("|") === t.done.join("|");
        return { status: ok ? "ok" : "fail", observed: `Vorbelegt: ${now.join(", ")} Sätze (gespeichert war: ${t.done.join(", ")}).`, locator: t.page.locator(".gy-list") };
      },
    },
    {
      nr: 4,
      action: `Im Krafttraining unter „Letzte Einheiten“ bei einer Einheit „Als Vorlage speichern“ tippen, Namen „${OLD}“ eingeben, „Speichern“.`,
      expected: "Bestätigung „Vorlage … gespeichert“; die Vorlage steht danach im Feld „Vorlage“.",
      async run(t) {
        await t.tool("log_strength_session", { day: add(t.today, -3), name: "Rücken (Test)", durationMin: 40, rpe: 7, exercises: [{ exercise: "Kreuzheben", sets: [{ reps: 5, weightKg: 90 }, { reps: 5, weightKg: 90 }] }] });
        await t.open("training");
        await t.section("strength");
        const row = t.page.locator("#stSessions > .row").filter({ hasText: "Rücken (Test)" });
        await row.getByRole("button", { name: "Als Vorlage speichern" }).click();
        const form = t.page.locator("#stSessions .st-tplrow");
        await form.locator("input").fill(OLD);
        await form.getByRole("button", { name: "Speichern" }).click();
        const msg = await t.poll(async () => { const s = await form.locator("[role=status]").innerText(); return /Vorlage .* gespeichert/.test(s) && s; });
        const inSel = await t.poll(async () => t.page.$$eval("#stTpl option", (o, n) => o.some((x) => x.value === n || x.textContent === n), OLD), 6000);
        return { status: msg && inSel ? "ok" : "fail", observed: `Bestätigung: „${msg || "keine"}“. Im Feld „Vorlage“: ${inSel ? "ja" : "nein"}.`, locator: t.page.locator("#sec-strength") };
      },
    },
  ],
};
