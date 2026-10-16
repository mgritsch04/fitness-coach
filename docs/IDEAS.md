# Ideen-Backlog (Arbeitsplan)

Kuratierter Arbeitsplan. **Neue Ideen als Issue mit Label `idea-inbox`** ([`IDEA_CAPTURE.md`](IDEA_CAPTURE.md)); die umsetzende Session übernimmt sie hierher. Workflow: [`DEVELOPMENT_WORKFLOW.md`](DEVELOPMENT_WORKFLOW.md) · Stand: [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

**Ablauf:** `idea-inbox` → bewerten (Nutzen, Aufwand, Abhängigkeiten, Abnahme, Priorität `P1` hoch … `P3` niedrig; Label `planned`) → `Ready` oder `Blocked` (mit Grund) → `In Progress` (höchstens 1–2) → `Done` (manuelle Abnahme über `[USERTEST]`-Issue).

**Abnahme-Vermerk bei `Done`:** ✅ von dir bestätigt (Datum) · 🧪 User-Test offen (#) · ❌ fehlgeschlagen (#) · ⚙️ nur automatisiert/Doku.

Sortierung: In Progress → Ready (nach Priorität) → Blocked → Done. **Größe** (für die Dashboard-Hochrechnung): S = 1, M = 2, L = 4 Punkte.

## Übersicht

| # | Titel (Issue) | Beschreibung | Nutzen | Prio | Größe | Abhängigkeiten | Abnahme | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | Grundgerüst: Server + Dashboard + CI | TypeScript-Monorepo (Server für OAuth/Sync, Web-Dashboard), SQLite, Lint/Test/Build, CI-Workflow | Basis für alles | P1 | M | – | CI grün, `npm run dev` startet Server + leeres Dashboard | Ready |
| 2 | Gemeinsames Datenmodell | Workout, Schlaf, Recovery/Tag, Körperwerte; Quelle + Roh-ID je Datensatz; Duplikat-Abgleich (Startzeit ± Toleranz, Dauer) | eine Sicht auf alle Quellen | P1 | M | Zeile 1 | Unit-Tests mit synthetischen Daten | Ready |
| 3 | WHOOP anbinden | OAuth (inkl. `offline`), Token-Refresh mit Rotation, Abgleich Recovery/Schlaf/Cycles/Workouts | Recovery & Schlaf | P1 | M | Zeile 1–2; Entwickler-App von dir (user-task) | Login → Daten der letzten 30 Tage sichtbar | Blocked |
| 4 | Wahoo anbinden | OAuth, Workouts + FIT-Dateien, später Webhook `workout_summary` | Radtraining mit Leistung | P1 | M | Zeile 1–2; Entwickler-App von dir (user-task) | Login → Workouts mit Leistung/Puls sichtbar | Blocked |
| 5 | MyWhoosh über Strava | Strava-OAuth, virtuelle Fahrten übernehmen; alternativ FIT-Upload | MyWhoosh-Einheiten | P2 | M | Zeile 1–2; Strava-App + MyWhoosh→Strava von dir (user-task) | MyWhoosh-Fahrt erscheint ohne Duplikat | Blocked |
| 6 | FIT-Datei-Import | FIT hochladen/aus Ordner lesen, parsen ins Datenmodell | Fallback für alles ohne API | P2 | S | Zeile 2 | Beispiel-FIT (synthetisch) wird korrekt importiert | Ready |
| 7 | Dashboard: Tagesansicht und Verlauf | Recovery, Schlaf, Strain/Belastung heute; Wochen-/Monatsverlauf | Überblick | P1 | L | Zeile 2, eine Quelle | User-Test | Ready |
| 8 | Trainingslast (CTL/ATL/TSB) und Leistungskurve | Belastung aus Leistung/Puls, Fitness/Ermüdung/Form, Power-Duration-Kurve | Training steuern | P2 | M | Zeile 4 oder 5 | Werte gegen Handrechnung geprüft | Ready |
| 9 | Trainingscoach | Tagesempfehlung aus Recovery + Trainingslast, Wochenplan, Rückblick; erklärt die Gründe | Coach | P2 | L | Zeile 3, 8 | User-Test | Ready |
| 10 | Entwicklungs-Dashboard | Nutzung (5 h/Woche + Hochrechnung), Sitzungen, Agents, User-Tests, Backlog – wie im Wohnungsplaner | Überblick über die Entwicklung | P2 | S | – | siehe [`DASHBOARD.md`](DASHBOARD.md) | Ready |
