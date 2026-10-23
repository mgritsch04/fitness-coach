// #180 Auf einen Blick: wichtigste Analyse-Befunde oben auf „Heute“; „Neu im Dashboard“ springt sauber.
export default {
  issue: 180,
  feature: 180,
  title: "Auf einen Blick: wichtigste Befunde (#180)",
  name: "Auf einen Blick",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Tab „Heute“ öffnen.",
      expected: "Unter dem Morgen-Briefing steht die Karte „Auf einen Blick“ mit bis zu vier Befunden, jeweils markiert mit „Achtung“, „Gut“ oder „Hinweis“.",
      async run(t) {
        await t.open("heute");
        await t.page.locator("#hlList .hl-item").first().waitFor({ timeout: 15_000 });
        const below = await t.page.evaluate(() => { const a = document.querySelector("#sec-briefing"), b = document.querySelector("#sec-highlights"); return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); });
        const items = await t.page.locator("#hlList .hl-item").evaluateAll((es) => es.map((e) => ({ tag: e.querySelector(".hl-tag").textContent.trim(), title: e.querySelector("strong").innerText.trim() })));
        const ok = below && items.length >= 1 && items.length <= 4 && items.every((i) => ["Achtung", "Gut", "Hinweis"].includes(i.tag));
        return { status: ok ? "ok" : "fail", observed: `Unter dem Briefing: ${below}. ${items.length} Befunde: ${items.map((i) => `${i.tag}: ${i.title}`).join(" | ")}.`, locator: t.page.locator("#sec-highlights") };
      },
    },
    {
      nr: 2,
      action: "Bei einem Befund auf „Details“ tippen.",
      expected: "Das Dashboard wechselt in den passenden Tab und landet direkt beim Abschnitt.",
      async run(t) {
        const btn = t.page.locator("#hlList button", { hasText: "Details" }).first();
        const n = await t.page.locator("#hlList button", { hasText: "Details" }).count();
        if (!n) return { status: "fail", observed: "Kein Befund mit „Details“-Knopf." };
        await btn.click();
        await t.page.waitForTimeout(1500);
        const r = await t.page.evaluate(() => { const vis = [...document.querySelectorAll("#sections > section")].find((e) => e.offsetParent !== null && !e.classList.contains("folded") && Math.abs(e.getBoundingClientRect().top) < 40); return { id: vis?.id, tab: localStorage.getItem("fc-tab") }; });
        return { status: r.id && r.id !== "sec-highlights" && r.tab !== "heute" ? "ok" : "fail", observed: `${n} Befunde mit „Details“. Nach dem Tippen: Reiter „${r.tab}“, Abschnitt oben im Bild: ${r.id}.`, locator: t.page.locator("body") };
      },
    },
    {
      nr: 3,
      action: "Prüfen, ob die Aussagen zum eigenen Gefühl passen.",
      expected: "Sie passen; es sind Beobachtungen und Schätzungen aus den eigenen Daten, keine Diagnose.",
      async run(t) {
        await t.tab("heute");
        const note = (await t.text("#hlNote")).trim();
        return { status: "look", observed: `Ob die Befunde zu deinem Gefühl passen, kannst nur du mit echten Daten beurteilen. Hinweis unter der Karte: „${note}“.`, locator: t.page.locator("#sec-highlights") };
      },
    },
    {
      nr: 4,
      action: "In „Neu im Dashboard“ einen Eintrag antippen.",
      expected: "Das Antippen springt sauber zum Abschnitt, auch wenn der erst nachlädt.",
      async run(t) {
        await t.open("heute");
        const items = await t.page.locator("#sec-whatsnew .wn li button:not(.wn-more)").evaluateAll((bs) => bs.map((b) => b.innerText.replace(/\s+/g, " ").trim()));
        if (!items.length) return { status: "fail", observed: "Keine Einträge in „Neu im Dashboard“." };
        await t.page.locator("#sec-whatsnew .wn li button:not(.wn-more)").nth(2).click();
        await t.page.waitForTimeout(1800);
        const r = await t.page.evaluate(() => { const tab = localStorage.getItem("fc-tab"); const vis = [...document.querySelectorAll("#sections > section")].filter((e) => e.offsetParent !== null && !e.classList.contains("folded")).map((e) => ({ id: e.id, top: Math.round(e.getBoundingClientRect().top) })); return { tab, near: vis.filter((v) => v.top > -40 && v.top < 200).map((v) => v.id) }; });
        return { status: r.tab !== "heute" && r.near.length ? "ok" : "fail", observed: `Einträge: ${items.slice(0, 3).join(" | ")}. Nach Tippen auf den dritten: Reiter „${r.tab}“, Abschnitt oben im Bild: ${r.near.join(", ")}.`, locator: t.page.locator("body") };
      },
    },
  ],
};
