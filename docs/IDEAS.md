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
| 6 | MyWhoosh per FIT-Upload (#14) | FIT aus dem MyWhoosh-Webportal im Dashboard hochladen, parsen ins Datenmodell | MyWhoosh-Fahrten (Standardweg) | P1 | S | Zeile 2 | Beispiel-FIT (synthetisch) wird korrekt importiert | Done ⚙️ (Import #34, Upload im Dashboard #18; User-Test #35) |
| 7 | Dashboard: Tagesansicht und Verlauf (#13) | Recovery, Schlaf, Strain/Belastung heute; Wochen-/Monatsverlauf | Überblick | P1 | L | Zeile 2, eine Quelle | User-Test | Done ⚙️ (#18; User-Test #17, Handy #44) |
| 8 | Trainingslast (CTL/ATL/TSB) und Leistungskurve (#32) | Belastung aus Leistung/Puls, Fitness/Ermüdung/Form, Power-Duration-Kurve | Training steuern | P2 | M | Zeile 4 oder 5 | Werte gegen Handrechnung geprüft | Done ⚙️ (Leistungskurve, FTP-Schätzung, Zonen #38; im Dashboard #18; User-Test #40) |
| 9 | Trainingscoach (#15) | Tagesempfehlung aus Recovery + Trainingslast, Wochenplan, Rückblick; erklärt die Gründe; läuft über Claude im Artefakt (kein API-Schlüssel) | Coach | P2 | L | Zeile 3, 8 | User-Test | In Progress (regelbasierte Empfehlung #12; Claude-Coach im Artefakt) |
| 10 | Entwicklungs-Dashboard | Nutzung (5 h/Woche + Hochrechnung), Sitzungen, Agents, User-Tests, Backlog – wie im Wohnungsplaner | Überblick über die Entwicklung | P2 | S | – | siehe [`DASHBOARD.md`](DASHBOARD.md) | Ready |
| 11 | Dashboard modularisieren (#31) | Kern + je Abschnitt eine Datei unter `artifact/sections/`, Artefakt mit mehreren Dateien | Voraussetzung für parallele UI-Arbeit | P1 | S | Zeile 7 | Vorschau ohne Fehler, gleiche Ansicht | Done ⚙️ (#18) |
| 12 | Pulszonen und Intensitätsverteilung (#19) | WHOOP `zone_durations` speichern, Zeit in Zonen je Workout/Woche, 80/20-Verteilung, gestapelte Wochenbalken | Training richtig dosieren | P1 | M | Zeile 3 | Unit-Tests, User-Test | Done ⚙️ (#42; im Dashboard #55; User-Test #45) |
| 13 | Schlaf-Detail (#20) | Phasen gestapelt, Schlafenszeiten-Streifen, Konsistenz, Schlafschuld-Verlauf, Nickerchen | Schlaf verstehen | P1 | M | Zeile 3 | User-Test | In Progress (Schlafrhythmus im Dashboard #49) |
| 14 | Einflussfaktoren (#21) | `core/insights.ts`: Erholung/HRV vs. Schlaf, Vortagsbelastung, späte Workouts, Wochentag, Tagebuch; Claude deutet | „Was hilft mir?“ | P1 | L | Zeile 3; besser mit Zeile 16 | Unit-Tests mit eingebautem Zusammenhang, User-Test | Done ⚙️ (#48; im Dashboard #55) |
| 15 | Coach mit Gedächtnis (#22) | Ziele + Wochenpläne in D1, Plan-Ist-Abgleich, Anpassung nach Tagesform | Coach, der dranbleibt | P1 | L | Zeile 9 | Unit-Tests, User-Test | Done ⚙️ (#41; Wochenplan und Ziele im Dashboard #73; User-Test #51) |
| 16 | Tagebuch (#23) | täglicher Check-in (Befinden, Muskelkater, Stress, Tags), RPE je Workout, Notizen | subjektive Daten für Coach | P1 | M | – | Unit-Tests, User-Test | Done ⚙️ (#41; Check-in im Dashboard #73; User-Test #52) |
| 17 | Frühwarnung Überlastung/Infekt (#24) | mehrere Signale außerhalb der Basis → „heute schonen“ (keine Diagnose) | Schutz vor Überlastung | P2 | S | Zeile 7 | Unit-Tests | Done ⚙️ (#54; im Dashboard #73; User-Test #57) |
| 18 | Jahresübersicht (#25) | Kalender-Heatmap, Serien, Rekorde, Zeitraumvergleich | Motivation, Überblick | P2 | M | Zeile 11 | User-Test | Done ⚙️ (#49; User-Test #50) |
| 19 | Event-Planung (#26) | Ziel-Rennen, CTL/TSB-Projektion, Tapering | auf ein Ziel hin trainieren | P2 | M | Zeile 15 | Unit-Tests, User-Test | Done ⚙️ (Formprognose #72/#74, im Fitness-Diagramm; User-Test #62) |
| 20 | Workout-Detail aus FIT (#27) | Zeitreihen, Intervalle, Entkopplung, Leistungszonen, Claude-Kommentar | Einheiten auswerten | P2 | L | Zeile 6 | User-Test | Blocked (Zeile 6) |
| 21 | Morgen-Briefing (#28) | 3–4 Sätze von Claude beim ersten Öffnen am Tag, Verlauf gespeichert | schneller Start in den Tag | P1 | S | Zeile 11 | User-Test | Done ⚙️ (#49; User-Test #50) |
| 22 | WHOOP-Webhooks (#29) | `/webhooks/whoop` mit Signaturprüfung, betroffene Daten sofort nachladen | Daten ohne Wartezeit | P2 | M | Zeile 3 | Unit-Tests | Done ⚙️ (#36; User-Test #39) |
| 23 | Körperwerte und Export (#30) | Gewichtsverlauf, manuelle Eingabe, W/kg, CSV-Export | vollständiges Bild | P3 | S | Zeile 11 | User-Test | Done ⚙️ (#74; im Dashboard #78; User-Test #77) |
| 25 | Handy-Version (#37) | Tab-Leiste unten, Tabellen als Karten, große Zahlen | Dashboard am Handy | P1 | S | Zeile 11 | User-Test | Done ⚙️ (#18; User-Test #44) |
| 24 | Krafttraining (#33) | Übungen/Sätze/Gewicht erfassen, Volumen je Muskelgruppe, 1RM-Verlauf, sRPE-Belastung in der Gesamtlast, Coach plant Kraft und Rad zusammen | du trainierst Kraft + Rennrad | P1 | L | Zeile 16 (RPE) hilfreich | Unit-Tests, User-Test | Done ⚙️ (#56; User-Test #47) |
| 26 | MyWhoosh-Workouts exportieren (#63) | Coach-Intervalle als Workout-Datei (% FTP), Download im Dashboard; Format vorher offiziell prüfen | strukturiert auf der Rolle trainieren | P1 | M | Zeile 8, 15 | Unit-Tests, User-Test | Ready |
| 27 | FTP-Test-Assistent (#64) | Ramp-/20-min-Test vorschlagen (TSB > 0), aus FIT auswerten, Verlauf | FTP aktuell halten | P2 | M | Zeile 6, 8 | Unit-Tests, User-Test | Ready |
| 28 | Bestleistungen-Feed (#65) | neue Rekorde Watt/1RM/Strecke, Woche gegen Vorwoche | Motivation | P2 | S | Zeile 8, 24 | Unit-Tests, User-Test | Ready |
| 29 | Wetter-Empfehlung (#66) | Open-Meteo, bestes Zeitfenster für draußen | Rennrad draußen planen | P2 | M | Zeile 9 | Unit-Tests, User-Test | Ready |
| 30 | Dashboard anpassen (#67) | Bereiche je Tab ein-/ausblenden, Reihenfolge | Übersicht am Handy | P1 | S | Zeile 11 | User-Test | Done ⚙️ (#73) |
| 31 | CI prüft Dashboard-Vorschau (#68) | Playwright in Actions: Skriptfehler, Überlauf, fehlende Script-Tags | weniger kaputte Veröffentlichungen | P1 | S | Zeile 11 | CI rot bei kaputtem Abschnitt | Done ⚙️ (#73) |
| 32 | Schneller laden (#69) | get_dashboard kompakter, KV-Cache, Tabs laden faul | schnelleres Handy-Dashboard | P2 | M | – | Messung vorher/nachher | Ready |

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
| 24 Krafttraining | `core/strength.ts` (neu), Migration, Werkzeuge | 12–14, 17, 22 (mit 16: RPE-Feld abstimmen) |
| 22 Webhooks | `src/webhooks.ts` (neu), `providers/whoop/` | allen außer 12 (beide in `providers/whoop/`, nur additiv) |
| 26 Workout-Export | `core/workouts.ts` (neu), Werkzeug `build_workout` | allen |
| 27 FTP-Test | `core/ftptest.ts` (neu) | allen außer 26 (beide nutzen FTP-Zonen, nur lesend) |
| 28 Rekorde | `core/records.ts` (neu), `sections/records.js` | allen |
| 29 Wetter | `core/weather.ts` (neu), KV, Einstellung Ort | allen außer Coach-Regel-Änderungen |
| 32 Ladezeit | `core/dashboard.ts`, `app/core.js` | nicht parallel zu anderen Änderungen an `dashboard.ts` |

**Oberfläche:** Bis Zeile 11 fertig ist, ändert nur der Haupt-Thread `artifact/`. Danach bringt jedes Thema seinen Abschnitt als eigene Datei `artifact/sections/<thema>.js` mit; der Haupt-Thread trägt ihn ein, pflegt die Werkzeugliste im Artefakt-Manifest und veröffentlicht.
