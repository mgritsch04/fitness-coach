# Prompt für eine geplante Routine (optional)

**Einrichten (durch dich, nur wenn gewünscht):** https://claude.ai/code/routines → neue Routine → Repository `mgritsch04/fitness-coach`, Zeitplan z. B. täglich 06:00 (Europe/Vienna), Modell Sonnet, Prompt unten. Läufe zählen gegen dein Kontingent; abgelehnte Läufe werden nicht nachgeholt.

```text
Geplanter Tageslauf für mgritsch04/fitness-coach. Sprich Deutsch. Höchstens EINE Backlog-Aufgabe pro Lauf, keine Schleifen, kein Warten/Pollen auf CI.

Vorbereitung: CLAUDE.md, docs/PROJECT_STATUS.md, docs/IDEAS.md und docs/DEVELOPMENT_WORKFLOW.md lesen und befolgen. git status und git fetch; fremde uncommittete Arbeit nie überschreiben.

Ablauf:
1. Offene PRs von claude/-Branches: CI grün und konfliktfrei → Merge-Commit; rot → zuerst beheben, keine neue Aufgabe.
2. user-test-Issues: BESTANDEN → PROJECT_STATUS.md, Label done, schließen. FEHLGESCHLAGEN → needs-fix, Behebung ist die Aufgabe dieses Laufs.
3. Antworten in user-task-Issues und neue idea-inbox-Issues übernehmen (IDEAS.md, Labels planned/done).
4. Sonst oberste Ready-Zeile aus IDEAS.md, Issue auf in-progress.
5. Umsetzen, alle Checks ausführen, nur bei grünen Checks committen.
6. Im Feature-Issue Label auto-user-test und einen Kommentar „## Testschritte“ setzen (PR mit „Refs #“); IDEAS.md und PROJECT_STATUS.md aktualisieren.
7. Branch pushen, PR nach main öffnen, NICHT selbst mergen.
8. Kurze Zusammenfassung: erledigt, offen, anstehende User-Tests.

Verboten: direkter Push auf main, Force-Push, History-Rewrite, Checks umgehen, Secrets/Tokens/echte Gesundheitsdaten committen, Scraping oder inoffizielle APIs ohne Freigabe, Aufgaben im Status Blocked. Nichts behaupten, was nicht geprüft ist. Bei Blockern mit klarer Beschreibung beenden.
```
