// Connector-Werkzeuge des Trainingscoachs: Ziele, Vorlieben, Wochenpläne, Coach-Notizen und ein
// kompakter Kontext, den Claude im Artefakt als Grundlage für Coach-Antworten nutzt.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { addDays, weekStart } from "./core/analysis";
import { analysisContext, analysisHighlightsView, recoveryForecastView } from "./core/analytics";
import { buildDashboard } from "./core/dashboard";
import { deleteGoal, deleteNote, deletePlan, readGoals, readNotes, readPlan, readPrefs, saveGoal, saveNote, writePlan, writePrefs } from "./core/goals";
import { normalizePlan } from "./core/plan";
import { weekReview } from "./core/review";
import { eventProjection, proposePlan, todayCheck, weekView } from "./core/training";
import { readJournal } from "./core/journal";
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
      return json({ ...view, today: isCurrent ? todayCheck(planned, dash.coach, view.plan) : null, readiness: isCurrent ? dash.coach : null });
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
      const [goals, prefs, stored] = await Promise.all([readGoals(db), readPrefs(db), readPlan(db, ws)]);
      const proposal = proposePlan(dash, ws, goals, prefs);
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
        recoveryForecast: forecast,
        analysisHighlights: highlights,
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
          "makeUp: kind makeUp = ausgefallene Schlüsseleinheit nachholen, kind postpone = heutige Schlüsseleinheit wegen der Tagesform verschieben. Nur am vorgeschlagenen Tag; bei day = null ausfallen lassen statt zwei harte Tage hintereinander.",
          "analysisHighlights sind die wichtigsten Befunde der Analysen (tone warn zuerst); bei Bedarf mit dem genannten tool Details holen. Nicht jeden Punkt aufzählen, nur was zur Frage passt.",
          "Planänderungen mit save_plan speichern, dauerhafte Erkenntnisse mit save_coach_note, Ziele mit set_goals.",
        ],
      });
    },
  );
}
