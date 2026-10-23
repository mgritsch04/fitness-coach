// #214 Zeit-in-Zone-Ziele je Woche (Training › Pulszonen › „Diese Woche: Plan gegen Ist“).
import { unit } from "./_unit.mjs";
export default {
  issue: 214,
  feature: 214,
  title: "Zeit-in-Zone-Ziele je Woche (#214)",
  name: "Plan gegen Ist je Pulszone",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Dashboard öffnen, Tab „Training“, Abschnitt „Pulszonen“ ansehen.",
      expected: "Unter dem Diagramm steht „Diese Woche: Plan gegen Ist“ mit drei Balken: gestrichelt die geplanten Minuten der ganzen Woche, gefüllt die gemessenen (WHOOP).",
      async run(t) {
        await t.open("training");
        await t.section("hrzones");
        const vis = await t.page.locator("#hzTargets").isVisible(), h = (await t.text("#hzTargets h3")).trim();
        const rows = await t.page.locator("#hzRows .hz-row").evaluateAll((rs) => rs.map((r) => ({ label: r.children[0].innerText, txt: r.querySelector("b").innerText, plan: r.querySelector(".hz-plan") != null, done: r.querySelector(".hz-done") != null })));
        const dashed = await t.page.locator("#hzRows .hz-plan").first().evaluate((e) => getComputedStyle(e).borderStyle + " " + getComputedStyle(e).outlineStyle);
        return { status: vis && /Plan gegen Ist/.test(h) && rows.length === 3 && rows.every((r) => r.plan && r.done && /\d+ min/.test(r.txt)) ? "ok" : "fail", observed: `Überschrift „${h}“. Balken: ${rows.map((r) => `${r.label}: ${r.txt}`).join(" · ")}. Stil Soll-Balken: ${dashed}.`, locator: t.page.locator("#hzTargets") };
      },
    },
    {
      nr: 2,
      action: "Prüfen, ob die Zahlen grob zu deinem Wochenplan passen.",
      expected: "Die Zahlen passen grob zu deinem Wochenplan.",
      async run(t) {
        const d = await t.tool("get_dashboard", { days: 7 });
        const planMin = d.training.thisWeek.plan.days.filter((x) => !["rest", "strength"].includes(x.type)).reduce((a, x) => a + x.durationMin, 0);
        const rows = d.zoneTargets.rows, sum = rows.reduce((a, r) => a + r.targetMin, 0);
        const ok = sum > 0 && Math.abs(sum - planMin) <= Math.max(10, planMin * 0.1);
        return { status: ok ? "ok" : "fail", observed: `Geplante Ausdauerzeit im Wochenplan ${planMin} min; Soll in den drei Balken zusammen ${sum} min (${rows.map((r) => `${r.label} ${r.targetMin}`).join(", ")}). Ob das zu deiner echten Woche passt, beurteilst du.`, locator: t.page.locator("#hzTargets") };
      },
    },
    {
      nr: 3,
      action: "Prüfen, ob der Hinweis „zu viel im mittleren Bereich“ erscheint, wenn lockere Einheiten zu schnell gefahren werden.",
      expected: "Der Hinweis erscheint.",
      async run(t) {
        const hints = await t.page.locator("#hzHints li").allInnerTexts();
        const u = unit("zone-targets.test.ts", "zu viel im mittleren Bereich");
        return { status: u.pass ? "ok" : "fail", observed: `Hinweise in den Testdaten: ${hints.map((h) => `„${h}“`).join(", ") || "keine"} (hier passt die Verteilung). Der Fall „lockere Einheiten zu schnell“ ist in der Oberfläche nicht herstellbar; belegt über den Unit-Test „zu viel im mittleren Bereich“: ${u.pass ? "bestanden" : "nicht bestanden"} (${u.line}).` };
      },
    },
    {
      nr: 4,
      action: "Prüfen, ob der Block ausgeblendet ist, wenn im Plan keine Ausdauereinheiten stehen.",
      expected: "Der Block ist ausgeblendet.",
      async run(t) {
        const u = unit("zone-targets.test.ts", "keine Ausdauer geplant");
        return { status: u.pass ? "ok" : "fail", observed: `Ein Plan ganz ohne Ausdauereinheiten ist in den Testdaten nicht herstellbar. Belegt über den Unit-Test „keine Ausdauer geplant“ (Soll 0 → Block ausgeblendet, im Code \`box.hidden = !t || !t.target.totalMin\`): ${u.pass ? "bestanden" : "nicht bestanden"} (${u.line}).` };
      },
    },
  ],
};
