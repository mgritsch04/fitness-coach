// #327 Übung frei beschreiben, Name der Übung wird automatisch gefunden (Gym-Modus und „Einheit eintragen“).
const startGym = async (t) => {
  await t.section("gym");
  await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
  await t.page.selectOption("#gySrc", "");
  await t.page.click("#gyBody button.primary");
  await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
};
const exNames = (t) => t.page.locator(".gy-list .gy-ex").evaluateAll((c) => c.map((x) => (x.querySelector("h3")?.textContent ?? x.querySelector("input")?.value ?? "").trim()));

export default {
  issue: 327,
  feature: 327,
  title: "Übung frei beschreiben (#327)",
  name: "Übung beschreiben",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Im Gym-Modus „Übung beschreiben“ tippen, „am Kabel sitzend von oben zur Brust ziehen“ eingeben, „Vorschlagen“.",
      expected: "1 bis 3 Vorschläge mit Muskelgruppen, oben „Latziehen“.",
      async run(t) {
        await t.open("training");
        await startGym(t);
        await t.page.locator("#gyBody").getByRole("button", { name: "Übung beschreiben" }).click();
        await t.page.fill(".st-desc-in", "am Kabel sitzend von oben zur Brust ziehen");
        await t.page.getByRole("button", { name: "Vorschlagen" }).click();
        await t.page.locator(".st-desc-pick").first().waitFor({ timeout: 8000 });
        const picks = await t.page.locator(".st-desc-pick").allInnerTexts();
        const ok = picks.length >= 1 && picks.length <= 3 && /Latziehen/.test(picks[0]) && picks.every((p) => /·/.test(p));
        return { status: ok ? "ok" : "fail", observed: `Vorschläge: ${picks.map((p) => `„${p.replace(/\s+/g, " ")}“`).join(", ")}.`, locator: t.page.locator("#sec-gym") };
      },
    },
    {
      nr: 2,
      action: "Einen Vorschlag antippen.",
      expected: "Die Übung wird mit diesem Namen zur Einheit hinzugefügt.",
      async run(t) {
        await t.page.locator(".st-desc-pick").first().click();
        await t.page.waitForTimeout(500);
        const names = await exNames(t);
        return { status: names.some((n) => /Latziehen/.test(n)) ? "ok" : "fail", observed: `Übungen in der Einheit: ${names.join(", ")}.`, locator: t.page.locator("#sec-gym") };
      },
    },
    {
      nr: 3,
      action: "Eine Beschreibung eingeben, die es nicht im Katalog gibt („Reifen umwerfen draußen“).",
      expected: "Keine Vorschläge, aber „Als eigene Übung anlegen“ mit vorbelegtem Namen; Tippen legt sie an.",
      async run(t) {
        await t.page.locator("#gyBody").getByRole("button", { name: "Übung beschreiben" }).click();
        await t.page.fill(".st-desc-in", "Reifen umwerfen draußen");
        await t.page.getByRole("button", { name: "Vorschlagen" }).click();
        await t.page.getByRole("button", { name: "Als eigene Übung anlegen" }).waitFor({ timeout: 8000 });
        const picks = await t.page.locator(".st-desc-pick").count();
        const pre = await t.page.locator("input[aria-label='Name der eigenen Übung']").inputValue();
        await t.page.getByRole("button", { name: "Als eigene Übung anlegen" }).click();
        await t.page.waitForTimeout(500);
        const names = await exNames(t);
        const ok = picks === 0 && pre.length > 0 && names.some((n) => n === pre);
        return { status: ok ? "ok" : "fail", observed: `Vorschläge: ${picks}. Vorbelegter Name „${pre}“. Übungen danach: ${names.join(", ")}.`, locator: t.page.locator("#sec-gym") };
      },
    },
    {
      nr: 4,
      action: "Im Krafttraining im Formular „Einheit eintragen“ auf „Übung beschreiben“ tippen und einen Vorschlag wählen.",
      expected: "Der Name steht in der ersten leeren Übungszeile.",
      async run(t) {
        await t.section("strength");
        await t.page.click("#stDescBtn");
        await t.page.fill("#stDesc .st-desc-in", "am Kabel sitzend von oben zur Brust ziehen");
        await t.page.locator("#stDesc").getByRole("button", { name: "Vorschlagen" }).click();
        await t.page.locator("#stDesc .st-desc-pick").first().waitFor({ timeout: 8000 });
        await t.page.locator("#stDesc .st-desc-pick").first().click();
        const first = await t.page.locator("#stRows .ex").first().inputValue();
        const msg = await t.text("#stMsg");
        return { status: /Latziehen/.test(first) ? "ok" : "fail", observed: `Erste Übungszeile: „${first}“. Meldung: „${msg}“.`, locator: t.page.locator("#stForm") };
      },
    },
  ],
};
