// #323 Fester Wochenplan: Krafttraining selbst festlegen, Coach plant drumherum.
// Synthetisch: Montag „Kraft: Beine“, Donnerstag „Kraft: Oberkörper“ (Woche ohne gespeicherten Plan, Vorschlag).
const week = async (t) => (await t.tool("get_dashboard", { days: 7 })).training.thisWeek;
const wd = (day) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Montag
const strengthDays = (w) => w.plan.days.filter((d) => d.strength || d.type === "strength").map((d) => `${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][wd(d.day)]} ${d.strength?.focus ?? "?"}`);

export default {
  issue: 323,
  feature: 323,
  title: "Fester Wochenplan Kraft (#323)",
  name: "Feste Krafttage",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Im Coach-Tab beim Wochenplan „Feste Krafttage“ aufklappen, Montag „Kraft: Beine“ und Donnerstag „Kraft: Oberkörper“ wählen, „Feste Tage speichern“.",
      expected: "Meldung „Gespeichert: 2 feste Krafttage“.",
      async run(t) {
        await t.open("coach");
        await t.section("plan");
        await t.page.locator("#fixBox summary").click();
        await t.page.selectOption("#fixDays select[data-day='0']", "Beine");
        await t.page.selectOption("#fixDays select[data-day='3']", "Oberkörper");
        await t.page.click("#fixSave");
        const msg = await t.poll(async () => { const s = await t.text("#fixMsg"); return /Gespeichert/.test(s) && s; });
        return { status: /Gespeichert: 2 feste Krafttage/.test(msg || "") ? "ok" : "fail", observed: `Meldung „${msg || (await t.text("#fixMsg"))}“.`, locator: t.page.locator("#fixBox") };
      },
    },
    {
      nr: 2,
      action: "Den Wochenplan ansehen.",
      expected: "Kraft genau Montag (Beine) und Donnerstag (Oberkörper), sonst keine Krafteinheit; am Sonntag und Dienstag keine harte Radeinheit; Hinweis „Kraft an deinen festen Tagen …“.",
      async run(t) {
        await t.page.waitForTimeout(800);
        const w = await week(t);
        const sd = strengthDays(w);
        const hard = (i) => w.plan.days.find((d) => wd(d.day) === i);
        const so = hard(6), di = hard(1);
        const isHard = (d) => d && /vo2|schwelle|sweet|interval|tempo|threshold/i.test(`${d.title} ${d.intensity}`);
        const notes = w.plan.notes.join(" ");
        const grid = (await t.text("#wplan")).replace(/\s+/g, " ");
        const hint = /Kraft an deinen festen Tagen/.test(notes) || /Kraft an deinen festen Tagen/.test(await t.text("#planNotes"));
        const ok = sd.join() === "Mo Beine,Do Oberkörper" && !isHard(so) && !isHard(di) && hint;
        return { status: ok ? "ok" : "fail", observed: `Krafttage im Plan: ${sd.join(", ")}. Sonntag: „${so?.title}“, Dienstag: „${di?.title}“ (keine harten Einheiten: ${!isHard(so) && !isHard(di)}). Hinweis „Kraft an deinen festen Tagen …“: ${hint ? "ja" : "nein"}. Plan-Raster: ${grid.slice(0, 220)}`, locator: t.page.locator("#sec-plan") };
      },
    },
    {
      nr: 3,
      action: "Einen festen Tag (Donnerstag) wieder auf „nicht fix“ stellen und speichern.",
      expected: "Der Plan passt sich an, Kraft steht nur noch am verbleibenden festen Tag.",
      async run(t) {
        await t.page.selectOption("#fixDays select[data-day='3']", "");
        await t.page.click("#fixSave");
        await t.poll(async () => /Gespeichert: 1 feste/.test(await t.text("#fixMsg")));
        await t.page.waitForTimeout(800);
        const sd = strengthDays(await week(t));
        return { status: sd.join() === "Mo Beine" ? "ok" : "fail", observed: `Krafttage jetzt: ${sd.join(", ") || "keine"} (erwartet: nur Montag, Beine). Meldung: „${await t.text("#fixMsg")}“.`, locator: t.page.locator("#sec-plan") };
      },
    },
    {
      nr: 4,
      action: "Optional: Alle Tage auf „nicht fix“ und speichern.",
      expected: "Der Coach verteilt die Kraft wieder selbst.",
      async run(t) {
        await t.page.selectOption("#fixDays select[data-day='0']", "");
        await t.page.click("#fixSave");
        await t.poll(async () => /der Coach verteilt die Kraft wieder selbst/.test(await t.text("#fixMsg")));
        await t.page.waitForTimeout(800);
        const w = await week(t);
        const prefs = (await t.tool("get_training_prefs", {})).fixedStrength ?? [];
        return { status: prefs.length === 0 ? "ok" : "fail", observed: `Meldung „${await t.text("#fixMsg")}“. Feste Tage gespeichert: ${prefs.length}. Krafttage im Plan: ${strengthDays(w).join(", ") || "keine"}.`, locator: t.page.locator("#sec-plan") };
      },
    },
  ],
};
