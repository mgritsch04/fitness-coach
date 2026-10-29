import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { validAccessToken, whoopGet, WhoopAuthError } from "./providers/whoop/client";
import { compactDashboard } from "./core/compact";
import { syncAll } from "./sync";
import { d1WahooTokenStore, d1WhoopTokenStore } from "./store";
import { wahooConnectLink, wahooCredentials } from "./wahoo";
import { getSyncState, readDaily, readLatestBody, readPowerCurves, readSleeps, readWorkouts } from "./core/repository";
import { combineCurves } from "./core/power";
import { FitImportError, importFit } from "./providers/mywhoosh/import";
import { loadWorkoutDetail } from "./core/workout-detail";
import { buildDashboard } from "./core/dashboard";
import { readSettings, writeSettings } from "./core/settings";
import { readIndoor, writeIndoor } from "./core/indoor";
import { readLayout, writeLayout } from "./core/ui-layout";
import { readIntervalRides } from "./core/intervals";
import { analysisContext, fitnessProfileView, healthTrendsView, periodSummariesView, recoveryFactorsView, earlyWarningView, sleepReportView, recordsView, enduranceView, recoveryForecastView, interferenceView, hrvTrendView, trainingTimingView, durabilityView, aerobicView, intervalQualityView, cadenceView, riderProfileView, muscleBalanceView, analysisHighlightsView, recoveryCurveView, readinessAlignmentView, eftpView, indoorOutdoorView, powerCompareView, strainRecoveryView, trainingLoadView } from "./core/analytics";
import type { AuthProps, Env } from "./env";
import { registerStrengthTools } from "./strength-tools";
import { registerCoachTools } from "./coach-tools";
import { registerJournalTools } from "./journal-tools";
import { registerBackupTools } from "./backup-tools";
import { registerBodyTools } from "./body-tools";
import { registerFtpTools } from "./ftp-tools";
import { registerBikeWorkoutTools } from "./bike-workout-tools";
import { registerWeatherTools } from "./weather-tools";
import { registerDevBoardTools } from "./devboard-tools";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });

interface WhoopRecoveryPage {
  records: {
    cycle_id: number;
    created_at: string;
    score_state: string;
    score?: { recovery_score: number; resting_heart_rate: number; hrv_rmssd_milli: number; spo2_percentage?: number; skin_temp_celsius?: number };
  }[];
}

