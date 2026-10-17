// #281 Express-Krafteinheit – Testschritte nach PR #308 (Supersatz-Hinweis nur bei echten Supersätzen).
const TPL = "Express-Test (synthetisch)";
const EXERCISES = [
  { exercise: "Kniebeuge", sets: 4, reps: 5, weightKg: 100 },
  { exercise: "Bankdrücken", sets: 4, reps: 5, weightKg: 80 },
  { exercise: "Kurzhantelrudern", sets: 3, reps: 10, weightKg: 30 },
  { exercise: "Schrägbankdrücken", sets: 3, reps: 10, weightKg: 25 },
  { exercise: "Bizepscurls", sets: 3, reps: 12, weightKg: 12 },
  { exercise: "Plank", sets: 3, reps: 45 },
];

/** Gym-Modus frisch öffnen, Vorlage und Zeit wählen, starten; liefert Übungen (Name, Pause, Supersatz) und Hinweis. */
async function express(t, minutes) {
  await t.open("training");
  const sec = await t.section("gym");
  await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
  await t.page.selectOption("#gySrc", `t:${TPL}`);
  await t.page.selectOption("#gyTime", String(minutes));
  await t.page.click("#gyBody button.primary");
  await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
  await t.page.waitForTimeout(400);
  const st = await t.page.evaluate(() => JSON.parse(localStorage.getItem("fc-gym") ?? "null"));
  const marked = await t.page.locator(".gy-list .gy-exh", { hasText: "Supersatz" }).count();
  const ex = (st?.exercises ?? []).map((x) => ({ name: x.name, rest: x.rest, superset: x.superset ?? null }));
  return { sec, ex, marked, msg: await t.text("#gyMsg") };
}
const list = (r) => r.ex.map((x) => `${x.name}${x.superset ? ` [Supersatz ${x.superset}]` : ""} (${x.rest} s)`).join(", ");
const BASE = /Kniebeuge|Bankdrücken$/;
// „Weggelassen: a, b, c.“ – die Namen kommen aus dem Übungskatalog (Plank heißt dort Unterarmstütz), daher nur die Anzahl vergleichen.
const weg = (msg) => (msg.match(/Weggelassen: ([^.]*)\./)?.[1] ?? "").split(",").map((x) => x.trim()).filter(Boolean);

export default {
  issue: 281,
  feature: 281,
  title: "Express-Krafteinheit bei wenig Zeit (#281)",
  name: "Express-Krafteinheit bei wenig Zeit",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Gym-Modus öffnen, die Einheit (Kniebeuge, Bankdrücken, Kurzhantelrudern, Schrägbankdrücken, Bizepscurls, Plank; synthetische Vorlage) wählen, Zeit 30 min, starten.",
      expected: "Nur Kniebeuge, Bankdrücken und eine Hilfsübung bleiben; kein „Supersatz“-Hinweis und keine Supersatz-Markierung; die Hilfsübung hat 75 s Pause.",
      async run(t) {
        await t.tool("save_strength_template", { name: TPL, exercises: EXERCISES });
        const r = await express(t, 30);
        const aux = r.ex.filter((x) => !["Kniebeuge", "Bankdrücken"].includes(x.name));
        const base = r.ex.filter((x) => ["Kniebeuge", "Bankdrücken"].includes(x.name)).length;
        const ok = base === 2 && aux.length === 1 && aux[0].rest === 75 && r.marked === 0 && !r.ex.some((x) => x.superset) && !/Supersatz/.test(r.msg);
        return { status: ok ? "ok" : "fail", observed: `Übungen: ${list(r)}. Hinweis: „${r.msg}“.`, locator: r.sec };
      },
    },
    {
      nr: 2,
      action: "Dieselbe Einheit mit 45 min starten.",
      expected: "Kurzhantelrudern und Schrägbankdrücken sind als Supersatz markiert, und der Hinweis „Hilfsübungen als Supersatz (abwechselnd, 60 s Pause)“ steht im Text.",
      async run(t) {
        const r = await express(t, 45);
        const ss = r.ex.filter((x) => x.superset).map((x) => x.name);
        const ok = ss.includes("Kurzhantelrudern") && ss.includes("Schrägbankdrücken") && r.marked >= 2 && r.msg.includes("Hilfsübungen als Supersatz (abwechselnd, 60 s Pause)");
        return { status: ok ? "ok" : "fail", observed: `Übungen: ${list(r)}; ${r.marked} als Supersatz markiert. Hinweis: „${r.msg}“.`, locator: r.sec };
      },
    },
    {
      nr: 3,
      action: "Dieselbe Einheit mit 20 min starten.",
      expected: "Nur Grundübungen; kein Supersatz-Hinweis; „Weggelassen: …“ nennt die gestrichenen Übungen.",
      async run(t) {
        const r = await express(t, 20);
        const dropped = EXERCISES.map((e) => e.exercise).filter((n) => !r.ex.some((x) => x.name === n));
        const ok = r.ex.length > 0 && r.ex.every((x) => BASE.test(x.name)) && !/Supersatz/.test(r.msg) && /Weggelassen:/.test(r.msg) && weg(r.msg).length === dropped.length;
        return { status: ok ? "ok" : "fail", observed: `Übungen: ${list(r)}. Gestrichen: ${dropped.join(", ")}. Hinweis: „${r.msg}“.`, locator: r.sec };
      },
    },
  ],
};
