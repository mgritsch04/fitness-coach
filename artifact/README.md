# Dashboard-Artefakt

Die Oberfläche des Fitness Coach als Claude-Artefakt:
**https://claude.ai/artifact/2uTpv443yDNX6UMiGEDhep** (privat).

- `dashboard.html`: Shell mit CSS (Tokens hell/dunkel, Handy-Tab-Leiste ≤ 640 px) und Skript-Reihenfolge.
- `app/core.js`: `window.FC` – Daten (`get_dashboard`), Diagramme, Tabs, Connector-Aufrufe, Abschnitts-Registry.
- `sections/<thema>.js`: je Bereich eine Datei mit `FC.section({ id, tab, order, css?, mount, render, rerender?, ready? })`. Tabs: heute, coach, verlauf, training, mehr.
- Connector **„Fitness Coach“**, Werkzeuge: `get_dashboard`, `sync_now`, `update_settings`, `wahoo_status`, `wahoo_connect`, `import_fit`, `get_fitness_profile`, `get_health_trends`, `get_strain_recovery`, `get_period_summaries`, `get_training_load`, `get_recovery_factors`, `get_sleep_report`, `get_strength`, `suggest_strength_session`, `log_strength_session`, `save_strength_template`, `save_plan`, `set_goals`, `save_journal`, `get_body_history`, `log_weight`, `export_csv`; dazu `sample` (Coach, Briefing) und `downloads` (CSV-Export).
- Coach und Morgen-Briefing laufen über Claude im Artefakt (`sample`), ohne API-Schlüssel.
- Keine Messwerte im Seiten-Code; alles kommt zur Laufzeit vom Worker.

## Veröffentlichen
Mit dem Artifact-Werkzeug `dashboard.html` auf dieselbe URL veröffentlichen, `root` = `artifact/`, und in `files` `app/core.js` sowie jede Datei unter `sections/` angeben (neue Abschnitte nicht vergessen). Kommt ein neues Connector-Werkzeug dazu, die `capabilities` vollständig neu angeben (Liste der Werkzeuge erweitern).

## Vorschau mit synthetischen Daten
```bash
cd worker && npx vite-node dev/mock-dashboard.ts > ../artifact/dev/mock-dashboard.json && cd ..
PW_CHROMIUM=/opt/pw-browsers/chromium node artifact/dev/preview.mjs   # Screenshots in artifact/dev/out/
```
`preview.mjs` baut ein nachgemachtes `window.claude` (Connector und Coach antworten mit Beispieldaten) und meldet Skriptfehler und waagrechtes Überlaufen.
