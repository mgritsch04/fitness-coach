// #332 Namensfeld bei „Als Vorlage speichern“ (Krafttraining › Letzte Einheiten) bleibt stehen.
// Synthetisch: eine gespeicherte Krafteinheit (Kniebeuge 3×5 @ 60 kg).
export default {
  issue: 332,
  feature: 332,
  title: "Namensfeld bei „Als Vorlage speichern“ bleibt sichtbar (#332)",
  name: "Vorlagen-Namensfeld stabil",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Im Krafttraining bei einer Einheit „Als Vorlage speichern“ antippen.",
      expected: "Ein Namensfeld mit „Speichern“ erscheint und bleibt sichtbar.",
      async run(t) {
        await t.tool("log_strength_session", { exercises: [{ exercise: "Kniebeuge", sets: [{ reps: 5, weightKg: 60 }, { reps: 5, weightKg: 60 }, { reps: 5, weightKg: 60 }] }], rpe: 7, durationMin: 40 });
        await t.open("training");
        await t.section("strength");
        const row = t.page.locator("#stSessions > .row").filter({ hasText: "Kniebeuge" }).first();
        await row.getByRole("button", { name: "Als Vorlage speichern" }).click();
        await t.page.waitForTimeout(1500);
        const field = t.page.locator("#stSessions .st-tplrow input");
        const ok = (await field.count()) === 1 && (await field.isVisible()) && (await t.page.locator("#stSessions .st-tplrow button.primary").isVisible());
        return { status: ok ? "ok" : "fail", observed: `Nach 1,5 s: Namensfeld ${(await field.count()) ? "sichtbar" : "weg"}, Speichern-Knopf ${(await t.page.locator("#stSessions .st-tplrow button.primary").count()) ? "da" : "weg"}.`, locator: t.page.locator("#stSessions") };
      },
    },
    {
      nr: 2,
      action: "Einige Sekunden warten und dann einen Namen eintippen.",
      expected: "Das Feld ist weiterhin da, der Text bleibt stehen.",
      async run(t) {
        await t.page.waitForTimeout(4000);
        const field = t.page.locator("#stSessions .st-tplrow input");
        const there = await field.count();
        await field.fill("Beine Test");
        await t.page.waitForTimeout(1500);
        const v = (await field.count()) ? await field.inputValue() : "";
        return { status: there === 1 && v === "Beine Test" ? "ok" : "fail", observed: `Nach 4 s Wartezeit Feld ${there ? "noch da" : "weg"}; nach dem Tippen und 1,5 s: Text „${v}“.`, locator: t.page.locator("#stSessions") };
      },
    },
    {
      nr: 3,
      action: "Optional: Das Fenster schmaler ziehen und wieder breiter.",
      expected: "Feld und Text bleiben.",
      async run(t) {
        const vp = t.page.viewportSize();
        await t.page.setViewportSize({ width: 700, height: vp.height });
        await t.page.waitForTimeout(1200);
        const mid = (await t.page.locator("#stSessions .st-tplrow input").count()) ? await t.page.locator("#stSessions .st-tplrow input").inputValue() : "";
        await t.page.setViewportSize(vp);
        await t.page.waitForTimeout(1200);
        const end = (await t.page.locator("#stSessions .st-tplrow input").count()) ? await t.page.locator("#stSessions .st-tplrow input").inputValue() : "";
        return { status: mid === "Beine Test" && end === "Beine Test" ? "ok" : "fail", observed: `Nach Verkleinern auf 700 px: „${mid}“; nach Zurück auf ${vp.width} px: „${end}“.`, locator: t.page.locator("#stSessions") };
      },
    },
    {
      nr: 4,
      action: "„Speichern“ drücken.",
      expected: "Bestätigung „Vorlage … gespeichert“, danach schließt sich das Feld.",
      async run(t) {
        await t.page.locator("#stSessions .st-tplrow button.primary").click();
        const msg = await t.poll(async () => { const s = await t.text("#stSessions .st-tplrow span[role=status]"); return /Vorlage .* gespeichert/.test(s) && s; });
        await t.shot("Bestätigung", t.page.locator("#stSessions"));
        await t.page.waitForTimeout(2200);
        const gone = (await t.page.locator("#stSessions .st-tplrow").count()) === 0;
        const tpl = (await t.tool("get_strength", { weeks: 1 })).templates.find((x) => x.name === "Beine Test");
        return { status: msg && gone && tpl ? "ok" : "fail", observed: `Meldung „${msg || "–"}“. Feld danach ${gone ? "geschlossen" : "noch offen"}. Vorlage vorhanden: ${tpl ? "ja" : "nein"}.`, locator: t.page.locator("#stSessions") };
      },
    },
    {
      nr: 5,
      action: "Einen zweiten Klick auf „Als Vorlage speichern“ bei einer offenen Einheit.",
      expected: "Das Feld schließt sich.",
      async run(t) {
        const row = t.page.locator("#stSessions > .row").filter({ hasText: "Kniebeuge" }).first();
        const btn = row.getByRole("button", { name: "Als Vorlage speichern" });
        await btn.click();
        const open = await t.page.locator("#stSessions .st-tplrow").count();
        await t.page.locator("#stSessions > .row").filter({ hasText: "Kniebeuge" }).first().getByRole("button", { name: "Als Vorlage speichern" }).click();
        await t.page.waitForTimeout(500);
        const after = await t.page.locator("#stSessions .st-tplrow").count();
        return { status: open === 1 && after === 0 ? "ok" : "fail", observed: `Nach erstem Klick ${open} offenes Feld, nach zweitem Klick ${after}.`, locator: t.page.locator("#stSessions") };
      },
    },
  ],
};
