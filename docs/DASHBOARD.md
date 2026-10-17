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

## Ohne Updater-Session (#309, ab 17.10.)
- **GitHub-Stand ohne Modell:** Die Seite ruft über den „Fitness Coach“-Connector das nur lesende Werkzeug `get_dev_board` auf (Worker, `worker/src/devboard-tools.ts`). Der Worker holt die offenen Issues und PRs beider Repos von der öffentlichen GitHub-API und hält das Ergebnis 5 min im KV. Bei einem GitHub-Fehler zeigt er den letzten Stand mit `stale: true`. Ein Token ist nicht nötig. Ein optionales Secret `GITHUB_READ_TOKEN` hebt das Limit an. Die Dokumente `features`, `usertests`, `forecast` und `wp_*` dienen nur noch als Rückfall.
- **Thread-Zeilen (R2):** Jeder Thread schreibt seine eigene Zeile, ohne Abruf im Takt.

### Zeile je Thread: Sammlung `threads`
Ein Dokument je Thread, `doc_id` = ID der Thread-Wurzel (`cmsg_…`, steht in jeder Wake-Nachricht):

```json
{"project": "fitness", "title": "Trainingscoach", "status": "working", "task": "Baut den Wochenplan für #299", "issue": 299, "env": "cloud", "updated": "2026-10-17T11:20:00Z"}
```

| Feld | Werte |
|---|---|
| `project` | `fitness` oder `wp` |
| `status` | `working`, `blocked` (wartet auf G), `done`, `failed` |
| `task` | ein Satz Klartext, nie rohe Befehle |
| `issue` | Issue-Nummer oder `null` |
| `env` | `cloud` oder `pc` |
| `updated` | ISO-Zeit UTC des Schreibens |

**So schreibt ein Thread:** `ArtifactData` mit `action: "set"`, `url: https://claude.ai/artifact/DLsyumhy4w8L66F1VNA9pk`, `collection: "threads"`, `doc_id: <eigene cmsg_-ID>`. Beim ersten Mal ohne `if_version`, danach mit der `version` aus dem letzten Ergebnis. Bei einem Versionskonflikt einmal mit `get` neu lesen und dann setzen. Geschrieben wird beim Start, bei jedem Schrittwechsel (neuer Status oder neue Aufgabe) und am Ende mit `status: "done"` (bei Abbruch `failed`). Nur die eigene Zeile schreiben.

**Anzeige:** Aktiv sind Zeilen mit `working` oder `blocked`, deren `updated` jünger als 2 h ist. Fertige Zeilen verschwinden nach 24 h. Solange ein Projekt noch keine `threads`-Zeilen hat, zeigt die Seite dafür weiter `live` bzw. `live_wp`.

## Stand
Live: https://claude.ai/artifact/DLsyumhy4w8L66F1VNA9pk
