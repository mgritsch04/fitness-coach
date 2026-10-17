// [USERTEST] Mobility nach der tatsächlichen Einheit (#297): Oberkörper statt geplanter Einheit → Oberkörper-Routine.
const UPPER = [
  { exercise: "Bankdrücken", setCount: 3, reps: 8, weightKg: 60 },
  { exercise: "Schulterdrücken", setCount: 3, reps: 8, weightKg: 35 },
  { exercise: "Latzug", setCount: 3, reps: 10, weightKg: 50 },
];
const mobility = (t) => t.page.evaluate(() => window.FC.state.data.training?.mobilityToday);

export default {
  issue: 301,
  feature: 297,
  title: "[USERTEST] Mobility nach der tatsächlichen Einheit (#297)",
  name: "Mobility nach der tatsächlichen Einheit",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Einheit trainieren und im Gym-Modus speichern (hier: Oberkörper-Einheit mit Bankdrücken, Schulterdrücken, Latzug für heute, synthetisch).",
      expected: "Die Einheit ist für heute gespeichert.",
      async run(t) {
        await t.open("heute");
        const before = await mobility(t);
        t.planKind = before?.kind;
        t.planBasis = before?.basis;
        const saved = await t.tool("log_strength_session", { name: "Oberkörper (Test)", durationMin: 45, rpe: 7, exercises: UPPER });
        const s = await t.tool("get_strength", { weeks: 1 });
        const today = s.today ?? saved.day;
        const found = (s.sessions ?? []).find((x) => x.day === today && /Oberkörper/.test(x.name ?? ""));
        return found
          ? { status: "ok", observed: `Gespeichert für ${today}: ${found.sets.length} Sätze. Vorher (ohne Einheit) zeigte „Heute“ die Routine „${before?.title}“ (Grundlage: ${before?.basis === "plan" ? "Plan" : "tatsächliche Einheit"}).` }
          : { status: "fail", observed: `Einheit nicht gefunden (Antwort: ${JSON.stringify(saved).slice(0, 200)})` };
      },
    },
    {
      nr: 2,
      action: "„Heute“ › „Mobility nach der Einheit“ öffnen.",
      expected: "Der Abschnitt ist sichtbar und zeigt eine Routine mit Übungen.",
      async run(t) {
        await t.open("heute");
        const sec = await t.section("mobility");
        const visible = await sec.isVisible();
        const items = await sec.locator("#moList li").count();
        const title = await t.text("#moTitle");
        return visible && items > 0
          ? { status: "ok", observed: `Abschnitt sichtbar: „${title}“, ${items} Übungen, ${await t.text("#moMin")}.`, locator: sec }
          : { status: "fail", observed: `sichtbar: ${visible}, Übungen: ${items}`, locator: sec };
      },
    },
    {
      nr: 3,
      action: "Passt die vorgeschlagene Routine zu dem, was du wirklich gemacht hast?",
      expected: "Nach einer Oberkörper-Einheit wird die Oberkörper-Routine vorgeschlagen, auf Basis der tatsächlichen Einheit (nicht des Plans).",
      async run(t) {
        const m = await mobility(t);
        const shown = await t.page.locator("#moKind").inputValue();
        const title = await t.text("#moTitle");
        const ok = m?.kind === "upper" && m?.basis === "actual" && shown === "upper" && /Oberkörper/.test(title);
        const changed = t.planKind && t.planKind !== "upper" ? ` Ohne die Einheit war es „${t.planKind}“ nach Plan, die Auswahl folgt also der tatsächlichen Einheit.` : "";
        return {
          status: ok ? "ok" : "fail",
          observed: `Routine „${title}“ (Art ${m?.kind}, Grundlage ${m?.basis === "actual" ? "tatsächliche Einheit" : m?.basis}), Auswahlfeld „${shown}“.${changed}`,
          locator: t.page.locator("#sec-mobility"),
        };
      },
    },
  ],
};
