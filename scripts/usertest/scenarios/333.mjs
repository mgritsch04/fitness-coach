// #333 Gespeicherte Krafttraining-Vorlagen bearbeiten (Name, Übungen, Sätze).
const tm = (t) => t.page.locator("#stTplMgr");
const card = (t, name) => tm(t).locator(`details[data-name="${name}"]`);
const names = (t) => tm(t).locator("details").evaluateAll((els) => els.map((e) => e.dataset.name));
const exs = (t, name) => card(t, name).locator(".st-tmx").evaluateAll((rs) => rs.map((r) => ({ n: r.querySelector(".ex").value, s: Number(r.querySelector(".sets").value) })));
async function open(t) { await t.open("training"); await t.section("strength"); await t.page.locator("#stTplMgr").waitFor({ timeout: 15_000 }); await t.poll(async () => (await names(t)).includes("Test A (synthetisch)"), 15_000); }

export default {
  issue: 333,
  feature: 333,
  title: "Vorlagen verwalten (#333)",
  name: "Vorlagen verwalten",
  device: "phone",
  steps: [
    {
      nr: 1, action: "Im Abschnitt Krafttraining „Vorlagen verwalten“ öffnen.", expected: "Alle gespeicherten Vorlagen sind aufgelistet.",
      async run(t) {
        await t.tool("save_strength_template", { name: "Test A (synthetisch)", exercises: [{ exercise: "Kniebeuge", sets: 3, reps: 5, weightKg: 60 }, { exercise: "Bankdrücken", sets: 3, reps: 8, weightKg: 50 }] });
        await t.tool("save_strength_template", { name: "Test B (synthetisch)", exercises: [{ exercise: "Rudern", sets: 3, reps: 10, weightKg: 40 }] });
        await t.tool("save_strength_template", { name: "Test C (synthetisch)", exercises: [{ exercise: "Kreuzheben", sets: 2, reps: 5, weightKg: 80 }] });
        await open(t);
        const have = await names(t);
        const api = (await t.tool("get_strength")).templates.map((x) => x.name);
        const ok = api.every((n) => have.includes(n)) && have.length === api.length;
        return { status: ok ? "ok" : "fail", observed: `Angezeigt: ${have.join(", ")}; im Speicher: ${api.join(", ")}.`, locator: tm(t) };
      },
    },
    {
      nr: 2, action: "Eine Vorlage öffnen und umbenennen, speichern.", expected: "Bestätigung; die Liste zeigt den neuen Namen, der alte ist weg.",
      async run(t) {
        const a = card(t, "Test C (synthetisch)");
        await a.locator("summary").click();
        await a.locator('input[aria-label="Name der Vorlage"]').fill("Test C neu (synthetisch)");
        await a.getByRole("button", { name: "Speichern" }).click();
        await t.page.waitForTimeout(3000);
        const nn = await names(t);
        const msg = await a.locator("[role=status]").innerText().catch(() => "");
        const api = (await t.tool("get_strength")).templates.map((x) => x.name);
        const ok = nn.includes("Test C neu (synthetisch)") && !nn.includes("Test C (synthetisch)") && api.includes("Test C neu (synthetisch)");
        return { status: ok ? "ok" : "fail", observed: `Meldung „${msg}“. Liste: ${nn.join(", ")}. Speicher: ${api.join(", ")}.`, locator: tm(t) };
      },
    },
    {
      nr: "2b", action: "Eine Übung entfernen und bei einer anderen Vorlage die Satzzahl ändern (ohne Umbenennen), speichern.", expected: "Bestätigung; Änderungen gespeichert.",
      async run(t) {
        const a = card(t, "Test A (synthetisch)");
        await a.locator("summary").click();
        await a.locator('button[aria-label="Übung entfernen"]').nth(1).click();
        await a.getByRole("button", { name: "Speichern" }).click();
        await t.poll(async () => (await exs(t, "Test A (synthetisch)")).length === 1, 15_000);
        const b = card(t, "Test B (synthetisch)");
        await b.locator("summary").click();
        await b.locator(".sets").first().fill("5"); await b.locator(".sets").first().dispatchEvent("change");
        await b.getByRole("button", { name: "Speichern" }).click();
        await t.poll(async () => (await exs(t, "Test B (synthetisch)"))[0]?.s === 5, 15_000);
        const msg = await card(t, "Test B (synthetisch)").locator("[role=status]").innerText();
        const api = (await t.tool("get_strength")).templates;
        const ea = api.find((x) => x.name === "Test A (synthetisch)")?.exercises.length;
        const sb = api.find((x) => x.name === "Test B (synthetisch)")?.exercises[0]?.sets;
        return { status: ea === 1 && sb === 5 ? "ok" : "fail", observed: `Meldung „${msg}“. Test A hat ${ea} Übung(en), Test B ${sb} Sätze.`, locator: tm(t) };
      },
    },
    {
      nr: 3, action: "Im Gym-Modus die geänderte Vorlage starten.", expected: "Übungen und Sätze entsprechen den Änderungen, der alte Name ist nicht mehr da.",
      async run(t) {
        await t.open("training"); await t.section("gym");
        await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
        const opts = await t.page.locator("#gySrc option").allTextContents();
        await t.page.selectOption("#gySrc", "t:Test B (synthetisch)");
        await t.page.click("#gyBody button.primary");
        await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
        const sets = await t.page.locator(".gy-list .gy-ex").first().locator(".gy-set").count();
        const oldGone = !opts.some((o) => o.includes("Test C (synthetisch)")) && opts.some((o) => o.includes("Test C neu"));
        return { status: sets === 5 && oldGone ? "ok" : "fail", observed: `Gym-Auswahl: ${opts.join(" | ")}. Test B startet mit ${sets} Sätzen (erwartet 5). Alter Name weg: ${oldGone}.`, locator: t.page.locator(".gy-list") };
      },
    },
    {
      nr: 4, action: "Eine Vorlage löschen und bestätigen.", expected: "Sie verschwindet aus der Liste und aus dem Gym-Modus.",
      async run(t) {
        await open2(t);
        const c = card(t, "Test A (synthetisch)");
        await c.locator("summary").click();
        t.page.once("dialog", (d) => d.accept());
        await c.getByRole("button", { name: "Vorlage löschen" }).click();
        await t.poll(async () => !(await names(t)).includes("Test A (synthetisch)"), 15_000);
        await t.open("training"); await t.section("gym");
        await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
        const opts = await t.page.locator("#gySrc option").allTextContents();
        const api = (await t.tool("get_strength")).templates.map((x) => x.name);
        const ok = !opts.some((o) => o.includes("Test A")) && !api.includes("Test A (synthetisch)");
        return { status: ok ? "ok" : "fail", observed: `Nach dem Löschen (Rückfrage bestätigt): Liste ohne Test A, Gym-Auswahl: ${opts.join(" | ")}; Speicher: ${api.join(", ")}.`, locator: t.page.locator("#gySrc") };
      },
    },
    {
      nr: 5, action: "Optik am Handy: Bearbeitungsansicht lesbar, nichts läuft über den Rand.", expected: "Lesbar, bedienbar.",
      async run(t) {
        await t.open("training"); const sec = await t.section("strength");
        await t.page.locator("#stTplMgr details").first().locator("summary").click();
        const over = await t.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        return { status: over <= 1 ? "look" : "fail", observed: `Überlauf ${over}px; Optik am Bild beurteilt.`, locator: tm(t) };
      },
    },
  ],
};
async function open2(t) { await open(t).catch(async () => { await t.open("training"); await t.section("strength"); }); }
