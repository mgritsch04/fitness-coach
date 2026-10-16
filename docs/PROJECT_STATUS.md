# Projektstatus – Fitness Coach

_Zuletzt aktualisiert: 2026-10-17 (nachts) · Workflow: [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md)_

## Aktuell
- **Phase:** 1 – Daten, Auswertung, Dashboard. WHOOP-Daten liegen in D1 und werden stündlich abgeglichen; Wahoo ist fertig gebaut und wartet auf die Freigabe der Wahoo-App (#3).
- **Fitness-Dashboard (Artefakt):** https://claude.ai/artifact/2uTpv443yDNX6UMiGEDhep – Shell `artifact/dashboard.html`, Kern `artifact/app/core.js`, je Bereich `artifact/sections/<thema>.js`; am Handy Tab-Leiste (Heute, Coach, Verlauf, Training, Mehr). Vorschau mit synthetischen Antworten aller Werkzeuge `artifact/dev/` (siehe `artifact/README.md`).
- **MyWhoosh:** FIT-Datei im Dashboard hochladen (Training › Rolle und Leistung), danach Leistungskurve, FTP-Schätzung und Zeit je Zone.
- **Auswertung im Worker (#12):** `get_dashboard` liefert Tagesreihe, Trends gegen die persönliche Basis, Trainingslast (CTL/ATL/TSB, Belastung aus Leistung oder Puls geschätzt), Wochen, Workouts (Duplikate zusammengeführt) und eine regelbasierte Tagesempfehlung. Einstellungen über `update_settings`.
- **Worker live:** https://fitness-coach.fitness-coach-worker.workers.dev. Deploy: `cd worker && npm ci && CLOUDFLARE_API_TOKEN=via-proxy npx wrangler deploy`; Migrationen `npx wrangler d1 migrations apply fitness-coach --remote`.
- **Connector „Fitness Coach“:** Anmeldung über WHOOP (nur dein Konto). Werkzeuge: `get_dashboard`, `get_daily`, `get_sleep`, `get_workouts`, `get_body`, `get_settings`, `update_settings`, `sync_now`, `whoop_status`, `whoop_recovery`, `wahoo_connect`, `wahoo_status`, `ping`, `import_fit`, `get_power_curve`, `get_training_load`, `get_fitness_profile`, `get_health_trends`, `get_period_summaries`, `get_strain_recovery`, `get_recovery_factors`, `get_sleep_report`, Frühwarnung, Kraft (`get_strength` u. a.), Coach (`save_plan`, `set_goals`, `save_journal`), Körperwerte (`get_body_history`, `log_weight`, `export_csv`) (siehe `docs/ANALYTICS.md`).
- **Deine Aufgaben:** #3 Wahoo-App (wartet auf Wahoo).
- **Nächster Schritt:** Offene User-Tests #17, #35, #39, #40, #44, #45, #47, #50–#53, #57, #60, #62, #75, #77, #82, #83, #85, #89–#91, #97, #101, #103, #104, #110, #112, #116, #119, #121, #123, #126, #130, #136, #138, #140, #144, #146. Dashboard Version 16 (40 Werkzeuge: u. a. Ermüdungsresistenz, Scheibenrechner im Gym-Modus, Anstrengung (RPE) je Workout, Beste Trainingszeit, HRV-Trend, Gym-Modus, „Heute dran“, Erholungs-Prognose, Kraft und Rad im Wechselspiel, Coach-Chat mit Fragen-Vorschlägen).

## Legende
`DONE` fertig mit Beleg · `PARTIAL` teilweise · `IN PROGRESS` in Arbeit · `PLANNED` geplant · `BLOCKED` blockiert · `NEEDS USER TEST` braucht deinen Praxistest

Prüfstufen: **Impl.** Code vorhanden · **Auto** automatischer Test/Build grün · **Manuell** von Claude in der laufenden App angesehen · **Nutzer** von dir bestätigt

| Aufgabe | Implementiert | Automatisiert getestet | Abnahme |
|---|---|---|---|
| Workflow, Labels, Vorlagen, Backlog | ✅ `docs/`, `.github/ISSUE_TEMPLATE/` | – | – |
| Machbarkeit Artefakt → Connector | ✅ `worker/` (#4) | – | ✅ von dir bestätigt (2026-10-16) |
| Connector-Anmeldung über WHOOP, Recovery live lesen | ✅ `worker/src/auth.ts`, `providers/whoop/` (#5) | ✅ CI: Typprüfung, Unit-Tests | ✅ von dir bestätigt (2026-10-16) |
| Datenmodell in D1, WHOOP-Abgleich stündlich | ✅ `worker/src/core/`, `providers/whoop/sync.ts` (#8) | ✅ CI: 25 Tests inkl. SQL gegen echtes Schema | ⚙️ erster Abgleich in Produktion fehlerfrei |
| Gemeinsames Datenmodell, WHOOP-Abgleich stündlich | ✅ `worker/src/core/`, `providers/whoop/sync.ts` (#8) | ✅ CI | ⚙️ |
| Wahoo-Anbindung | ✅ `providers/wahoo/` (#7, #9) | ✅ CI | blockiert: Wahoo-App (#3) |
| Auswertung, Trainingslast, Tagesempfehlung | ✅ `core/analysis.ts`, `core/coach.ts` (#11, Issue #12) | ✅ CI, 19 Tests | über Dashboard-Test |
| Fitness-Dashboard (Artefakt) | ✅ `artifact/` (Issue #13, PR #18) | ✅ Vorschau mit synthetischen Daten | 🧪 User-Test #17 |
| Dashboard modular + Handy-Ansicht | ✅ `artifact/app/`, `artifact/sections/` (#31, #37) | ✅ Vorschau Handy 5 Tabs ohne Überlauf | 🧪 User-Test #44 |
| Morgen-Briefing, Körpersignale, Belastung vs. Erholung, Monate, Jahresübersicht | ✅ `sections/briefing.js`, `health.js`, `strain.js`, `periods.js`, `year.js` (#28, #25, PR #49) | ✅ Vorschau | 🧪 User-Test #50 |
| Einflussfaktoren, Pulszonen im Dashboard | ✅ `sections/insights.js`, `hrzones.js` (#21, #19, PR #55) | ✅ Vorschau | 🧪 User-Test #45 |
| Coach mit Gedächtnis, Tagebuch (Worker) | ✅ `core/goals`, `journal` (#22, #23, PR #41) | ✅ CI | 🧪 User-Tests #51, #52 |
| MyWhoosh-FIT-Upload im Dashboard, Leistungskurve, Zonen | ✅ `sections/fit.js` (#14, #32) | ✅ Vorschau mit Upload | 🧪 User-Tests #35, #40 |
