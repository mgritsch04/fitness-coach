# Auftrag – Fitness Coach

_Stand 2026-10-16 · vom Nutzer im Projekt „Fitness“ formuliert, von Claude strukturiert._

## Ziel
Ein persönlicher Fitness- und Gesundheits-Tracker mit Trainingscoach, der alle Daten an einem Ort sammelt:
- **WHOOP:** Recovery, HRV, Ruhepuls, Schlaf, Strain, Workouts, Körperwerte.
- **Wahoo:** Outdoor-/Indoor-Workouts (ELEMNT, KICKR …) inkl. FIT-Dateien (Leistung, Puls, Trittfrequenz).
- **MyWhoosh:** virtuelle Radeinheiten. Keine offizielle API → FIT-Upload; kein Strava (siehe [`INTEGRATIONS.md`](INTEGRATIONS.md)).

## Bausteine
1. **Datenanbindung:** OAuth je Anbieter, regelmäßiger Abgleich (Webhooks wo möglich), Rohdaten lokal speichern, Duplikate erkennen (dieselbe Einheit kann über Wahoo, MyWhoosh-FIT und WHOOP kommen).
2. **Gemeinsames Datenmodell:** Workout, Schlaf, Recovery/Tageszustand, Körperwerte; Anbieter nur als Quelle.
3. **Dashboard:** Tagesansicht (Recovery, Schlaf, Belastung), Trainingslast über Zeit (z. B. CTL/ATL/TSB), Leistungskurven, Wochen-/Monatsübersicht.
4. **Trainingscoach:** Tagesempfehlung aus Recovery + Trainingslast, Wochenplanung, Rückblick; Erklärungen statt Blackbox.

## Entscheidungen
- **Architektur (vom Nutzer entschieden 2026-10-16):** Ein **Cloudflare-Worker** ist der Kern: OAuth für WHOOP und Wahoo, Token-Refresh, Abgleich per Cron und Webhooks, Speicher in **D1**, Auswertung (Trainingslast). Er ist als eigener claude.ai-Connector („Fitness“, Remote-MCP mit OAuth) eingetragen. Die **Oberfläche ist ein Claude-Artefakt**, das den Worker über diesen Connector abfragt; Rohdaten liegen nur im Worker.
- **Coach über Claude im Artefakt** (`sample`-Capability, läuft über das Abo des Nutzers). **Kein eigener Anthropic-API-Schlüssel** – der Nutzer will dafür nicht extra zahlen.
- Eine eigene Web-App mit Push auf demselben Worker ist später möglich, aber nicht geplant.
- **Risiko zuerst prüfen:** ob ein Artefakt eigene Connectoren aufrufen darf.
- **Zugriffsschutz:** Worker-Endpunkte nur mit OAuth des Connectors; Secrets als Worker-Secrets.
- **Entwicklung:** lokal mit `wrangler dev`.
- **MyWhoosh:** FIT-Upload; inoffizielle API nur mit Freigabe. Strava wird nicht genutzt.

## Grenzen
- Keine medizinischen Diagnosen; Gesundheitsdaten bleiben privat (siehe [`../CLAUDE.md`](../CLAUDE.md)).
