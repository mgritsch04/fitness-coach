# Ideen-Backlog (Arbeitsplan)

Kuratierter Arbeitsplan. **Neue Ideen als Issue mit Label `idea-inbox`** ([`IDEA_CAPTURE.md`](IDEA_CAPTURE.md)); die umsetzende Session übernimmt sie hierher. Workflow: [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md) · Stand: [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

**Ablauf:** `idea-inbox` → bewerten (Nutzen, Aufwand, Abhängigkeiten, Abnahme, Priorität `P1` hoch … `P3` niedrig; Label `planned`) → `Ready` oder `Blocked` (mit Grund) → `In Progress` (höchstens 1–2) → `Done` (manuelle Abnahme über `[USERTEST]`-Issue).

**Abnahme-Vermerk bei `Done`:** ✅ von dir bestätigt (Datum) · 🧪 User-Test offen (#) · ❌ fehlgeschlagen (#) · ⚙️ nur automatisiert/Doku.

Sortierung: In Progress → Ready (nach Priorität) → Blocked → Done. **Größe** (für die Dashboard-Hochrechnung): S = 1, M = 2, L = 4 Punkte.

## Übersicht

| # | Titel (Issue) | Beschreibung | Nutzen | Prio | Größe | Abhängigkeiten | Abnahme | Status |
|---|---|---|---|---|---|---|---|---|
| 0 | Machbarkeit: Artefakt ruft eigenen Connector auf (#4) | Mini-Worker als Remote-MCP (noch ohne Login, nur `ping`), in claude.ai als Connector „Fitness Coach“ eingetragen, Test-Artefakt ruft `ping` auf | trägt die ganze Architektur | P1 | S | Cloudflare-Token von dir (#1) | Artefakt zeigt Antwort des Workers | Done ✅ von dir bestätigt (2026-10-16) |
| 1 | Grundgerüst: Worker + D1 + Artefakt + CI | TypeScript-Worker (MCP-Connector mit OAuth-Login – Pflicht, bevor echte Daten im Worker liegen –, Cron), D1-Schema, Artefakt-Oberfläche, Lint/Test/Build, CI-Workflow | Basis für alles | P1 | M | Zeile 0 | CI grün, Deployment erreichbar, Artefakt lädt Daten über den Connector | Done ⚙️ (Worker, D1, OAuth, CI #5; Cron #8; Artefakt-Oberfläche #13) |
| 2 | Gemeinsames Datenmodell | Workout, Schlaf, Recovery/Tag, Körperwerte; Quelle + Roh-ID je Datensatz; Duplikat-Abgleich (Startzeit ± Toleranz, Dauer) | eine Sicht auf alle Quellen | P1 | M | Zeile 1 | Unit-Tests mit synthetischen Daten | Done ⚙️ (#8, Duplikat-Abgleich beim Auslesen #12) |
| 3 | WHOOP anbinden | OAuth (inkl. `offline`), Token-Refresh mit Rotation, Abgleich Recovery/Schlaf/Cycles/Workouts | Recovery & Schlaf | P1 | M | Zeile 1–2 | Login → Daten der letzten 30 Tage sichtbar | Done ⚙️ (#5, #8: Recovery, Schlaf, Cycles, Workouts, Körperwerte stündlich gespeichert; Nachladen bis 120 Tage #12) |
| 4 | Wahoo anbinden | OAuth, Workouts + FIT-Dateien, später Webhook `workout_summary` | Radtraining mit Leistung | P1 | M | Zeile 1–2; Wahoo-App von dir (#3) | Login → Workouts mit Leistung/Puls sichtbar | Blocked (Code fertig #7/#9; wartet auf Freigabe der Wahoo-App #3) |
| 5 | MyWhoosh automatisch (inoffizielle API) | Fahrten ohne Handgriff übernehmen; braucht MyWhoosh-Login im Worker, kann bei App-Updates brechen | kein manueller Upload | P3 | M | Zeile 6; ausdrückliche Freigabe von dir | neue MyWhoosh-Fahrt erscheint ohne Duplikat | Blocked |
| 6 | MyWhoosh per FIT-Upload (#14) | FIT aus dem MyWhoosh-Webportal im Dashboard hochladen, parsen ins Datenmodell | MyWhoosh-Fahrten (Standardweg) | P1 | S | Zeile 2 | Beispiel-FIT (synthetisch) wird korrekt importiert | Ready |
| 7 | Dashboard: Tagesansicht und Verlauf (#13) | Recovery, Schlaf, Strain/Belastung heute; Wochen-/Monatsverlauf | Überblick | P1 | L | Zeile 2, eine Quelle | User-Test | In Progress (Auswertung #12 live, Artefakt veröffentlicht) |
| 8 | Trainingslast (CTL/ATL/TSB) und Leistungskurve (#32) | Belastung aus Leistung/Puls, Fitness/Ermüdung/Form, Power-Duration-Kurve | Training steuern | P2 | M | Zeile 4 oder 5 | Werte gegen Handrechnung geprüft | Ready (CTL/ATL/TSB aus Puls fertig #12; Leistungskurve braucht FIT-Daten, Zeile 6) |
| 9 | Trainingscoach (#15) | Tagesempfehlung aus Recovery + Trainingslast, Wochenplan, Rückblick; erklärt die Gründe; läuft über Claude im Artefakt (kein API-Schlüssel) | Coach | P2 | L | Zeile 3, 8 | User-Test | In Progress (regelbasierte Empfehlung #12; Claude-Coach im Artefakt) |
| 10 | Entwicklungs-Dashboard | Nutzung (5 h/Woche + Hochrechnung), Sitzungen, Agents, User-Tests, Backlog – wie im Wohnungsplaner | Überblick über die Entwicklung | P2 | S | – | siehe [`DASHBOARD.md`](DASHBOARD.md) | Ready |
| 11 | Dashboard modularisieren (#31) | Kern + je Abschnitt eine Datei unter `artifact/sections/`, Artefakt mit mehreren Dateien | Voraussetzung für parallele UI-Arbeit | P1 | S | Zeile 7 | Vorschau ohne Fehler, gleiche Ansicht | In Progress (Haupt-Thread) |
| 12 | Pulszonen und Intensitätsverteilung (#19) | WHOOP `zone_durations` speichern, Zeit in Zonen je Workout/Woche, 80/20-Verteilung, gestapelte Wochenbalken | Training richtig dosieren | P1 | M | Zeile 3 | Unit-Tests, User-Test | Ready |
| 13 | Schlaf-Detail (#20) | Phasen gestapelt, Schlafenszeiten-Streifen, Konsistenz, Schlafschuld-Verlauf, Nickerchen | Schlaf verstehen | P1 | M | Zeile 3 | User-Test | Ready |
| 14 | Einflussfaktoren (#21) | `core/insights.ts`: Erholung/HRV vs. Schlaf, Vortagsbelastung, späte Workouts, Wochentag, Tagebuch; Claude deutet | „Was hilft mir?“ | P1 | L | Zeile 3; besser mit Zeile 16 | Unit-Tests mit eingebautem Zusammenhang, User-Test | Ready |
| 15 | Coach mit Gedächtnis (#22) | Ziele + Wochenpläne in D1, Plan-Ist-Abgleich, Anpassung nach Tagesform | Coach, der dranbleibt | P1 | L | Zeile 9 | Unit-Tests, User-Test | Ready |
| 16 | Tagebuch (#23) | täglicher Check-in (Befinden, Muskelkater, Stress, Tags), RPE je Workout, Notizen | subjektive Daten für Coach | P1 | M | – | Unit-Tests, User-Test | Ready |
| 17 | Frühwarnung Überlastung/Infekt (#24) | mehrere Signale außerhalb der Basis → „heute schonen“ (keine Diagnose) | Schutz vor Überlastung | P2 | S | Zeile 7 | Unit-Tests | Ready |
| 18 | Jahresübersicht (#25) | Kalender-Heatmap, Serien, Rekorde, Zeitraumvergleich | Motivation, Überblick | P2 | M | Zeile 11 | User-Test | Ready |
| 19 | Event-Planung (#26) | Ziel-Rennen, CTL/TSB-Projektion, Tapering | auf ein Ziel hin trainieren | P2 | M | Zeile 15 | Unit-Tests, User-Test | Blocked (Zeile 15) |
| 20 | Workout-Detail aus FIT (#27) | Zeitreihen, Intervalle, Entkopplung, Leistungszonen, Claude-Kommentar | Einheiten auswerten | P2 | L | Zeile 6 | User-Test | Blocked (Zeile 6) |
| 21 | Morgen-Briefing (#28) | 3–4 Sätze von Claude beim ersten Öffnen am Tag, Verlauf gespeichert | schneller Start in den Tag | P1 | S | Zeile 11 | User-Test | Ready |
| 22 | WHOOP-Webhooks (#29) | `/webhooks/whoop` mit Signaturprüfung, betroffene Daten sofort nachladen | Daten ohne Wartezeit | P2 | M | Zeile 3 | Unit-Tests | Ready |
| 23 | Körperwerte und Export (#30) | Gewichtsverlauf, manuelle Eingabe, W/kg, CSV-Export | vollständiges Bild | P3 | S | Zeile 11 | User-Test | Ready |

## Parallel-Plan (Stand 2026-10-16 abends)

Damit 3–4 Threads gleichzeitig ohne Konflikte arbeiten, gehört jedem Thema ein eigener Bereich. **Gemeinsame Dateien** (`core/analysis.ts`, `core/coach.ts`, `core/dashboard.ts`, `src/mcp.ts`, Migrationen) nur additiv ändern: neue Funktionen/Felder anhängen, nichts umbauen; Migrationen fortlaufend nummerieren und vor dem PR `main` mergen, falls die Nummer schon vergeben ist. Neue Werkzeuge in `src/mcp.ts` am Ende der Liste eintragen.

| Zeile | eigener Bereich | parallel ohne Konflikt mit |
|---|---|---|
| 6 FIT-Upload | `providers/fit/` (neu), Werkzeug `import_fit` | allen außer 8, 20 |
| 8 Leistungskurve | `core/power.ts` (neu) | nach 6 |
| 11 Modularisieren | `artifact/` (Haupt-Thread) | allen Worker-Themen |
| 12 Pulszonen | `providers/whoop/map.ts`, Migration, `core/zones.ts` (neu) | 13–17, 21, 22 |
| 13 Schlaf-Detail | `core/sleep.ts` (neu), Feld in `get_dashboard` | 12, 14–17, 22 |
| 14 Einflussfaktoren | `core/insights.ts` (neu), Werkzeug `get_insights` | 12, 13, 15–17, 22 |
| 15 Coach mit Gedächtnis | `core/goals.ts`/`plans.ts` (neu), Migration, Werkzeuge | 12–14, 16, 17, 22 |
| 16 Tagebuch | `core/journal.ts` (neu), Migration, Werkzeuge | 12–15, 17, 22 |
| 17 Frühwarnung | Erweiterung in `core/coach.ts` | allen außer anderen Coach-Regel-Änderungen |
| 22 Webhooks | `src/webhooks.ts` (neu), `providers/whoop/` | allen außer 12 (beide in `providers/whoop/`, nur additiv) |

**Oberfläche:** Bis Zeile 11 fertig ist, ändert nur der Haupt-Thread `artifact/`. Danach bringt jedes Thema seinen Abschnitt als eigene Datei `artifact/sections/<thema>.js` mit; der Haupt-Thread trägt ihn ein, pflegt die Werkzeugliste im Artefakt-Manifest und veröffentlicht.
