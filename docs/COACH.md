# Trainingscoach – Gedächtnis, Wochenplan, Connector-Werkzeuge

_Stand 2026-10-16 · Code: `worker/src/core/plan.ts` (Planung, reine Funktionen), `goals.ts` (D1), `training.ts` (Übersicht), `worker/src/coach-tools.ts` (Werkzeuge) · Tests: `worker/test/coach-plan.test.ts`, `coach-tools.test.ts` · Issue #22_

## Aufbau (Entscheidung)
- **Der Worker rechnet und merkt sich**, **Claude im Artefakt spricht**. Regeln (Tagesempfehlung `core/coach.ts`, Wochenplan `core/plan.ts`) liefern nachvollziehbare Zahlen und Gründe; Claude (über die `sample`-Capability des Artefakts, kein API-Schlüssel) erklärt sie, beantwortet Fragen, passt den Plan an und speichert das Ergebnis über die Werkzeuge zurück.
- **Kein eigenes Coach-Artefakt:** Der Coach ist ein Bereich im Fitness-Dashboard (pflegt der Haupt-Thread). `get_dashboard` enthält dafür das Feld `training`; Texte, die Claude erzeugt, landen als Coach-Notizen in D1 und erscheinen beim nächsten Öffnen wieder.
- Sportarten: Rennrad (derzeit indoor mit MyWhoosh) **und Krafttraining**. Standard: 2 Krafteinheiten pro Woche.
- Alles sind Trainingsempfehlungen, keine Diagnosen; Belastung (TSS-Maßstab), Phasen und Zeitbudget sind Schätzungen.

## Tabellen (Migration `0008_coach.sql`)
| Tabelle | Inhalt |
|---|---|
| `goals` | Ziele: `kind` (event/fitness/weight/habit/other), `title`, `target_date`, `metric` (ftpW/ctl/weightKg/weeklyHours), `target_value`, `unit`, `priority` A/B/C, `status` active/done/dropped |
| `training_plans` | ein Plan je Woche (`week_start` = Montag), JSON, `source` rule/coach |
| `coach_notes` | Texte des Coachs: daily (je Tag einer), weekly_review (je Woche einer), insight, chat; optional `data` (JSON für Diagramme) |
| `settings` Schlüssel `trainingPrefs` | Zeitbudget, Ruhetage, Langtag, Kraft pro Woche |

## Planungsregeln (`plan.ts`)
- **Phase** rückwärts vom nächsten aktiven Terminziel (A vor B vor C): Wettkampfwoche · 1 Woche Tapering · 2–3 Wochen Spitze · 4–11 Wochen Aufbau · davor Grundlage. Ohne Termin: „Erhalten“ (mit Fitnessziel: Grundlage). Erholungswoche nach drei Wochen mit steigender Fitness oder bei Form (TSB) unter −25.
- **Wochenbelastung** = Fitness (CTL) × 7 × Faktor (Grundlage 1,05 · Aufbau 1,1 · Spitze 1,0 · Tapering 0,6 · Erholung 0,6). Ohne Lastdaten (CTL < 15) nach Zeit.
- **Zeitbudget**: `weeklyHours` aus den Vorlieben, sonst Schnitt der letzten 4 Wochen (3–12 h, als Schätzung markiert).
- **Tage**: 3–6 Trainingstage je nach Zeit, feste Ruhetage bleiben frei, mindestens ein Tag pro Woche bleibt ganz frei (auch keine Kraft), lange Einheit am Langtag (Standard Samstag). Schlüsseleinheiten (Tempo/Schwelle/VO₂max) nie an Nachbartagen von harten Tagen oder dem Langtag; Tag nach Langtag/VO₂max eher Erholung. Watt- und Pulsbereiche aus FTP und Schwellenpuls.
- **Kraft-Gewohnheit**: Ohne Vorgabe übernimmt der Plan Häufigkeit und Dauer der Krafteinheiten aus den letzten 4 Wochen (bis 6× pro Woche, sonst Standard 2 × 45 min). Das Rad-Zeitbudget zählt Kraftminuten nicht mit.
- **Kraft** (Beine/Ganzkörper; Oberkörper darf auch vor harten Tagen liegen): nie am Tag vor Intervallen, Langtag oder Wettkampf; bevorzugt nach einer harten Radeinheit („harte Tage hart“) oder an freien Tagen, mindestens ein Tag zwischen zwei Krafttagen, Beine früh in der Woche. Tapering/Erholung höchstens eine leichte, Wettkampfwoche keine.
- **Soll/Ist** (`comparePlan`): je Tag `done` (≥ 70 % von Belastung oder Dauer; harte Einheiten brauchen ≥ 60 % der Belastung und ≥ 50 % der Dauer), `partial`, `missed`, `extra` (Training am Ruhetag), `today`, `upcoming`, `rest`; Kraft erledigt, wenn an dem Tag ein Kraft-Workout (WHOOP: weightlifting, bodybuilding, functional …) vorliegt.
- **Heute** (`todayCheck`): vergleicht die geplante Einheit mit der Bereitschaft aus der Tagesempfehlung → `ok`, `reduce` (leichter), `swap` (mit einem späteren lockeren Tag tauschen), `rest`.

