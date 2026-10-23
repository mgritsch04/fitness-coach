// #328 Übungen: Verlauf und Prognose je Übung (Krafttraining › Fortschritt je Übung, Gym-Modus › Verlauf).
// Synthetisch: Kniebeuge steigt in 6 Einheiten (60 → 85 kg × 5), Bankdrücken bleibt 5 Wochen bei 60 kg × 5 (Plateau), Kreuzheben hat nur 1 Einheit.
const add = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const TPL = "Verlauf-Test";

export default {
  issue: 328,
  feature: 328,
  title: "Verlauf und Prognose je Übung (#328)",
  name: "Übungsverlauf mit Prognose",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Im Krafttraining unter „Fortschritt je Übung“ auf den Namen einer Übung mit mehreren Einheiten tippen.",
      expected: "Darunter öffnet sich ein Verlaufsdiagramm des geschätzten Maximums.",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        const ws = [60, 65, 70, 75, 80, 85];
        for (let i = 0; i < ws.length; i++) await t.tool("log_strength_session", { day: add(today, -35 + i * 7), exercises: [{ exercise: "Kniebeuge", sets: [{ reps: 5, weightKg: ws[i] }] }], rpe: 7, durationMin: 40 });
        for (let i = 0; i < 5; i++) await t.tool("log_strength_session", { day: add(today, -28 + i * 7), exercises: [{ exercise: "Bankdrücken", sets: [{ reps: 5, weightKg: 60 }] }], rpe: 7, durationMin: 40 });
        await t.tool("log_strength_session", { day: add(today, -3), exercises: [{ exercise: "Kreuzheben", sets: [{ reps: 5, weightKg: 100 }] }], rpe: 7, durationMin: 30 });
        await t.tool("save_strength_template", { name: TPL, exercises: [{ exercise: "Kniebeuge", sets: 3, reps: 5, weightKg: 85 }] });
        await t.open("training");
        await t.section("strength");
        const btn = t.page.locator("#stProg").getByRole("button", { name: /Kniebeuge/ });
        await btn.click();
        await t.page.waitForTimeout(800);
        const chart = t.page.locator("#stProg .st-detail .st-chart svg, #stProg .st-detail .st-chart canvas");
        return { status: (await chart.count()) > 0 ? "ok" : "fail", observed: `Verlaufsdiagramm unter der Zeile: ${(await chart.count()) ? "ja" : "nein"}.`, locator: t.page.locator("#stProg") };
      },
    },
    {
      nr: 2,
      action: "Das Diagramm und den Text darunter ansehen.",
      expected: "Bei steigendem Trend eine gestrichelte Prognose für 8 Wochen mit Text „Bei gleichem Tempo in 8 Wochen etwa …“ und dem Hinweis Schätzung.",
      async run(t) {
        const cap = (await t.text("#stProg .st-detail .chart-cap")).replace(/\s+/g, " ");
        const fine = (await t.text("#stProg .st-detail .fine")).replace(/\s+/g, " ");
        const dashed = /gestrichelt/.test(fine) ? 1 : 0;
        const ok = /Bei gleichem Tempo in 8 Wochen etwa/.test(cap) && /Schätzung/.test(fine) && dashed > 0;
        return { status: ok ? "ok" : "fail", observed: `Text: „${cap}“ · Hinweis: „${fine}“ · Legende nennt gestrichelte Prognose: ${dashed ? "ja" : "nein"}.`, locator: t.page.locator("#stProg .st-detail") };
      },
    },
    {
      nr: 3,
      action: "Eine Übung mit nur einer oder zwei Einheiten (oder mit Plateau) öffnen.",
      expected: "Keine gestrichelte Linie, stattdessen „Zu wenig Daten …“ bzw. „Plateau …“.",
      async run(t) {
        const res = [];
        for (const name of ["Kreuzheben", "Bankdrücken"]) {
          const btn = t.page.locator("#stProg").getByRole("button", { name: new RegExp(name) });
          await btn.click(); await t.page.waitForTimeout(600);
          const det = t.page.locator("#stProg .st-detail").filter({ hasText: /Einheit/ }).last();
          const cap = (await det.locator(".chart-cap").innerText()).replace(/\s+/g, " ");
          const dashed = /gestrichelt/.test(await det.locator(".fine").innerText()) ? 1 : 0;
          res.push({ name, cap, dashed });
          await btn.click(); await t.page.waitForTimeout(300);
        }
        const [a, b] = res;
        const ok = /Zu wenig Daten/.test(a.cap) && a.dashed === 0 && /Plateau/i.test(b.cap) && b.dashed === 0;
        return { status: ok ? "ok" : "fail", observed: res.map((r) => `${r.name}: „${r.cap}“, gestrichelt: ${r.dashed ? "ja" : "nein"}`).join(" · "), locator: t.page.locator("#stProg") };
      },
    },
    {
      nr: 4,
      action: "Im Gym-Modus bei einer Übung neben „Letztes Mal“ auf „Verlauf“ tippen.",
      expected: "Dasselbe Diagramm erscheint in der Übung.",
      async run(t) {
        await t.section("gym");
        await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
        await t.page.selectOption("#gySrc", `t:${TPL}`);
        await t.page.click("#gyBody button.primary");
        await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
        await t.page.locator(".gy-ex").first().getByRole("button", { name: "Verlauf" }).click();
        await t.page.waitForTimeout(800);
        const box = t.page.locator(".gy-ex .st-detailbox");
        const cap = (await box.count()) ? (await box.locator(".chart-cap").innerText()).replace(/\s+/g, " ") : "";
        const chart = await box.locator("svg, canvas").count();
        return { status: chart > 0 && /8 Wochen/.test(cap) ? "ok" : "fail", observed: `Diagramm im Gym-Modus: ${chart ? "ja" : "nein"}; Text: „${cap}“.`, locator: t.page.locator("#sec-gym") };
      },
    },
  ],
};
