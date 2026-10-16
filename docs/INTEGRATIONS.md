# Datenquellen

_Stand 2026-10-16 · Recherche aus öffentlichen Doku-/Forenquellen, vor der Umsetzung je Anbieter noch einmal gegen die offizielle Doku prüfen._

Architektur (entschieden 2026-10-16, Details in MASTER_PROMPT.md): Dashboard und Coach als Claude-Artefakt; WHOOP und Wahoo über einen kleinen Cloudflare-Worker, der als eigener claude.ai-Connector „Fitness“ eingetragen wird und die Secrets hält. Zuerst zu prüfen: ob ein Artefakt eigene Connectoren aufrufen darf (IDEAS Zeile 0). Redirect-URLs zeigen später auf den Worker (`https://<worker>.workers.dev/auth/<anbieter>/callback`); bis die Adresse feststeht, reicht die localhost-URL, weitere URLs lassen sich nachtragen.

Grundregel: Secrets nie im Chat, Browser-Code oder Repository. **Cloudflare-API-Token:** als Network secret der Claude-Cloud-Umgebung (Host `api.cloudflare.com`, Bearer), dazu Umgebungsvariablen `CLOUDFLARE_ACCOUNT_ID` und `CLOUDFLARE_API_TOKEN=via-proxy` (Platzhalter). **WHOOP-/Wahoo-Client-Secrets:** nur als Worker-Secrets im Cloudflare-Dashboard (Worker › Settings › Variables and Secrets). Lokal (`wrangler dev`) in `.dev.vars`, Namen in [`../.env.example`](../.env.example).

