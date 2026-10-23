// #379 Fehlende WHOOP-Tage robust behandeln – Testschritte aus dem Issue, Lücke synthetisch (vorgestern, gestern, heute).
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export default {
  issue: 379,
  feature: 379,
  title: "Fehlende Tage robust behandeln (#379)",
  name: "Fehlende WHOOP-Tage",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Testdaten mit einer Lücke von 2 Tagen (plus heute noch ohne Auswertung) anlegen; das Dashboard öffnen.",
      expected: "Die Tage stehen als „keine Daten“, nicht als 0 oder schlechter Wert.",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        const gap = [addDays(today, -2), addDays(today, -1), today];
        await t.gap(gap);
        const d = await t.tool("get_dashboard", { days: 30 });
        const pts = d.days.filter((p) => gap.includes(p.day));
        const marked = pts.filter((p) => p.noData).map((p) => p.day);
        const zeros = pts.filter((p) => p.recovery === 0 || p.hrv === 0 || p.sleepH === 0).length;
        await t.open("verlauf");
        const sec = await t.section("recovery");
        const ok = marked.length === 2 && zeros === 0 && pts.every((p) => p.recovery == null);
        return { status: ok ? "ok" : "fail", observed: `Als „keine Daten“ markiert: ${marked.join(", ")} (erwartet 2 vergangene Tage); Nullwerte: ${zeros}.`, locator: sec };
      },
    },
    {
      nr: 2,
      action: "Trends (Erholung, HRV, Schlaf) ansehen und mit der Maus über die Lückentage fahren.",
      expected: "Linie springt nicht ab; Lücke sichtbar.",
      async run(t) {
        const sec = await t.section("recovery");
        const cols = await sec.locator("svg rect.nodata").count();
        const charts = await sec.locator(".chart svg").count();
        const box = await sec.locator("#cHrv svg").boundingBox();
        const n = await t.page.evaluate(() => FC.state.range);
        await t.page.mouse.move(box.x + 38 + ((box.width - 48) / n) * (n - 2.5), box.y + 90); // gestern
        await t.page.waitForTimeout(300);
        const tip = await t.text("#cHrv .tip");
        const d = await t.tool("get_dashboard", { days: 30 });
        const hrvAvg = d.trends.hrv.avg7;
        const ok = cols >= 4 && /keine Daten/.test(tip) && hrvAvg != null && hrvAvg > 20;
        return { status: ok ? "look" : "fail", observed: `${cols} Lücken-Spalten in ${charts} Diagrammen; Tooltip: „${tip.replace(/\s+/g, " ")}“; HRV-7-Tage-Mittel ${hrvAvg} ms (Lücke zählt nicht als 0).`, locator: sec };
      },
    },
    {
      nr: 3,
      action: "Tagesempfehlung für heute (Tag nach der Lücke) ansehen.",
      expected: "Empfehlung aus Vortagen/Tagebuch, mit Hinweis „Schätzung wegen fehlender Daten“.",
      async run(t) {
        await t.open("heute");
        const sec = await t.section("today");
        const reasons = await t.text("#readyReasons");
        const d = await t.tool("get_dashboard", { days: 7 });
        const ok = /Schätzung wegen fehlender Daten/.test(reasons) && d.coach.dataGap?.days === 2 && d.coach.readiness !== "hard";
        return { status: ok ? "ok" : "fail", observed: `Gründe: „${reasons.replace(/\s+/g, " ").slice(0, 300)}“; Empfehlung: ${d.coach.readiness} (${d.coach.headline}); Lücke ${d.coach.dataGap?.days ?? "–"} Tage.`, locator: sec };
      },
    },
  ],
};
