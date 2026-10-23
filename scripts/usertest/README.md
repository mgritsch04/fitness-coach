# Automatische User-Tests

Klickt die Schritte eines User-Tests automatisch im Dashboard durch, macht je Schritt ein Bild und entscheidet,
ob der Test **eindeutig bestanden** ist. Quelle: Feature-Issues mit Label `auto-user-test` (Testschritte als Kommentar).
Warteschlange: `node scripts/usertest/issues.mjs` (älteste zuerst; zeigt, ob schon ein Szenario existiert).

```bash
node scripts/usertest/run.mjs 301          # Test laufen lassen (Cloud, Port 4391)
node scripts/usertest/run.mjs 301 --plan   # "cloud" oder "pc"
node scripts/usertest/run.mjs 301 --report-only
node scripts/usertest/run.mjs 301 --gpu    # auf einem PC mit echter Grafikkarte
```

Kein `playwright install`: genommen wird `/opt/pw-browsers/chromium` (Cloud) bzw. Playwrights Chromium.

## Was dabei läuft

- `artifact/dev/preview.mjs --build-only` baut die Dashboard-Seite wie die CI-Vorschau.
- `worker/dev/usertest-bridge.ts` startet **die echten Connector-Werkzeuge** des Workers gegen eine D1-Nachbildung
  (node:sqlite, echtes Schema) mit synthetischen Daten bis heute (`worker/dev/seed.ts`). Die Seite ruft sie über
  `/tool` auf. Nur WHOOP/Wahoo/Sync, das Wetter (Netz) und Claude-Texte (`sample`) bleiben Beispielantworten.
- **Keine echten Gesundheitsdaten**, keine Secrets. Das Repo ist öffentlich: Berichte enthalten nur synthetische Werte.

Ergebnis in `usertest-reports/<nr>/` (nicht im Git): `report.md` (Issue-Kommentar), `report.html` (Bildbericht,
nur lokal ansehen), `report.json`, `step-*.jpg`. **Kein Artefakt veröffentlichen:** der Bericht steht nur als Text
im Issue-Kommentar.

## Testschritte lesen

- Der **neueste Kommentar**, der mit `## Testschritte`, `### Testschritte` oder
  `**Testschritte**` beginnt. Format: optional `**Voraussetzung:** …`, dann nummerierte Schritte, je Schritt darunter
  `→ Erwartet: …`; Schritte mit `Optional:` dürfen fehlen (im Szenario `skip`).

Issue (und Kommentare) als JSON `{ title, body, comments: [{ body }] }` speichern, dann:

```bash
node scripts/usertest/steps.mjs issue.json                       # Schritte als JSON
node scripts/usertest/steps.mjs issue.json --scaffold 312        # Gerüst scenarios/312.mjs im Wortlaut des Issues
```

## Szenario schreiben

`scenarios/<issue-nr>.mjs`, Schritte und Erwartungen im Wortlaut des Issues (Gerüst siehe oben). Jeder Schritt liefert `{ status, observed }`:

| status | Bedeutung |
|---|---|
| `ok` | Erwartung nachweislich erfüllt (DOM, Daten oder Werkzeug-Antwort geprüft, nicht nur „sieht gut aus“) |
| `fail` | nicht erfüllt |
| `look` | Zustand stimmt, die Optik beurteilt der Test-Thread selbst am Screenshot (Maßstab seit 23.10., siehe unten); das Werkzeug-Urteil bleibt `pruefen`, bis der Thread das Bild angesehen und im Kommentar bewertet hat |
| `device` | nur am echten Gerät oder im echten Training prüfbar (z. B. „passt die Dauer zur echten?“) |
| `skip` | optional oder ein reiner Handgriff des Nutzers (z. B. wiegen), durch synthetische Werte ersetzt |

Szenario-Felder: `issue`, `feature` (Feature-Issue), `title`, `name`, `device: 'desktop' | 'phone'`, `scheme`,
`realDevice: [..]` (was nur echt prüfbar ist), `pc: true` nur wenn ein Schritt Optik auf echter Grafik beurteilt,
`live: false` (nur Beispielantworten), `mockTools: [..]` (einzelne Werkzeuge als Beispielantwort).

