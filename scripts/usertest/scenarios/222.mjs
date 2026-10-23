// #222 Eiweiß- und Kohlenhydrat-Richtwert je Tag (Heute dran › „Essen heute: KH … g · Eiweiß … g“).
const kh = (s) => Number((s.match(/KH[^\d]*(\d+)/) ?? [])[1]);
export default {
  issue: 222,
  feature: 222,
  title: "Eiweiß- und KH-Richtwert je Tag (#222)",
  name: "Essen-Richtwerte",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "In der Wochenagenda („Heute dran“) die Zeile „Essen heute: KH … g · Eiweiß … g“ ansehen.",
      expected: "Je Tag steht eine solche Zeile, berechnet aus Körpergewicht und geplanter Einheit. Heute richtet sie sich nach der Tagesform (Ruhetag → Ruhetag-Werte).",
      async run(t) {
        await t.open("heute");
        await t.section("agenda");
        const line = (await t.page.locator("#agBody .ag-meta", { hasText: "Essen" }).first().innerText()).trim();
        const d = (await t.tool("get_dashboard", { days: 7 }));
        const nut = d.training.nutrition;
        const today = nut.days.find((n) => n.day === d.today);
        const ok = /^Essen heute: KH \d+/.test(line) && /Eiweiß \d+/.test(line) && nut.days.length >= 7;
        return { status: ok ? "ok" : "fail", observed: `Zeile heute: „${line}“. Tage mit Richtwert in der Woche: ${nut.days.length}. Heute laut Werkzeug: „${today?.short}“ (${d.coach.readiness}). Gewicht der Berechnung: ${nut.weightKg ?? "?"} kg.`, locator: t.page.locator("#sec-agenda") };
      },
    },
    {
      nr: 2,
      action: "Auf andere Tage in der Wochenagenda tippen.",
      expected: "Deren Werte erscheinen; eine lange Fahrt hat deutlich mehr KH als ein Ruhetag.",
      async run(t) {
        const d = await t.tool("get_dashboard", { days: 7 });
        const days = d.training.thisWeek.comparison.days;
        const res = {};
        for (const x of days) {
          await t.page.locator(".ag-week .ag-day").nth(days.indexOf(x)).click();
          const el = t.page.locator("#agBody .ag-meta", { hasText: /^Essen/ }).first();
          res[x.day] = { type: x.type, line: (await el.innerText()).trim() };
        }
        const long = Object.values(res).find((r) => r.type === "long"), rest = Object.values(res).find((r) => r.type === "rest");
        const ok = Object.values(res).every((r) => /KH \d+/.test(r.line)) && long && rest && kh(long.line) > kh(rest.line) * 1.3;
        return { status: ok ? "ok" : "fail", observed: Object.entries(res).map(([k, r]) => `${k} (${r.type}): ${r.line}`).join(" · "), locator: t.page.locator("#sec-agenda") };
      },
    },
    {
      nr: 3,
      action: "An Krafttagen die Eiweiß-Obergrenze ansehen.",
      expected: "Die Eiweiß-Obergrenze ist höher, 2,0 statt 1,8 g/kg.",
      async run(t) {
        const d = await t.tool("get_dashboard", { days: 7 });
        const pd = d.training.nutrition.days;
        const w = d.body?.weightKg ?? d.body?.latest?.weightKg ?? 75;
        const hi = (n) => Number((n.text.match(/und \d+–(\d+) g Eiweiß/) ?? n.text.match(/\d+–(\d+) g Eiweiß/) ?? [])[1]);
        const strengthDays = new Set(d.training.thisWeek.comparison.days.filter((x) => x.strength || x.type === "strength").map((x) => x.day));
        const rows = pd.map((n) => ({ day: n.day, kraft: strengthDays.has(n.day), hi: hi(n), gkg: (hi(n) / w).toFixed(2) }));
        const ok = rows.some((r) => r.kraft) && rows.filter((r) => r.kraft).every((r) => Math.abs(r.hi - 2.0 * w) <= 2) && rows.some((r) => !r.kraft && Math.abs(r.hi - 1.8 * w) <= 2);
        const s = rows.filter((r) => r.kraft), o = rows.filter((r) => !r.kraft);
        return { status: ok ? "ok" : "fail", observed: `Körpergewicht ${w} kg. Obergrenze Eiweiß je Tag: ${rows.map((r) => `${r.day}${r.kraft ? " (Kraft)" : ""}: ${r.hi} g = ${r.gkg} g/kg`).join("; ")}.`, locator: t.page.locator("#sec-agenda") };
      },
    },
    {
      nr: 4,
      action: "Im Coach-Chat fragen: „Wie viel soll ich heute essen?“",
      expected: "Die Antwort nennt die Richtwerte als Richtwert.",
      async run(t) {
        const d = await t.tool("get_dashboard", { days: 7 });
        const note = d.training.nutrition.note ?? "";
        return { status: "device", observed: `Die Antwort schreibt Claude (in der Testumgebung nur Beispielantworten). Der Richtwert-Hinweis im Coach-Kontext: „${String(note).slice(0, 200)}“.` };
      },
    },
  ],
};
