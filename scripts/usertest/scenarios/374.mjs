// #374 Verpflegungszettel je Einheit (Erweiterung von #87). Vorprüfung mit synthetischen Daten.
const norm = (s) => s.replace(/\s+/g, " ").trim();

/** Tag im Wochenplan antippen, dessen Beschriftung passt; liefert den Detailtext. */
async function dayDetail(t, pick) {
  const sec = await t.section("plan");
  const days = sec.locator("button.pd");
  const n = await days.count();
  for (let i = 0; i < n; i++) {
    const lbl = await days.nth(i).getAttribute("aria-label");
    if (pick(lbl)) { await days.nth(i).click(); return { sec, lbl, txt: norm(await sec.locator("#planDetail").innerText()) }; }
  }
  return { sec, lbl: null, txt: "" };
}
const num = (txt, label) => { const m = new RegExp(`${label}\\s+(\\d+)(?:–(\\d+))? ?g`).exec(txt); return m ? Number(m[2] ?? m[1]) : null; };
let before = null;

export default {
  issue: 374,
  feature: 374,
  title: "Verpflegungszettel je Einheit (#374)",
  name: "Verpflegungszettel je Einheit",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Die lange Einheit im Wochenplan öffnen (Schweißrate als Testwert gespeichert).",
      expected: "Verpflegungszettel mit Kohlenhydraten/h, Trinkmenge/h, Natrium, „vorher“ und „danach“.",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        await t.tool("log_sweat_test", { day: today, durationMin: 60, weightBeforeKg: 70, weightAfterKg: 69.2, drankL: 0.6, indoor: true });
        await t.open("coach");
        const { sec, lbl, txt } = await dayDetail(t, (l) => /Lange/.test(l));
        before = txt;
        const ok = /Verpflegungszettel/.test(txt) && /Kohlenhydrate/i.test(txt) && /Trinken/i.test(txt) && /Natrium/i.test(txt) && /vorher/i.test(txt) && /danach/i.test(txt) && /pro Stunde/i.test(txt) && /deine Schweißrate/.test(txt);
        return { status: ok ? "look" : "fail", observed: `${lbl}: „${txt.slice(txt.indexOf("Verpflegungszettel"), txt.indexOf("Verpflegungszettel") + 420)}“`, locator: sec };
      },
    },
    {
      nr: 2,
      action: "Dauer erhöhen (lange Einheit im Plan um 60 min verlängern, speichern, Seite neu laden) und den Zettel wieder öffnen.",
      expected: "Mengen passen sich an.",
      async run(t) {
        const dash = await t.tool("get_dashboard", { days: 7 });
        const plan = dash.training.thisWeek.plan;
        const day = plan.days.find((x) => x.type === "long") ?? plan.days.find((x) => x.durationMin >= 75 && x.type !== "strength");
        const days = plan.days.map((x) => ({ day: x.day, type: x.type, title: x.title, durationMin: x.day === day.day ? x.durationMin + 60 : x.durationMin, intensity: x.intensity, description: x.description, key: x.key, strength: x.strength }));
        await t.tool("save_plan", { week: plan.weekStart, days });
        await t.open("coach");
        const { sec, txt } = await dayDetail(t, (l) => /Lange/.test(l));
        const [b, a] = [num(before, "KOHLENHYDRATE"), num(txt, "KOHLENHYDRATE")];
        const totalsB = /(\d[\d,]*) l (\d[\d,]*) l/.exec(before), totalsA = /(\d[\d,]*) l (\d[\d,]*) l/.exec(txt);
        const ok = /Verpflegungszettel/.test(txt) && txt !== before && totalsA && totalsB && Number(totalsA[2].replace(",", ".")) > Number(totalsB[2].replace(",", "."));
        return { status: ok ? "ok" : "fail", observed: `Vorher: Kohlenhydrate bis ${b} g/h, Trinken gesamt ${totalsB?.[2]} l. Nachher (+60 min): bis ${a} g/h, gesamt ${totalsA?.[2]} l.`, locator: sec };
      },
    },
    {
      nr: 3,
      action: "Eine Einheit unter 75 Minuten ansehen.",
      expected: "Kein oder nur ein kurzer Zettel.",
      async run(t) {
        const dash = await t.tool("get_dashboard", { days: 7 });
        const short = dash.training.thisWeek.plan.days.find((x) => x.type !== "rest" && x.type !== "strength" && x.durationMin > 0 && x.durationMin < 75);
        if (!short) return { status: "fail", observed: "Kein Radtag unter 75 min im Testplan." };
        const { sec, lbl, txt } = await dayDetail(t, (l) => l.includes(short.title));
        const ok = !!lbl && !/Verpflegungszettel/.test(txt) && /Verpflegung:/.test(txt);
        return { status: ok ? "ok" : "fail", observed: `${lbl}: „${txt.slice(txt.indexOf("Verpflegung"), txt.indexOf("Verpflegung") + 260)}“`, locator: sec };
      },
    },
    {
      nr: 4,
      action: "Zettel lesen.",
      expected: "Als Richtwert gekennzeichnet, keine medizinische Aussage.",
      async run(t) {
        const { sec, txt } = await dayDetail(t, (l) => /Lange/.test(l));
        const ok = /Richtwert/.test(txt) && /keine Ernährungsberatung/.test(txt) && /keine medizinische Aussage/.test(txt) && !/Diagnose|Therapie|Krankheit/.test(txt);
        const over = await t.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        return { status: ok && over <= 1 ? "ok" : "fail", observed: `Hinweis: „${txt.slice(txt.indexOf("Richtwert"), txt.indexOf("Richtwert") + 230)}“; kein seitlicher Überlauf: ${over <= 1}.`, locator: sec };
      },
    },
  ],
};
