# Dashboard-Artefakt

`dashboard.html` ist die Oberfläche des Fitness Coach als Claude-Artefakt:
**https://claude.ai/artifact/2uTpv443yDNX6UMiGEDhep** (privat).

- Holt alle Daten über den Connector **„Fitness Coach“** (`get_dashboard`, `sync_now`, `update_settings`, `wahoo_status`, `wahoo_connect`).
- Der Coach (Erklären, Wochenplan, Rückblick, Fragen) läuft über Claude im Artefakt (`sample`), ohne API-Schlüssel.
- Keine Messwerte im Seiten-Code; alles kommt zur Laufzeit vom Worker.

## Veröffentlichen
Mit dem Artifact-Werkzeug dieselbe Datei auf dieselbe URL veröffentlichen. Kommt ein neues Connector-Werkzeug dazu, die `capabilities` vollständig neu angeben (Liste der Werkzeuge erweitern).

## Vorschau mit synthetischen Daten
```bash
cd worker && npx vite-node dev/mock-dashboard.ts > ../artifact/dev/mock-dashboard.json && cd ..
PW_CHROMIUM=/opt/pw-browsers/chromium node artifact/dev/preview.mjs   # Screenshots in artifact/dev/out/
```
`preview.mjs` baut ein nachgemachtes `window.claude` (Connector und Coach antworten mit Beispieldaten) und meldet Skriptfehler und waagrechtes Überlaufen.
