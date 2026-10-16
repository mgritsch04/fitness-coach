# Datenquellen

_Stand 2026-10-16 · Recherche aus öffentlichen Doku-/Forenquellen, vor der Umsetzung je Anbieter noch einmal gegen die offizielle Doku prüfen._

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
Keine offizielle Entwickler-API gefunden. Optionen:
1. **Über Strava (Standard):** In der MyWhoosh-App Strava verbinden (automatischer Upload jeder Fahrt). Wir lesen Strava über die offizielle API. Dafür braucht der Nutzer eine eigene Strava-API-App ([strava.com/settings/api](https://www.strava.com/settings/api), sofort verfügbar, Client-ID/Secret; „Authorization Callback Domain“ `localhost`). Hinweis: Die Strava-API-Bedingungen schränken die Weitergabe und die Nutzung für KI-Modelle ein – nur eigene Daten, nur für den Nutzer selbst anzeigen; vor dem Coach-Ausbau prüfen.
2. **FIT-Import:** Fahrten im MyWhoosh-Webportal (Profil › Aktivitäten) als FIT herunterladen und in einen Import-Ordner legen bzw. im Dashboard hochladen. Laut Forenberichten liefern manche App-Versionen GPX statt FIT (Leistungsdaten können fehlen).
3. **Inoffizielle API** (z. B. Community-Tools): nur mit ausdrücklicher Freigabe des Nutzers, nicht Standard.

Duplikate: Dieselbe Fahrt kann über Strava, Wahoo (wenn ein KICKR-Workout dort landet) und WHOOP (als Workout) kommen → Abgleich über Startzeit ± Toleranz und Dauer.

## Quellen
- https://developer.whoop.com/docs/developing/getting-started
- https://developer.whoop.com/docs/developing/oauth
- https://providers.apievangelist.com/providers/wahoo/
- https://github.com/armonge/wahoo-mcp
- https://forum.intervals.icu/t/mywhoosh-data-not-working-anymore/111818
- https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/400631/download-from-mywhoosh
- https://knowledge.enduco.app/en/articles/12840740-mywhoosh
