# Dashboard-Updater (ein Lauf)

Auftrag von G (Projektinhaber): Aktualisiere sein privates Dashboard-Artefakt https://claude.ai/artifact/DLsyumhy4w8L66F1VNA9pk mit der aktuellen Claude-Nutzung und den Sitzungen des Projekts „Fitness“. Schreiben von board/usage und board/live ist ausdrücklich gewünscht. Sparsam arbeiten: wenige Aufrufe, nur schreiben, wenn sich etwas geändert hat.

WERKZEUGREGEL: Erlaubt sind nur ToolSearch (zum Laden der folgenden Werkzeuge), mcp__hearthbot__list_thread_sessions (nur lesen), mcp__claude-code-remote__get_session, mcp__claude-code-remote__list_events, ArtifactData (nur get und batch). Alles andere ist verboten, insbesondere jedes andere mcp__hearthbot__-Werkzeug (nichts posten, nicht reagieren), Bash, Dateien schreiben, GitHub, Trigger, send_message.

1. ToolSearch einmal: "select:mcp__hearthbot__list_thread_sessions,mcp__claude-code-remote__get_session,mcp__claude-code-remote__list_events,ArtifactData".
2. list_thread_sessions (ohne Parameter). Für jede Zeile: id = session_id, title, bucket = status_bucket, updated = last_activity_at, resolved = resolved (falls vorhanden). AKTIV = Zeilen mit bucket "working" oder "blocked", oder (nicht "failed", nicht resolved und updated jünger als 10 Minuten).
3. Für jede AKTIVE Zeile get_session mit session_id = id, bei der das Präfix "cse_" durch "session_" ersetzt ist. Daraus: cost = external_metadata.usage.cost_usd (sonst null), task = task_summary, sonst post_turn_summary.status_detail, sonst "". Für nicht aktive Zeilen kein get_session; cost und task aus dem bisherigen board/live übernehmen (gleiche id), sonst null bzw. "".
4. Nutzung: list_events mit kinds ["rate_limit_event"], limit 100, für die AKTIVE Sitzung mit dem jüngsten updated (Session-ID wie in 3). Das Ergebnis ohne Cursor liefert die neuesten Events; ist data leer und has_more true, einmal mit before_id = first_id wiederholen. Nimm das neueste Event mit internal_anthropic_catchall.rate_limit_info.unifiedWindows: five_hour = {utilization, resetsAt}, seven_day = {utilization, resetsAt}. Zahlen unverändert übernehmen, nichts erfinden. Kein Event gefunden: bisherige Werte behalten.
5. ArtifactData get collection "board", doc_id "usage", und get "board"/"live" (Versionen merken).
6. „Unverändert“ = five_hour.utilization, seven_day.utilization und die Liste (id, bucket, updated, task) gleich wie bisher.
   - Unverändert: EIN batch mit nur einem update auf board/usage (if_version): updater = {mode: "active" wenn AKTIV > 0 sonst "idle", runs: bisher + 1, stopAt: bisheriger Wert, interval: bisheriger Wert, lastRun: jetzt (ISO, UTC), stopped: false}.
   - Geändert: EIN batch mit zwei update-Einträgen (je if_version):
     · board/usage: at = jetzt, source "updater", five_hour, seven_day, history = bisherige history + {at: jetzt, u: five_hour.utilization}, nur die letzten 300 Einträge; updater wie oben.
     · board/live: at = jetzt, by "updater", rows = alle Zeilen aus 2 (höchstens 15), je {id, title, bucket, env: "anthropic_cloud", updated, resolved, task, cost}.
   Schlägt der batch wegen einer Version fehl: einmal neu lesen und wiederholen.
7. Antworte danach nur mit genau einer Zeile: „AKTIV=<Anzahl> · 5h <x> % · Woche <y> %“ und „· unverändert“, falls nichts geändert wurde. Fehlt ein Werkzeug: „FEHLER: <Werkzeug> fehlt“.
