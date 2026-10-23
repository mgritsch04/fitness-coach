// #202 Kraft-Plateau erkennen und Entlastungswoche vorschlagen (Krafttraining › Fortschritt je Übung).
// Synthetisch: Kniebeuge, Kreuzheben, Bankdrücken stagnieren über 6 Wochen (gleiches Gewicht, 11 Einheiten) bei steigender Anstrengung (RPE 7 → 9).
import { unit } from "./_unit.mjs";
const add = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export default {
  issue: 202,
  feature: 202,
  title: "Kraft-Plateau und Entlastungswoche (#202)",
  name: "Plateau-Hinweis",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Krafteinheiten mit Gewicht und Wiederholungen speichern, mit Anstrengung (RPE).",
      expected: "Die Einheiten sind gespeichert.",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        for (let w = 0; w < 11; w++) await t.tool("log_strength_session", { day: add(today, -40 + w * 4), exercises: [{ exercise: "Kniebeuge", sets: [{ reps: 5, weightKg: 100 }] }, { exercise: "Kreuzheben", sets: [{ reps: 5, weightKg: 120 }] }, { exercise: "Bankdrücken", sets: [{ reps: 5, weightKg: 70 }] }], rpe: 7 + w * 0.2, durationMin: 50 });
        const s = (await t.tool("get_strength", { weeks: 6 })).sessions;
        return { status: s.length >= 11 ? "ok" : "fail", observed: `${s.length} Krafteinheiten mit Sätzen gespeichert.` };
      },
    },
    {
      nr: 2,
      action: "Training › Krafttraining: über „Fortschritt je Übung“ nachsehen.",
      expected: "Bei Stagnation mehrerer Grundübungen über etwa 3 Wochen bei gleicher oder steigender Anstrengung steht „Plateau beobachten“ oder „Entlastungswoche empfohlen“. Die Entlastungswoche bedeutet etwa 40 % weniger Sätze und Gewichte etwa 10 % runter.",
      async run(t) {
        await t.open("training");
        await t.section("strength");
        await t.page.waitForTimeout(1200);
        const vis = await t.page.locator("#stDeload").isVisible();
        const txt = vis ? (await t.text("#stDeload")).replace(/\s+/g, " ") : "";
        const ok = vis && /Plateau beobachten|Entlastungswoche empfohlen/.test(txt) && /40 ?%/.test(txt) && /10 ?%/.test(txt);
        return { status: ok ? "ok" : "fail", observed: vis ? `Hinweis: „${txt}“.` : "Kein Plateau-Hinweis sichtbar.", locator: t.page.locator("#sec-strength") };
      },
    },
    {
      nr: 3,
      action: "Im Coach-Chat fragen: „Brauche ich eine Entlastungswoche im Gym?“",
      expected: "Der Coach antwortet passend zur Einschätzung im Dashboard.",
      async run(t) {
        const u = unit("strength-deload.test.ts", "Plateau bei steigender RPE");
        return { status: "device", observed: `Die Chat-Antwort schreibt Claude (in der Testumgebung nur Beispielantworten). Die Einschätzung selbst (Regel „Plateau bei steigender RPE → Entlastungswoche“) ist per Unit-Test bestanden: ${u.pass}.` };
      },
    },
  ],
};
