# Auftrag – Fitness Coach

_Stand 2026-10-16 · vom Nutzer im Projekt „Fitness“ formuliert, von Claude strukturiert._

## Ziel
Ein persönlicher Fitness- und Gesundheits-Tracker mit Trainingscoach, der alle Daten an einem Ort sammelt:
- **WHOOP:** Recovery, HRV, Ruhepuls, Schlaf, Strain, Workouts, Körperwerte.
- **Wahoo:** Outdoor-/Indoor-Workouts (ELEMNT, KICKR …) inkl. FIT-Dateien (Leistung, Puls, Trittfrequenz).
- **MyWhoosh:** virtuelle Radeinheiten. Keine offizielle API → FIT-Upload; kein Strava (siehe [`INTEGRATIONS.md`](INTEGRATIONS.md)).

## Bausteine
1. **Datenanbindung:** OAuth je Anbieter, regelmäßiger Abgleich (Webhooks wo möglich), Rohdaten lokal speichern, Duplikate erkennen (dieselbe Einheit kann über Wahoo, Strava und WHOOP kommen).
2. **Gemeinsames Datenmodell:** Workout, Schlaf, Recovery/Tageszustand, Körperwerte; Anbieter nur als Quelle.
3. **Dashboard:** Tagesansicht (Recovery, Schlaf, Belastung), Trainingslast über Zeit (z. B. CTL/ATL/TSB), Leistungskurven, Wochen-/Monatsübersicht.
4. **Trainingscoach:** Tagesempfehlung aus Recovery + Trainingslast, Wochenplanung, Rückblick; Erklärungen statt Blackbox.

## Offene Entscheidungen (Standard, bis der Nutzer anders entscheidet)
- **Technik:** TypeScript auf **Cloudflare Workers** (OAuth-Callbacks, Token-Refresh, Webhooks, geplanter Abgleich per Cron) + Web-Dashboard, **D1** (SQLite) als Speicher, Secrets als Worker-Secrets. Grund: läuft auch ohne eingeschalteten PC, vom Handy erreichbar, feste HTTPS-Adresse; Client-Secrets und Refresh-Tokens bleiben serverseitig.
- **Zugriffsschutz:** Cloudflare Access (nur der Nutzer), da Gesundheitsdaten.
- **Entwicklung:** lokal mit `wrangler dev` (Redirect-URLs zusätzlich `http://localhost:8787/...`).
- Stand der Entscheidung: von Claude empfohlen am 2026-10-16, Bestätigung durch den Nutzer offen.
- **MyWhoosh:** FIT-Upload; inoffizielle API nur mit Freigabe. Strava wird nicht genutzt.
- **Architektur-Vorschlag:** Dashboard/Coach als Claude-Artefakt, WHOOP/Wahoo über Cloudflare-Worker als eigener Connector – Entscheidung offen (siehe INTEGRATIONS.md).

## Grenzen
- Keine medizinischen Diagnosen; Gesundheitsdaten bleiben privat (siehe [`../CLAUDE.md`](../CLAUDE.md)).
