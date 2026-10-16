# Auftrag – Fitness Coach

_Stand 2026-10-16 · vom Nutzer im Projekt „Fitness“ formuliert, von Claude strukturiert._

## Ziel
Ein persönlicher Fitness- und Gesundheits-Tracker mit Trainingscoach, der alle Daten an einem Ort sammelt:
- **WHOOP:** Recovery, HRV, Ruhepuls, Schlaf, Strain, Workouts, Körperwerte.
- **Wahoo:** Outdoor-/Indoor-Workouts (ELEMNT, KICKR …) inkl. FIT-Dateien (Leistung, Puls, Trittfrequenz).
- **MyWhoosh:** virtuelle Radeinheiten. Keine offizielle API → Umweg über Strava oder FIT-Import (siehe [`INTEGRATIONS.md`](INTEGRATIONS.md)).

## Bausteine
1. **Datenanbindung:** OAuth je Anbieter, regelmäßiger Abgleich (Webhooks wo möglich), Rohdaten lokal speichern, Duplikate erkennen (dieselbe Einheit kann über Wahoo, Strava und WHOOP kommen).
2. **Gemeinsames Datenmodell:** Workout, Schlaf, Recovery/Tageszustand, Körperwerte; Anbieter nur als Quelle.
3. **Dashboard:** Tagesansicht (Recovery, Schlaf, Belastung), Trainingslast über Zeit (z. B. CTL/ATL/TSB), Leistungskurven, Wochen-/Monatsübersicht.
4. **Trainingscoach:** Tagesempfehlung aus Recovery + Trainingslast, Wochenplanung, Rückblick; Erklärungen statt Blackbox.

## Offene Entscheidungen (Standard, bis der Nutzer anders entscheidet)
- **Technik:** TypeScript; kleiner Server (Node) für OAuth-Callbacks, Token-Refresh und Webhooks + Web-Dashboard; SQLite als Speicher. Grund: Client-Secrets und Refresh-Tokens dürfen nicht in den Browser.
- **Wo läuft es:** zuerst lokal auf dem PC des Nutzers (Redirect-URLs auf `http://localhost:8787/...`); Hosting später als eigene Entscheidung (Webhooks brauchen eine öffentliche HTTPS-Adresse).
- **MyWhoosh:** über Strava (automatischer Upload aus MyWhoosh) statt inoffizieller API.

## Grenzen
- Keine medizinischen Diagnosen; Gesundheitsdaten bleiben privat (siehe [`../CLAUDE.md`](../CLAUDE.md)).
