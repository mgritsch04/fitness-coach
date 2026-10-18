// Connector-Werkzeuge des Trainingscoachs: Ziele, Vorlieben, Wochenpläne, Coach-Notizen und ein
// kompakter Kontext, den Claude im Artefakt als Grundlage für Coach-Antworten nutzt.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { addDays, weekStart } from "./core/analysis";
import { analysisContext, analysisHighlightsView, recoveryForecastView } from "./core/analytics";
import { buildDashboard } from "./core/dashboard";
import { deleteGoal, deleteNote, deletePlan, readGoals, readNotes, readPlan, readPrefs, saveGoal, saveNote, writePlan, writePrefs } from "./core/goals";
import { comparePlan, normalizePlan } from "./core/plan";
import { CONSISTENCY_WEEKS, consistency } from "./core/consistency";
import { deleteSweatTest, readSweatTests, saveSweatTest, sweatRate, sweatSummary } from "./core/sweat";
import { weekReview } from "./core/review";
import { actualDays, blockWarning, eventProjection, proposeBlock, proposePlan, todayCheck, weekView } from "./core/training";
import { blockView, buildBlock, deleteBlock, readBlock, saveBlock } from "./core/periodization";
import { readJournal } from "./core/journal";
import { zoneTargets } from "./core/zone-targets";
import { feedbackAdjust, readFeedback, saveFeedback } from "./core/feedback";
import { MOBILITY_KINDS, mobilityKindFor, mobilityRoutine, type MobilityKind } from "./core/mobility";
import type { Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (error: string, message: string) => ({ ...json({ error, message }), isError: true });

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-TT");
const WEEK = z.union([z.enum(["current", "next", "previous"]), DAY]).optional().describe("current (Standard), next, previous oder ein Datum in der Woche");

const SESSION_TYPE = z.enum(["rest", "recovery", "endurance", "long", "tempo", "threshold", "vo2max", "strength", "opener", "race"]);

function resolveWeek(today: string, w?: string) {
  const cur = weekStart(today);
  if (!w || w === "current") return cur;
  if (w === "next") return addDays(cur, 7);
  if (w === "previous") return addDays(cur, -7);
  return weekStart(w);
}

export function registerCoachTools(server: McpServer, env: Env) {
  const db = env.DB;
  // Für Pläne nur so viel Verlauf wie nötig: 8 Wochen reichen für Phase und Zeitbudget.
  const dashboard = () => buildDashboard(db, { days: 56 });

  const goalShape = {
    id: z.number().int().optional().describe("Weglassen = neues Ziel; sonst werden nur die übergebenen Felder geändert"),
    kind: z.enum(["event", "fitness", "weight", "habit", "other"]).optional().describe("event = Wettkampf/Termin, fitness = z. B. FTP/CTL, weight, habit = z. B. Stunden pro Woche"),
    title: z.string().min(1).max(120).optional(),
    targetDate: DAY.nullable().optional(),
    metric: z.enum(["ftpW", "ctl", "weightKg", "weeklyHours"]).nullable().optional().describe("messbare Zielgröße, wenn vorhanden"),
    targetValue: z.number().nullable().optional(),
    unit: z.string().max(20).nullable().optional(),
    sport: z.string().max(40).nullable().optional(),
    priority: z.enum(["A", "B", "C"]).optional().describe("A = Hauptziel (Planung richtet sich danach), B = wichtig, C = nebenbei"),
    status: z.enum(["active", "done", "dropped"]).optional(),
    notes: z.string().max(1000).nullable().optional(),
  };

  server.registerTool(
    "get_goals",
    {
      description: "Gespeicherte Trainingsziele (Termine, FTP, Gewicht, Stunden pro Woche …).",
      inputSchema: { status: z.enum(["active", "done", "dropped", "all"]).optional().describe("Standard active") },
      annotations: { readOnlyHint: true },
    },
    async ({ status }) => json(await readGoals(db, { status })),
  );

  server.registerTool(
    "set_goals",
    {
      description:
        "Ziele anlegen oder ändern (je Eintrag ohne id = neu, mit id = Änderung) und optional per id löschen. " +
        "Ein A-Ziel mit Datum (kind=event) steuert die Periodisierung der Wochenpläne.",
      inputSchema: { goals: z.array(z.object(goalShape)).max(20).optional(), delete: z.array(z.number().int()).max(20).optional() },
      annotations: { readOnlyHint: false },
    },
    async ({ goals, delete: del }) => {
      try {
        const saved = [];
        for (const g of goals ?? []) saved.push(await saveGoal(db, g));
        const deleted = [];
        for (const id of del ?? []) if (await deleteGoal(db, id)) deleted.push(id);
        return json({ saved, deleted, goals: await readGoals(db) });
      } catch (err) {
        return fail("invalid_goal", (err as Error).message);
      }
    },
  );

  const prefsShape = {
    weeklyHours: z.number().min(1).max(30).nullable().optional().describe("verfügbare Trainingszeit pro Woche (h)"),
    restDays: z.array(z.number().int().min(0).max(6)).max(6).nullable().optional().describe("feste Ruhetage, 0 = Montag … 6 = Sonntag"),
    longDay: z.number().int().min(0).max(6).nullable().optional().describe("Tag der langen Einheit, 0 = Montag … 6 = Sonntag"),
    maxWeekdayMin: z.number().int().min(20).max(300).nullable().optional().describe("längste Einheit Montag–Freitag (min)"),
    mainSport: z.string().max(40).nullable().optional().describe("Hauptsportart, z. B. cycling oder running"),
    strengthPerWeek: z.number().int().min(0).max(6).nullable().optional().describe("Krafteinheiten pro Woche (null = wie in den letzten Wochen)"),
    strengthMin: z.number().int().min(15).max(120).nullable().optional().describe("Dauer einer Krafteinheit in min (null = wie in den letzten Wochen)"),
    strengthPhase: z.enum(["build", "maintain", "race"]).nullable().optional().describe("Saisonphase Kraft: build = Aufbau, maintain = Erhalt, race = Wettkampf (null = automatisch)"),
    ridesPerWeek: z.number().int().min(0).max(14).nullable().optional().describe("Radeinheiten pro Woche als Ziel für die Serien (null = wie in den letzten Wochen)"),
    fixedStrength: z
      .array(z.object({ day: z.number().int().min(0).max(6), focus: z.string().min(1).max(60), durationMin: z.number().int().min(15).max(150).nullable().optional() }))
      .max(7)
      .nullable()
      .optional()
      .describe("Fester Wochenplan Kraft: je Eintrag Wochentag (0 = Montag) und Art, z. B. Beine oder Oberkörper. Der Plan übernimmt diese Tage unverändert und plant nur Rad und Ruhe drumherum; null oder [] = Coach verteilt die Kraft."),
  };

  server.registerTool(
    "get_training_prefs",
    { description: "Trainingsvorlieben für die Wochenplanung (Zeitbudget, Ruhetage, Langtag, Kraft pro Woche).", annotations: { readOnlyHint: true } },
    async () => json(await readPrefs(db)),
  );

  server.registerTool(
    "set_training_prefs",
    {
      description: "Setzt Trainingsvorlieben für die Wochenplanung; null setzt einen Wert auf den Standard zurück.",
      inputSchema: prefsShape,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async (patch) => json(await writePrefs(db, patch)),
  );

  server.registerTool(
    "get_plan",
    {
      description:
        "Wochenplan (Mo–So) mit Phase (Grundlage/Aufbau/Spitze/Tapering/Erholung), Einheiten je Tag (Rad und Kraft), Soll/Ist-Abgleich mit den echten Workouts " +
        "und – für die laufende Woche – ob die heutige Einheit zur Tagesform passt. Ohne gespeicherten Plan kommt ein Regelvorschlag (stored=false). Belastungen sind Schätzungen.",
      inputSchema: { week: WEEK },
      annotations: { readOnlyHint: true },
    },
    async ({ week }) => {
      const dash = await dashboard();
      const ws = resolveWeek(dash.today, week);
      const view = await weekView(db, dash, ws);
      const isCurrent = ws === weekStart(dash.today);
      const planned = view.plan.days.find((d) => d.day === dash.today) ?? null;
      const zoneWeek = dash.hrZones.weeks.find((w) => w.week === ws) ?? null;
      return json({ ...view, today: isCurrent ? todayCheck(planned, dash.coach, view.plan) : null, readiness: isCurrent ? dash.coach : null,
        zoneTargets: zoneTargets(view.plan, zoneWeek, dash.today) });
    },
  );

  const sessionShape = z.object({
    day: DAY,
    type: SESSION_TYPE,
    title: z.string().max(80).optional(),
    durationMin: z.number().min(0).max(600).optional(),
    targetLoad: z.number().min(0).max(600).optional().describe("Belastung im TSS-Maßstab; weglassen = Schätzung aus Typ und Dauer"),
    intensity: z.string().max(120).optional(),
    description: z.string().max(500).optional(),
    key: z.boolean().optional(),
    strength: z.object({ durationMin: z.number().min(0).max(180), focus: z.string().max(80).optional() }).nullable().optional(),
  });

  server.registerTool(
    "save_plan",
    {
      description:
        "Speichert den Wochenplan. accept=true übernimmt den Regelvorschlag unverändert; mit days speichert ein angepasster Plan (z. B. nach der Tagesform vom Coach umgestellt, fehlende Tage = Ruhetag). " +
        "reset=true löscht den gespeicherten Plan, danach gilt wieder der Vorschlag.",
      inputSchema: {
        week: WEEK,
        accept: z.boolean().optional(),
        reset: z.boolean().optional(),
        days: z.array(sessionShape).max(14).optional(),
        notes: z.array(z.string().max(300)).max(10).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ week, accept, reset, days, notes }) => {
      const dash = await dashboard();
      const ws = resolveWeek(dash.today, week);
      if (reset) return json({ week: ws, deleted: await deletePlan(db, ws) });
      const [goals, prefs, stored, block] = await Promise.all([readGoals(db), readPrefs(db), readPlan(db, ws), readBlock(db, dash.today).catch(() => null)]);
      const proposal = proposePlan(dash, ws, goals, prefs, block);
      let plan;
      if (days?.length) {
        try {
          plan = normalizePlan(ws, { days, notes }, stored ?? proposal);
        } catch (err) {
          return fail("invalid_plan", (err as Error).message);
        }
      } else if (accept) {
        plan = { ...proposal, notes: notes ?? proposal.notes };
      } else {
        return fail("nothing_to_save", "Entweder accept=true, days oder reset=true angeben.");
      }
      await writePlan(db, plan);
      return json(await weekView(db, dash, ws, { goals, prefs }));
    },
  );

  server.registerTool(
    "get_event_projection",
    {
      description:
        "Formprognose bis zum Ziel-Termin: Fitness (CTL), Ermüdung (ATL) und Form (TSB) je Tag bis zum Termin, wenn der Plan so trainiert wird; Phasen je Woche " +
        "(Aufbau, Spitze, Tapering …), Form am Wettkampftag mit Wunschbereich und Hinweisen. Ohne goalId das nächste aktive Terminziel. Schätzung.",
      inputSchema: { goalId: z.number().int().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ goalId }) => {
      const dash = await dashboard();
      const [goals, prefs] = await Promise.all([readGoals(db), readPrefs(db)]);
      const p = eventProjection(dash, goals, prefs, dash.training.thisWeek.plan, goalId);
      return p ? json(p) : fail("no_event", "Kein aktives Ziel mit Datum in der Zukunft. Lege eines mit set_goals an (kind=event, targetDate).");
    },
  );

  server.registerTool(
    "get_week_review",
    {
      description:
        "Wochenrückblick: Stunden, Belastung, Fitnessänderung, Zeit je Sport, Pulszonen-Verteilung, Erholung/HRV/Ruhepuls/Schlaf gegen die Vorwoche, Plan-Soll/Ist, " +
        "Highlights, Tagebuch und 2–3 Punkte für die nächste Woche. Standard: letzte abgeschlossene Woche. Den Text dazu mit save_coach_note (kind=weekly_review, day=Montag) speichern. Schätzung.",
      inputSchema: { week: WEEK.describe("previous (Standard), current oder ein Datum in der Woche") },
      annotations: { readOnlyHint: true },
    },
    async ({ week }) => {
      const dash = await dashboard();
      const ws = resolveWeek(dash.today, week ?? "previous");
      if (ws > weekStart(dash.today)) return fail("future_week", "Für eine zukünftige Woche gibt es noch keinen Rückblick.");
      if (ws < addDays(weekStart(dash.today), -7 * 6)) return fail("too_old", "Rückblick nur für die letzten 6 Wochen.");
      const view = await weekView(db, dash, ws);
      const notes = await readNotes(db, { kind: "weekly_review", fromDay: ws, limit: 10 });
      return json({
        ...weekReview({
          week: ws,
          today: dash.today,
          days: dash.days,
          weeks: dash.weeks,
          workouts: dash.workouts,
          comparison: view.comparison,
          journal: await readJournal(db, addDays(ws, -7), addDays(ws, 6)),
          strengthSessions: dash.strength.sessions,
        }),
        planSource: view.stored ? "gespeichert" : "Vorschlag",
        savedReview: notes.find((n) => n.day === ws) ?? null,
      });
    },
  );

  server.registerTool(
    "save_coach_note",
    {
      description:
        "Speichert einen Text des Coachs, damit er bleibt und im Dashboard erscheint: daily (Tageshinweis, ersetzt den des Tages), weekly_review (Wochenrückblick, day = Montag der Woche), " +
        "insight (Erkenntnis aus den Daten) oder chat (gemerkte Antwort). data = optionale strukturierte Werte für Diagramme.",
      inputSchema: {
        kind: z.enum(["daily", "weekly_review", "insight", "chat"]),
        day: DAY.optional().describe("Standard heute"),
        title: z.string().max(120).optional(),
        body: z.string().min(1).max(6000),
        data: z.unknown().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ kind, day, title, body, data }) => {
      const dash = await buildDashboard(db, { days: 7 });
      const d = day ?? (kind === "weekly_review" ? weekStart(dash.today) : dash.today);
      const size = data === undefined ? 0 : JSON.stringify(data).length;
      if (size > 20_000) return fail("data_too_large", "data darf höchstens 20 000 Zeichen haben.");
      return json(await saveNote(db, { kind, day: d, title, body, data }));
    },
  );

  server.registerTool(
    "get_coach_notes",
    {
      description: "Gespeicherte Coach-Texte, neueste zuerst.",
      inputSchema: {
        days: z.number().int().min(1).max(365).optional().describe("Zeitraum bis heute, Standard 30"),
        kind: z.enum(["daily", "weekly_review", "insight", "chat"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ days, kind, limit }) => {
      const from = new Date(Date.now() - (days ?? 30) * 86_400_000).toISOString().slice(0, 10);
      return json(await readNotes(db, { fromDay: from, kind, limit }));
    },
  );

  server.registerTool(
    "get_sleep_target",
    {
      description:
        "Schlafziel für heute Nacht: Schlafdauer aus eigenem Grundbedarf (Nächte vor guter Erholung) plus Zuschläge für Belastung heute, Schlafschuld und harte Einheit morgen; " +
        "Zubettgehzeit aus der üblichen Aufwachzeit und der Schlafeffizienz. Dazu die Erholungs-Prognose für morgen mit Ziel gegen üblichen Schlaf (falls verfügbar). Schätzung.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const [dash, c] = await Promise.all([dashboard(), analysisContext(db, { days: 90 }).catch(() => null)]);
      const t = dash.sleepTarget;
      const scenario = c ? (() => {
        const withTarget = recoveryForecastView(c, { sleepH: t.targetAsleepH });
        const usual = recoveryForecastView(c);
        return withTarget.available && usual.available
          ? { usualSleepH: usual.typicalSleepH, recoveryUsual: usual.forecast.recovery, recoveryWithTarget: withTarget.forecast.recovery, note: "Erholung morgen laut Prognose (Schätzung)." }
          : null;
      })() : null;
      return json({ ...t, forecast: scenario });
    },
  );

  server.registerTool(
    "save_recommendation_feedback",
    {
      description:
        "Rückmeldung zur Tagesempfehlung speichern: ok = passt, too_hard = war zu hart, too_easy = war zu leicht (eine je Tag, überschreibt). " +
        "Aus den letzten 30 Tagen (ab 4 Rückmeldungen) wird die Empfehlung begrenzt angepasst: häufig zu hart → vorsichtiger. Liefert die aktuelle Auswertung.",
      inputSchema: {
        verdict: z.enum(["ok", "too_hard", "too_easy"]),
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Tag (YYYY-MM-DD), Standard heute"),
        readiness: z.enum(["rest", "easy", "moderate", "hard"]).optional().describe("Empfehlung an dem Tag (Standard: heutige)"),
        note: z.string().max(300).optional(),
      },
    },
    async ({ verdict, day, readiness, note }) => {
      const dash = await dashboard();
      const d = day ?? dash.today;
      if (d > dash.today) return fail("future_day", "Rückmeldung nur für heute oder vergangene Tage.");
      await saveFeedback(db, { day: d, verdict, readiness: readiness ?? (d === dash.today ? dash.coach.readiness : null), note: note ?? null });
      const rows = await readFeedback(db, addDays(dash.today, -30));
      return json({ saved: { day: d, verdict }, ...feedbackAdjust(rows, dash.today) });
    },
  );

  server.registerTool(
    "get_consistency",
    {
      description:
        "Konstanz und Serien: Wochenziel (Kraft- und Radeinheiten aus den Trainingsvorlieben, sonst geschätzt), je Woche der letzten 12 erreicht ja/nein, " +
        "aktuelle und beste Serie, Quote der abgeschlossenen Wochen und Plan-Treue (absolvierte gegen geplante Einheiten aus gespeicherten Plänen).",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const [dash, prefs] = await Promise.all([buildDashboard(db, { days: CONSISTENCY_WEEKS * 7 }), readPrefs(db)]);
      const cur = weekStart(dash.today);
      const weeks = Array.from({ length: CONSISTENCY_WEEKS }, (_, i) => addDays(cur, -7 * i));
      const stored = await Promise.all(weeks.map((w) => readPlan(db, w).catch(() => null)));
      const plans = stored.flatMap((p, i) => {
        if (!p) return [];
        const c = comparePlan(p, actualDays(dash.workouts, weeks[i], addDays(weeks[i], 6)), dash.today);
        return [{ week: weeks[i], planned: c.sessionsPlannedToDate, done: c.sessionsDoneToDate }];
      });
      return json(consistency({ today: dash.today, workouts: dash.workouts, prefs, plans }));
    },
  );

  server.registerTool(
    "log_sweat_test",
    {
      description:
        "Schweißraten-Messung speichern: Gewicht vor und nach einer Fahrt (ohne Kleidung), getrunkene Menge und Dauer. Rate = (vorher − nachher + getrunken) / Stunden, " +
        "getrennt nach Rolle (indoor) und draußen. Die Verpflegungsempfehlung nutzt danach die persönliche Trinkmenge (~75 % des Verlusts). delete = id entfernt eine Messung.",
      inputSchema: {
        durationMin: z.number().int().min(1).max(600).optional(),
        weightBeforeKg: z.number().min(30).max(250).optional(),
        weightAfterKg: z.number().min(30).max(250).optional(),
        drankL: z.number().min(0).max(10).optional().describe("während der Fahrt getrunken, in Litern"),
        indoor: z.boolean().optional().describe("Rolle (Standard true)"),
        day: DAY.optional().describe("Standard heute"),
        note: z.string().max(200).optional(),
        delete: z.number().int().optional().describe("id einer Messung zum Löschen"),
      },
    },
    async (i) => {
      const dash = await dashboard();
      if (i.delete != null) return json({ deleted: (await deleteSweatTest(db, i.delete)) ? i.delete : null, ...sweatSummary(await readSweatTests(db), dash.today) });
      if (i.durationMin == null || i.weightBeforeKg == null || i.weightAfterKg == null) return fail("invalid_input", "Bitte durationMin, weightBeforeKg und weightAfterKg angeben.");
      const m = { day: i.day ?? dash.today, durationMin: i.durationMin, weightBeforeKg: i.weightBeforeKg, weightAfterKg: i.weightAfterKg, drankL: i.drankL ?? 0, indoor: i.indoor ?? true, note: i.note ?? null };
      if (m.day > dash.today) return fail("future_day", "Messung nur für heute oder vergangene Tage.");
      const v = sweatRate(m);
      if ("error" in v) return fail("implausible", v.error);
      const saved = await saveSweatTest(db, m);
      return json({ saved, ...sweatSummary(await readSweatTests(db), dash.today) });
    },
  );

  server.registerTool(
    "get_sweat_rate",
    {
      description: "Persönliche Schweißrate (Mittel der letzten Messungen, getrennt Rolle/draußen) mit Trinkempfehlung pro Stunde. Schätzung.",
      annotations: { readOnlyHint: true },
    },
    async () => json(sweatSummary(await readSweatTests(db), (await dashboard()).today)),
  );

  server.registerTool(
    "get_mobility_routine",
    {
      description:
        "Kurze Mobility-Routine (5–10 min) nach der Einheit: ohne kind passend zur heutigen Planeinheit, sonst ride_long (Hüfte/Rücken nach langer Fahrt), " +
        "ride_intervals, legs (nach Beintag), upper (Schultern) oder general. Übungen mit Dauer in Sekunden (sides = je Seite). Faustregeln, keine Physiotherapie.",
      inputSchema: { kind: z.enum(MOBILITY_KINDS as [MobilityKind, ...MobilityKind[]]).optional().describe("Art der Routine; leer = passend zu heute") },
      annotations: { readOnlyHint: true },
    },
    async ({ kind }) => {
      if (kind) return json(mobilityRoutine(kind));
      const t = (await dashboard()).training;
      return json(t.mobilityToday ?? mobilityRoutine(mobilityKindFor(null)));
    },
  );

  server.registerTool(
    "get_training_block",
    {
      description:
        "4-Wochen-Block (3 Aufbauwochen + 1 Entlastungswoche): Wochenziele (Belastung), Schwerpunkt, Soll/Ist je Woche und Anpassungen " +
        "(Ziel gehalten bei < 70 %, Entlastung vorgezogen bei Warnzeichen). Ohne gespeicherten Block ein Vorschlag ab dieser Woche (saved = false). Schätzungen.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => json((await dashboard()).training.block),
  );

  server.registerTool(
    "save_training_block",
    {
      description:
        "Startet bzw. speichert einen 4-Wochen-Block; der Wochenplan richtet seine Ziel-Belastung danach (Termin-Phasen haben Vorrang). " +
        "startWeek (Montag, Standard diese Woche), rampPct (Steigerung je Aufbauwoche, Standard 0.05). delete=true entfernt den Block dieser Startwoche.",
      inputSchema: {
        startWeek: DAY.optional(),
        rampPct: z.number().min(0).max(0.1).optional(),
        delete: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ startWeek, rampPct, delete: del }) => {
      const dash = await dashboard();
      const ws = weekStart(startWeek ?? dash.today);
      if (del) return json({ startWeek: ws, deleted: await deleteBlock(db, ws) });
      const ref = [...dash.days].reverse().find((d) => d.day < ws) ?? dash.days.at(-1);
      const block = rampPct == null && !startWeek ? proposeBlock(dash) : buildBlock(ws, ref?.ctl ?? 0, rampPct ?? 0.05);
      await saveBlock(db, block);
      return json({ saved: true, ...blockView({ ...block, source: "saved" }, dash.weeks, dash.today, blockWarning(dash)) });
    },
  );

  server.registerTool(
    "delete_coach_note",
    { description: "Löscht einen gespeicherten Coach-Text per id.", inputSchema: { id: z.number().int() }, annotations: { readOnlyHint: false, destructiveHint: true } },
    async ({ id }) => json({ id, deleted: await deleteNote(db, id) }),
  );

  server.registerTool(
    "get_coach_context",
    {
      description:
        "Kompakter Überblick als Grundlage für Coach-Antworten von Claude: Tagesempfehlung mit Gründen, Abgleich mit dem Plan, Trends, letzte Tage, letzte Wochen, Ziele, " +
        "Wochenplan mit Soll/Ist und letzte Coach-Notizen. Trainingsempfehlungen, keine Diagnosen; Belastungen sind Schätzungen.",
      inputSchema: { days: z.number().int().min(7).max(42).optional().describe("Anzahl letzter Tage im Detail, Standard 14") },
      annotations: { readOnlyHint: true },
    },
    async ({ days }) => {
      // Erholungs-Prognose für morgen (core/forecast.ts, Analyse-Thread) für Fragen wie „heute Abend noch trainieren?“.
      // Analyse-Highlights (#175/#179): wichtigste Befunde aller Analysen als ein Aufruf statt zehn.
      const [dash, forecast, highlights] = await Promise.all([
        dashboard(),
        analysisContext(db, { days: 90 }).then((c) => recoveryForecastView(c)).catch(() => null),
        analysisHighlightsView(db, 6).catch(() => null),
      ]);
      const n = days ?? 14;
      const t = dash.training;
      const trendBrief = Object.fromEntries(
        Object.entries(dash.trends).map(([k, v]) => [k, { last: v.last, avg7: v.avg7, baseline: v.baseline, deltaPct: v.deltaPct, status: v.status }]),
      );
      return json({
        today: dash.today,
        readiness: dash.coach,
        earlyWarning: dash.earlyWarning,
        returnToTraining: dash.returnToTraining,
        sleepTarget: dash.sleepTarget,
        trainingBlock: { saved: t.block.saved, text: t.block.text, current: t.block.current },
        planToday: t.today,
        trends: trendBrief,
        recentDays: dash.days.slice(-n).map((d) => ({
          day: d.day, recovery: d.recovery, hrv: d.hrv, rhr: d.rhr, sleepH: d.sleepH, strain: d.strain, load: d.load, ctl: d.ctl, atl: d.atl, tsb: d.tsb, trainingMin: d.trainingMin,
        })),
        recentWorkouts: dash.workouts.slice(0, 20).map((w) => ({ day: w.day, sport: w.sport, durationMin: w.durationMin, load: w.load, rpe: w.rpe, avgHr: w.avgHr, avgPowerW: w.avgPowerW, intensity: w.intensity })),
        weeks: dash.weeks.slice(-4).map((w) => ({ week: w.week, trainingH: w.trainingH, load: w.load, workouts: w.workouts, avgRecovery: w.avgRecovery, avgSleepH: w.avgSleepH, ctlEnd: w.ctlEnd, ctlChange: w.ctlChange, bySport: w.bySport })),
        goals: t.goals,
        prefs: t.prefs,
        thisWeek: {
          week: t.thisWeek.week, stored: t.thisWeek.stored, phase: t.thisWeek.phaseLabel, phaseReason: t.thisWeek.plan.phaseReason,
          summary: t.thisWeek.comparison.summary,
          days: t.thisWeek.comparison.days.map((d) => ({ day: d.day, type: d.type, title: d.title, durationMin: d.durationMin, targetLoad: d.targetLoad, strength: d.strength, status: d.status, actualMin: d.actualMin, actualLoad: d.actualLoad })),
        },
        nextWeek: t.nextWeek,
        intensityCheck: t.intensity,
        ftpTest: t.ftpTest,
        makeUp: t.makeUp,
        fuelingToday: t.fueling.days.find((f) => f.day === dash.today) ?? null,
        recommendationFeedback: { count: dash.recommendationFeedback.count, scoreDelta: dash.recommendationFeedback.scoreDelta, text: dash.recommendationFeedback.text },
        nutritionToday: t.nutrition.days.find((n) => n.day === dash.today) ?? null,
        recoveryForecast: forecast,
        analysisHighlights: highlights,
        strengthSeason: { phase: t.strengthSeason.phase, text: t.strengthSeason.text },
        strengthDeload: { verdict: t.strengthDeload.verdict, text: t.strengthDeload.text, suggestion: t.strengthDeload.suggestion },
        strengthWorkouts: t.strengthWorkouts.days.slice(0, 2).map((w) => ({ day: w.day, focus: w.focus, text: w.text })),
        eventProjection: t.projection
          ? { goal: t.projection.goal.title, date: t.projection.goal.targetDate, daysLeft: t.projection.daysLeft, atEvent: t.projection.atEvent, targetTsb: t.projection.targetTsb, verdict: t.projection.verdict, advice: t.projection.advice, weeks: t.projection.weeks }
          : null,
        settings: { ftpW: dash.settings.ftpW, maxHr: dash.settings.maxHr, restingHr: dash.settings.restingHr, thresholdHr: dash.settings.thresholdHr, sleepNeedH: dash.settings.sleepNeedH, origin: dash.settings.origin },
        journal: { today: dash.journal.today, recent: dash.journal.recent.slice(0, 7), tagEffects: dash.journal.tagEffects.slice(0, 5) },
        coachNotes: t.notes.slice(0, 5).map((nn) => ({ kind: nn.kind, day: nn.day, title: nn.title, body: nn.body.slice(0, 600) })),
        dataNotes: dash.notes,
        guidance: [
          "Du bist ein Trainingscoach für Rennrad (derzeit oft indoor mit MyWhoosh) und Krafttraining. Antworte auf Deutsch, kurz und konkret.",
          "Nur Trainingsempfehlungen, keine medizinischen Diagnosen. Bei Schmerzen, Krankheitszeichen oder auffälligen Werten zur Pause raten und ärztliche Abklärung empfehlen.",
          "Schätzungen (Belastung, Fitness/Form, FTP aus Puls) als Schätzungen kennzeichnen. Gründe aus den Daten nennen.",
          "Kraft und Rad zusammen denken: keine schweren Beine vor Intervallen oder der langen Fahrt; harte Tage hart, lockere Tage locker.",
          "Das Tagebuch (Befinden, Muskelkater, Stress, Tags wie krank/Reise/Alkohol) ist so wichtig wie die Messwerte; tagEffects sind Beobachtungen, keine Ursachen.",
          "recoveryForecast ist eine statistische Schätzung der Erholung von morgen aus deinen eigenen Daten: Spanne (low–high) nennen und nur nutzen, wenn available = true.",
          "returnToTraining: Läuft ein Wiedereinstieg nach Krankheit oder Pause, die Stufe (Dauer, Intensität, Kraft) einhalten und bei abort nicht steigern. Bei Fieber, Brustschmerz oder Atemnot nicht trainieren.",
          "makeUp: kind makeUp = ausgefallene Schlüsseleinheit nachholen, kind postpone = heutige Schlüsseleinheit wegen der Tagesform verschieben. Nur am vorgeschlagenen Tag; bei day = null ausfallen lassen statt zwei harte Tage hintereinander.",
          "recommendationFeedback: Wie gut passten die Empfehlungen zuletzt (Rückmeldungen passt/zu hart/zu leicht); nach einer Einheit nach der Rückmeldung fragen und mit save_recommendation_feedback speichern.",
          "nutritionToday: Eiweiß- und Kohlenhydrat-Richtwert für heute (Faustregel nach Gewicht und Belastung, heute nach Tagesform); als Richtwert nennen, keine Ernährungsberatung.",
          "analysisHighlights sind die wichtigsten Befunde der Analysen (tone warn zuerst); bei Bedarf mit dem genannten tool Details holen. Nicht jeden Punkt aufzählen, nur was zur Frage passt.",
          "Planänderungen mit save_plan speichern, dauerhafte Erkenntnisse mit save_coach_note, Ziele mit set_goals.",
        ],
      });
    },
  );
}
