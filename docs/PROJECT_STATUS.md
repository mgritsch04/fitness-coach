# Projektstatus – Fitness Coach

_Zuletzt aktualisiert: 2026-10-16 · Workflow: [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md)_

## Aktuell
- **Phase:** 0 – Organisation. Repository angelegt, Workflow, Labels, Vorlagen und Backlog aus `wohnungsplaner-3d` übernommen und angepasst.
- **Deine Aufgaben:** #1 Cloudflare-Token (priority: high), #2 WHOOP-App, #3 Wahoo-App (Label `user-task`).
- **Architektur:** Cloudflare-Worker als Kern + Claude-Artefakt als Oberfläche, Coach über Claude ohne API-Schlüssel (siehe MASTER_PROMPT.md).
- **Cloudflare-Skills** sind als Projekt-Plugin aktiv (`.claude/settings.json`); der Cloudflare-MCP braucht Browser-Login und wird in Cloud-Sitzungen nicht genutzt, Deploy per Wrangler mit `CLOUDFLARE_API_TOKEN`.
- **Worker live:** https://fitness-coach.fitness-coach-worker.workers.dev (`/privacy`, `/mcp` mit `ping`). Deploy: `cd worker && npm ci && CLOUDFLARE_API_TOKEN=via-proxy npx wrangler deploy` (Token als Network secret, Header `Authorization`, Prefix `Bearer`).
- **Machbarkeitstest bestanden (2026-10-16):** Ein Claude-Artefakt ruft den Worker über den Custom Connector „Fitness Coach“ auf (Test-Artefakt: https://claude.ai/artifact/AgMooNUSyF6JdY3xKQAaF2).
- **WHOOP-App (#2):** Redirect `https://fitness-coach.fitness-coach-worker.workers.dev/auth/whoop/callback`, Datenschutz `…/privacy`.
- **Connector mit Anmeldung (2026-10-16):** `/mcp` nur nach OAuth-Login über WHOOP; dein WHOOP-Konto ist als Besitzer eingetragen, andere Konten werden abgewiesen. In claude.ai: Connector „Fitness Coach“, *Sign in now*, *Use Claude's published identity*. Werkzeuge `ping`, `whoop_status`, `whoop_recovery`; WHOOP-Recovery kommt im Artefakt an (von dir bestätigt).
- **Nächster Schritt:** Gemeinsames Datenmodell und Speicherung in D1 (IDEAS Zeile 2), danach WHOOP-Abgleich aller Daten (Zeile 3).

## Legende
`DONE` fertig mit Beleg · `PARTIAL` teilweise · `IN PROGRESS` in Arbeit · `PLANNED` geplant · `BLOCKED` blockiert · `NEEDS USER TEST` braucht deinen Praxistest

Prüfstufen: **Impl.** Code vorhanden · **Auto** automatischer Test/Build grün · **Manuell** von Claude in der laufenden App angesehen · **Nutzer** von dir bestätigt

| Aufgabe | Implementiert | Automatisiert getestet | Abnahme |
|---|---|---|---|
| Workflow, Labels, Vorlagen, Backlog | ✅ `docs/`, `.github/ISSUE_TEMPLATE/` | – | – |
| Machbarkeit Artefakt → Connector | ✅ `worker/` (#4) | – | ✅ von dir bestätigt (2026-10-16) |
| Connector-Anmeldung über WHOOP, Recovery live lesen | ✅ `worker/src/auth.ts`, `providers/whoop/` (#5) | ✅ CI: Typprüfung, Unit-Tests | ✅ von dir bestätigt (2026-10-16) |