## Werkzeuge
| Werkzeug | Parameter | Inhalt |
|---|---|---|
| `get_goals` | `status` (active/done/dropped/all) | Ziele |
| `set_goals` | `goals[]` (ohne `id` = neu, mit `id` = ändern), `delete[]` | speichert, gibt alle aktiven Ziele zurück |
| `get_training_prefs` / `set_training_prefs` | `weeklyHours` (Rad/Ausdauer), `restDays` (0 = Mo … 6 = So), `longDay`, `maxWeekdayMin`, `mainSport`, `strengthPerWeek` (0–6), `strengthMin` (`null` = aus den letzten Wochen) | Vorlieben |
| `get_event_projection` | `goalId` (Std. nächstes Terminziel) | Formprognose, siehe unten |
| `get_plan` | `week` = current/next/previous/Datum | `{ week, stored, savedAt, plan, phaseLabel, comparison, today, readiness }` |
| `save_plan` | `week`, `accept` (Vorschlag übernehmen) **oder** `days[]` (angepasster Plan, fehlende Tage = Ruhe) **oder** `reset` | gespeicherter Plan mit Soll/Ist |
| `save_coach_note` | `kind`, `day` (Std. heute bzw. Montag), `title`, `body`, `data` | Notiz |
| `get_coach_notes` / `delete_coach_note` | `days`, `kind`, `limit` / `id` | Notizen |
| `get_coach_context` | `days` (7–42, Std. 14) | kompakter Überblick für Coach-Prompts: Tagesempfehlung, `planToday`, Trends, letzte Tage/Workouts/Wochen, Ziele, Plan mit Soll/Ist, Einstellungen, letzte Notizen, `guidance` (Regeln für Claude) |

### Plan (`plan`)
`{ weekStart, phase, phaseReason, goalId, targetLoad, targetHours, notes[], source, days[7] }`, je Tag `{ day, type, title, durationMin, targetLoad, intensity, description, key, strength: { durationMin, focus } | null }`. `type`: rest, recovery, endurance, long, tempo, threshold, vo2max, strength, opener, race.

### `get_dashboard` → `training`
`{ goals: [{ goal, daysLeft, weeksLeft, current, text }], prefs, thisWeek: (wie get_plan), nextWeek: { week, stored, phase, phaseLabel, phaseReason }, today: { planned, verdict, text }, projection: (wie get_event_projection oder null), notes: [letzte Coach-Notizen, 14 Tage], disclaimer }`.

