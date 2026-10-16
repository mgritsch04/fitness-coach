# Ideen-Backlog (Arbeitsplan)

Kuratierter Arbeitsplan. **Neue Ideen als Issue mit Label `idea-inbox`** ([`IDEA_CAPTURE.md`](IDEA_CAPTURE.md)); die umsetzende Session übernimmt sie hierher. Workflow: [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md) · Stand: [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

**Ablauf:** `idea-inbox` → bewerten (Nutzen, Aufwand, Abhängigkeiten, Abnahme, Priorität `P1` hoch … `P3` niedrig; Label `planned`) → `Ready` oder `Blocked` (mit Grund) → `In Progress` (höchstens 1–2) → `Done` (manuelle Abnahme über `[USERTEST]`-Issue).

**Abnahme-Vermerk bei `Done`:** ✅ von dir bestätigt (Datum) · 🧪 User-Test offen (#) · ❌ fehlgeschlagen (#) · ⚙️ nur automatisiert/Doku.

Sortierung: In Progress → Ready (nach Priorität) → Blocked → Done. **Größe** (für die Dashboard-Hochrechnung): S = 1, M = 2, L = 4 Punkte.

## Übersicht

| # | Titel (Issue) | Beschreibung | Nutzen | Prio | Größe | Abhängigkeiten | Abnahme | Status |
|---|---|---|---|---|---|---|---|---|
| 0 | Machbarkeit: Artefakt ruft eigenen Connector auf (#4) | Mini-Worker als Remote-MCP (noch ohne Login, nur `ping`), in claude.ai als Connector „Fitness Coach“ eingetragen, Test-Artefakt ruft `ping` auf | trägt die ganze Architektur | P1 | S | Cloudflare-Token von dir (#1) | Artefakt zeigt Antwort des Workers | Done ✅ von dir bestätigt (2026-10-16) |
| 1 | Grundgerüst: Worker + D1 + Artefakt + CI | TypeScript-Worker (MCP-Connector mit OAuth-Login – Pflicht, bevor echte Daten im Worker liegen –, Cron), D1-Schema, Artefakt-Oberfläche, Lint/Test/Build, CI-Workflow | Basis für alles | P1 | M | Zeile 0 | CI grün, Deployment erreichbar, Artefakt lädt Daten über den Connector | In Progress (Worker, D1, OAuth, CI fertig #5; Cron und Artefakt-Oberfläche offen) |
| 2 | Gemeinsames Datenmodell | Workout, Schlaf, Recovery/Tag, Körperwerte; Quelle + Roh-ID je Datensatz; Duplikat-Abgleich (Startzeit ± Toleranz, Dauer) | eine Sicht auf alle Quellen | P1 | M | Zeile 1 | Unit-Tests mit synthetischen Daten | In Progress (Tabellen und WHOOP-Mapping fertig #8; Duplikat-Abgleich offen, sobald Wahoo liefert) |
| 3 | WHOOP anbinden | OAuth (inkl. `offline`), Token-Refresh mit Rotation, Abgleich Recovery/Schlaf/Cycles/Workouts | Recovery & Schlaf | P1 | M | Zeile 1–2 | Login → Daten der letzten 30 Tage sichtbar | Done ⚙️ (#5, #8: Login, Refresh, stündlicher Abgleich 30 Tage; User-Test im Dashboard folgt mit Zeile 7) |
| 4 | Wahoo anbinden | OAuth, Workouts + FIT-Dateien, später Webhook `workout_summary` | Radtraining mit Leistung | P1 | M | Zeile 1–2; Wahoo-App von dir (#3) | Login → Workouts mit Leistung/Puls sichtbar | Blocked |
| 5 | MyWhoosh automatisch (inoffizielle API) | Fahrten ohne Handgriff übernehmen; braucht MyWhoosh-Login im Worker, kann bei App-Updates brechen | kein manueller Upload | P3 | M | Zeile 6; ausdrückliche Freigabe von dir | neue MyWhoosh-Fahrt erscheint ohne Duplikat | Blocked |
| 6 | MyWhoosh per FIT-Upload | FIT aus dem MyWhoosh-Webportal im Dashboard hochladen, parsen ins Datenmodell | MyWhoosh-Fahrten (Standardweg) | P1 | S | Zeile 2 | Beispiel-FIT (synthetisch) wird korrekt importiert | Ready |
| 7 | Dashboard: Tagesansicht und Verlauf | Recovery, Schlaf, Strain/Belastung heute; Wochen-/Monatsverlauf | Überblick | P1 | L | Zeile 2, eine Quelle | User-Test | Ready |
| 8 | Trainingslast (CTL/ATL/TSB) und Leistungskurve | Belastung aus Leistung/Puls, Fitness/Ermüdung/Form, Power-Duration-Kurve | Training steuern | P2 | M | Zeile 4 oder 5 | Werte gegen Handrechnung geprüft | Ready |
| 9 | Trainingscoach | Tagesempfehlung aus Recovery + Trainingslast, Wochenplan, Rückblick; erklärt die Gründe; läuft über Claude im Artefakt (kein API-Schlüssel) | Coach | P2 | L | Zeile 3, 8 | User-Test | Ready |
| 10 | Entwicklungs-Dashboard | Nutzung (5 h/Woche + Hochrechnung), Sitzungen, Agents, User-Tests, Backlog – wie im Wohnungsplaner | Überblick über die Entwicklung | P2 | S | – | siehe [`DASHBOARD.md`](DASHBOARD.md) | Ready |
