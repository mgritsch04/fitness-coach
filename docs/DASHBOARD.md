# Entwicklungs-Dashboard (Nutzung, Sitzungen, Agents)

Vorbild: „Entwicklungsstand live“ aus `wohnungsplaner-3d` (#113). Getrennt vom Fitness-Dashboard der App: es zeigt, **wie die Entwicklung läuft**, nicht Trainingsdaten.

## Aufbau
Eine private Seite in claude.ai (Artifact) mit eingebauter Datenbank (`db`-Capability), Sammlung `board`. Kopfzeile mit Kurzfazit und „aktualisiert vor …“, darunter Kacheln, die je eine Detailansicht öffnen:
- **5-Stunden-Limit** und **Woche:** verbraucht in %, Hochrechnung bis Fensterende (als Schätzung gekennzeichnet), Warnschwelle einstellbar (Standard 80 %), Verlaufsdiagramm.
- **Aktive Sitzungen:** Threads/Sitzungen mit Status (arbeitet, wartet auf dich, fertig, Fehler), Ort (Cloud / dein PC), API-Gegenwert in $.
- **Agents aktiv:** Hilfsagenten innerhalb einer Session (erscheinen nicht in der Sitzungsliste).
- **Zum Testen:** offene `[USERTEST]`-Issues, die schon in `main` sind.
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

## Updater
- Läuft als **geplanter Task stündlich** (jeweils um :20, kürzer erlaubt die Plattform nicht) im Thread „Entwicklungsstand-Dashboard“ des Projekts „Fitness“. Jeder Lauf startet einen Wegwerf-Hilfsagenten mit **Haiku**, der nach [`DASHBOARD_UPDATER.md`](DASHBOARD_UPDATER.md) arbeitet (Kopie für die Läufe: `/mnt/project-files/dashboard/updater-anleitung.md`).
- Quellen: Threads des Projekts (`list_thread_sessions`), Kosten/Aufgabe aktiver Threads (`get_session`), Nutzung aus dem neuesten `rate_limit_event` einer aktiven Sitzung (`list_events`). Schreibt per `ArtifactData` nur `board/usage` und `board/live`, und nur bei Änderung.
- Ende: `stopAt` = 2026-10-18 00:00 UTC; danach löscht der Thread den geplanten Task. Verlängern oder stoppen nur auf deinen Wunsch („Updater stoppen“ / „Updater verlängern bis …“ im Thread).
- Kosten: pro Lauf ein Haiku-Agent (rund 80 000 Token, überwiegend Cache) plus ein kurzer Weckruf des Threads; zählt gegen dein Kontingent.
- Erkenntnis aus dem Wohnungsplaner: Die Seite kann die Sitzungsliste nicht selbst abfragen, deshalb der Updater. Keine Zugangsdaten im Seiten-Code.

## Stand
Live seit 2026-10-16: https://claude.ai/artifact/DLsyumhy4w8L66F1VNA9pk (Startdaten für `features`, `agents`, `usertests`, `forecast` eingetragen; ab dann pflegt sie der integrierende Thread).
