# Dashboard-Artefakt

Die Oberfläche des Fitness Coach als Claude-Artefakt:
**https://claude.ai/artifact/2uTpv443yDNX6UMiGEDhep** (privat).

- `dashboard.html`: Shell mit CSS (Tokens hell/dunkel, Handy-Tab-Leiste ≤ 640 px) und Skript-Reihenfolge.
- `app/core.js`: `window.FC` – Daten (`get_dashboard`), Diagramme, Tabs, Connector-Aufrufe, Abschnitts-Registry.
- `sections/fuelsheet.js`: Verpflegungszettel (#374), kein Abschnitt; rechnet im Browser aus Plan, Schweißrate und Wetter, daher ohne Worker-Deploy.
- `sections/<thema>.js`: je Bereich eine Datei mit `FC.section({ id, tab, order, css?, mount, render, rerender?, ready? })`. Tabs: heute, coach, verlauf, training, mehr.
- Connector **„Fitness Coach“**, Werkzeuge: `get_dashboard`, `sync_now`, `update_settings`, `wahoo_status`, `wahoo_connect`, `import_fit`, `get_fitness_profile`, `get_health_trends`, `get_strain_recovery`, `get_period_summaries`, `get_training_load`, `get_recovery_factors`, `get_sleep_report`, `get_strength`, `get_exercises`, `manage_exercise`, `get_workout_detail`, `compare_workouts`, `suggest_strength_session`, `log_strength_session`, `save_strength_template`, `save_gym_draft`, `get_gym_draft`, `save_plan`, `set_goals`, `save_journal`, `get_body_history`, `log_weight`, `export_csv`, `export_backup`, `get_bike_workout`, `get_records`, `get_week_review`, `save_coach_note`, `get_ride_weather`, `set_weather_location`, `get_ftp_tests`, `analyze_ftp_test`, `save_ftp_test`, `get_plan` (Coach-Chat); dazu `sample` (Coach, Briefing) und `downloads` (CSV-Export).
- Coach und Morgen-Briefing laufen über Claude im Artefakt (`sample`), ohne API-Schlüssel.
- Keine Messwerte im Seiten-Code; alles kommt zur Laufzeit vom Worker.

## Einfache Ansicht
Standard: nur Abschnitte mit `simple: true` (Kraft und Rad, im Verlauf Gewicht, Belastung und Erholung, HRV-Trend, Erholung und Schlaf, im Training Pulszonen, Monate und Jahre, Jahresübersicht) sind sichtbar, Reiter ohne sichtbare Abschnitte verschwinden. Die übrigen ruhen (laden nichts), nichts ist gelöscht; „Mehr › Dashboard anpassen › Einfache Ansicht“ schaltet den vollen Umfang wieder ein (Flag `simple` in der Anordnung, gilt auf allen Geräten). `sections/liftlog.js` („Meine Krafteinheiten“): alle Einheiten der letzten 12 Monate, Detail, Bearbeiten, Löschen.

## Veröffentlichen
Mit dem Artifact-Werkzeug `dashboard.html` auf dieselbe URL veröffentlichen, `root` = `artifact/`, und in `files` `app/core.js` sowie jede Datei unter `sections/` angeben (u. a. `workoutdetail.js`) (neue Abschnitte nicht vergessen). Kommt ein neues Connector-Werkzeug dazu, die `capabilities` vollständig neu angeben (Liste der Werkzeuge erweitern).

## Gym-Seite (#321)
`gym.html` ist eine schlanke Einzelseite nur fürs Krafttraining (Gym-Modus, Vorlagen, Übungsverlauf) mit denselben Daten wie das Dashboard. Sie wird aus `dashboard.html` erzeugt: `node artifact/dev/build-gym.mjs` (nach jeder Änderung an `dashboard.html`; die Vorschau meldet eine veraltete `gym.html`). Veröffentlichen als eigenes Artefakt: `gym.html` mit `root` = `artifact/`, in `files` `app/core.js`, `sections/gym.js`, `sections/exlist.js` und `sections/strength.js`, gleiche `capabilities` (Connector „Fitness Coach“).

## Vorschau mit synthetischen Daten
```bash
cd worker && npx vite-node dev/mock-dashboard.ts > ../artifact/dev/mock-dashboard.json && cd ..
npm install --no-save --no-package-lock axe-core@4.10.3                # einmalig, für die Barrierefreiheits-Prüfung
PW_CHROMIUM=/opt/pw-browsers/chromium node artifact/dev/preview.mjs   # Screenshots in artifact/dev/out/
```
`preview.mjs` baut ein nachgemachtes `window.claude` (Connector und Coach antworten mit Beispieldaten) und meldet Skriptfehler und waagrechtes Überlaufen.

Außerdem läuft axe-core (WCAG 2.1 A/AA) in jeder Ansicht, hell und dunkel; ernste Verstöße brechen die CI ab, alle Funde stehen in `artifact/dev/out/a11y.json` (#211).

**Farben für Text:** Statustexte nutzen `--good-ink`, `--warn-ink`, `--bad-ink` (AA-Kontrast); `--good`/`--warn`/`--bad` sind für Punkte, Balken und Linien. Kein `opacity` auf Text, stattdessen `--ink-2`/`--ink-3`.
