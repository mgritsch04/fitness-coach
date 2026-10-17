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
| 9 | Trainingscoach (#15) | Tagesempfehlung aus Recovery + Trainingslast, Wochenplan, Rückblick; erklärt die Gründe; läuft über Claude im Artefakt (kein API-Schlüssel) | Coach | P2 | L | Zeile 3, 8 | User-Test | Done ⚙️ (Erklärung, Briefing, Wochenplan, Rückblick, Fragen; #15 geschlossen) |
| 10 | Entwicklungs-Dashboard | Nutzung (5 h/Woche + Hochrechnung), Sitzungen, Agents, User-Tests, Backlog – wie im Wohnungsplaner | Überblick über die Entwicklung | P2 | S | – | siehe [`DASHBOARD.md`](DASHBOARD.md) | Done ⚙️ (Thread „Entwicklungsstand-Dashboard“, Master für beide Projekte) |
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
| 26 | MyWhoosh-Workouts exportieren (#63) | Coach-Intervalle als Workout-Datei (% FTP), Download im Dashboard; Format vorher offiziell prüfen | strukturiert auf der Rolle trainieren | P1 | M | Zeile 8, 15 | Unit-Tests, User-Test | Done ⚙️ (#84, ZWO über den offiziellen Workout Builder; User-Test #89) |
| 27 | FTP-Test-Assistent (#64) | Ramp-/20-min-Test vorschlagen (TSB > 0), aus FIT auswerten, Verlauf | FTP aktuell halten | P2 | M | Zeile 6, 8 | Unit-Tests, User-Test | Done ⚙️ (#86; User-Test #90) |
| 28 | Bestleistungen-Feed (#65) | neue Rekorde Watt/1RM/Strecke, Woche gegen Vorwoche | Motivation | P2 | S | Zeile 8, 24 | Unit-Tests, User-Test | Done ⚙️ (#79; User-Test #83) |
| 29 | Wetter-Empfehlung (#66) | Open-Meteo, bestes Zeitfenster für draußen | Rennrad draußen planen | P2 | M | Zeile 9 | Unit-Tests, User-Test | Done ⚙️ (#95; User-Test #97) |
| 30 | Dashboard anpassen (#67) | Bereiche je Tab ein-/ausblenden, Reihenfolge | Übersicht am Handy | P1 | S | Zeile 11 | User-Test | Done ⚙️ (#73) |
| 31 | CI prüft Dashboard-Vorschau (#68) | Playwright in Actions: Skriptfehler, Überlauf, fehlende Script-Tags | weniger kaputte Veröffentlichungen | P1 | S | Zeile 11 | CI rot bei kaputtem Abschnitt | Done ⚙️ (#73) |
| 32 | Schneller laden (#69) | get_dashboard kompakter, KV-Cache, Tabs laden faul | schnelleres Handy-Dashboard | P2 | M | – | Messung vorher/nachher | Done ⚙️ (#81: 157 → 79 KB, Handy-Start 1 statt 11 Aufrufe; KV-Cache bewusst weggelassen; User-Test #82) |
| 33 | Wochenrückblick (#76) | Soll/Ist, Belastung, Erholung, Schlaf, Highlights, Text von Claude | dranbleiben, Woche einordnen | P1 | M | Zeile 15 | Unit-Tests, User-Test | Done ⚙️ (#80; im Dashboard v8; User-Test #85) |
| 34 | Ausdauer-Profil (#92) | Critical Power, W′, Effizienz-Trend (Watt pro Herzschlag) | Fortschritt auf dem Rad sehen | P2 | M | Zeile 8 | Unit-Tests, User-Test | Done ⚙️ (#96; im Dashboard v10; User-Test #101) |
| 35 | Erholungs-Prognose (#93) | Erholung morgen aus Belastung, Schlafplan und eigener Historie schätzen | Tag vorher planen | P2 | M | Zeile 14 | Unit-Tests, User-Test | Done ⚙️ (#109; im Dashboard v11; User-Test #112) |
| 36 | Coach-Fragen mit Werkzeugen (#100) | Claude holt sich zur Frage Schlaf, Kraft, Plan, Rückblick, Wetter usw. selbst | bessere Antworten im Chat | P1 | S | Zeile 9 | Vorschau, User-Test | Done ⚙️ (#102; im Dashboard v10; User-Test #104) |
| 37 | FTP-Test im Wochenplan (#98) | Plan schlägt einen passenden Tag für den FTP-Test vor, mit Anleitung | FTP aktuell halten | P2 | S | Zeile 25 | Unit-Tests, User-Test | Done ⚙️ (#99; User-Test #103) |
| 38 | Gym-Modus am Handy (#107) | Einheit aus Vorlage starten, Sätze abhaken, Pausen-Timer, Bildschirm bleibt an, Einzelsätze speichern | Krafttraining live erfassen statt nachtragen | P1 | S | Zeile 17 | Vorschau, User-Test | Done ⚙️ (#105; im Dashboard v11; User-Test #116) |
| 39 | Krafteinheiten im Wochenplan (#108) | Übungen, Sätze, Wiederholungen und Gewicht je Krafttag | wissen, was im Gym dran ist | P1 | S | Zeile 17 | Unit-Tests, User-Test | Done ⚙️ (Coach-Thread; User-Test #110) |
| 40 | Coach-Chat: Fragen zum Antippen, Verlauf bleibt (#118) | 4 Fragen passend zum Tag, Chat übersteht Neuladen (3 Tage) | Coach am Handy schneller fragen | P2 | S | Zeile 36 | Vorschau, User-Test | Done ⚙️ (#117; im Dashboard v12; User-Test #121) |
| 41 | „Heute dran“ (#122) | geplante Einheit auf „Heute“, Wochenstreifen, Direkt-Start Gym-Modus / MyWhoosh-Workout | am Handy sofort sehen, was dran ist | P1 | S | Zeile 21, 38 | Vorschau, User-Test | Done ⚙️ (#124; im Dashboard v13; User-Test #126) |
| 42 | Kraft und Rad im Wechselspiel (#113) | Wirkung von Beineinheiten auf Erholung/HRV und die nächste Radeinheit, bewährter Abstand | Kraft und Rad besser kombinieren | P2 | M | Zeile 17 | Unit-Tests, User-Test | Done ⚙️ (#120; im Dashboard v13; User-Test #123) |
| 43 | Gym-Modus: letztes Mal und Bestwert (#127) | je Übung „Letztes Mal“, Hinweis bei neuem geschätztem 1RM | Motivation, Orientierung im Gym | P2 | S | Zeile 38 | Vorschau, User-Test | Done ⚙️ (#129; im Dashboard v14; User-Test mit #116) |
| 44 | HRV-Trend nach Plews (#125) | 7-Tage-Mittel und Schwankung (CV) der HRV gegen den eigenen Normalbereich, Einordnung | Ermüdung früh erkennen | P2 | M | Zeile 14 | Unit-Tests, User-Test | Done ⚙️ (#128; User-Test #130) |
| 45 | Anstrengung je Workout im Dashboard (#134) | RPE 1–10 in der Workout-Liste und als Frage unter „Heute dran“ | bessere Belastungsschätzung beim Krafttraining | P2 | S | Zeile 16 | Unit-Test, Vorschau, User-Test | Done (#137, v15; User-Test #140) |
| 46 | Beste Trainingszeit (#131) | Tageszeit des Trainings gegen Schlaf, Erholung und Leistung | Training günstig legen | P2 | M | Zeile 14 | Unit-Tests, User-Test | Done ⚙️ (#135; User-Test #138) |
| 47 | Ermüdungsresistenz (#139) | Beste 5/20 min nach 500/1000/1500 kJ | Langfahrten realistisch planen | P2 | M | Zeile 14 | Unit-Tests, User-Test | Done ⚙️ (#141, v16; User-Test #144) |
| 48 | Scheibenrechner im Gym-Modus (#143) | Scheiben je Seite für Langhantel-Übungen, Stange 20/15/10 kg | weniger Kopfrechnen im Gym | P3 | S | Zeile 38 | Vorschau, User-Test | Done (#142, v16; User-Test #146) |
| 49 | Aufwärmsätze im Gym-Modus (#148) | Aufwärm-Treppe zum Arbeitsgewicht mit Scheiben je Seite | sicherer und schneller ins Training | P3 | S | Zeile 48 | Vorschau, User-Test | Done (#149, v17; User-Test #151) |
| 50 | „Neu im Dashboard“ (#152) | Box oben im Heute-Tab mit neuen Abschnitten und Sprung dorthin | neue Funktionen finden | P2 | S | – | Vorschau, User-Test | Done (#153, v18; User-Test #156) |
| 51 | Aerobe Basis (#145) | Entkopplung lockerer Fahrten im Verlauf | Grundlagenausdauer messbar machen | P2 | M | Zeile 34 | Unit-Tests, User-Test | Done ⚙️ (#150, v18; User-Test #154) |
| 52 | Wochenplan als Kalenderdatei (#157) | Restliche Woche als .ics über den Download-Dialog | Training im eigenen Kalender | P2 | S | Zeile 41 | Vorschau, User-Test | Done (#159, v19; User-Test #165) |
| 53 | Intervall-Qualität (#155) | Leistungsabfall je Intervall-Serie und Verlauf je Intervallart | Intervalle richtig dosieren | P2 | M | Zeile 14 | Unit-Tests, User-Test | Done ⚙️ (#158, v19; User-Test #160) |
| 54 | Trittfrequenz-Profil (#161) | Kadenz-Verteilung, Median je Leistungszone, Verlauf in Zone 2 | Technik auf dem Rad | P3 | M | Zeile 14 | Unit-Tests, User-Test | Done ⚙️ (#162, v19; User-Test #163) |
| 55 | Fahrertyp (#164) | Stärken und Schwächen der Leistungskurve relativ zur FTP | Training gezielt auf Schwächen | P3 | M | Zeile 34 | Unit-Tests, User-Test | Done ⚙️ (#167, v20; User-Test #170) |
| 56 | Sprungleiste am Handy (#168) | Wischbare Abschnittsliste oben in langen Tabs | Training-Tab (über 20 000 px) schnell durchsuchen | P2 | S | Zeile 25 | Vorschau, User-Test | Done (#169, v20; User-Test #172) |
| 57 | Muskelbalance (#171) | Sätze je Muskelgruppe gegen Zielbereich, Ziehen/Drücken | ausgewogenes Krafttraining | P2 | M | Zeile 24 | Unit-Tests, User-Test | Done ⚙️ (#174, v21; User-Test #176) |
| 58 | Auf einen Blick (#180) | wichtigste Analyse-Befunde oben auf „Heute“ mit Sprung zu den Details (get_analysis_highlights #175) | Überblick ohne durch alle Tabs zu scrollen | P2 | S | #175 | Vorschau-Test, User-Test | Done (v22; User-Test #183) |
| 59 | Coach-Chat kennt alle Analysen (#185) | 13 weitere Chat-Werkzeuge (Befunde, HRV-Trend, Prognose, Last, Muskelbalance, Rad-Analysen, Timing, Kraft/Rad) | fundierte Antworten zu jeder Analyse | P2 | S | #175 | Vorschau-Test, User-Test | Done (v23; User-Test #186) |
| 60 | Lange Tabs einklappbar (#188) | Handy: in Training/Verlauf nur die ersten zwei Abschnitte offen, Rest als Überschriften-Liste, lädt erst beim Aufklappen | Training-Tab 23 500 → 2 600 px, 16 → 1 Werkzeug-Aufruf beim Öffnen | P1 | S | #69, #168 | Vorschau-Test, User-Test | Done (v24; User-Test #189) |
| 61 | Heute unten einklappbar (#191) | Handy: in „Heute“ bis „Heute dran“ offen, Radwetter/Check-in/Bestleistungen/Prognose eingeklappt | Heute 6 300 → 4 050 px | P2 | S | #188 | Vorschau-Test, User-Test | Done (v25; User-Test #192) |
| 62 | Ausgefallene Schlüsseleinheit nachholen (#194) | Wochenplan schlägt einen Ersatztag vor | Schlüsseleinheiten gehen nicht verloren | P2 | S | Zeile 15 | Unit-Tests, User-Test | Done (User-Test #197) |
| 63 | Erholungskurve (#195) | Erholung, HRV, Ruhepuls nach harten Tagen bis zur Rückkehr | Wie viele lockere Tage nach harten Tagen | P2 | M | — | Unit-Tests | Done (PR #199) |
| 64 | Schlüsseleinheit bei schlechter Tagesform verschieben (#198) | späteren Tag vorschlagen statt nur Ruhe | Plan bleibt erfüllbar | P2 | S | Zeile 62 | Unit-Tests | In Progress (PR #217) |
| 65 | eFTP-Verlauf (#200) | FTP-Schätzung aus normalen Fahrten je Woche, Testvorschlag bei Abweichung | Formtrend zwischen Tests | P1 | M | Zeile 8 | Unit-Tests, Vorschau | Planned |
| 66 | Wiedereinstieg nach Krankheit/Pause (#201) | Pause erkennen, gestufter Wiedereinstieg, Tagebuch-Feld krank | sicher zurück ins Training | P1 | M | Zeile 16, 17 | Unit-Tests | Planned |
| 67 | Kraft-Plateau und Entlastungswoche (#202) | Plateau je Übung, Deload-Vorschlag | Fortschritt statt Stillstand | P2 | S | Zeile 24 | Unit-Tests, Vorschau | Planned |
| 68 | Kraftstandards relativ zum Körpergewicht (#203) | e1RM/kg je Grundübung mit groben Stufen | Kraft pro kg wie W/kg | P2 | S | Zeile 23, 24 | Unit-Tests | Planned |
| 69 | Gym-Modus: Übung tauschen (#204) | Übungsbibliothek mit Alternativen | belegte Geräte | P2 | M | Zeile 38 | Unit-Tests, Vorschau | Planned |
| 70 | Schlafziel für heute Nacht (#205) | Schlafbedarf aus Belastung und Schlafschuld, Zubettgehzeit | bessere Erholung | P2 | S | Zeile 13 | Unit-Tests | Planned |
| 71 | 4-Wochen-Blockplanung (#206) | 3 Aufbau- + 1 Entlastungswoche mit CTL-Rampe | planbarer Fortschritt | P2 | M | Zeile 15 | Unit-Tests, Vorschau | Planned |
| 72 | Rolle gegen Straße (#207) | Leistung/Puls indoor vs. outdoor | Zonen indoor anpassen | P3 | S | Zeile 6 | Unit-Tests | Planned |
| 73 | W′-Bilanz im Workout-Detail (#208) | W′bal-Verlauf (Skiba) | Intervalle richtig dosieren | P3 | S | Zeile 20, 34 | Unit-Tests | Planned |
| 74 | Konstanz und Serien (#209) | Wochenziel-Serien, Plan-Treue | Motivation | P3 | S | Zeile 15 | Unit-Tests, Vorschau | Planned |
| 75 | Diagramme: Tippen zeigt Werte (#210) | Fadenkreuz und Wertbox in FC.chart | Werte am Handy ablesen | P2 | S | — | Vorschau, User-Test #230 | Done |
| 76 | Vorschau-CI prüft Barrierefreiheit (#211) | axe-core in preview.mjs, Verstöße beheben | Qualität | P2 | M | Zeile 31 | CI, User-Test #251 | Done |
| 77 | Datenstand je Quelle (#212) | freshness in get_dashboard, Hinweis in Kopfzeile/Briefing | alte Daten erkennen | P3 | S | — | Unit-Tests, Vorschau, User-Test #243 | Done |
| 78 | Krafttraining nach Saisonphase (#213) | Aufbau/Erhalt/Wettkampf im Wochenplan | Kraft passend zur Radsaison | P3 | S | Zeile 39 | Unit-Tests | Planned |
| 79 | Zeit-in-Zone-Ziele je Woche (#214) | Soll aus Plan gegen Ist | Intensitätsverteilung steuern | P3 | S | Zeile 12, 15 | Unit-Tests, Vorschau | Planned |
| 80 | Leistungskurve Zeitraum-Vergleich (#215) | zwei Zeiträume übereinander mit Differenz | Fortschritt sehen | P3 | S | Zeile 8 | Unit-Tests, Vorschau | Planned |
| 81 | Rückmeldung zur Tagesempfehlung (#216) | passt/zu hart/zu leicht, Korrekturfaktor | Coach lernt | P3 | M | Zeile 9 | Unit-Tests, Vorschau | Planned |
| 82 | Wochenbilanz als Bild (#218) | Canvas-PNG über Downloads | aufheben/teilen | P3 | S | Zeile 33 | Vorschau | Planned |
| 83 | Zwei Workouts vergleichen (#219) | Kennzahlen und Kurven nebeneinander | Fortschritt auf gleicher Runde | P3 | M | Zeile 20 | Unit-Tests, Vorschau | Planned |
| 84 | Workout-Liste filtern und suchen (#220) | Sport, Zeitraum, Quelle, Suche | lange Historie nutzbar | P3 | S | — | Vorschau, User-Test #236 | Done |
| 85 | Workout-Bibliothek für MyWhoosh (#221) | Vorlagen je Typ, an FTP angepasst, .zwo | Auswahl für spontane Rolleneinheiten | P2 | M | Zeile 26 | Unit-Tests, Vorschau | Planned |
| 86 | Eiweiß-/KH-Richtwert je Tag (#222) | aus Gewicht und Tagesbelastung | Essen planen | P3 | S | Zeile 23 | Unit-Tests | Planned |
| 87 | Mobility-Routine nach der Einheit (#223) | Routinen je Einheitstyp mit Timer | Beweglichkeit | P3 | S | Zeile 38 | Unit-Tests, Vorschau | Planned |
| 88 | Radwetter: Kleidungsempfehlung (#224) | Stufen nach gefühlter Temperatur, Regen, Licht | passend angezogen | P3 | S | Zeile 29 | Unit-Tests | Planned |

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
