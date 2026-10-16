# Datenquellen

_Stand 2026-10-16 · Recherche aus öffentlichen Doku-/Forenquellen, vor der Umsetzung je Anbieter noch einmal gegen die offizielle Doku prüfen._

Architektur (Vorschlag 2026-10-16): Dashboard und Coach als Claude-Artefakt; WHOOP und Wahoo über einen kleinen Cloudflare-Worker, der als eigener claude.ai-Connector „Fitness“ eingetragen wird und die Secrets hält. Offen: ob ein Artefakt eigene Connectoren aufrufen darf (zuerst testen).

Grundregel: Client-Secrets und Tokens nur serverseitig (`.env` lokal bzw. Umgebungs-Secrets), nie im Chat, Browser-Code oder Repository. Variablennamen: [`../.env.example`](../.env.example).

## WHOOP – offizielle API (OAuth 2.0)
- **Nutzer:** App im [WHOOP Developer Dashboard](https://developer.whoop.com/docs/developing/getting-started) anlegen (mit dem eigenen WHOOP-Konto) → liefert Client-ID und Client-Secret.
- Pflichtangaben: mindestens eine Redirect-URL (Standard hier: `http://localhost:8787/auth/whoop/callback`), mindestens ein Scope.
- Scopes: `read:recovery`, `read:cycles`, `read:sleep`, `read:workout`, `read:body_measurement`, `read:profile`, dazu `offline` für Refresh-Tokens.
- Endpunkte: Auth `https://api.prod.whoop.com/oauth/oauth2/auth`, Token `https://api.prod.whoop.com/oauth/oauth2/token` ([OAuth-Doku](https://developer.whoop.com/docs/developing/oauth)).
- Entwicklungsmodus reicht für bis zu 10 WHOOP-Mitglieder → für den eigenen Account keine Freigabe nötig. Refresh-Tokens rotieren (immer den neuesten speichern).
- Webhooks möglich (öffentliche HTTPS-URL nötig) – bis dahin periodischer Abgleich.

## Wahoo – Cloud API (OAuth 2.0)
- **Nutzer:** im Wahoo Developer Portal (`developers.wahooligan.com`) mit Wahoo-Konto eine App registrieren → Client-ID und Client-Secret; Redirect-URL `http://localhost:8787/auth/wahoo/callback`.
- API-Basis `https://api.wahooligan.com`, u. a. `GET /v1/workouts`, `GET /v1/workouts/{id}`, Workout-Summaries mit FIT-Datei.
- Scopes (laut Doku/Drittquellen): `user_read`, `workouts_read`, `offline_data` (für Webhooks `workout_summary`).
- Neue Apps starten in einer Sandbox; der Wechsel in Produktion läuft über ein Freigabeverfahren (Wahoo API Agreement). Ob die Sandbox für den eigenen Account dauerhaft reicht, ist **ungeprüft** – beim Anlegen der App nachsehen.

## MyWhoosh – keine öffentliche API
Keine offizielle Entwickler-API gefunden. Strava wird **nicht** genutzt (Entscheidung des Nutzers, 2026-10-16). Optionen:
1. **FIT-Upload (Standard):** Fahrten im MyWhoosh-Webportal (Profil › Aktivitäten) als FIT herunterladen und im Dashboard hochladen; Parsing im Dashboard bzw. Worker. Laut Forenberichten liefern manche App-Versionen GPX statt FIT (Leistungsdaten können fehlen).
2. **Inoffizielle MyWhoosh-API** (wie Community-Tools): automatisch, braucht aber die MyWhoosh-Logindaten im Worker und kann bei App-Updates brechen – nur mit ausdrücklicher Freigabe des Nutzers.

Duplikate: Dieselbe Fahrt kann über MyWhoosh-FIT, Wahoo (wenn ein KICKR-Workout dort landet) und WHOOP (als Workout) kommen → Abgleich über Startzeit ± Toleranz und Dauer.

## Quellen
- https://developer.whoop.com/docs/developing/getting-started
- https://developer.whoop.com/docs/developing/oauth
- https://providers.apievangelist.com/providers/wahoo/
- https://github.com/armonge/wahoo-mcp
- https://forum.intervals.icu/t/mywhoosh-data-not-working-anymore/111818
- https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/400631/download-from-mywhoosh
- https://knowledge.enduco.app/en/articles/12840740-mywhoosh
