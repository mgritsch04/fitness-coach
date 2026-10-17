# Hinweise für Claude Code (Projektkonventionen)

* Auftrag: `docs/MASTER_PROMPT.md`. Aktueller Stand: `docs/PROJECT_STATUS.md` – zu Sitzungsbeginn lesen, nach Meilensteinen aktualisieren.
* Mit dem Nutzer **Deutsch** sprechen.
* Workflow, Labels, Prioritäten, Modellwahl: `docs/DEVELOPMENT_WORKFLOW.md`. Ohne konkreten Auftrag: dort › „Ablauf je Durchlauf“ (User-Test-Rückmeldungen, `user-task`-Antworten, `idea-inbox`-Issues, dann oberste `Ready`-Zeile in `docs/IDEAS.md`). Konkrete Aufträge haben Vorrang. Nie einen fehlgeschlagenen User-Test als bestanden markieren. User-Tests laufen im Feature-Issue (Label `auto-user-test`, Kommentar `## Testschritte`, PRs mit `Refs #` statt `Closes #`); keine neuen `[USERTEST]`-Issues.
* Ideen-Backlog: `docs/IDEAS.md` (pflegt nur die Session, die gerade integriert; Ideen kommen als Issues mit Label `idea-inbox` rein, Anleitung `docs/IDEA_CAPTURE.md`).
* Datenquellen: `docs/INTEGRATIONS.md`. Anbieter-Code nur in `src/providers/<anbieter>/`, nie im Kern (Datenmodell, Auswertung, Coach). Alles wird zuerst in ein gemeinsames Datenmodell (Workout, Schlaf, Recovery, Körperwerte) übersetzt.
* **Gesundheitsdaten sind sensibel:** Keine echten Messwerte, Tokens oder Exporte ins Repository (auch nicht als Testdaten – Fixtures synthetisch erzeugen). `.env` ist in `.gitignore`; Namen der Variablen stehen in `.env.example`.
* **Keine Secrets im Chat, im Browser-Code oder in Commits.** Client-Secrets und Refresh-Tokens leben nur serverseitig (lokale `.env` bzw. Umgebungs-Secrets). Den Nutzer nie bitten, Secrets in den Chat zu kopieren.
* Kein Scraping, keine inoffiziellen/umgangenen APIs ohne ausdrückliche Freigabe des Nutzers; erlaubte Wege stehen in `docs/INTEGRATIONS.md`.
* Coach-Hinweise sind Trainingsempfehlungen, keine medizinischen Diagnosen; Annahmen und Schätzungen als solche kennzeichnen.
* Kleine, fokussierte Commits mit Präfix (`feat:`, `fix:`, `test:`, `perf:`, `docs:`, `ci:`), nach den relevanten Checks; danach pushen und Ergebnis prüfen.
* Entwicklungs-Dashboard (Nutzung, Sitzungen, Agents): `docs/DASHBOARD.md`.
