// #269 Dashboard: Abschnitte suchen und direkt hinspringen.
const hits = (t) => t.page.locator("#searchList button").evaluateAll((bs) => bs.map((b) => b.innerText.replace(/\s+/g, " ").trim()));
const type = async (t, q) => { await t.page.fill("#searchInput", q); await t.page.waitForTimeout(250); };

export default {
  issue: 269,
  feature: 269,
  title: "Abschnitte suchen (#269)",
  name: "Dashboard-Suche",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Oben neben „Jetzt abgleichen“ auf „Suchen“ tippen.",
      expected: "Das Suchfeld öffnet sich.",
      async run(t) {
        await t.open();
        await t.page.locator("#btnSearch").click();
        const open = await t.page.locator("#searchDlg").evaluate((d) => d.open);
        const vis = await t.page.locator("#searchInput").isVisible();
        return { status: open && vis ? "ok" : "fail", observed: `Dialog offen: ${open}, Suchfeld sichtbar: ${vis}.`, locator: t.page.locator("#searchDlg") };
      },
    },
    {
      nr: 2,
      action: "„kadenz“ eingeben.",
      expected: "Als Treffer steht „Trittfrequenz“ mit dem Tab „Training“ daneben.",
      async run(t) {
        await type(t, "kadenz");
        const h = await hits(t);
        return { status: h.length >= 1 && /Trittfrequenz.*Training/.test(h[0]) ? "ok" : "fail", observed: `Treffer: ${h.map((x) => `„${x}“`).join(", ")}.`, locator: t.page.locator("#searchDlg") };
      },
    },
    {
      nr: 3,
      action: "Den Treffer antippen.",
      expected: "Das Dashboard wechselt in den Tab „Training“, klappt Trittfrequenz am Handy auf und scrollt hin.",
      async run(t) {
        await t.page.locator("#searchList button").first().click();
        await t.page.waitForTimeout(1500);
        const r = await t.page.evaluate(() => { const e = document.querySelector("#sec-cadence"); const b = e?.getBoundingClientRect(); return { vis: !!e && e.offsetParent !== null, folded: e?.classList.contains("folded"), top: Math.round(b?.top ?? -999), tab: localStorage.getItem("fc-tab") }; });
        const ok = r.vis && !r.folded && r.top > -10 && r.top < 700 && r.tab === "training";
        return { status: ok ? "ok" : "fail", observed: `Abschnitt Trittfrequenz sichtbar: ${r.vis}, eingeklappt: ${r.folded}, Abstand oben: ${r.top} px, aktiver Reiter: ${r.tab}.`, locator: t.page.locator("#sec-cadence") };
      },
    },
    {
      nr: 4,
      action: "Weitere Begriffe suchen: „schlaf“, „ftp“, „gewicht“, „wetter“.",
      expected: "Du findest, was du suchst; fehlt dir ein Suchwort, fällt dir das auf.",
      async run(t) {
        const want = { schlaf: /Schlaf/, ftp: /FTP/, gewicht: /Gewicht/, wetter: /Radwetter/ };
        const out = [];
        let ok = true;
        for (const [q, re] of Object.entries(want)) {
          await t.page.evaluate(() => window.scrollTo(0, 0));
          await t.page.locator("#btnSearch").click();
          await type(t, q);
          const h = await hits(t);
          const good = h.some((x) => re.test(x));
          ok &&= good;
          out.push(`„${q}“ → ${h.length ? h.slice(0, 4).join(" | ") : "keine Treffer"}${good ? "" : " (erwartet nicht gefunden)"}`);
          await t.page.locator(".search-close").click();
        }
        return { status: ok ? "ok" : "fail", observed: out.join(" · ") + ". Ob dir ein weiteres Suchwort fehlt, kannst nur du beurteilen.", locator: t.page.locator("#searchDlg") };
      },
    },
  ],
};
