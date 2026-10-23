// #372 „Heute in 10 Sekunden“: schlanke Startansicht, lokale Nutzungszählung, Vorschlag „Ungenutztes ausblenden“.
const norm = (s) => s.replace(/\s+/g, " ").trim();

export default {
  issue: 372,
  feature: 372,
  title: "„Heute in 10 Sekunden“: schlanke Startansicht und Aufräumen (#372)",
  name: "Heute in 10 Sekunden",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Die Startansicht „Heute“ öffnen.",
      expected: "Oben „Heute in 10 Sekunden“ mit Tagesform, heutigem Training samt einem Tipp und höchstens einer Warnung; keine langen Listen.",
      async run(t) {
        await t.open("heute");
        const sec = await t.section("focus");
        await t.poll(async () => (/Tagesform/.test(await sec.innerText()) ? true : false), 15_000);
        const info = await t.page.evaluate(() => {
          const s = document.getElementById("sec-focus");
          const txt = s.innerText.replace(/\s+/g, " ").trim();
          return {
            txt,
            h: s.querySelector("h2")?.textContent,
            warns: s.querySelectorAll(".fo-warn").length,
            lists: s.querySelectorAll("ul, ol, table").length,
            tips: s.querySelectorAll(".fo-tip").length,
            first: [...document.querySelectorAll("#sections > section.on")].find((x) => x.offsetParent)?.id,
            over: document.documentElement.scrollWidth - window.innerWidth,
          };
        });
        const ok = info.h === "Heute in 10 Sekunden" && /tagesform/i.test(info.txt) && /\d+\/100/.test(info.txt) && /heute dran/i.test(info.txt)
          && info.tips >= 2 && info.warns <= 1 && info.lists === 0 && info.first === "sec-focus" && info.over <= 1 && info.txt.length < 700;
        return { status: ok ? "ok" : "fail", observed: `Überschrift „${info.h}“, oberster sichtbarer Abschnitt ${info.first}, Tipps/Texte ${info.tips}, Warnungen ${info.warns}, Listen/Tabellen ${info.lists}, ${info.txt.length} Zeichen, Überlauf ${info.over}px. Text: „${info.txt}“`, locator: sec };
      },
    },
    {
      nr: 2,
      action: "„Heute schlank halten“ anhaken, einige Abschnitte in anderen Tabs öffnen und zurück zu „Heute“.",
      expected: "In der schlanken Ansicht ist nur „Heute in 10 Sekunden“ sichtbar; Nutzung wird lokal im Browser gezählt (fc-usage).",
      async run(t) {
        await t.open("heute");
        await t.section("focus");
        await t.page.locator("#foLean").check();
        await t.page.waitForTimeout(400);
        const lean = await t.page.evaluate(() => ({
          vis: [...document.querySelectorAll("#sections > section.on")].filter((x) => x.offsetParent).map((x) => x.id),
          stored: localStorage.getItem("fc-lean"),
        }));
        const shot = await t.shot("Schlanke Ansicht", t.page.locator("#sec-focus"));
        for (const tab of ["training", "coach", "mehr"]) {
          await t.tab(tab);
          await t.page.evaluate(() => window.scrollTo(0, 0));
          await t.page.waitForTimeout(1800);
        }
        await t.tab("heute");
        await t.page.waitForTimeout(1500);
        const u = await t.page.evaluate(() => { try { return JSON.parse(localStorage.getItem("fc-usage") ?? "null"); } catch { return null; } });
        const ids = Object.keys(u?.views ?? {});
        const total = ids.reduce((a, k) => a + u.views[k].n, 0);
        const onlyFocus = lean.vis.join() === "sec-focus" && lean.stored === "1";
        const counted = !!u && ids.length >= 2 && total >= 2 && typeof u.since === "string";
        return { status: onlyFocus && counted ? "ok" : "fail", observed: `Schlank: sichtbar ${JSON.stringify(lean.vis)}, fc-lean=${lean.stored}. Nutzung lokal gezählt (fc-usage): ${ids.length} Abschnitte (${ids.join(", ")}), ${total} Aufrufe.`, locator: t.page.locator("#sec-focus") };
      },
    },
    {
      nr: 3,
      action: "Unter „Mehr“ → „Dashboard anpassen“ den Vorschlag „Ungenutztes ausblenden“ ansehen (per gesetztem Zähler) und übernehmen.",
      expected: "Nie geöffnete Abschnitte sind ausgeblendet; „Alle … wieder einblenden“ holt sie zurück.",
      async run(t) {
        await t.page.evaluate(() => {
          localStorage.setItem("fc-lean", "0");
          localStorage.setItem("fc-usage", JSON.stringify({ since: new Date(Date.now() - 9 * 864e5).toISOString(), views: { today: { n: 40, last: null }, agenda: { n: 5, last: null } } }));
        });
        await t.page.reload();
        await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 });
        await t.page.waitForLoadState("networkidle");
        await t.tab("heute");
        await t.page.waitForTimeout(800);
        const hint = norm(await t.page.locator("#foHint").innerText().catch(() => ""));
        await t.page.evaluate(() => FC.goTo("layout"));
        await t.page.waitForTimeout(700);
        const box = t.page.locator("#loSug");
        const before = norm(await box.innerText());
        await t.shot("Vorschlag Ungenutztes ausblenden", box);
        const dbg = await t.page.evaluate(() => ({ st: document.getElementById("loSugState")?.textContent, btn: !!document.getElementById("loSugApply"), usage: localStorage.getItem("fc-usage") }));
        if (!dbg.btn) return { status: "fail", observed: `Kein Übernehmen-Knopf. ${JSON.stringify(dbg)}` };
        await t.page.click("#loSugApply");
        await t.page.waitForTimeout(400);
        const hid = await t.page.evaluate(() => ({
          n: FC.layout.list().filter((x) => x.hidden).length,
          today: document.getElementById("sec-today").hidden,
          agenda: document.getElementById("sec-agenda").hidden,
          focus: document.getElementById("sec-focus").hidden,
        }));
        await t.shot("Nach Ausblenden", box);
        const hasBack = await t.page.locator("#loShowAll").isVisible();
        await t.page.click("#loShowAll");
        await t.page.waitForTimeout(400);
        const left = await t.page.evaluate(() => FC.layout.list().filter((x) => x.hidden).length);
        const ok = /Abschnitte ausblenden|ungenutzte Abschnitte/.test(before + hint) && hid.n >= 10 && !hid.today && !hid.agenda && !hid.focus && hasBack && left === 0;
        return { status: ok ? "ok" : "fail", observed: `Hinweis auf Heute: „${hint}“. Vorschlag: „${before.slice(0, 260)}…“. Nach Übernehmen ausgeblendet: ${hid.n} (Heute-Abschnitt ${hid.today ? "weg" : "da"}, Agenda ${hid.agenda ? "weg" : "da"}, Fokus ${hid.focus ? "weg" : "da"}). „Alle wieder einblenden“ sichtbar: ${hasBack}; danach ausgeblendet: ${left}.`, locator: box };
      },
    },
  ],
};
