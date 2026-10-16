# Projektstatus – Fitness Coach

_Zuletzt aktualisiert: 2026-10-16 · Workflow: [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md)_

## Aktuell
- **Phase:** 0 – Organisation. Repository angelegt, Workflow, Labels, Vorlagen und Backlog aus `wohnungsplaner-3d` übernommen und angepasst.
- **Deine Aufgaben:** #1 Cloudflare-Token (priority: high), #2 WHOOP-App, #3 Wahoo-App (Label `user-task`).
- **Architektur:** Cloudflare-Worker als Kern + Claude-Artefakt als Oberfläche, Coach über Claude ohne API-Schlüssel (siehe MASTER_PROMPT.md).
- **Cloudflare-Skills** sind als Projekt-Plugin aktiv (`.claude/settings.json`); der Cloudflare-MCP braucht Browser-Login und wird in Cloud-Sitzungen nicht genutzt, Deploy per Wrangler mit `CLOUDFLARE_API_TOKEN`.
- **Nächster Schritt:** Machbarkeitstest (IDEAS Zeile 0), sobald #1 erledigt ist.

## Legende
`DONE` fertig mit Beleg · `PARTIAL` teilweise · `IN PROGRESS` in Arbeit · `PLANNED` geplant · `BLOCKED` blockiert · `NEEDS USER TEST` braucht deinen Praxistest

Prüfstufen: **Impl.** Code vorhanden · **Auto** automatischer Test/Build grün · **Manuell** von Claude in der laufenden App angesehen · **Nutzer** von dir bestätigt

| Aufgabe | Implementiert | Automatisiert getestet | Abnahme |
|---|---|---|---|
| Workflow, Labels, Vorlagen, Backlog | ✅ `docs/`, `.github/ISSUE_TEMPLATE/` | – | – |
