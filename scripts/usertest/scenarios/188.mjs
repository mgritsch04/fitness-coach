// #188 Handy: lange Tabs einklappbar, eingeklappte Abschnitte laden erst beim Aufklappen (390 px; Schritt 5 am Rechner).
const st = (t, id) => t.page.evaluate((id) => { const e = document.querySelector(`#sec-${id}`); return !e || e.hidden ? "fehlt" : e.classList.contains("folded") ? "zu" : "offen"; }, id);
const openIds = (t) => t.page.evaluate(() => [...document.querySelectorAll("#sections > section")].filter((e) => !e.hidden && e.offsetParent !== null && e.classList.contains("foldable") && !e.classList.contains("folded")).map((e) => e.id.slice(4)));
export default {
  issue: 188,
  feature: 188,
  title: "Handy: lange Tabs einklappbar (#188)",
  name: "Abschnitte einklappen",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Tab „Training“ öffnen.",
      expected: "Offen sind nur Gym-Modus und Trainingslast; darunter steht eine Liste von Überschriften mit Pfeil.",
      async run(t) {
        await t.open("training");
        await t.page.waitForTimeout(800);
        const open = await openIds(t), bars = await t.page.locator("#sections > section.foldable.folded > .fold-bar").count();
        return { status: open.join() === "gym,load" && bars >= 5 ? "ok" : "fail", observed: `Offen: ${open.join(", ")}; eingeklappte Überschriften mit Pfeil: ${bars}.`, locator: t.page.locator("body") };
      },
    },
    {
      nr: 2,
      action: "Die Überschrift „Trittfrequenz“ antippen, danach nochmal.",
      expected: "Der Abschnitt klappt auf und lädt seine Daten; erneut antippen klappt ihn zu.",
      async run(t) {
        const bar = t.page.locator("#sec-cadence > .fold-bar");
        const before = await st(t, "cadence");
        await bar.click(); await t.page.waitForTimeout(1200);
        const opened = await st(t, "cadence"), content = (await t.page.locator("#sec-cadence").innerText()).replace(/\s+/g, " ").length;
        await t.page.locator("#sec-cadence > .fold-bar").click(); await t.page.waitForTimeout(400);
        const closed = await st(t, "cadence");
        await t.page.locator("#sec-cadence > .fold-bar").click(); await t.page.waitForTimeout(600);
        return { status: before === "zu" && opened === "offen" && closed === "zu" && content > 80 ? "ok" : "fail", observed: `Vorher ${before}, nach Antippen ${opened} (Inhalt ${content} Zeichen), nochmal ${closed}.`, locator: t.page.locator("#sec-cadence") };
      },
    },
    {
      nr: 3,
      action: "Seite neu laden.",
      expected: "Was du aufgeklappt hast, bleibt offen.",
      async run(t) {
        await t.page.reload();
        await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 });
        await t.page.waitForTimeout(800);
        await t.tab("training");
        const open = await openIds(t);
        return { status: open.includes("cadence") && open.includes("gym") ? "ok" : "fail", observed: `Nach dem Neuladen offen: ${open.join(", ")}.`, locator: t.page.locator("body") };
      },
    },
    {
      nr: 4,
      action: "Im Tab „Verlauf“ einen Abschnitt antippen; zusätzlich per Sprung (Suche/„Auf einen Blick“) einen eingeklappten Abschnitt ansteuern.",
      expected: "Der Abschnitt klappt auf und zu; direkt angesprungene Abschnitte klappen von selbst auf.",
      async run(t) {
        await t.tab("verlauf");
        const ids = await t.page.evaluate(() => [...document.querySelectorAll("#sections > section.foldable.folded")].filter((e) => e.offsetParent !== null).map((e) => e.id.slice(4)));
        const id = ids[0];
        await t.page.locator(`#sec-${id} > .fold-bar`).click(); await t.page.waitForTimeout(800);
        const a = await st(t, id);
        await t.page.locator(`#sec-${id} > .fold-bar`).click(); await t.page.waitForTimeout(400);
        const b = await st(t, id);
        const target = (await t.page.evaluate(() => [...document.querySelectorAll("#sections > section.foldable.folded")].filter((e) => e.offsetParent !== null).map((e) => e.id.slice(4))))[0];
        await t.page.evaluate((x) => window.FC.goTo(x), target);
        await t.page.waitForTimeout(1000);
        const c = await st(t, target);
        return { status: a === "offen" && b === "zu" && c === "offen" ? "ok" : "fail", observed: `Verlauf „${id}“: aufklappen ${a}, zuklappen ${b}. Direkt angesprungen (goTo, wie Suche/Sprungleiste) „${target}“: ${c}. Der Weg über die Karten „Neu im Dashboard“ und „Auf einen Blick“ nutzt dieselbe Funktion.`, locator: t.page.locator("body") };
      },
    },
    {
      nr: 5,
      action: "Am Rechner prüfen.",
      expected: "Am Rechner ändert sich nichts.",
      async run(t) {
        await t.page.setViewportSize({ width: 1280, height: 900 });
        await t.page.waitForTimeout(800);
        await t.tab("training");
        const bars = await t.page.locator("#sections .fold-bar").count(), folded = await t.page.locator("#sections > section.folded").count();
        return { status: bars === 0 && folded === 0 ? "ok" : "fail", observed: `Am Rechner (1280 px): Einklapp-Leisten ${bars}, eingeklappte Abschnitte ${folded}.`, locator: t.page.locator("body") };
      },
    },
  ],
};
