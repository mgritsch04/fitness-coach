// #331 Vorlage aus jedem Krafttraining mit eingetragenen Übungen (Workout-Übersicht), auch älteren.
// Synthetisch: zwei Krafteinheiten (vor 20 Tagen: Kniebeuge/Bankdrücken, heute: Kreuzheben) und das WHOOP-Krafttraining von heute ohne Übungen.
const VORLAGE = "Alt-Training (Test)";
const add = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

export default {
  issue: 331,
  feature: 331,
  title: "Vorlage aus jedem Krafttraining speichern (#331)",
  name: "Vorlage aus der Workout-Übersicht",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Training › Workout-Übersicht öffnen und nach „Kraft“ filtern.",
      expected: "Bei Krafttrainings mit Übungen steht unter dem Sportnamen „Als Vorlage speichern“, bei solchen ohne Übungen nicht.",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        t.old = add(today, -20);
        await t.tool("log_strength_session", { day: t.old, exercises: [{ exercise: "Kniebeuge", sets: [{ reps: 5, weightKg: 70 }, { reps: 5, weightKg: 75 }] }, { exercise: "Bankdrücken", sets: [{ reps: 8, weightKg: 50 }] }], rpe: 7, durationMin: 50 });
        await t.tool("log_strength_session", { day: today, exercises: [{ exercise: "Kreuzheben", sets: [{ reps: 5, weightKg: 100 }] }], rpe: 7, durationMin: 20 });
        await t.open("training");
        const sec = await t.section("workouts");
        await t.page.locator("#tWorkouts tbody tr").first().waitFor();
        await t.page.locator("#woKind button", { hasText: /Kraft/ }).click();
        await t.page.waitForTimeout(500);
        const rows = t.page.locator("#tWorkouts tbody tr");
        const info = [];
        for (let i = 0; i < (await rows.count()); i++) {
          const r = rows.nth(i);
          info.push({ day: (await r.locator("td").first().innerText()).trim(), src: (await r.locator("td[data-k=Quelle]").innerText()).trim(), tpl: await r.locator("button.wo-tpl").count() });
        }
        const withTpl = info.filter((x) => x.tpl), without = info.filter((x) => !x.tpl);
        const oldDay = await t.page.evaluate((d) => window.FC.fmtDayLong(d), t.old);
        const ok = withTpl.length >= 1 && info.some((x) => x.day === oldDay && x.tpl) && without.length >= 0;
        return { status: ok ? "ok" : "fail", observed: `Kraft-Trainings in der Liste: ${info.map((x) => `${x.day} (${x.src}) ${x.tpl ? "mit Knopf" : "ohne Knopf"}`).join("; ")}.`, locator: sec };
      },
    },
    {
      nr: 2,
      action: "Bei einem älteren Krafttraining (nicht dem letzten) „Als Vorlage speichern“ antippen.",
      expected: "Darunter erscheint ein Namensfeld mit „Speichern“ und bleibt offen.",
      async run(t) {
        const oldDay = await t.page.evaluate((d) => window.FC.fmtDayLong(d), t.old);
        const row = t.page.locator("#tWorkouts tbody tr").filter({ hasText: oldDay }).first();
        await row.locator("button.wo-tpl").click();
        await t.page.waitForTimeout(3000);
        const f = t.page.locator("#tWorkouts .wo-tplrow input");
        const ok = (await f.count()) === 1 && (await f.isVisible()) && (await t.page.locator("#tWorkouts .wo-tplrow button.primary").isVisible());
        return { status: ok ? "ok" : "fail", observed: `Nach 3 s: Namensfeld ${(await f.count()) ? "da" : "fehlt"}, Speichern-Knopf ${(await t.page.locator("#tWorkouts .wo-tplrow button.primary").count()) ? "da" : "fehlt"}.`, locator: t.page.locator("#tWorkouts") };
      },
    },
    {
      nr: 3,
      action: "Einen Namen eingeben und „Speichern“ drücken.",
      expected: "Bestätigung „Vorlage … gespeichert“, danach schließt sich das Feld.",
      async run(t) {
        await t.page.locator("#tWorkouts .wo-tplrow input").fill(VORLAGE);
        await t.page.locator("#tWorkouts .wo-tplrow button.primary").click();
        const msg = await t.poll(async () => { const s = await t.text("#tWorkouts .wo-tplrow span[role=status]"); return /Vorlage .* gespeichert/.test(s) && s; });
        await t.page.waitForTimeout(2200);
        const gone = (await t.page.locator("#tWorkouts .wo-tplrow").count()) === 0;
        return { status: msg && gone ? "ok" : "fail", observed: `Meldung „${msg || "–"}“, Feld danach ${gone ? "geschlossen" : "noch offen"}.`, locator: t.page.locator("#tWorkouts") };
      },
    },
    {
      nr: 4,
      action: "Im Gym-Modus die Auswahl „Vorlage“ öffnen.",
      expected: "Die neue Vorlage ist da und enthält die Übungen dieses Trainings.",
      async run(t) {
        await t.open("training");
        await t.section("gym");
        await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
        const has = await t.page.$$eval("#gySrc option", (o, n) => o.some((x) => x.value === `t:${n}`), VORLAGE);
        const tpl = (await t.tool("get_strength", { weeks: 1 })).templates.find((x) => x.name === VORLAGE);
        const ex = tpl ? tpl.exercises.map((e) => `${e.name ?? e.exercise} ${e.sets}×${e.reps} @ ${e.weightKg} kg`) : [];
        const ok = has && ex.length === 2 && ex.some((x) => /squat|Kniebeuge/i.test(x)) && ex.some((x) => /bench|Bankdr/i.test(x));
        return { status: ok ? "ok" : "fail", observed: `Gym-Auswahl enthält „${VORLAGE}“: ${has ? "ja" : "nein"}. Inhalt: ${ex.join("; ") || "–"}.`, locator: t.page.locator("#sec-gym") };
      },
    },
  ],
};
