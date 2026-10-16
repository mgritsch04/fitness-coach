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
| `usage` | `{at, five_hour: {utilization, resetsAt}, seven_day: {…}, history: [{at, u}], updater: {mode, runs, stopAt, stopped}}` | Cloud-Updater |
| `live` | `{at, rows: [{title, task, bucket, env, cost, updated}]}` | Cloud-Updater |
| `agents` | `{rows: [{name, aufgabe, status, seit}]}` | umsetzende Session |
| `features` | `{rows: [{nr, titel, wer, stand}]}` | umsetzende Session |
| `usertests` | `{rows: [{nr, titel, bereit}]}` | umsetzende Session |
| `forecast` | `{at, rate, rateBasis, inProgress: [...], items: [{nr, titel, size}]}` | umsetzende Session |

## Cloud-Updater
- Eine eigene Cloud-Session mit kleinem Modell (Haiku), die Nutzung und Sitzungen aus den Sitzungsdaten von Claude Code liest (`get_session`/`list_sessions`) und per `ArtifactData` in `board` schreibt.
- Takt: etwa alle 1–2 min, solange Sitzungen aktiv sind; sonst Ruhemodus (alle 30 min). Pro Lauf ein Wegwerf-Helfer, damit der Verlauf der Updater-Session klein bleibt. Begrenzte Laufzeit (`stopAt`), danach beendet.
- Erkenntnis aus dem Wohnungsplaner: Die Seite kann die Sitzungsliste nicht selbst abfragen (Connector „Claude Code Remote“ ist im Browser per Richtlinie gesperrt) und stündliche Routinen haben die nötigen Werkzeuge nicht – deshalb der Updater. Er kostet Kontingent und läuft nur auf deinen Wunsch.
- Keine Zugangsdaten im Seiten-Code.

## Stand
Noch nicht angelegt (IDEAS Zeile 10). Link wird hier und in `PROJECT_STATUS.md` eingetragen.
