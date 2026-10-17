// [USERTEST] Express-Krafteinheit bei wenig Zeit (#281): geplante Einheit auf 30 min kürzen.
const COMPOUND = /Kniebeuge|Kreuzheben|Bankdrücken|Schulterdrücken|Klimmzug|Rudern mit der Langhantel|Hip Thrust|Beinpresse/;

export default {
  issue: 294,
  feature: 281,
  title: "[USERTEST] Express-Krafteinheit bei wenig Zeit (#281)",
  name: "Express-Krafteinheit bei wenig Zeit",
  device: "phone",
  realDevice: ["Ob die geschätzte Dauer zur echten Trainingszeit passt, zeigt erst eine echte Einheit im Gym."],
  steps: [
    {
      nr: 1,
      action: "Gym-Modus öffnen, eine Einheit wählen und bei „Zeit“ zum Beispiel „Nur 30 min“ einstellen.",
      expected: "Auswahl der Einheit und „Nur 30 min“ sind möglich.",
      async run(t) {
        await t.open("training");
        const sec = await t.section("gym");
        await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
        const opts = await t.page.$$eval("#gySrc option", (o) => o.map((x) => ({ v: x.value, t: x.textContent })));
        const pick = opts.find((o) => o.v.startsWith("p:")) ?? opts.find((o) => o.v.startsWith("t:")) ?? opts.find((o) => o.v.startsWith("s:"));
        if (!pick) return { status: "fail", observed: `Keine Einheit zur Auswahl (${opts.map((o) => o.t).join(", ")})`, locator: sec };
        await t.page.selectOption("#gySrc", pick.v);
        await t.page.selectOption("#gyTime", "30");
        t.pick = pick;
        return { status: "ok", observed: `Gewählt: „${pick.t}“, Zeit „${await t.page.$eval("#gyTime", (s) => s.selectedOptions[0].textContent)}“.`, locator: sec };
      },
    },
    {
      nr: 2,
      action: "Starten: Ist die Einheit sinnvoll gekürzt (Grundübungen bleiben, Supersätze sind markiert)? Nennt der Hinweis, was weggefallen ist?",
      expected: "Gekürzte Einheit passt in 30 min, Grundübungen bleiben, Supersätze sind in der Liste markiert, der Hinweis nennt Weggefallenes/Kürzungen.",
      async run(t) {
        // Volle Einheit zum Vergleich: dieselbe Liste wie der Gym-Modus an get_express_session schickt
        const full = await t.page.evaluate((v) => {
          const w = window.FC.state.data.training.strengthWorkouts.days.find((x) => x.day === v.slice(2));
          return (w?.exercises ?? []).map((x) => ({ name: x.name, sets: x.sets, reps: x.reps || 8, weightKg: x.weightKg ?? null, unit: x.unit === "s" ? "s" : "Wdh" }));
        }, t.pick.v);
        await t.page.click("#gyBody button.primary");
        await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
        await t.page.waitForTimeout(400);
        const msg = await t.text("#gyMsg");
        const shown = await t.page.$$eval(".gy-list .gy-exh", (h) => h.map((x) => x.parentElement.innerText.split("\n")[0] + " | " + x.innerText));
        const r = full.length ? await t.tool("get_express_session", { minutes: 30, exercises: full }) : null;
        if (!r) return { status: "fail", observed: "Keine Plan-Einheit mit Übungen zum Vergleich." };
        const fullCompound = full.filter((x) => COMPOUND.test(x.name)).map((x) => x.name);
        const keptCompound = fullCompound.filter((n) => r.exercises.some((e) => e.name === n));
        const ss = r.exercises.filter((e) => e.superset).length;
        const ssShown = shown.filter((s) => /Supersatz/.test(s)).length;
        const namesDropped = r.dropped.every((n) => msg.includes(n));
        const checks = {
          passt: r.fits && r.estimatedMin <= 30,
          grund: keptCompound.length === fullCompound.length,
          supersatz: ssShown === ss && (!/Supersatz/.test(msg) || ss > 0), // Hinweis verspricht keine Supersätze, die es nicht gibt
          hinweis: msg.length > 0 && msg === r.text && namesDropped && (r.dropped.length > 0 || r.changes.length > 0 || r.fullMin <= 30),
          liste: shown.length === r.exercises.length,
        };
        const ok = Object.values(checks).every(Boolean);
        return {
          status: ok ? "ok" : "fail",
          observed: `Voll ${r.fullMin} min → gekürzt ca. ${r.estimatedMin} min (${full.length} → ${r.exercises.length} Übungen). Grundübungen ${keptCompound.length}/${fullCompound.length} behalten. Supersätze: ${ss} Übungen, ${ssShown} markiert. Weggefallen: ${r.dropped.join(", ") || "nichts"}. Hinweis: „${msg}“.${ok ? "" : ` Nicht erfüllt: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(", ")}.`}`,
        };
      },
    },
    {
      nr: 3,
      action: "Passt die geschätzte Dauer ungefähr zur echten?",
      expected: "Geschätzte Dauer ≈ tatsächliche Trainingszeit.",
      async run() {
        return { status: "device", observed: "Nur mit einer echten Einheit prüfbar; die Schätzung (Sätze, Pausen, 5 min Aufwärmen) steht in Schritt 2.", noFinalShot: true };
      },
    },
  ],
};
