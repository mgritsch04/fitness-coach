// Connector-Werkzeuge fürs Krafttraining (Logik in core/strength.ts).
import { rirTrend } from "./core/autoregulation";
import { strengthExpress } from "./core/strength-express";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { addDays, todayIn, type WorkoutRow } from "./core/analysis";
import { readLatestBody, readWorkouts } from "./core/repository";
import { strengthStandards } from "./core/strength-standards";
import { exerciseAlternatives } from "./core/exercises";
import { readSettings } from "./core/settings";
import { strengthDeload } from "./core/strength-deload";
import {
  deleteStrengthSession,
  deleteTemplate,
  estimate1RM,
  exerciseKey,
  exerciseName,
  exerciseProgress,
  findLinkedWorkout,
  muscleVolume,
  MUSCLE_LABEL,
  readStrengthSessions,
  readTemplates,
  saveStrengthSession,
  saveTemplate,
  srpeLoad,
  strengthCoachNotes,
  suggestFromTemplate,
  weeklyVolume,
  type Muscle,
  type StrengthSession,
  type StrengthSet,
} from "./core/strength";
import type { Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (error: string, message: string) => ({ ...json({ error, message }), isError: true });

const muscleEnum = z.enum(Object.keys(MUSCLE_LABEL) as [Muscle, ...Muscle[]]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const exerciseInput = z.object({
  exercise: z.string().min(1).max(80).describe("Übungsname, deutsch oder englisch (z. B. Kniebeuge, Bankdrücken, deadlift)"),
  sets: z
    .array(z.object({ reps: z.number().int().min(1).max(100), weightKg: z.number().min(0).max(500).optional(), rpe: z.number().min(1).max(10).optional() }))
    .max(30)
    .optional()
    .describe("Jeder Satz einzeln"),
  setCount: z.number().int().min(1).max(20).optional().describe("Kurzform statt sets: Anzahl gleicher Sätze"),
  reps: z.number().int().min(1).max(100).optional().describe("Kurzform: Wiederholungen je Satz"),
  weightKg: z.number().min(0).max(500).optional().describe("Kurzform: Gewicht je Satz (0 = Körpergewicht)"),
  muscles: z.array(muscleEnum).max(4).optional().describe("Nur für Übungen, die nicht im Katalog sind"),
});

function toSets(items: z.infer<typeof exerciseInput>[]): StrengthSet[] | string {
  const out: StrengthSet[] = [];
  for (const it of items) {
    const { key, known } = exerciseKey(it.exercise);
    const base = { exercise: key, exerciseName: exerciseName(key, it.exercise.trim()), muscles: known ? null : (it.muscles ?? null) };
    if (it.sets?.length) for (const s of it.sets) out.push({ ...base, reps: s.reps, weightKg: s.weightKg ?? 0, rpe: s.rpe ?? null });
    else if (it.setCount && it.reps) for (let i = 0; i < it.setCount; i++) out.push({ ...base, reps: it.reps, weightKg: it.weightKg ?? 0, rpe: null });
    else return `Bei „${it.exercise}“ fehlen die Sätze (sets oder setCount + reps).`;
  }
  return out.length ? out : "Keine Übungen angegeben.";
}

export function registerStrengthTools(server: McpServer, env: Env) {
  const today = async () => todayIn((await readSettings(env.DB)).timezone ?? "Europe/Berlin");

  server.registerTool(
    "log_strength_session",
    {
      description:
        "Krafteinheit erfassen oder ändern (mit id): Übungen mit Sätzen, Wiederholungen, Gewicht. Wird automatisch mit einem WHOOP-Krafttraining " +
        "am selben Tag verknüpft (Startzeit und Dauer von dort, falls nicht angegeben). rpe = Anstrengung der ganzen Einheit 1–10; " +
        "damit zählt die Einheit mit Dauer × Anstrengung zur Trainingslast (Puls unterschätzt Kraft). Ohne exercises, aber mit template, " +
        "werden die Übungen der Vorlage mit dem Vorschlag aus suggest_strength_session übernommen. Antwort: Belastung, geschätztes 1RM je Übung, neue Bestwerte.",
      inputSchema: {
        id: z.string().max(64).optional().describe("Bestehende Einheit ersetzen"),
        day: day.optional().describe("YYYY-MM-DD, Standard heute"),
        startTime: z.string().datetime().optional(),
        durationMin: z.number().min(1).max(600).optional(),
        rpe: z.number().min(1).max(10).optional(),
        name: z.string().max(80).optional().describe("z. B. Beine, Push, Ganzkörper"),
        notes: z.string().max(1000).optional(),
        template: z.string().max(80).optional(),
        exercises: z.array(exerciseInput).max(30).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      const sessionDay = input.day ?? (await today());
      const history = await readStrengthSessions(env.DB, addDays(sessionDay, -365));
      let sets: StrengthSet[] | string;
      if (input.exercises?.length) sets = toSets(input.exercises);
      else if (input.template) {
        const tpl = (await readTemplates(env.DB)).find((t) => t.name.toLowerCase() === input.template!.toLowerCase());
        if (!tpl) return fail("template_not_found", `Keine Vorlage „${input.template}“.`);
        sets = toSets(suggestFromTemplate(tpl.exercises, history).map((x) => ({ exercise: x.exercise, setCount: x.sets, reps: x.reps, weightKg: x.weightKg })));
      } else sets = "Bitte exercises oder template angeben.";
      if (typeof sets === "string") return fail("invalid_input", sets);

      const workouts = (await readWorkouts(env.DB, sessionDay)) as unknown as WorkoutRow[];
      const draft = { day: sessionDay, startTime: input.startTime ?? null, linkedSource: null, linkedSourceId: null };
      const linked = findLinkedWorkout(draft, workouts.filter((w) => w.day === sessionDay));
      const session: StrengthSession = {
        id: input.id ?? crypto.randomUUID(),
        day: sessionDay,
        startTime: input.startTime ?? linked?.start_time ?? null,
        durationMin: input.durationMin ?? (linked?.duration_s ? Math.round(linked.duration_s / 60) : null),
        rpe: input.rpe ?? null,
        name: input.name ?? input.template ?? null,
        notes: input.notes ?? null,
        linkedSource: linked?.source ?? null,
        linkedSourceId: linked?.source_id ?? null,
        sets,
      };
      await saveStrengthSession(env.DB, session);

      const before = history.filter((h) => h.id !== session.id && h.day < session.day);
      const exercises = [...new Set(sets.map((s) => s.exercise))].map((key) => {
        const mine = sets.filter((s) => s.exercise === key);
        const e1rm = Math.max(0, ...mine.map((s) => estimate1RM(s.weightKg, s.reps) ?? 0)) || null;
        const prev = Math.max(0, ...before.flatMap((h) => h.sets.filter((s) => s.exercise === key).map((s) => estimate1RM(s.weightKg, s.reps) ?? 0))) || null;
        return { exercise: key, name: mine[0].exerciseName, sets: mine.length, e1rmKg: e1rm, previousBestE1rmKg: prev, newBest: e1rm != null && prev != null && e1rm > prev };
      });
      return json({
        saved: { id: session.id, day: session.day, name: session.name, durationMin: session.durationMin, rpe: session.rpe, sets: sets.length },
        linkedWorkout: linked ? { source: linked.source, sport: linked.sport, start: linked.start_time, durationMin: Math.round((linked.duration_s ?? 0) / 60), avgHr: linked.avg_hr, strain: linked.strain } : null,
        load: {
          value: srpeLoad(session.durationMin, session.rpe),
          method: "srpe",
          note: session.rpe == null ? "Ohne rpe zählt die Einheit nur über den Puls (falls WHOOP sie erfasst hat). rpe nachtragen für eine realistischere Schätzung." : "Schätzung aus Dauer × Anstrengung.",
        },
        exercises,
        muscles: muscleVolume(sets),
        unknownExercises: [...new Set(sets.filter((s) => !exerciseKey(s.exercise).known).map((s) => s.exerciseName))],
      });
    },
  );

  server.registerTool(
    "get_strength",
    {
      description:
        "Krafttraining-Überblick: Einheiten mit Sätzen, Volumen je Muskelgruppe und Woche (Sätze, Tonnage), geschätztes 1RM je Übung im Verlauf " +
        "mit Status (progress/plateau/decline/new), Kraft pro kg Körpergewicht mit groben Stufen (standards), Reserve je Satz über die letzten 3 Wochen (autoregulation), Vorlagen und Hinweise zum Zusammenspiel mit dem Radtraining. 1RM nach Epley (Schätzung).",
      inputSchema: { weeks: z.number().int().min(1).max(52).optional().describe("Zeitraum in Wochen, Standard 8") },
      annotations: { readOnlyHint: true },
    },
    async ({ weeks }) => {
      const t = await today();
      const from = addDays(t, -7 * (weeks ?? 8) + 1);
      const all = await readStrengthSessions(env.DB, addDays(t, -365));
      const inRange = all.filter((s) => s.day >= from);
      return json({
        today: t,
        range: { from, to: t },
        sessions: inRange.map((s) => ({ ...s, load: srpeLoad(s.durationMin, s.rpe) })),
        weeks: weeklyVolume(inRange),
        progress: exerciseProgress(all, t),
        deload: strengthDeload(all, t),
        standards: strengthStandards(all, ((await readLatestBody(env.DB).catch(() => null)) as { weight_kg?: number | null } | null)?.weight_kg ?? null, t),
        autoregulation: rirTrend(all, t),
        templates: await readTemplates(env.DB),
        coachNotes: strengthCoachNotes(all, t),
        note: "1RM und Belastung sind Schätzungen. Volumen: Hauptmuskel zählt einen Satz, Hilfsmuskel einen halben.",
      });
    },
  );

  server.registerTool(
    "get_exercise_alternatives",
    {
      description:
        "Gleichwertige Alternativen zu einer Übung (gleiche Muskelgruppe, ähnliches Bewegungsmuster), z. B. wenn das Gerät belegt ist: " +
        "Kniebeuge ↔ Beinpresse ↔ Ausfallschritt usw. Mit Startgewicht aus deiner letzten Einheit der Alternative (sonst selbst wählen).",
      inputSchema: {
        exercise: z.string().min(1).max(80).describe("Übung als Name (z. B. Kniebeuge) oder Schlüssel (back_squat)"),
        exclude: z.array(z.string().max(80)).max(20).optional().describe("Übungen, die schon in der Einheit sind"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ exercise, exclude }) => {
      const t = await today();
      return json(exerciseAlternatives(exercise, await readStrengthSessions(env.DB, addDays(t, -180)), exclude ?? []));
    },
  );

  server.registerTool(
    "delete_strength_session",
    { description: "Löscht eine erfasste Krafteinheit samt Sätzen.", inputSchema: { id: z.string().max(64) }, annotations: { readOnlyHint: false, destructiveHint: true } },
    async ({ id }) => ((await deleteStrengthSession(env.DB, id)) ? json({ deleted: id }) : fail("not_found", "Keine Einheit mit dieser id.")),
  );

  server.registerTool(
    "save_strength_template",
    {
      description: "Vorlage für eine wiederkehrende Krafteinheit speichern (gleicher Name ersetzt sie) oder mit delete=true löschen.",
      inputSchema: {
        name: z.string().min(1).max(80),
        delete: z.boolean().optional(),
        exercises: z
          .array(z.object({ exercise: z.string().min(1).max(80), sets: z.number().int().min(1).max(20), reps: z.number().int().min(1).max(100), weightKg: z.number().min(0).max(500).optional() }))
          .max(30)
          .optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ name, delete: del, exercises }) => {
      if (del) return (await deleteTemplate(env.DB, name)) ? json({ deleted: name }) : fail("not_found", `Keine Vorlage „${name}“.`);
      if (!exercises?.length) return fail("invalid_input", "Bitte exercises angeben.");
      const normalized = exercises.map((e) => ({ ...e, exercise: exerciseKey(e.exercise).key }));
      await saveTemplate(env.DB, name, normalized);
      return json({ saved: name, exercises: normalized.map((e) => ({ ...e, name: exerciseName(e.exercise) })) });
    },
  );

  server.registerTool(
    "suggest_strength_session",
    {
      description:
        "Vorschlag für die nächste Einheit aus einer Vorlage: Gewicht der letzten Einheit, nach komplett geschafften Sätzen etwas mehr " +
        "(+2,5 kg, Beine/Kreuzheben +5 kg). Dazu Hinweise, falls harte Radintervalle anstehen könnten. Schätzung, nach Gefühl anpassen.",
      inputSchema: { template: z.string().min(1).max(80) },
      annotations: { readOnlyHint: true },
    },
    async ({ template }) => {
      const tpl = (await readTemplates(env.DB)).find((t) => t.name.toLowerCase() === template.toLowerCase());
      if (!tpl) return fail("template_not_found", `Keine Vorlage „${template}“.`);
      const t = await today();
      const history = await readStrengthSessions(env.DB, addDays(t, -365));
      return json({ template: tpl.name, exercises: suggestFromTemplate(tpl.exercises, history), coachNotes: strengthCoachNotes(history, t) });
    },
  );

  server.registerTool(
    "get_express_session",
    {
      description:
        "Krafteinheit auf wenig Zeit kürzen (Express, z. B. 20/30/45 min): Hilfsübungen als Supersatz, kürzere Pausen, Isolationsübungen zuerst kürzen/streichen, " +
        "Grundübungen behalten. Eingabe: Übungsliste (wie im Gym-Modus) oder eine Vorlage. Liefert gekürzte Übungen, Weggelassenes und geschätzte Dauer.",
      inputSchema: {
        minutes: z.number().int().min(10).max(120),
        exercises: z
          .array(z.object({ name: z.string().min(1).max(80), sets: z.number().int().min(1).max(10), reps: z.number().int().min(1).max(300), weightKg: z.number().min(0).max(500).nullable().optional(), unit: z.enum(["Wdh", "s"]).nullable().optional() }))
          .max(20)
          .optional(),
        template: z.string().min(1).max(80).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ minutes, exercises, template }) => {
      let list = exercises;
      if (!list?.length && template) {
        const tpl = (await readTemplates(env.DB)).find((t) => t.name.toLowerCase() === template.toLowerCase());
        if (!tpl) return fail("template_not_found", `Keine Vorlage „${template}“.`);
        const history = await readStrengthSessions(env.DB, addDays(await today(), -365));
        list = suggestFromTemplate(tpl.exercises, history).map((x) => ({ name: x.name, sets: x.sets, reps: x.reps, weightKg: x.weightKg }));
      }
      if (!list?.length) return fail("invalid_input", "Bitte exercises oder template angeben.");
      return json(strengthExpress(list, minutes));
    },
  );
}
