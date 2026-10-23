// #322 Am PC Reiter statt einer langen Seite.
const visible = (t) => t.page.evaluate(() => [...document.querySelectorAll("#sections > section, #sections > div")].filter((e) => e.id.startsWith("sec-") && e.offsetParent !== null && e.getBoundingClientRect().height > 0).map((e) => e.id.slice(4)));
const tabs = (t) => t.page.evaluate(() => [...document.querySelectorAll("#tabbar [data-tab]")].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()));

export default {
  issue: 322,
  feature: 322,
  title: "Am PC Reiter statt einer langen Seite (#322)",
  name: "Reiter am PC",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Dashboard am PC in voller Breite öffnen.",
      expected: "Oben eine Reiterleiste (Heute, Coach, Verlauf, Training, Mehr), sichtbar sind nur die Abschnitte von „Heute“.",
      async run(t) {
        await t.open();
        await t.page.waitForTimeout(800);
        const tb = await tabs(t), vis = await visible(t);
        const tabOf = await t.page.evaluate((ids) => ids.map((id) => window.FC.layout.list().find((s) => s.id === id)?.tab), vis);
        const ok = tb.join("|") === "Heute|Coach|Verlauf|Training|Mehr" && vis.length > 0 && tabOf.every((x) => x === "heute");
        return { status: ok ? "ok" : "fail", observed: `Reiter: ${tb.join(", ")}. Sichtbare Abschnitte (${vis.length}): ${vis.join(", ")}; ihre Reiter: ${[...new Set(tabOf)].join(", ")}.`, locator: t.page.locator("body") };
      },
    },
    {
      nr: 2,
      action: "Auf „Training“ klicken und herunterscrollen.",
      expected: "Nur die Abschnitte dieses Reiters sind sichtbar; beim Scrollen bleibt die Leiste oben.",
      async run(t) {
        await t.page.locator("#tabbar [data-tab=training]").click();
        await t.page.waitForTimeout(800);
        const vis = await visible(t);
        const tabOf = await t.page.evaluate((ids) => ids.map((id) => window.FC.layout.list().find((s) => s.id === id)?.tab), vis);
        await t.page.mouse.wheel(0, 1500);
        await t.page.waitForTimeout(500);
        const top = await t.page.evaluate(() => Math.round(document.querySelector("#tabbar").getBoundingClientRect().top));
        const ok = vis.length > 0 && tabOf.every((x) => x === "training") && top <= 2;
        return { status: ok ? "ok" : "fail", observed: `Sichtbar: ${vis.join(", ")} (Reiter: ${[...new Set(tabOf)].join(", ")}). Nach dem Scrollen liegt die Leiste ${top} px unter dem Fensterrand.`, locator: t.page.locator("body") };
      },
    },
    {
      nr: 3,
      action: "Seite neu laden.",
      expected: "„Training“ ist wieder offen.",
      async run(t) {
        await t.page.reload();
        await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 });
        await t.page.waitForTimeout(800);
        const sel = await t.page.evaluate(() => document.querySelector("#tabbar [aria-selected=true], #tabbar .on, #tabbar [aria-current=page]")?.dataset.tab ?? null);
        const vis = await visible(t);
        const tabOf = await t.page.evaluate((ids) => ids.map((id) => window.FC.layout.list().find((s) => s.id === id)?.tab), vis);
        return { status: tabOf.length && tabOf.every((x) => x === "training") ? "ok" : "fail", observed: `Nach dem Neuladen sichtbar: ${vis.join(", ")} (Reiter: ${[...new Set(tabOf)].join(", ")}); markierter Reiter: ${sel}.`, locator: t.page.locator("body") };
      },
    },
    {
      nr: 4,
      action: "Mehr › Dashboard anpassen: „Am PC Reiter statt einer langen Seite“ ausschalten.",
      expected: "Wieder alle Abschnitte untereinander, keine Reiterleiste am PC.",
      async run(t) {
        await t.tab("mehr");
        await t.section("layout");
        await t.page.locator("#loDesk").uncheck();
        await t.page.waitForTimeout(1000);
        const vis = await visible(t), tb = await tabs(t);
        const tabsSeen = new Set(await t.page.evaluate((ids) => ids.map((id) => window.FC.layout.list().find((s) => s.id === id)?.tab), vis));
        const ok = tb.length === 0 && tabsSeen.size >= 4 && vis.length >= 20;
        return { status: ok ? "ok" : "fail", observed: `Reiterleiste sichtbar: ${tb.length ? tb.join(", ") : "nein"}. Sichtbare Abschnitte: ${vis.length}, aus ${tabsSeen.size} verschiedenen Reitern (${[...tabsSeen].join(", ")}).`, locator: t.page.locator("body") };
      },
    },
    {
      nr: 5,
      action: "Optional: Wieder einschalten.",
      expected: "Reiter sind zurück.",
      async run(t) {
        await t.page.locator("#loDesk").check();
        await t.page.waitForTimeout(1000);
        const tb = await tabs(t);
        return { status: tb.length === 5 ? "ok" : "fail", observed: `Reiter: ${tb.join(", ") || "keine"}.`, locator: t.page.locator("body") };
      },
    },
  ],
};
