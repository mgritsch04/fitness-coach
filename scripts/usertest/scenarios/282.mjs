// #282 Schweißrate auf der Rolle – Testschritte nach PR #308 (Formular bleibt beim Neuzeichnen offen).
const de = (n) => n.toLocaleString("de-DE");
const vals = (t) => t.page.evaluate(() => ["swBefore", "swAfter", "swDrank", "swDur"].map((id) => document.getElementById(id)?.value ?? null));
const open = (t) => t.page.evaluate(() => document.querySelector("details.ag-sw")?.open === true);

export default {
  issue: 282,
  feature: 282,
  title: "Schweißrate auf der Rolle (#282)",
  name: "Schweißrate auf der Rolle",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Tab Agenda öffnen, den heutigen Tag auswählen (heute: synthetische 60-min-Rollenfahrt per FIT-Import).",
      expected: "Unter der Radeinheit steht „Schweißrate messen“ (zugeklappt).",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        await t.tool("import_fit", { fileName: "usertest-rolle.fit", fileBase64: await t.fit({ start: `${today}T15:00:00Z`, seconds: 3600, watts: 180 }) });
        await t.open("heute");
        const sec = await t.section("agenda");
        const n = await sec.locator("details.ag-sw").count();
        const closed = n === 1 && !(await open(t));
        return { status: closed ? "ok" : "fail", observed: n ? `„${await sec.locator("details.ag-sw summary").innerText()}“ vorhanden, ${closed ? "zugeklappt" : "aufgeklappt"}.` : "„Schweißrate messen“ fehlt.", locator: sec };
      },
    },
    {
      nr: 2,
      action: "„Schweißrate messen“ anklicken und eine Sekunde warten.",
      expected: "Das Formular bleibt offen (Gewicht vorher, Gewicht nachher, Getrunken, Dauer, „Auf der Rolle“).",
      async run(t) {
        await t.page.click("details.ag-sw summary");
        await t.page.waitForTimeout(1000);
        const o = await open(t);
        const fields = (await vals(t)).filter((v) => v !== null).length + (await t.page.locator("#swIn").count());
        return { status: o && fields === 5 ? "ok" : "fail", observed: `Formular ${o ? "bleibt offen" : "ist wieder zu"}, ${fields}/5 Felder da.`, locator: t.page.locator("#sec-agenda") };
      },
    },
    {
      nr: 3,
      action: "Gewicht vorher 70, Gewicht nachher 69,2, Getrunken 0,6, Dauer 60 eintragen und eine Sekunde warten.",
      expected: "Alle Werte bleiben stehen, das Formular bleibt offen.",
      async run(t) {
        await t.page.fill("#swBefore", "70");
        await t.page.fill("#swAfter", "69.2");
        await t.page.fill("#swDrank", "0.6");
        await t.page.fill("#swDur", "60");
        await t.page.waitForTimeout(1000);
        const v = await vals(t), o = await open(t);
        const ok = o && v.join("|") === "70|69.2|0.6|60";
        return { status: ok ? "ok" : "fail", observed: `Werte: ${v.join(", ")}; Formular ${o ? "offen" : "zu"}.`, locator: t.page.locator("#sec-agenda") };
      },
    },
    {
      nr: 4,
      action: "„Speichern“ antippen.",
      expected: "„Gespeichert: 1,4 l/h …“ mit einer Trinkempfehlung pro Stunde; das Formular bleibt offen.",
      async run(t) {
        await t.page.click("details.ag-sw button.primary");
        const out = await t.poll(async () => { const s = await t.text("#swOut"); return /Gespeichert/.test(s) && s; });
        await t.page.waitForTimeout(1000);
        const stored = (await t.tool("get_sweat_rate", {})).indoor;
        const ok = !!out && /1,4 l\/h/.test(out) && /pro Stunde trinken/.test(out) && stored?.rateLph === 1.4 && (await open(t));
        return { status: ok ? "ok" : "fail", observed: `Anzeige: „${out || (await t.text("#swOut"))}“; gespeichert ${stored ? de(stored.rateLph) + " l/h" : "nichts"}; Formular ${(await open(t)) ? "offen" : "zu"}.`, locator: t.page.locator("#sec-agenda") };
      },
    },
    {
      nr: 5,
      action: "Optional: Fenstergröße ändern (oder Handy drehen).",
      expected: "Formular, Werte und Ergebnis bleiben erhalten.",
      async run(t) {
        const before = await t.text("#swOut");
        await t.page.setViewportSize({ width: 900, height: 800 });
        await t.page.waitForTimeout(800);
        await t.page.setViewportSize({ width: 1280, height: 900 });
        await t.page.waitForTimeout(800);
        const v = await vals(t), o = await open(t), after = await t.text("#swOut");
        const ok = o && v.join("|") === "70|69.2|0.6|60" && after === before;
        return { status: ok ? "ok" : "fail", observed: `Nach Größenänderung: Formular ${o ? "offen" : "zu"}, Werte ${v.join(", ")}, Ergebnis ${after === before ? "unverändert" : `„${after}“`}.`, locator: t.page.locator("#sec-agenda") };
      },
    },
  ],
};
