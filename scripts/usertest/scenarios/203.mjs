// #203 Kraftwerte relativ zum Körpergewicht (Krafttraining › „Kraft pro kg Körpergewicht“).
// Synthetisch: Kniebeuge 100 kg × 5, Kreuzheben 120 kg × 5, Bankdrücken 70 kg × 5 gespeichert (Körpergewicht der Testdaten 75 kg).
export default {
  issue: 203,
  feature: 203,
  title: "Kraftwerte relativ zum Körpergewicht (#203)",
  name: "Kraft pro kg Körpergewicht",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Dashboard öffnen und den Bereich „Kraft“ öffnen.",
      expected: "Das Panel „Kraft pro kg Körpergewicht“ ist zu sehen.",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        for (const [ex, kg] of [["Kniebeuge", 100], ["Kreuzheben", 120], ["Bankdrücken", 70]]) await t.tool("log_strength_session", { day: today, exercises: [{ exercise: ex, sets: [{ reps: 5, weightKg: kg }] }], rpe: 7, durationMin: 20 });
        await t.open("training");
        await t.section("strength");
        await t.page.locator("#stStd tbody tr").first().waitFor({ timeout: 15_000 });
        const h = await t.page.locator("#sec-strength h3", { hasText: "Kraft pro kg Körpergewicht" }).count();
        return { status: h ? "ok" : "fail", observed: `Panel „Kraft pro kg Körpergewicht“: ${h ? "da" : "fehlt"}. Hinweistext: „${(await t.text("#stStdText")).trim()}“.`, locator: t.page.locator("#stStd") };
      },
    },
    {
      nr: 2,
      action: "Das Panel prüfen.",
      expected: "Je Übung stehen geschätztes 1RM, Wert pro kg, Stufe und nächste Stufe da. Die Stufen sind grobe Richtwerte, keine Norm; das 1RM ist eine Schätzung.",
      async run(t) {
        const ths = (await t.page.locator("#stStd thead th").allInnerTexts()).map((x) => x.trim());
        const rows = await t.page.locator("#stStd tbody tr").evaluateAll((rs) => rs.map((r) => [...r.children].map((c) => c.innerText.replace(/\s+/g, " ").trim())));
        const note = (await t.text("#stStdNote")).trim();
        const ok = rows.length >= 3 && rows.every((r) => r.length >= 4 && r.every((c) => c.length > 0)) && /Richtwert|Norm/i.test(`${note} ${await t.text("#stStdText")}`);
        return { status: ok ? "ok" : "fail", observed: `Spalten: ${ths.join(" | ")}. Zeilen: ${rows.map((r) => r.join(" / ")).join(" || ")}. Hinweis: „${note}“.`, locator: t.page.locator("#stStd") };
      },
    },
    {
      nr: 3,
      action: "Die Einschätzung mit deinem Gefühl vergleichen.",
      expected: "Sie stimmt grob mit deinem Gefühl überein.",
      async run() {
        return { status: "look", observed: "Ob die Stufen zu deinem Gefühl passen, beurteilst du mit deinen echten Kraftwerten." };
      },
    },
  ],
};
