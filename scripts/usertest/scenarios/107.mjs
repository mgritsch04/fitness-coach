// #107 Gym-Modus: Anzeige „seit letztem Satz“ (zählt hoch, springt beim nächsten Haken auf 0:00, übersteht Neuladen).
const since = (t) => t.page.evaluate(() => { const b = document.getElementById("gySince"); return b && !b.hidden ? document.getElementById("gySinceT").textContent : null; });
const secs = (s) => (s ? Number(s.split(":")[0]) * 60 + Number(s.split(":")[1]) : null);
async function tick(t, j) {
  const row = t.page.locator(".gy-list .gy-ex").first().locator(".gy-set").nth(j);
  await row.locator("button.ok").click();
  await t.page.waitForTimeout(300);
}

export default {
  issue: 107,
  feature: 107,
  title: "Gym-Modus: Dauer seit letztem Satz (#107)",
  name: "Gym-Modus: seit letztem Satz",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Gym-Modus öffnen, eine Einheit starten (synthetische Vorlage, 3 Sätze Kniebeuge) und einen Satz abhaken.",
      expected: "Oben erscheint „seit letztem Satz“ und zählt Minuten:Sekunden hoch.",
      async run(t) {
        await t.tool("save_strength_template", { name: "Timer-Test (synthetisch)", exercises: [{ exercise: "Kniebeuge", sets: 3, reps: 5, weightKg: 60 }] });
        await t.open("training");
        await t.section("gym");
        await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
        await t.page.selectOption("#gySrc", "t:Timer-Test (synthetisch)");
        await t.page.click("#gyBody button.primary");
        await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
        const before = await since(t);
        await tick(t, 0);
        const a = await since(t);
        await t.page.waitForTimeout(2500);
        const b = await since(t);
        const ok = before == null && a != null && secs(b) >= secs(a) + 2 && /^\d+:\d\d$/.test(b);
        return { status: ok ? "ok" : "fail", observed: `Vor dem ersten Haken: ${before == null ? "keine Anzeige" : before}. Nach dem Haken „seit letztem Satz ${a}“, 2,5 s später „${b}“.`, locator: t.page.locator(".gy-bar") };
      },
    },
    {
      nr: 2,
      action: "Etwas warten (hier 4 s), dann den nächsten Satz abhaken.",
      expected: "Die Anzeige springt auf 0:00 und zählt neu.",
      async run(t) {
        await t.page.waitForTimeout(4000);
        const a = await since(t);
        await tick(t, 1);
        const b = await since(t);
        await t.page.waitForTimeout(1500);
        const c = await since(t);
        const ok = secs(a) >= 6 && secs(b) <= 1 && secs(c) >= 1 && secs(c) < secs(a);
        return { status: ok ? "ok" : "fail", observed: `Vor dem Haken ${a}, direkt danach ${b}, 1,5 s später ${c}.`, locator: t.page.locator(".gy-bar") };
      },
    },
    {
      nr: 3,
      action: "Die Seite neu laden, während die Einheit läuft. Danach die Pause mit „Weiter“ beenden.",
      expected: "Die Anzeige läuft mit der richtigen Zeit weiter. Er stört nicht und kann mit „Weiter“ beendet werden.",
      async run(t) {
        await t.page.waitForTimeout(3000);
        const a = await since(t);
        await t.page.reload();
        await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 });
        await t.page.waitForLoadState("networkidle");
        await t.tab("training");
        await t.section("gym");
        await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
        const b = await since(t);
        const restVisible = await t.page.locator("#gyRest").isVisible();
        await t.page.getByRole("button", { name: "Pause beenden" }).click();
        await t.page.waitForTimeout(700);
        const restAfter = await t.page.locator("#gyRest").isVisible();
        const c = await since(t);
        const ok = secs(b) >= secs(a) && secs(b) <= secs(a) + 15 && restVisible && !restAfter && c != null;
        return {
          status: ok ? "ok" : "fail",
          observed: `Vor dem Neuladen ${a}, danach ${b} (läuft weiter, nicht auf 0). Pause vor „Weiter“ ${restVisible ? "sichtbar" : "nicht sichtbar"}, danach ${restAfter ? "noch sichtbar" : "weg"}; „seit letztem Satz“ steht weiter (${c}).`,
          locator: t.page.locator(".gy-bar"),
        };
      },
    },
  ],
};