## Vorschlag für den Coach-Bereich im Dashboard
1. Kopf: `coach.headline` + `training.today.text`, Gründe als Chips.
2. Wochenplan als 7 Kacheln mit Status-Häkchen aus `thisWeek.comparison.days`, Phase und Fortschritt (`comparison.summary`). Knöpfe „Vorschlag übernehmen“ (`save_plan accept`) und „An Tagesform anpassen“ (Claude erhält `get_coach_context`, gibt geänderte `days` zurück → `save_plan days`).
3. Ziele mit Countdown (`training.goals`), Formular → `set_goals`.
4. Coach-Chat: Prompt = `get_coach_context` + Frage; gute Antworten mit `save_coach_note kind=chat` merken. Wochenrückblick sonntags → `kind=weekly_review`.

## Tagebuch (#23, `core/journal.ts`, Migration `0009_journal.sql`, Werkzeuge `src/journal-tools.ts`)
- Tabelle `journal`: ein Check-in je Tag – `feeling`, `energy`, `motivation` (1 = schlecht … 5 = sehr gut), `soreness`, `stress` (1 = keiner … 5 = stark), `notes`, `tags` (JSON-Liste, klein geschrieben). Tabelle `workout_rpe`: RPE 1–10 je Workout (`source`, `source_id`).
- Werkzeuge: `get_journal` (`days`, Std. 14; mit `suggestedTags`), `save_journal` (`day` Std. heute, nur übergebene Felder, `null` löscht, `tags` ersetzt, `remove`), `save_workout_rpe` (`source`, `sourceId`, `rpe` oder `null`).
- Wirkung auf die Tagesempfehlung (`applyJournal`, nur leichter, nie härter): „krank/erkältet/Fieber“ → Ruhe mit Warnung · „verletzt/Schmerzen“, Muskelkater ≥ 4, Energie ≤ 2, Befinden 1, Stress 5 → je eine Stufe leichter · Alkohol → Hinweis. Gründe erscheinen mit `factor: "journal"`.
- `get_dashboard` → `journal: { today, recent (14 Tage), tagEffects }`; `tagEffects` = Erholung/HRV am Folgetag mit vs. ohne Tag (ab 3 Tagen mit Tag; Beobachtung, keine Ursache). Workouts haben zusätzlich `sourceId`, `rpe`, `sessionRpe` (Dauer × RPE nach Foster, eigene Einheit „AU“, nicht TSS).
- `get_coach_context` enthält `journal` und RPE der letzten Workouts.
- Abgrenzung zum Krafttraining (#33, `core/strength.ts`): Dort hat jede Krafteinheit ihre eigene RPE, die die Belastung (sRPE → TSS-Maßstab) bestimmt. `workout_rpe` gilt für jedes Workout (auch Radfahrten), dient der Anzeige und dem Coach und ändert die Belastung nicht.
- UI-Vorschlag: Check-in-Karte oben im Dashboard (5 Regler oder Smileys + Tag-Chips aus `suggestedTags`), RPE-Auswahl 1–10 direkt am Workout.

## Formprognose (#26, `core/projection.ts`)
- Schreibt Fitness/Ermüdung/Form ab dem Stand von gestern fort: Rest der laufenden Woche aus ihrem Plan (heute das Größere aus Plan und schon Trainiertem), danach je Woche der Regelplan mit der fortgeschriebenen Fitness. Höchstens 26 Wochen.
- Ergebnis: `{ goal, daysLeft, weeks: [{ week, phase, phaseLabel, targetLoad, targetHours, ctlEnd }], days: [{ day, load, ctl, atl, tsb }], atEvent: { ctl, atl, tsb, formZone, ctlGain }, targetTsb, verdict, advice[], disclaimer }`.
- Form am Wettkampfmorgen: Wunschbereich A-Ziel +5 … +25, B/C −5 … +20 (Faustregel). `verdict`: `on_track`, `too_tired` (Tapering früher), `too_fresh` (Tapering kürzer), `short` (unter einer Woche).
- Anzeige: Prognose-Linie (gestrichelt) im Trainingslast-Diagramm an `days` anhängen.

## Frühwarnung in der Empfehlung (#24)
- Die Erkennung selbst liegt in `core/warnings.ts` (Analysen, siehe `docs/ANALYTICS.md`); `get_dashboard` → `earlyWarning`.
- `core/warning-cap.ts` begrenzt die Tagesempfehlung: `caution` → höchstens locker, `alert` → Ruhe; Grund `factor: "warning"` mit dem Rat aus `earlyWarning.advice`. Macht die Empfehlung nie härter. Keine Diagnose.
- Reihenfolge in `get_dashboard`: Regeln (`coach.ts`) → Kraft-Hinweise (`strength.ts`) → Frühwarnung → Tagebuch.

## Intensitäts-Check und WHOOP-Zonen
- Pulsangaben im Plan beziehen sich auf die Schwelle (Grundlage 80–89 %). Dahinter steht die passende WHOOP-Zone (Anteil der maximalen Herzfrequenz), damit die Zahlen zum Pulszonen-Diagramm im Dashboard passen.
- `training.intensity` (`core/training.ts`, `intensityCheck`): Ausdauer-Einheiten der letzten 28 Tage (ab 20 min, mit Puls) gegen den Grundlagenbereich. `below` gilt, wenn ≥ 60 % mehr als 10 Schläge darunter liegen, `above`, wenn ≥ 50 % darüber liegen. Erklärt, warum die gemessene Belastung unter dem Soll bleibt. Hinweis, wenn die Schwelle nur geschätzt ist.

## Wochenrückblick (#76, `core/review.ts`)
- `get_week_review` (Standard: letzte abgeschlossene Woche, höchstens 6 Wochen zurück): Stunden, Belastung, Fitnessänderung, Zeit je Sport, Pulszonen-Anteile, Erholung/HRV/Ruhepuls/Schlaf gegen die Vorwoche, Plan-Soll/Ist, Highlights, Tagebuch und höchstens 3 regelbasierte Punkte für die nächste Woche (`nextWeek`). Dazu `savedReview`, der gespeicherte Text von Claude.
- Abschnitt `artifact/sections/review.js` (Tab „coach“, order 25): Kennzahlen mit Pfeilen zur Vorwoche. „Rückblick schreiben (Claude)“ schreibt den Text per `sample` und speichert ihn mit `save_coach_note` (kind `weekly_review`, day = Montag).

## Verpflegung je Einheit (`core/fueling.ts`)
- `training.fueling.days`: für jeden Trainingstag der laufenden Woche Hinweise für vorher, währenddessen und danach, dazu eine Kurzfassung (`short`). Mengen richten sich nach dem Körpergewicht, wenn eines bekannt ist.
- Faustregeln: unter 60 min locker nur Wasser. Bei harten Einheiten oder ab 60 min 30–60 g Kohlenhydrate pro Stunde, ab 90 min 60–80 g, ab 150 min 70–90 g. Dazu 0,5–0,8 l pro Stunde trinken, auf der Rolle mehr. Nach langen oder harten Einheiten etwa 1 g/kg Kohlenhydrate und 0,3 g/kg Eiweiß, nach Kraft 0,3 g/kg Eiweiß. Keine Ernährungsberatung.
- Anzeige im Wochenplan (Tagesdetail und Zeile „heute“) und in `get_coach_context` als `fuelingToday`.

## FTP-Test im Wochenplan (#98, `ftpTestPlan` in `core/training.ts`)
Ist ein Test fällig (noch keiner gespeichert oder der letzte ist ≥ 6 Wochen her, Regel aus `core/ftp-test.ts`), schlägt `training.ftpTest` einen Tag der laufenden Woche ab heute vor. In Frage kommt eine Tempo-, Schwellen-, VO₂max- oder Grundlageneinheit, deren Vortag weder lange Fahrt noch hart noch Beinkraft war; harte Tage werden bevorzugt, dann der früheste. Ob man am Tag selbst frisch genug ist, entscheidet die Tagesempfehlung; `rested` zeigt den heutigen Stand (Form ≥ 0). Ohne FTP weist der Text darauf hin, dass ein Test Wattbereiche für die Rolle liefert. Der Wochenplan zeigt den Vorschlag in der Zusammenfassung, als „oder FTP-Test“ am Tag und mit Anleitung im Tagesdetail.
