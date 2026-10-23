// #291 Dashboard: Lieblingsabschnitte anheften (Favoriten oben auf „Heute“). Wie am Handy bedient (390 px).
// Gewünscht: Trainingslast, Schlaf im Detail, Gym-Modus. Ist der Stern dort am Handy nicht erreichbar, werden die weiteren Schritte
// mit Abschnitten aus „Coach“ und „Mehr“ weitergeprüft (dort gibt es keine Einklapp-Leiste).
// Am Handy sitzt der Stern in einklappbaren Reitern in der Einklapp-Leiste (.fav-bar), sonst neben der Überschrift.
const star = (t, id) => t.page.locator(`#sec-${id} > .fav-bar, #h-${id} .fav-btn`).locator("visible=true").first();
const favs = (t) => t.page.locator("#favList li button").evaluateAll((bs) => bs.map((b) => b.innerText.replace(/\s+/g, " ").trim()));
const WANT = [["training", "load", /Trainingslast.*Training/], ["verlauf", "sleep", /Schlaf im Detail.*Verlauf/], ["training", "gym", /Gym-Modus.*Training/]];
const FALL = [["coach", "plan", /Wochenplan.*Coach/], ["mehr", "settings", /Einstellungen.*Mehr/], ["mehr", "sources", /Datenquellen.*Mehr/]];

export default {
  issue: 291,
  feature: 291,
  title: "Favoriten anheften (#291)",
  name: "Favoriten oben auf Heute",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Den kleinen Stern neben der Überschrift bei drei Abschnitten antippen (Trainingslast, Schlaf im Detail, Gym-Modus).",
      expected: "Der Stern füllt sich.",
      async run(t) {
        await t.open();
        t.fav = [];
        const res = [], missing = [];
        for (const [tab, id, re] of WANT) {
          await t.tab(tab);
          await t.section(id);
          if (await star(t, id).isVisible()) { await star(t, id).click(); res.push(`${id}: ${await star(t, id).getAttribute("aria-pressed")}`); t.fav.push([tab, id, re]); }
          else missing.push(id);
        }
        // Weiter mit Ersatzabschnitten, damit die übrigen Schritte geprüft werden können.
        for (const [tab, id, re] of FALL) {
          if (t.fav.length >= 3) break;
          if (!missing.length) break;
          await t.tab(tab); await t.section(id);
          if (await star(t, id).isVisible()) { await star(t, id).click(); t.fav.push([tab, id, re]); }
        }
        const ok = missing.length === 0 && res.every((r) => r.endsWith("true"));
        return { status: ok ? "ok" : "fail", observed: ok ? `aria-pressed nach dem Antippen: ${res.join(", ")}.` : `Stern am Handy NICHT sichtbar/antippbar bei: ${missing.join(", ")} (die Überschrift ist dort durch die Einklapp-Leiste ausgeblendet, .fold-title { display: none }). Funktioniert bei: ${res.join(", ") || "keinem"}. Weitere Schritte mit Ersatzabschnitten: ${t.fav.filter(([, id]) => !WANT.some((w) => w[1] === id)).map((f) => f[1]).join(", ") || "–"}.`, locator: t.page.locator("body") };
      },
    },
    {
      nr: 2,
      action: "Oben auf „Heute“ ansehen.",
      expected: "„Deine Favoriten“ mit je einem Knopf (Name und Tab).",
      async run(t) {
        await t.tab("heute");
        await t.page.waitForTimeout(600);
        const head = await t.text("#h-favorites").catch(() => "");
        const list = await favs(t);
        const ok = /Deine Favoriten/.test(head) && list.length === t.fav.length && t.fav.length > 0 && t.fav.every(([, , re]) => list.some((x) => re.test(x)));
        return { status: ok ? "ok" : "fail", observed: `Überschrift „${head}“, Knöpfe: ${list.map((x) => `„${x}“`).join(", ") || "keine"}.`, locator: t.page.locator("#sec-favorites") };
      },
    },
    {
      nr: 3,
      action: "Einen Favoriten antippen.",
      expected: "Das Dashboard springt in den Tab und zum Abschnitt.",
      async run(t) {
        const [tab, id] = t.fav[0];
        await t.page.locator("#favList li button").first().click();
        await t.page.waitForTimeout(1200);
        const r = await t.page.evaluate((id) => { const e = document.querySelector(`#sec-${id}`); const b = e?.getBoundingClientRect(); return { vis: !!e && e.offsetParent !== null, top: Math.round(b?.top ?? -999), folded: e?.classList.contains("folded"), tab: localStorage.getItem("fc-tab") }; }, id);
        const ok = r.vis && !r.folded && r.top > -10 && r.top < 700 && r.tab === tab;
        return { status: ok ? "ok" : "fail", observed: `Abschnitt „${id}“ sichtbar: ${r.vis}, eingeklappt: ${r.folded}, Abstand vom Fensterrand oben: ${r.top} px, aktiver Reiter: ${r.tab} (erwartet ${tab}).`, locator: t.page.locator(`#sec-${id}`) };
      },
    },
    {
      nr: 4,
      action: "Dashboard neu laden.",
      expected: "Die Favoriten sind noch da.",
      async run(t) {
        await t.page.reload();
        await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 });
        await t.page.waitForTimeout(800);
        await t.tab("heute");
        const list = await favs(t);
        return { status: list.length === t.fav.length ? "ok" : "fail", observed: `Nach dem Neuladen: ${list.map((x) => `„${x}“`).join(", ") || "keine"}.`, locator: t.page.locator("#sec-favorites") };
      },
    },
    {
      nr: 5,
      action: "Den Stern des Abschnitts nochmal antippen.",
      expected: "Der Abschnitt wird wieder aus den Favoriten entfernt.",
      async run(t) {
        const [tab, id, re] = t.fav[0];
        await t.tab(tab);
        await t.section(id);
        await star(t, id).click();
        const pressed = await star(t, id).getAttribute("aria-pressed");
        await t.tab("heute");
        const list = await favs(t);
        return { status: pressed === "false" && list.length === t.fav.length - 1 && !list.some((x) => re.test(x)) ? "ok" : "fail", observed: `Stern: ${pressed}. Favoriten jetzt: ${list.map((x) => `„${x}“`).join(", ")}.`, locator: t.page.locator("#sec-favorites") };
      },
    },
  ],
};
