// #375 Zielwerte für die nächste Krafteinheit (Doppelprogression). Synthetisch: Kniebeuge 3×12 mit 60 kg (oben im Bereich),
// Bankdrücken 3×7 mit 60 kg (verfehlt, Bereich 8–12).
const add = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const target = (t, i) => t.page.locator(".gy-list .gy-ex").nth(i).locator(".gy-target").textContent();
const card = (t, i) => t.page.locator(".gy-list .gy-ex").nth(i);

export default {
  issue: 375,
  feature: 375,
  title: "Zielwerte für die nächste Krafteinheit (#375)",
  name: "Zielwerte Doppelprogression",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Gym-Modus öffnen und eine Einheit mit Übungen starten, die einen Verlauf haben (synthetisch: Kniebeuge 3×12 mit 60 kg, Bankdrücken 3×7 mit 60 kg).",
      expected: "Je Übung steht ein konkretes Ziel für heute neben „Letztes Mal“.",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        await t.tool("log_strength_session", { day: add(today, -3), name: "Beine (Test Z)", durationMin: 50, rpe: 8, exercises: [
          { exercise: "Kniebeuge", setCount: 3, reps: 12, weightKg: 60 },
          { exercise: "Bankdrücken", setCount: 3, reps: 7, weightKg: 60 }] });
        await t.open("training");
        await t.section("gym");
        await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
        const v = await t.page.$$eval("#gySrc option", (o) => o.find((x) => x.value.startsWith("s:") && /Test Z/.test(x.textContent))?.value);
        await t.page.selectOption("#gySrc", v);
        await t.page.click("#gyBody button.primary");
        await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
        const a = await target(t, 0), b = await target(t, 1);
        const ok = /^Ziel heute: 3×\d+ mit \d/.test(a) && /^Ziel heute: 3×\d+ mit \d/.test(b);
        return { status: ok ? "ok" : "fail", observed: `Kniebeuge: „${a}“; Bankdrücken: „${b}“`, locator: card(t, 0) };
      },
    },
    {
      nr: 2,
      action: "Übung ansehen, bei der alle Sätze am oberen Wiederholungsende lagen (Kniebeuge 3×12 mit 60 kg).",
      expected: "Das Ziel erhöht das Gewicht (62,5 kg) und setzt die Wiederholungen zurück (3×8).",
      async run(t) {
        const a = await target(t, 0);
        return { status: /3×8 mit 62,5 kg/.test(a) && /Gewicht rauf/.test(a) ? "ok" : "fail", observed: `„${a}“`, locator: card(t, 0) };
      },
    },
    {
      nr: 3,
      action: "Übung ansehen, bei der die Wiederholungen verfehlt wurden (Bankdrücken 3×7 mit 60 kg).",
      expected: "Das Ziel bleibt bei 60 kg und steigert die Wiederholungen (3×8).",
      async run(t) {
        const b = await target(t, 1);
        return { status: /3×8 mit 60 kg/.test(b) && !/rauf/.test(b) ? "ok" : "fail", observed: `„${b}“`, locator: card(t, 1) };
      },
    },
  ],
};
