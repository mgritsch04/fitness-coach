// [USERTEST] Schweißrate auf der Rolle (#282). Wiegen und Trinken sind Handgriffe des Nutzers: hier synthetische Werte.
const BEFORE = 75.0, AFTER = 74.2, DRANK = 0.5, MIN = 60;
const RATE = Math.round(((BEFORE - AFTER + DRANK) / (MIN / 60)) * 100) / 100; // 1,3 l/h
const de = (n) => n.toLocaleString("de-DE");

export default {
  issue: 296,
  feature: 282,
  title: "[USERTEST] Schweißrate auf der Rolle (#282)",
  name: "Schweißrate auf der Rolle",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Vor der Fahrt ohne Kleidung wiegen und die getrunkene Menge notieren.",
      expected: "Handgriff des Nutzers – hier: synthetische 60-min-Rollenfahrt für heute per FIT-Import, Gewicht vorher 75,0 kg, getrunken 0,5 l.",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        const r = await t.tool("import_fit", { fileName: "usertest-rolle.fit", fileBase64: await t.fit({ start: `${today}T15:00:00Z`, seconds: MIN * 60, watts: 180 }) });
        return {
          status: "skip",
          observed: `Wiegen ist ein Handgriff, nicht automatisierbar; ersetzt durch synthetische Werte. Fahrt importiert: ${r.workout?.day}, ${Math.round((r.workout?.durationS ?? 0) / 60)} min (${r.imported ? "neu" : "schon vorhanden"}).`,
          noFinalShot: true,
        };
      },
    },
    {
      nr: 2,
      action: "Nach der Fahrt abtrocknen und wieder wiegen.",
      expected: "Handgriff des Nutzers – hier: Gewicht nachher 74,2 kg.",
      async run() {
        return { status: "skip", observed: "Handgriff, nicht automatisierbar; synthetisch 74,2 kg.", noFinalShot: true };
      },
    },
    {
      nr: 3,
      action: "Unter „Heute dran“ › „Schweißrate messen“ die Werte eintragen und speichern.",
      expected: "Die Messung wird gespeichert und die Schweißrate angezeigt.",
      async run(t) {
        await t.open("heute");
        const sec = await t.section("agenda");
        const box = sec.locator("details.ag-sw");
        if (!(await box.count())) return { status: "fail", observed: "„Schweißrate messen“ fehlt unter „Heute dran“ trotz Radfahrt heute.", locator: sec };
        await box.locator("summary").click();
        await t.page.waitForTimeout(800);
        const staysOpen = await t.page.evaluate(() => document.querySelector("details.ag-sw")?.open === true);
        // Eintragen und Speichern in einem Zug (falls die Messung wieder zuklappt, gehen getippte Werte sonst verloren).
        await t.page.evaluate(([b, a, d, m]) => {
          const box = document.querySelector("details.ag-sw"); box.open = true;
          const set = (id, v) => { const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); };
          set("swBefore", b); set("swAfter", a); set("swDrank", d); set("swDur", m);
          box.querySelector("button.primary").click();
        }, [String(BEFORE), String(AFTER), String(DRANK), String(MIN)]);
        const out = await t.poll(async () => { const s = await t.text("#swOut"); return /Gespeichert/.test(s) && s; });
        const stored = (await t.tool("get_sweat_rate", {})).indoor;
        const ok = staysOpen && out && out.includes(`${de(RATE)} l/h`) && stored?.rateLph === RATE;
        const closes = staysOpen ? "" : "„Schweißrate messen“ klappt nach dem Aufklappen nach etwa 0,1 s von selbst wieder zu, getippte Werte gehen verloren (Desktop und Handy). ";
        return { status: ok ? "ok" : "fail", observed: `${closes}Speichern selbst: Anzeige: „${out || (await t.text("#swOut"))}“. Gespeichert (Rolle): ${stored ? `${de(stored.rateLph)} l/h, ${stored.tests} Messung(en)` : "nichts"}.`, locator: sec };
      },
    },
    {
      nr: 4,
      action: "Wirkt die Rate plausibel? Nennt die Verpflegung danach deine persönliche Trinkmenge pro Stunde?",
      expected: `Rate = (vorher − nachher + getrunken) / Stunden = ${de(RATE)} l/h (üblich 0,5–2,5 l/h); die Verpflegung im Plan nennt die persönliche Trinkmenge.`,
      async run(t) {
        await t.open("heute");
        const d = await t.page.evaluate(() => window.FC.state.data.training);
        const personal = (d?.fueling?.days ?? []).filter((f) => /deine Schweißrate/.test(f.during ?? ""));
        const plausible = d?.sweat?.indoor?.rateLph === RATE && RATE >= 0.5 && RATE <= 2.5;
        const sec = await t.section("agenda");
        const drink = `${de(d?.sweat?.indoor?.drinkLph ?? -1)} l/h`;
        const line = (await t.text("#agBody")).split("\n").find((l) => l.startsWith("Verpflegung")) ?? "";
        const todayPersonal = personal.some((f) => f.day === d?.thisWeek?.today || f.short?.endsWith(drink));
        const shown = line.endsWith(drink);
        const ok = plausible && personal.length > 0 && todayPersonal && shown;
        return {
          status: ok ? "ok" : "fail",
          observed: `Rate ${de(d?.sweat?.indoor?.rateLph ?? 0)} l/h (Formel ergibt ${de(RATE)} l/h). ${personal.length} Plantage mit persönlicher Trinkmenge, z. B. „${personal[0]?.during ?? "–"}“; „Heute dran“ zeigt: „${line || "keine Verpflegungszeile"}“.`,
          locator: sec,
        };
      },
    },
  ],
};