Hilfen im Schritt (`t`): `open(tab)`, `tab(name)`, `section(id)` (springt hin, liefert Locator), `tool(name, input)`
(echtes Werkzeug direkt, z. B. Daten anlegen oder nachprüfen), `fit({ start, seconds, watts })` (synthetische FIT-Fahrt
für `import_fit`), `calls()`, `text(sel)`, `poll(fn)`, `shot(caption, locator?)`. Rückgabe `locator` = Bild nur von diesem Teil.

## Urteil und was danach passiert

- **bestanden**: alle Schritte `ok` (`skip` erlaubt), keine Konsolenfehler, nichts nur am Gerät; bei `pc: true` auf echter Grafik.
- **pc**: sonst bestanden, braucht aber echte Grafik → auf Gs PC wiederholen (`--gpu`). Für Fitness selten.
- **pruefen**: alles andere.

| Urteil | Feature-Issue (`auto-user-test`) |
|---|---|
| bestanden | Kommentar „Automatisch BESTANDEN“ (Text), Label `done`, Issue schließen (`completed`) |
| pruefen | Label `auto-user-test` → `user-test`, Kommentar beginnt mit „Automatische Vorprüfung – bitte selbst anschauen: …“ (Text); G antwortet im Issue |

- **Was nicht blockiert** (Maßstab seit 23.10.): Gefühlsabgleich mit echten Daten („passt zu meinem Gefühl“, „plausibel gegen die WHOOP-App“) und der Wortlaut von Claude-Antworten sind keine Abnahmekriterien. Belegt sein müssen die Funktion (Anzeige, Werkzeug-Antwort, Regel per Unit-Test) und bei Chat-Schritten, dass der Coach-Kontext die nötigen Angaben enthält (`chatCtx` in `scenarios/_q.mjs`; gegen den echten Connector kann der prüfende Thread zusätzlich `get_coach_context` aufrufen, ohne Werte ins Issue zu schreiben). Optik-Schritte beurteilt der Test-Thread selbst am Bild. Nur echte Geräte/Konten (MyWhoosh-Portal, Wahoo/WHOOP-Webhooks, Handy in der Claude-App, echtes Internet für Ortssuche, echtes Training) bleiben bei G, jeweils mit einem Auftrag von 1–3 Minuten.
- Zusammengefasst: Dem Test-Thread gehört alles, was sich automatisch oder am Screenshot beurteilen lässt. G bekommt `user-test` nur bei echten Geräten, echten Konten/Daten oder echtem Claude-Chat (siehe oben), nicht für Optik, Gefühl oder Wortlaut.
- Nie einen `fail` als bestanden werten; `FEHLGESCHLAGEN` schreibt nur G.
- Wünsche oder Fehler, die beim Testen auffallen, nicht selbst bauen: im Issue nennen, der Koordinator plant sie ein.
- „automatisch bestätigt (Datum)“ in `docs/PROJECT_STATUS.md` trägt der Haupt-Thread („Dashboard und Auswertungen“) ein.
- Nach einem behobenen `FEHLGESCHLAGEN` setzt der Feature-Thread das Label wieder auf `auto-user-test`; dann prüft der Test-Thread erneut.
- Jeder GitHub-Kommentar endet mit `Generated by [Claude Code](https://claude.ai/code)`.

## PC-Lauf (nur wenn wirklich echte Grafik nötig ist)

Remote-Control-Sitzung auf Gs PC in eigenem Ordner (z. B. `C:\Users\maxim\fitness-tests`), Repo dort klonen,
`npm ci` in `worker/`, dann `node scripts/usertest/run.mjs <nr> --gpu`. Windows: npx läuft mit `shell: true`,
die Brücke wird mit `taskkill /T /F` beendet; ein Lauf mit Software-Grafik (SwiftShader/llvmpipe) zählt nicht als
echte Grafik. Kommentar und Labels macht die Cloud-Seite.
