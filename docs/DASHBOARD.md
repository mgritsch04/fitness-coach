# Entwicklungs-Dashboard (Master für Fitness und Wohnungsplaner)

Vorbild: „Entwicklungsstand live“ aus `wohnungsplaner-3d` (#113). Getrennt vom Fitness-Dashboard der App: es zeigt, **wie die Entwicklung läuft**, nicht Trainingsdaten.

## Aufbau
Eine private Seite in claude.ai (Artifact) mit eingebauter Datenbank (`db`-Capability), Sammlung `board`. Kopfzeile mit Kurzfazit und „aktualisiert vor …“, darunter Kacheln, die je eine Detailansicht öffnen:
- **5-Stunden-Limit** und **Woche:** verbraucht in %, Hochrechnung bis Fensterende (als Schätzung gekennzeichnet), Warnschwelle einstellbar (Standard 80 %), Verlaufsdiagramm.
- **Aktive Sitzungen:** Threads/Sitzungen mit Status (arbeitet, wartet auf dich, fertig, Fehler), Ort (Cloud / dein PC), API-Gegenwert in $.
- **Agents aktiv:** Hilfsagenten innerhalb einer Session (erscheinen nicht in der Sitzungsliste).
- **Zum Testen:** offene Feature-Issues mit Label `auto-user-test` (läuft automatisch) oder `user-test` (du schaust selbst); nur aus den Labels abgeleitet.
- **Backlog:** offene Zeilen aus `IDEAS.md` mit Größe S/M/L und Hochrechnung in Stunden.

## Datendokumente in `board`
| Dokument | Inhalt | schreibt |
|---|---|---|
| `usage` | `{at, five_hour: {utilization, resetsAt}, seven_day: {…}, history: [{at, u}], updater: {mode, runs, stopAt, stopped}}` | Updater |
| `live` | `{at, rows: [{title, task, bucket, env, cost, updated}]}` | Updater |
| `agents` | `{rows: [{name, aufgabe, status, seit}]}` | umsetzende Session |
| `features` | `{rows: [{nr, titel, wer, stand}]}` | umsetzende Session |
| `usertests` | `{rows: [{nr, titel, bereit}]}` | umsetzende Session |
| `forecast` | `{at, rate, rateBasis, inProgress: [...], items: [{nr, titel, size, hinweis}]}` | umsetzende Session |

## Master-Dashboard (seit 2026-10-16)
Auf Gs Wunsch zeigt das Dashboard beide Projekte: Nutzung einmal oben (gilt fürs ganze Konto), darunter je ein Abschnitt für Fitness Coach und Wohnungsplaner (wer arbeitet gerade, Features in Arbeit, Tests, Backlog). Zusätzliche Dokumente in `board`: `live_wp`, `wp_features`, `wp_usertests`, `wp_forecast`, optional `wp_agents` (Formate wie oben).

## Updater
- **Nutzung (`usage`) und Wohnungsplaner-Sitzungen (`live_wp`):** der „Dashboard-Updater“ (eigene Sitzung von G, alle ~4 min). Andere Sitzungen fassen diese beiden Dokumente nie an.
- **Fitness-Sitzungen und GitHub-Stand beider Repos** (`live`, `features`, `usertests`, `forecast`, `wp_*`): Kette im Thread „Entwicklungsstand-Dashboard“ alle ~15 min. Jeder Lauf prüft zuerst, ob sich etwas geändert hat, und schreibt nur dann (Helfer nach [`DASHBOARD_UPDATER.md`](DASHBOARD_UPDATER.md), Kopie: `/mnt/project-files/dashboard/updater-anleitung.md`). Zusätzlicher Lauf, wenn ein Thread startet oder endet. Tests, Features und Backlog kommen nur aus den Issue-Labels (`auto-user-test`, `user-test`, `in-progress`, `planned` …), damit sie nicht davon abhängen, dass ein Thread sie einträgt.
- Ende: 2026-10-18 00:00 UTC; verlängern oder stoppen nur auf deinen Wunsch. Keine Zugangsdaten im Seiten-Code.

## Stand
Live: https://claude.ai/artifact/DLsyumhy4w8L66F1VNA9pk
