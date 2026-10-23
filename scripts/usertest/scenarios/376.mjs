// #376 Beschwerde-Karte statt Freitext im Check-in – Testschritte aus dem Issue, Vorlage (Kniebeuge + Schulterdrücken) synthetisch angelegt.
export default {
  issue: 376,
  feature: 376,
  title: "Beschwerde-Karte im Check-in (#376)",
  name: "Beschwerde-Karte",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Im Check-in auf der Körperkarte „Knie“ antippen.",
      expected: "Stelle markiert, Hinweis als Trainingsanpassung (keine Diagnose).",
      async run(t) {
        await t.tool("save_strength_template", { name: "Test Gym", exercises: [{ exercise: "back_squat", sets: 3, reps: 5, weightKg: 60 }, { exercise: "overhead_press", sets: 3, reps: 8, weightKg: 30 }] });
        await t.tool("save_journal", { day: (await t.tool("get_dashboard", { days: 7 })).today, tags: [] });
        await t.open("heute");
        const sec = await t.section("journal");
        await t.page.click('#ciAreas button[data-area="knie"]');
        const pressed = await t.page.getAttribute('#ciAreas button[data-area="knie"]', "aria-pressed");
        const hint = await t.text("#ciAreaFx");
        const ok = pressed === "true" && /Trainingsanpassung/.test(hint) && /keine Diagnose/.test(hint);
        await t.page.click("#ciSave");
        await t.page.waitForTimeout(800);
        return { status: ok ? "look" : "fail", observed: `Knie markiert: ${pressed}; Hinweis: „${hint}“`, locator: sec };
      },
    },
    {
      nr: 2,
      action: "Gym-Vorlage ansehen.",
      expected: "Knie-belastende Übungen sind durch Alternativen ersetzt oder markiert.",
      async run(t) {
        const s = await t.tool("suggest_strength_session", { template: "Test Gym" });
        const names = s.exercises.map((e) => e.exercise);
        const d = await t.tool("get_dashboard", { days: 7 });
        const plan = d.training.strengthWorkouts.days;
        const planBad = plan.some((w) => w.exercises.some((e) => ["back_squat", "front_squat", "leg_press", "lunge", "leg_extension"].includes(e.exercise)));
        const ok = !names.includes("back_squat") && names.includes("overhead_press") && s.complaintAdjustments?.length === 1 && !planBad && d.journal.complaints.areas.includes("knee");
        return { status: ok ? "ok" : "fail", observed: `Vorlage jetzt: ${s.exercises.map((e) => e.name).join(", ")}; Anpassung: ${s.complaintAdjustments?.map((a) => a.text).join("; ")}; Wochenplan ohne Knie-Übungen: ${!planBad}.` };
      },
    },
    {
      nr: 3,
      action: "Beschwerde wieder entfernen.",
      expected: "Ursprüngliche Vorlage kommt zurück.",
      async run(t) {
        await t.open("heute");
        await t.page.click('#ciAreas button[data-area="knie"]');
        const pressed = await t.page.getAttribute('#ciAreas button[data-area="knie"]', "aria-pressed");
        await t.page.click("#ciSave");
        await t.page.waitForTimeout(800);
        const s = await t.tool("suggest_strength_session", { template: "Test Gym" });
        const names = s.exercises.map((e) => e.exercise);
        const ok = pressed === "false" && names.join() === "back_squat,overhead_press" && !s.complaintAdjustments;
        return { status: ok ? "ok" : "fail", observed: `Knie markiert: ${pressed}; Vorlage: ${s.exercises.map((e) => e.name).join(", ")}.` };
      },
    },
  ],
};