## WHOOP – offizielle API (OAuth 2.0)
- **Nutzer:** App im [WHOOP Developer Dashboard](https://developer.whoop.com/docs/developing/getting-started) anlegen (mit dem eigenen WHOOP-Konto) → liefert Client-ID und Client-Secret.
- Pflichtangaben: Privacy-Policy-URL (`https://fitness-coach.<subdomain>.workers.dev/privacy`, Text in [`PRIVACY.md`](PRIVACY.md), wird vom Worker ausgeliefert), mindestens eine Redirect-URL (Standard hier: `http://localhost:8787/auth/whoop/callback`), mindestens ein Scope.
- Scopes: `read:recovery`, `read:cycles`, `read:sleep`, `read:workout`, `read:body_measurement`, `read:profile`, dazu `offline` für Refresh-Tokens.
- Endpunkte: Auth `https://api.prod.whoop.com/oauth/oauth2/auth`, Token `https://api.prod.whoop.com/oauth/oauth2/token` ([OAuth-Doku](https://developer.whoop.com/docs/developing/oauth)).
- Entwicklungsmodus reicht für bis zu 10 WHOOP-Mitglieder → für den eigenen Account keine Freigabe nötig. Refresh-Tokens rotieren (immer den neuesten speichern).
- **Webhooks (Modell v2):** `https://fitness-coach.fitness-coach-worker.workers.dev/webhooks/whoop`. Signatur `X-WHOOP-Signature` = base64(HMAC-SHA256(`X-WHOOP-Signature-Timestamp` + Body, Client-Secret)), sonst 401. `*.updated` startet einen kleinen Abgleich, `workout.deleted`/`sleep.deleted` löschen die Zeile; der stündliche Abgleich bleibt als Sicherheitsnetz.

## Wahoo – Cloud API (OAuth 2.0)
- **Nutzer:** im Wahoo Developer Portal (`developers.wahooligan.com`) mit Wahoo-Konto eine App registrieren → Client-ID und Client-Secret (Issue #3).
- **Redirect-URL:** `https://fitness-coach.fitness-coach-worker.workers.dev/auth/wahoo/callback` (für `wrangler dev` zusätzlich `http://localhost:8787/auth/wahoo/callback`).
- **Scopes:** `user_read`, `workouts_read`, `offline_data` (Refresh-Token). Mehr braucht der Worker nicht.
- **Secrets:** `WAHOO_CLIENT_ID`, `WAHOO_CLIENT_SECRET` als Worker-Secrets im Cloudflare-Dashboard (Worker `fitness-coach` › Settings › Variables and Secrets), nie im Chat.
- **Umsetzung (Worker):** Code in `worker/src/providers/wahoo/`. Verbinden über das Connector-Werkzeug `wahoo_connect`: Es erzeugt einen Einmal-Link (15 Minuten, einmal einlösbar, an den Besitzer gebunden), der Callback nimmt nur gültige Links an. Tokens in D1 (`wahoo_tokens`), Erneuerung erst kurz vor Ablauf (Wahoo bittet darum, sonst sammeln sich offene Tokens), rotierendes Refresh-Token wird sofort gespeichert. Abgleich in das gemeinsame Datenmodell (`workouts`, Quelle `wahoo`): direkt nach dem Verbinden (letzte 30 Tage), danach stündlich per Cron zusammen mit WHOOP und über `sync_now`; höchstens 5 Seiten pro Lauf wegen der Sandbox-Limits. Lesen über `get_workouts`, Stand über `wahoo_status`. Kalorien werden wie bei WHOOP als kJ gespeichert; Max-Puls fehlt in der Wahoo-Zusammenfassung, TSS hat im Modell noch kein Feld.
- API-Basis `https://api.wahooligan.com`: Auth `/oauth/authorize`, Token `/oauth/token`, `GET /v1/user`, `GET /v1/workouts?page=&per_page=` (mit `workout_summary`, FIT-Datei unter `workout_summary.file.url`).
- Neue Apps starten in einer Sandbox, laut Drittquellen mit Limits von 25 Anfragen je 5 Minuten, 100 je Stunde, 250 je Tag → Abgleich sparsam planen. Der Wechsel in Produktion läuft über ein Freigabeverfahren (Wahoo API Agreement). Ob die Sandbox für den eigenen Account dauerhaft reicht, ist **ungeprüft**.
- **Webhook `workout_summary`:** URL `https://fitness-coach.fitness-coach-worker.workers.dev/webhooks/wahoo`, Token aus den App-Einstellungen als Worker-Secret `WAHOO_WEBHOOK_TOKEN`. Wahoo schickt den Token im Body (keine Signatur); ohne gesetzten Token antwortet der Endpunkt 503, bei falschem 401. Das gemeldete Workout wird direkt gespeichert (keine zusätzliche API-Anfrage). Fehlt in der Workout-Liste die Zusammenfassung, lädt der Abgleich sie einzeln nach (höchstens 10 pro Lauf).

## MyWhoosh – keine öffentliche API
Keine offizielle Entwickler-API gefunden. Strava wird **nicht** genutzt (Entscheidung des Nutzers, 2026-10-16). Optionen:
1. **FIT-Upload (Standard):** Fahrten im MyWhoosh-Webportal (Profil › Aktivitäten) als FIT herunterladen und im Dashboard hochladen; Parsing im Dashboard bzw. Worker. Laut Forenberichten liefern manche App-Versionen GPX statt FIT (Leistungsdaten können fehlen).
2. **Inoffizielle MyWhoosh-API** (wie Community-Tools): automatisch, braucht aber die MyWhoosh-Logindaten im Worker und kann bei App-Updates brechen – nur mit ausdrücklicher Freigabe des Nutzers.

**Workouts zu MyWhoosh (#63):** Der Coach baut aus einer geplanten Radeinheit eine ZWO-Datei (`get_bike_workout`, Download im Dashboard). Die lädt man selbst im offiziellen MyWhoosh Workout Builder (workout.mywhoosh.com) hoch und überträgt sie mit „Export to MyWhoosh“ in die App (MyWorkouts). Es gibt keinen automatischen Weg und keinen Login im Worker. Quelle: https://mywhoosh.com/everything-you-need-to-know-about-the-new-mywhoosh-workout-builder/

Duplikate: Dieselbe Fahrt kann über MyWhoosh-FIT, Wahoo (wenn ein KICKR-Workout dort landet) und WHOOP (als Workout) kommen → Abgleich über Startzeit ± Toleranz und Dauer.

## Quellen
- https://developer.whoop.com/docs/developing/getting-started
- https://developer.whoop.com/docs/developing/oauth
- https://providers.apievangelist.com/providers/wahoo/
- https://github.com/armonge/wahoo-mcp
- https://forum.intervals.icu/t/wahoo-is-disconnecting-repeatedly-from-intervals/120268
- https://vibehackers.io/claude-code/skills/wahoo-cloud
- https://forum.intervals.icu/t/mywhoosh-data-not-working-anymore/111818
- https://forums.garmin.com/apps-software/mobile-apps-web/f/garmin-connect-web/400631/download-from-mywhoosh
- https://knowledge.enduco.app/en/articles/12840740-mywhoosh