// Werkzeuge des Connectors. Jeder Aufruf kommt nur nach erfolgreicher Anmeldung hier an (OAuthProvider).
export function createServer(env: Env, props: AuthProps, origin: string) {
  const server = new McpServer({ name: "fitness-coach", version: "0.1.0" });
  const creds = { clientId: env.WHOOP_CLIENT_ID, clientSecret: env.WHOOP_CLIENT_SECRET };
  const store = d1WhoopTokenStore(env.DB);

  server.registerTool(
    "ping",
    {
      description: "Verbindungstest: antwortet mit der Serverzeit und dem übergebenen Text.",
      inputSchema: { text: z.string().max(200).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ text }) => json({ ok: true, serverTime: new Date().toISOString(), echo: text ?? null }),
  );

  server.registerTool(
    "whoop_status",
    { description: "Ob WHOOP verbunden ist und bis wann das aktuelle Token gilt.", annotations: { readOnlyHint: true } },
    async () => {
      const tokens = await store.get(props.whoopUserId);
      const sync = await getSyncState(env.DB, "whoop");
      return json({
        connected: Boolean(tokens),
        tokenExpiresAt: tokens ? new Date(tokens.expiresAt).toISOString() : null,
        lastSync: sync?.last_success_at ?? null,
        lastSyncError: sync?.last_error ?? null,
      });
    },
  );

  const days = { days: z.number().int().min(1).max(365).optional().describe("Zeitraum in Tagen bis heute, Standard 30") };
  const fromDay = (d?: number) => new Date(Date.now() - (d ?? 30) * 86_400_000).toISOString().slice(0, 10);

  server.registerTool(
    "get_daily",
    {
      description:
        "Gespeicherte Tageswerte, neueste zuerst: Erholung (recovery_score %, resting_hr, hrv_ms, spo2_pct, skin_temp_c) und Tagesbelastung (strain, energy_kj, avg_hr, max_hr).",
      inputSchema: days,
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await readDaily(env.DB, fromDay(d))),
  );

  server.registerTool(
    "get_sleep",
    {
      description: "Gespeicherte Schlafphasen, neueste zuerst. Dauern in Sekunden, day = Tag des Aufwachens, is_nap = Nickerchen.",
      inputSchema: days,
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await readSleeps(env.DB, fromDay(d))),
  );

  server.registerTool(
    "get_workouts",
    {
      description: "Gespeicherte Workouts aus allen Quellen, neueste zuerst (Dauer s, Distanz m, Energie kJ, Puls, Leistung W, Strain).",
      inputSchema: days,
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await readWorkouts(env.DB, fromDay(d))),
  );

  server.registerTool(
    "import_fit",
    {
      description:
        "Importiert eine FIT-Datei (z. B. MyWhoosh-Export aus dem Webportal) als Workout mit Quelle mywhoosh: Dauer, Distanz, " +
        "Leistung (Ø, NP), Puls, Trittfrequenz, TSS sowie Sekundenwerte und Bestleistungskurve. Erneuter Upload derselben Fahrt " +
        "aktualisiert sie. Dieselbe Fahrt aus WHOOP/Wahoo wird beim Auslesen zusammengeführt (sameRideIn nennt diese Quellen).",
      inputSchema: {
        fileBase64: z.string().min(16).max(12_000_000).describe("Inhalt der .fit-Datei als Base64 (Data-URL erlaubt)"),
        fileName: z.string().max(200).optional().describe("Dateiname, nur für die Rückmeldung"),
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ fileBase64, fileName }) => {
      try {
        return json({ fileName: fileName ?? null, ...(await importFit(env.DB, fileBase64)) });
      } catch (err) {
        if (err instanceof FitImportError) return { ...json({ error: "invalid_fit", fileName: fileName ?? null, message: err.message }), isError: true };
        throw err;
      }
    },
  );

  server.registerTool(
    "get_power_curve",
    {
      description:
        "Leistungskurve (beste Durchschnittsleistung in Watt je Dauer in Sekunden, 1 s bis 2 h) über den Zeitraum, dazu die Kurve je Workout. " +
        "Bisher nur aus importierten FIT-Dateien mit Sekundenwerten.",
      inputSchema: {
        days: z.number().int().min(1).max(3650).optional().describe("Zeitraum in Tagen bis heute, Standard 90"),
        compare: z.enum(["previous", "lastYear"]).optional()
          .describe("Zusätzlich Vergleich (comparison): previous = gleich langer Zeitraum davor, lastYear = dieselbe Zeit im Vorjahr; Differenz je Dauer in W und %"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d, compare }) => {
      const workouts = await readPowerCurves(env.DB, fromDay(d ?? 90));
      const comparison = compare ? await powerCompareView(env.DB, compare, Math.min(d ?? 90, 365)) : undefined;
      return json({ best: combineCurves(workouts.map((w) => w.power_curve)), workouts, ...(comparison ? { comparison } : {}) });
    },
  );

  server.registerTool(
    "get_workout_detail",
    {
      description:
        "Detail einer Fahrt mit Sekundenwerten (FIT-Import): Verlauf von Leistung/Puls/Trittfrequenz (verkleinert, series.points), " +
        "Kennzahlen (NP, IF, VI, TSS-Schätzung, Arbeit), Zeit in Leistungs- und Pulszonen, automatisch erkannte Intervalle, " +
        "Pa:HR-Entkopplung und Bestleistungskurve. Ohne source/sourceId die neueste solche Fahrt; available listet die letzten 20.",
      inputSchema: {
        source: z.string().max(20).optional().describe("Quelle aus get_workouts, z. B. mywhoosh"),
        sourceId: z.string().max(100).optional().describe("source_id aus get_workouts"),
        maxPoints: z.number().int().min(50).max(3600).optional().describe("Höchstzahl Punkte im Verlauf, Standard 600"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ source, sourceId, maxPoints }) => json(await loadWorkoutDetail(env.DB, source, sourceId, maxPoints)),
  );

  server.registerTool(
    "get_body",
    { description: "Zuletzt gespeicherte Körperwerte (Größe m, Gewicht kg, maximaler Puls).", annotations: { readOnlyHint: true } },
    async () => json(await readLatestBody(env.DB)),
  );

  server.registerTool(
    "sync_now",
    {
      description:
        "WHOOP und Wahoo jetzt abgleichen (sonst stündlich automatisch). full=true lädt die letzten `days` Tage neu (Standard 30, höchstens 365, so weit WHOOP und Wahoo zurückreichen). Ergebnis je Quelle; Wahoo wird übersprungen, solange es nicht verbunden ist.",
      inputSchema: { full: z.boolean().optional(), days: z.number().int().min(1).max(365).optional() },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ full, days: d }) => {
      return json(await syncAll(env, props.whoopUserId, { full, days: d }));
    },
  );

  server.registerTool(
    "get_dashboard",
    {
      description:
        "Alles für das Dashboard in einem Aufruf: Tagesreihe (Erholung, HRV, Ruhepuls, Schlaf, Strain, Belastung, Fitness/Ermüdung/Form), " +
        "Trends gegen die persönliche Basis, Wochenübersicht, Workouts mit geschätzter Belastung (Duplikate aus mehreren Quellen zusammengeführt) " +
        "und die regelbasierte Tagesempfehlung des Coachs. Belastungswerte sind Schätzungen.",
      inputSchema: {
        days: z.number().int().min(7).max(3650).optional().describe("Zeitraum der Ansicht in Tagen, Standard 90"),
        compact: z.boolean().optional().describe("true: days und workouts als {keys, rows} statt Objektliste (halbe Größe, für das Dashboard-Artefakt)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d, compact }) => {
      const dash = await buildDashboard(env.DB, { days: d });
      return json(compact ? compactDashboard(dash) : dash);
    },
  );

  const settingsShape = {
    ftpW: z.number().min(50).max(600).nullable().optional().describe("Functional Threshold Power in Watt"),
    maxHr: z.number().int().min(120).max(230).nullable().optional().describe("maximaler Puls"),
    restingHr: z.number().int().min(30).max(100).nullable().optional().describe("Ruhepuls (sonst Median der letzten 30 Tage)"),
    thresholdHr: z.number().int().min(100).max(220).nullable().optional().describe("Puls an der Schwelle (LTHR)"),
    sleepNeedH: z.number().min(5).max(11).nullable().optional().describe("Schlafbedarf in Stunden"),
    timezone: z.string().max(60).nullable().optional().describe("IANA-Zeitzone, z. B. Europe/Berlin"),
    indoorOnly: z.boolean().nullable().optional().describe("Winterbetrieb: nur Rolle (true) oder auch draußen (false)"),
    dashboardLayout: z
      .object({ hidden: z.array(z.string().max(40)).max(100), order: z.record(z.string().max(40), z.number()), deskTabs: z.boolean().optional() })
      .nullable()
      .optional()
      .describe("Anordnung des Dashboards für alle Geräte (ausgeblendete Bereiche, Reihenfolge, Reiter am PC); null = Standard"),
    indoorUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe("letzter Tag des Winterbetriebs (YYYY-MM-DD), null = ohne Ende"),
  };

  server.registerTool(
    "get_settings",
    { description: "Persönliche Einstellungen für die Auswertung (nur die selbst gesetzten Werte).", annotations: { readOnlyHint: true } },
    async () => json({ ...(await readSettings(env.DB)), indoor: await readIndoor(env.DB) }),
  );

  server.registerTool(
    "update_settings",
    {
      description: "Setzt persönliche Einstellungen (FTP, Pulswerte, Schlafbedarf, Zeitzone, Winterbetrieb „nur Rolle“ mit optionalem Enddatum). null löscht einen Wert, dann wird er wieder aus den Daten geschätzt.",
      inputSchema: settingsShape,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ indoorOnly, indoorUntil, dashboardLayout, ...patch }) => {
      if (patch.timezone) {
        try {
          new Intl.DateTimeFormat("en", { timeZone: patch.timezone });
        } catch {
          return { ...json({ error: "invalid_timezone", message: `Unbekannte Zeitzone: ${patch.timezone}` }), isError: true };
        }
      }
      const indoor = indoorOnly !== undefined || indoorUntil !== undefined ? await writeIndoor(env.DB, { on: indoorOnly, until: indoorUntil }) : await readIndoor(env.DB);
      const layout = dashboardLayout !== undefined ? await writeLayout(env.DB, dashboardLayout) : await readLayout(env.DB);
      return json({ ...(await writeSettings(env.DB, patch)), indoor, dashboardLayout: layout });
    },
  );

  server.registerTool(
    "whoop_recovery",
    {
      description: "Letzte WHOOP-Recovery-Werte (Recovery %, Ruhepuls, HRV), neueste zuerst. Direkt von WHOOP gelesen, noch ohne Speicherung.",
      inputSchema: { limit: z.number().int().min(1).max(25).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => {
      try {
        const token = await validAccessToken(creds, store, props.whoopUserId);
        const page = await whoopGet<WhoopRecoveryPage>(token, `/v2/recovery?limit=${limit ?? 7}`);
        return json(
          page.records.map((r) => ({
            date: r.created_at,
            state: r.score_state,
            recovery: r.score?.recovery_score ?? null,
            restingHeartRate: r.score?.resting_heart_rate ?? null,
            hrvMs: r.score?.hrv_rmssd_milli ?? null,
          })),
        );
      } catch (err) {
        if (err instanceof WhoopAuthError) return { ...json({ error: "whoop_not_connected", message: err.message }), isError: true };
        throw err;
      }
    },
  );

  const wahooStore = d1WahooTokenStore(env.DB);
  const wahooNotConfigured = () => ({
    ...json({ error: "wahoo_not_configured", message: "Die Wahoo-App ist im Worker noch nicht eingerichtet (WAHOO_CLIENT_ID/SECRET fehlen)." }),
    isError: true,
  });

  server.registerTool(
    "wahoo_connect",
    {
      description:
        "Erzeugt einen Einmal-Link (15 Minuten gültig), über den sich der Nutzer bei Wahoo anmeldet und Wahoo mit dem Fitness Coach verbindet. Den Link dem Nutzer zum Öffnen geben.",
      annotations: { readOnlyHint: false },
    },
    async () => {
      const url = await wahooConnectLink(env, origin, props.whoopUserId);
      return url ? json({ url, expiresInMinutes: 15 }) : wahooNotConfigured();
    },
  );

  server.registerTool(
    "wahoo_status",
    { description: "Ob Wahoo verbunden ist und bis wann das aktuelle Token gilt.", annotations: { readOnlyHint: true } },
    async () => {
      const tokens = await wahooStore.get(props.whoopUserId);
      return json({
        configured: Boolean(wahooCredentials(env)),
        connected: Boolean(tokens),
        tokenExpiresAt: tokens ? new Date(tokens.expiresAt).toISOString() : null,
        sync: await getSyncState(env.DB, "wahoo"),
      });
    },
  );

  // --- Auswertungen (core/analytics.ts); Ausgaben sind in docs/ANALYTICS.md beschrieben. ---------
  const viewDays = (def: number) => ({
    days: z.number().int().min(7).max(730).optional().describe(`Zeitraum der Ansicht in Tagen bis heute, Standard ${def}`),
  });

  server.registerTool(
    "get_training_load",
    {
      description:
        "Trainingslast: Tagesreihe mit Belastung (TSS-Maßstab), Fitness (CTL), Ermüdung (ATL), Form (TSB) und Form-Bereich, " +
        "aktueller Stand mit Anstieg der Fitness in 7 Tagen, ATL/CTL-Verhältnis, Monotonie und die belastendsten Workouts. Schätzungen.",
      inputSchema: viewDays(90),
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(trainingLoadView(await analysisContext(env.DB, { days: d ?? 90, maxDays: 730 }))),
  );

  server.registerTool(
    "get_fitness_profile",
    {
      description:
        "Leistungsprofil: FTP (eigene oder geschätzt, mit Methode), W/kg, Leistungszonen (Coggan) und Pulszonen (Friel), " +
        "Zeit je Zone und Verteilung locker/mittel/hart, Leistungskurve (beste Leistung 1 s … 2 h) für 30/90/365 Tage und gesamt, Zeit je WHOOP-Pulszone je Woche (80/20). Schätzungen.",
      inputSchema: viewDays(28),
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => {
      const c = await analysisContext(env.DB, { days: d ?? 28, maxDays: 730 });
      return json(fitnessProfileView(c, await readIntervalRides(env.DB, c.viewFrom)));
    },
  );

  server.registerTool(
    "get_health_trends",
    {
      description:
        "Gesundheitstrends je Tag mit persönlichem Normalbereich: HRV, Ruhepuls, Erholung, Schlafdauer, Atemfrequenz, Hauttemperatur, SpO2 " +
        "(Wert, 7-Tage-Mittel, Basis ± Streuung, Status), HRV-Stabilität und Schlafrhythmus (Einschlaf-/Aufwachzeit, Schlafschuld).",
      inputSchema: viewDays(60),
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(healthTrendsView(await analysisContext(env.DB, { days: d ?? 60, maxDays: 365 }))),
  );

  server.registerTool(
    "get_period_summaries",
    {
      description:
        "Zusammenfassungen je Woche, Monat oder Jahr: Workouts, Stunden, Belastung, Distanz, Sportarten, Erholung (grün/gelb/rot), " +
        "HRV, Ruhepuls, Schlaf und Schlafschuld, Strain, Fitness-Veränderung und Vergleich zum vorigen Zeitraum.",
      inputSchema: {
        period: z.enum(["week", "month", "year"]).optional().describe("Standard month"),
        ...viewDays(180),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ period, days: d }) => json(periodSummariesView(await analysisContext(env.DB, { days: d ?? 180, maxDays: 730 }), period ?? "month")),
  );

  server.registerTool(
    "get_strain_recovery",
    {
      description:
        "Strain und Belastung gegen die Erholung am Folgetag: Tagespaare, Mittelwerte je Strain- und Belastungsstufe, Korrelation, " +
        "letzte 7 gegen 28 Tage und kurze Erkenntnisse. Beobachtungen aus deinen Daten, keine Ursache-Wirkung.",
      inputSchema: viewDays(90),
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(strainRecoveryView(await analysisContext(env.DB, { days: d ?? 90, maxDays: 365 }))),
  );

  server.registerTool(
    "get_recovery_factors",
    {
      description:
        "Einflussfaktoren auf Erholung und HRV: Schlafdauer, Tiefschlaf, Einschlafzeit, Strain und Belastung am Vortag, spätes Training, " +
        "Ruhetag, Wochentag – je Faktor Stichprobe, Stärke, Vergleichsgruppen und ein Satz; highlights = die deutlichsten Erkenntnisse. " +
        "Beobachtungen, keine Ursache-Wirkung.",
      inputSchema: viewDays(90),
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(recoveryFactorsView(await analysisContext(env.DB, { days: d ?? 90, maxDays: 365 }))),
  );

  server.registerTool(
    "get_early_warning",
    {
      description:
        "Frühwarnung Überlastung/Infekt: Ruhepuls, HRV, Atemfrequenz, Hauttemperatur und SpO2 von heute (oder gestern) gegen die persönliche Basis; " +
        "level none/watch/caution/alert, auffällige Signale, Hinweis für heute. Trainingshinweis, keine Diagnose.",
      annotations: { readOnlyHint: true },
    },
    async () => json(earlyWarningView(await analysisContext(env.DB, { days: 7 }))),
  );

  server.registerTool(
    "get_sleep_report",
    {
      description:
        "Schlaf-Detail je Nacht: Einschlaf-/Aufwachzeit, Phasen (leicht/tief/REM, Anteile), Effizienz, Nickerchen, Schlafschuld der letzten 7 Nächte; " +
        "Zusammenfassung mit Regelmäßigkeit, Wochenend-Verschiebung, Anteil Nächte mit genug Schlaf, empfohlener Schlafenszeit und Tipps.",
      inputSchema: viewDays(30),
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(sleepReportView(await analysisContext(env.DB, { days: d ?? 30, maxDays: 365 }))),
  );

  server.registerTool(
    "get_records",
    {
      description:
        "Bestleistungen-Feed: neue Rekorde (Leistung 5 s bis 60 min, geschätztes Kraft-1RM, längste Fahrt nach Strecke und Zeit) mit Vorwert und Datum, " +
        "plus Vergleich dieser Woche mit denselben Tagen der Vorwoche (Stunden, Belastung, Erholung, HRV, Schlaf). 1RM und Belastung sind Schätzungen.",
      inputSchema: { days: z.number().int().min(7).max(365).optional().describe("Zeitraum des Feeds in Tagen, Standard 30") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await recordsView(env.DB, await analysisContext(env.DB, { days: 14 }), d ?? 30)),
  );

  server.registerTool(
    "get_recovery_forecast",
    {
      description:
        "Erholungs-Prognose: geschätzte WHOOP-Erholung für morgen früh mit 80-%-Spanne, aus Erholung, Belastung und Strain von heute, " +
        "geplantem Schlaf und spätem Training (Regression nur auf den eigenen letzten 90 Tagen). Mit Was-wäre-wenn (mehr/weniger Schlaf, Training am Abend) " +
        "und ehrlicher Trefferquote; bei zu wenig Daten oder zu großem Fehler keine Prognose. Schätzung, keine Diagnose.",
      inputSchema: {
        sleepH: z.number().min(3).max(12).optional().describe("Geplanter Schlaf heute Nacht in Stunden, Standard: üblicher Schlaf der letzten 14 Nächte"),
        extraLoad: z.number().min(0).max(400).optional().describe("Heute noch geplante Trainingsbelastung (TSS-ähnliche Punkte), zählt als Training am Abend"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ sleepH, extraLoad }) => json(recoveryForecastView(await analysisContext(env.DB, { days: 90 }), { sleepH, extraLoad })),
  );

  server.registerTool(
    "get_strength_cycling_interference",
    {
      description:
        "Kraft und Rad im Wechselspiel: Erholung und HRV am Tag nach Beineinheiten im Vergleich zu anderen Tagen, Effizienz (Watt pro Herzschlag) und Intensität " +
        "der nächsten Radeinheit je nach Abstand zu den Beinen (unter 24 h bis 7 Tage) und daraus ein bewährter Mindestabstand für harte Intervalle. " +
        "Beobachtungen aus den eigenen Daten, keine Ursache-Wirkung.",
      inputSchema: { days: z.number().int().min(28).max(365).optional().describe("Zeitraum in Tagen, Standard 180") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => {
      const days = d ?? 180;
      return json(await interferenceView(env.DB, await analysisContext(env.DB, { days, maxDays: 365 }), days));
    },
  );

  server.registerTool(
    "get_hrv_trend",
    {
      description:
        "HRV-Trend nach Plews: Tageswerte, 7-Tage-Mittel der logarithmierten HRV, Normalband (60-Tage-Mittel ± 0,5 SD) und Schwankung von Tag zu Tag (CV). " +
        "Dazu eine Deutung (stabil, über dem Normalbereich, unruhig, Ermüdung baut sich auf, niedrig und gleichförmig, unter dem Normalbereich) mit Trainingshinweis. Keine Diagnose.",
      inputSchema: { days: z.number().int().min(28).max(365).optional().describe("Zeitraum für den Verlauf in Tagen, Standard 90") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => {
      const days = d ?? 90;
      return json(hrvTrendView(await analysisContext(env.DB, { days: days + 67, maxDays: 450 }), days));
    },
  );

  server.registerTool(
    "get_training_timing",
    {
      description:
        "Beste Trainingszeit: je Tageszeit (morgens bis spät) Anzahl Einheiten, Effizienz der Radeinheiten (Watt je Herzschlag), Schlaf der folgenden Nacht " +
        "und Erholung am nächsten Morgen gegenüber dem eigenen Mittel, dazu Hinweise. Beobachtungen aus den eigenen Daten, keine Ursache-Wirkung.",
      inputSchema: { days: z.number().int().min(28).max(365).optional().describe("Zeitraum in Tagen, Standard 120") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => {
      const days = d ?? 120;
      return json(trainingTimingView(await analysisContext(env.DB, { days, maxDays: 365 }), days));
    },
  );

  server.registerTool(
    "get_durability",
    {
      description:
        "Ermüdungsresistenz auf dem Rad: beste 5- und 20-min-Leistung frisch und nach 500, 1000 und 1500 kJ geleisteter Arbeit in derselben Fahrt " +
        "(aus FIT-Sekundenwerten), als Anteil der frischen Leistung, mit Einordnung. Schätzung.",
      inputSchema: { days: z.number().int().min(14).max(365).optional().describe("Zeitraum in Tagen, Standard 90") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await durabilityView(env.DB, d ?? 90)),
  );

  server.registerTool(
    "get_aerobic_decoupling",
    {
      description:
        "Aerobe Basis: Pa:HR-Entkopplung gleichmäßiger Fahrten ab 50 min (ohne 10 min Aufwärmen, aus FIT-Sekundenwerten) im Verlauf, " +
        "Median der letzten 4 Fahrten gegen die 4 davor, Einordnung und längste Fahrt unter 5 %. Schätzung.",
      inputSchema: { days: z.number().int().min(28).max(365).optional().describe("Zeitraum in Tagen, Standard 120") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await aerobicView(env.DB, d ?? 120)),
  );

  server.registerTool(
    "get_interval_quality",
    {
      description:
        "Intervall-Qualität: Hauptserie je Intervalltraining (aus FIT-Sekundenwerten erkannt), Leistungsabfall von der ersten zur letzten Wiederholung, " +
        "Gleichmäßigkeit, Pulsanstieg, Verlauf je Intervallart (kurz, VO2max, Schwelle, lang) und Hinweise. Trainingshinweise, keine Diagnose.",
      inputSchema: { days: z.number().int().min(14).max(365).optional().describe("Zeitraum in Tagen, Standard 90") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await intervalQualityView(env.DB, d ?? 90)),
  );

  server.registerTool(
    "get_cadence_profile",
    {
      description:
        "Trittfrequenz-Profil aus FIT-Sekundenwerten: Zeit je Kadenzbereich, Median-Kadenz je Leistungszone (nach FTP), " +
        "Verlauf der Kadenz in Zone 2 je Woche und Hinweise. Trainingshinweise, keine Diagnose.",
      inputSchema: { days: z.number().int().min(14).max(365).optional().describe("Zeitraum in Tagen, Standard 90") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await cadenceView(env.DB, d ?? 90)),
  );

  server.registerTool(
    "get_rider_profile",
    {
      description:
        "Fahrertyp aus der Leistungskurve: beste 5 s, 1 min und 5 min im Verhältnis zur FTP gegen die typischen Verhältnisse aus Coggans Leistungsprofil, " +
        "Stärken, Schwächen, Veränderung zum Vorzeitraum und Trainingsvorschlag für die Schwäche. Schätzung.",
      inputSchema: { days: z.number().int().min(28).max(365).optional().describe("Zeitraum in Tagen, Standard 90") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => json(await riderProfileView(env.DB, d ?? 90)),
  );

  server.registerTool(
    "get_eftp_trend",
    {
      description:
        "eFTP-Verlauf: FTP-Schätzung je Woche aus normalen Fahrten (Leistungskurve der letzten 42 Tage: Critical Power, sonst 95 % der besten 20 min, sonst 90 % der besten 10 min) " +
        "mit Spanne, Veränderung über 6 Wochen, Abweichung von der eingestellten FTP und Testvorschlag ab 5 % über zwei Wochen. Schätzung.",
      inputSchema: { weeks: z.number().int().min(4).max(52).optional().describe("Anzahl Wochen, Standard 26") },
      annotations: { readOnlyHint: true },
    },
    async ({ weeks }) => json(await eftpView(env.DB, weeks ?? 26)),
  );

  server.registerTool(
    "get_indoor_outdoor",
    {
      description:
        "Rolle gegen Straße: Radfahrten drinnen (MyWhoosh, Rolle) gegen draußen (mit Strecke). Anzahl, Stunden, Effizienz (NP pro Herzschlag), " +
        "Puls bei gleicher Leistung, Intensität und Trittfrequenz, mit Hinweisen zu Pulszonen auf der Rolle. Beobachtungen, keine Diagnose.",
      inputSchema: { days: z.number().int().min(28).max(730).optional().describe("Zeitraum in Tagen, Standard 180") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => {
      const days = d ?? 180;
      return json(indoorOutdoorView(await analysisContext(env.DB, { days, maxDays: 730 }), days));
    },
  );

  server.registerTool(
    "get_muscle_balance",
    {
      description:
        "Muskelbalance im Krafttraining: Arbeitssätze je Muskelgruppe im Wochenmittel gegen einen Zielbereich für Radfahrer mit Krafttraining, " +
        "Verhältnis Ziehen/Drücken und Beinbeuger/Beinstrecker, vernachlässigte Gruppen mit Übungsvorschlägen. Trainingsempfehlungen, keine Diagnose.",
      inputSchema: { weeks: z.number().int().min(1).max(12).optional().describe("Zeitraum in Wochen, Standard 4") },
      annotations: { readOnlyHint: true },
    },
    async ({ weeks }) => json(await muscleBalanceView(env.DB, weeks ?? 4)),
  );

  server.registerTool(
    "get_analysis_highlights",
    {
      description:
        "Die wichtigsten Befunde aller Analysen in wenigen Sätzen (Erholungsprognose, HRV-Trend, Aerobe Basis, Intervalle, Ermüdungsresistenz, Fahrertyp, " +
        "Muskelbalance, Trainingszeit, Kraft/Rad, Trittfrequenz), Auffälliges zuerst, je mit dem Tool für Details. Guter Einstieg für den Coach.",
      inputSchema: { limit: z.number().int().min(1).max(10).optional().describe("Höchstzahl der Sätze, Standard 6") },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => json(await analysisHighlightsView(env.DB, limit ?? 6)),
  );

  server.registerTool(
    "get_recovery_curve",
    {
      description:
        "Erholungskurve: Erholung, HRV und Ruhepuls an den Tagen 0 bis +4 nach harten Tagen (Strain ab dem 80. Perzentil) gegenüber dem eigenen Mittel, " +
        "Tage bis zur Rückkehr aufs Normalniveau und Einfluss des Schlafs danach. Nur Tageswerte (WHOOP). Beobachtungen, keine Diagnose.",
      inputSchema: { days: z.number().int().min(60).max(365).optional().describe("Zeitraum in Tagen, Standard 180") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => {
      const days = d ?? 180;
      return json(recoveryCurveView(await analysisContext(env.DB, { days, maxDays: 365 }), days));
    },
  );

  server.registerTool(
    "get_readiness_alignment",
    {
      description:
        "Training nach der Erholungsampel: Strain je Erholungszone (grün/gelb/rot) als Matrix, Quote passender Tage (hart an grünen, locker an roten), " +
        "Erholung am Morgen nach harten roten Tagen gegen ruhige und Hinweise. Nur Tageswerte (WHOOP). Trainingsempfehlung, keine Diagnose.",
      inputSchema: { days: z.number().int().min(28).max(365).optional().describe("Zeitraum in Tagen, Standard 90") },
      annotations: { readOnlyHint: true },
    },
    async ({ days: d }) => {
      const days = d ?? 90;
      return json(readinessAlignmentView(await analysisContext(env.DB, { days, maxDays: 365 }), days));
    },
  );

  server.registerTool(
    "get_endurance_profile",
    {
      description:
        "Ausdauer-Profil Rad: Critical Power (CP) und W′ aus den besten 3–20-min-Leistungen der letzten 90 Tage (2-Parameter-Modell), " +
        "wie lange welche Wattzahl haltbar ist, Vergleich mit der FTP und der Effizienz-Faktor (NP/Puls) lockerer Fahrten im Wochenverlauf. Schätzungen.",
      annotations: { readOnlyHint: true },
    },
    async () => json(enduranceView(await analysisContext(env.DB, { days: 180, maxDays: 365 }))),
  );

  registerStrengthTools(server, env);
  registerCoachTools(server, env);
  registerJournalTools(server, env);
  registerBodyTools(server, env);
  registerBackupTools(server, env);
  registerFtpTools(server, env);
  registerBikeWorkoutTools(server, env);
  registerWeatherTools(server, env);
  registerDevBoardTools(server, env);

  return server;
}
