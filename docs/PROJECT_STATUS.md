# Projektstatus – Fitness Coach

_Zuletzt aktualisiert: 2026-10-16 (abends) · Workflow: [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md)_

## Aktuell
- **Phase:** 1 – Daten, Auswertung, Dashboard. WHOOP-Daten liegen in D1 und werden stündlich abgeglichen; Wahoo ist fertig gebaut und wartet auf die Freigabe der Wahoo-App (#3).
- **Fitness-Dashboard (Artefakt):** https://claude.ai/artifact/2uTpv443yDNX6UMiGEDhep – Quelle `artifact/dashboard.html`, Vorschau mit synthetischen Daten `artifact/dev/` (siehe `artifact/README.md`).
- **Auswertung im Worker (#12):** `get_dashboard` liefert Tagesreihe, Trends gegen die persönliche Basis, Trainingslast (CTL/ATL/TSB, Belastung aus Leistung oder Puls geschätzt), Wochen, Workouts (Duplikate zusammengeführt) und eine regelbasierte Tagesempfehlung. Einstellungen über `update_settings`.
- **Worker live:** https://fitness-coach.fitness-coach-worker.workers.dev. Deploy: `cd worker && npm ci && CLOUDFLARE_API_TOKEN=via-proxy npx wrangler deploy`; Migrationen `npx wrangler d1 migrations apply fitness-coach --remote`.
- **Connector „Fitness Coach“:** Anmeldung über WHOOP (nur dein Konto). Werkzeuge: `get_dashboard`, `get_daily`, `get_sleep`, `get_workouts`, `get_body`, `get_settings`, `update_settings`, `sync_now`, `whoop_status`, `whoop_recovery`, `wahoo_connect`, `wahoo_status`, `ping`.
- **Deine Aufgaben:** #3 Wahoo-App (wartet auf Wahoo).
- **Nächster Schritt:** Dashboard-User-Test, MyWhoosh-FIT-Upload mit Leistungskurve (#14), Coach im Dashboard (#15).

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
| Fitness-Dashboard (Artefakt) | ✅ `artifact/dashboard.html` (Issue #13) | ✅ Vorschau mit synthetischen Daten | 🧪 User-Test offen |
