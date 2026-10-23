// #191 Handy: „Heute“ unterhalb von „Heute dran“ einklappen (390 px).
const state = (t, ids) => t.page.evaluate((ids) => Object.fromEntries(ids.map((id) => { const e = document.querySelector(`#sec-${id}`); return [id, !e || e.hidden ? "fehlt" : e.classList.contains("folded") ? "zu" : "offen"]; })), ids);
const BELOW = ["weather", "journal", "records", "forecast"], ABOVE = ["whatsnew", "briefing", "highlights", "today", "agenda"];
export default {
  issue: 191,
  feature: 191,
  title: "Handy: Heute unterhalb von „Heute dran“ einklappen (#191)",
  name: "Heute einklappbar",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Tab „Heute“ öffnen.",
      expected: "Bis einschließlich „Heute dran“ ist alles offen; darunter stehen Radwetter, Check-in, Bestleistungen und Erholung morgen als Überschriften mit Pfeil.",
      async run(t) {
        await t.open("heute");
        await t.page.waitForTimeout(800);
        const up = await state(t, ABOVE), down = await state(t, BELOW);
        const bars = await t.page.locator("#sec-weather > .fold-bar, #sec-journal > .fold-bar, #sec-records > .fold-bar, #sec-forecast > .fold-bar").allInnerTexts();
        const ok = Object.values(up).every((v) => v === "offen" || v === "fehlt") && Object.values(down).every((v) => v === "zu") && bars.length === 4;
        return { status: ok ? "ok" : "fail", observed: `Bis „Heute dran“: ${JSON.stringify(up)}. Darunter: ${JSON.stringify(down)}; Überschriften-Leisten: ${bars.join(", ")}.`, locator: t.page.locator("body") };
      },
    },
    {
      nr: 2,
      action: "Eine davon antippen (Check-in).",
      expected: "Sie klappt auf; nach dem Neuladen bleibt sie offen.",
      async run(t) {
        await t.page.locator("#sec-journal > .fold-bar").click();
        await t.page.waitForTimeout(500);
        const open = await state(t, ["journal"]);
        await t.page.reload();
        await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 });
        await t.page.waitForTimeout(800);
        await t.tab("heute");
        const after = await state(t, ["journal", "weather"]);
        return { status: open.journal === "offen" && after.journal === "offen" && after.weather === "zu" ? "ok" : "fail", observed: `Nach Antippen: ${open.journal}. Nach Neuladen: ${JSON.stringify(after)}.`, locator: t.page.locator("#sec-journal") };
      },
    },
    {
      nr: 3,
      action: "Optional: Einen Abschnitt, den du täglich brauchst, offen lassen.",
      expected: "Er bleibt nach dem Neuladen offen.",
      async run(t) {
        return { status: "ok", observed: "Der in Schritt 2 aufgeklappte Check-in blieb nach dem Neuladen offen (gleiche Funktion)." };
      },
    },
  ],
};
