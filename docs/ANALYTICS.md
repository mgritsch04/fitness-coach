# Auswertungen – Connector-Werkzeuge für Dashboard und Coach

_Stand 2026-10-16 · Code: `worker/src/core/performance.ts`, `insights.ts`, `analytics.ts` · Tests: `worker/test/performance.test.ts`_

Alle Werkzeuge sind nur lesend, nehmen `days` (Zeitraum der Ansicht bis heute) und liefern JSON mit `today`, `range {from, to, days}` und `notes` (Hinweise für die Oberfläche, u. a. dass Werte Schätzungen sind). Tage sind lokale Daten (`YYYY-MM-DD`) in der Zeitzone aus den Einstellungen.

| Werkzeug | Parameter | Inhalt |
|---|---|---|
| `get_training_load` | `days` (7–730, Std. 90) | Trainingslast und Form |
| `get_fitness_profile` | `days` (Std. 28) | FTP, Zonen, Zeit je Zone, Leistungskurve |
| `get_health_trends` | `days` (7–365, Std. 60) | HRV, Ruhepuls usw. mit Normalbereich, Schlafrhythmus |
| `get_period_summaries` | `period` = `week`/`month`/`year` (Std. `month`), `days` (Std. 180) | Zusammenfassungen je Zeitraum |
| `get_strain_recovery` | `days` (7–365, Std. 90) | Strain/Belastung gegen Erholung am Folgetag |
| `get_recovery_factors` | `days` (7–365, Std. 90) | Was hängt mit Erholung und HRV zusammen (#21) |
| `get_sleep_report` | `days` (7–365, Std. 30) | Schlaf-Detail je Nacht (#20) |
| `get_early_warning` | – | Frühwarnung Überlastung/Infekt (#24), auch in `get_dashboard.earlyWarning` |

`get_dashboard` enthält zusätzlich `ftpEstimate` (siehe unten), `hrZones` (wie `hrZoneTime` unten, für gestapelte Wochenbalken) und je Workout `hrZoneMin` (Minuten je Zone 0–5 oder `null`); `settings.origin.ftpW` ist `"data"`, wenn die FTP geschätzt ist. Mit `compact: true` kommen `days` und `workouts` als `{ keys, rows }` (Spaltennamen einmal, je Zeile ein Werte-Array) und `compact: 1`; das halbiert die Antwort ungefähr (#69). Das Artefakt packt das in `app/core.js` aus.

## get_training_load
- `current`: `{ day, ctl, atl, tsb, formZone, formLabel, rampRate7d, acwr, load7d, load28d }` oder `null`.
  - `formZone`: `overreaching` (TSB < −30) · `productive` (−30…−10) · `maintaining` (−10…5) · `fresh` (5…25) · `detraining` (> 25); `formLabel` ist der deutsche Text.
  - `rampRate7d`: Fitness-Anstieg in 7 Tagen (> 8 gilt als steil). `acwr` = ATL/CTL (≈ 0,8–1,3 ausgewogen; `null` bei CTL < 5).
- `days[]`: `{ day, load, ctl, atl, tsb, formZone }` – für die Fitness/Form-Kurve.
- `monotony7d`: Mittel/Streuung der Tagesbelastung der letzten 7 Tage (> 2 = eintönig).
- `methods`: Anzahl Workouts mit Belastung aus `power`, `hr`, ohne (`none`).
- `topWorkouts[]` (max. 10): `{ day, sport, durationMin, load, method, intensity, sources }`.
- `reference`: `{ ftpW, thresholdHr, origin }`.

## get_fitness_profile
- `settings`: wirksame Einstellungen (wie in `get_dashboard`).
- `ftp`: `{ watts, origin: "user"|"data"|"none", estimate, wattsPerKg }`; `estimate` = `{ watts, method: "curve_20min"|"curve_60min"|"workouts_np", confidence: "medium"|"low", basedOn: { day, durationS, watts }, note }` oder `null`.
  - Mit Leistungskurve: max(95 % der besten 20 min, beste 60 min) der letzten 90 Tage. Ohne: grobe Untergrenze aus normalisierter Leistung von Fahrten ≥ 20 min.
  - Eine selbst gesetzte FTP (`update_settings`) geht immer vor.
- `zones`: `{ power: Zone[7] | null, hr: Zone[5] | null }`, `Zone = { zone, name, min, max }` (`max: null` = offen). Leistung nach Coggan, Puls nach Friel (Schwellenpuls).
- `zoneDistribution`: `{ power, hr }`, je `{ basis, zones: [...Zone, minutes, sharePct, workouts], totalMinutes, intensity: { easyPct, moderatePct, hardPct } }`. **Näherung:** jede Einheit zählt komplett in die Zone ihres Mittelwerts (bis Sekundendaten bzw. WHOOP-Zonenzeiten da sind, #19).
- `hrZoneTime` (#19): Zeit je Pulszone nach WHOOP-Schema (Zone 0–5 = < 50 %, 50–60, 60–70, 70–80, 80–90, ≥ 90 % HFmax), gemessen von WHOOP je Workout:
  `{ scheme: [{ zone, name }], total, weeks: [{ week, ...HrZoneTime }], verdict }`, `HrZoneTime = { minutes: number[6], totalMin, workouts, easyPct, moderatePct, hardPct }`.
  Locker = Zone 1–3, mittel = 4, hart = 5, Anteile an der Zeit ab Zone 1 (Zone 0, z. B. Pausen im Krafttraining, zählt nicht; Ziel grob 80 % locker). `verdict` ist ein kurzer deutscher Hinweis ab 3 h Trainingszeit ab Zone 1, sonst `null`.
- `powerCurve`: `{ last30d, last42d, last90d, last365d, allTime }`, je `[{ durationS, watts, day, source }]` für die Dauern aus `core/power.ts` (1 s … 2 h). Leer, solange keine FIT-Datei mit Leistung importiert ist.

## get_health_trends
- `metrics.<key>` für `hrv`, `rhr`, `recovery`, `sleepH`, `respRate`, `skinTemp`, `spo2`: `{ last, lastDay, avg7, baseline, status: "below"|"normal"|"above"|"unknown", band[] }`.
  - `band[]`: `{ day, value, avg7, baseline, low, high }` – Normalbereich = Mittel ± 1 Standardabweichung der Tage −34…−7 (mind. 7 Werte). Für Flächen-/Bandcharts.
  - Bewertung: bei `rhr`, `respRate`, `skinTemp` ist `above` eher ungünstig, bei `hrv`, `recovery`, `sleepH`, `spo2` `below`.
- `hrvStabilityCvPct`: Variationskoeffizient der HRV der letzten 7 Tage (höher = unruhiger).
- `sleep.last14d`: `{ nights, avgBedtime "HH:MM", avgWake, bedtimeSdMin, wakeSdMin, debt7dH }`, `sleep.sleepNeedH`.

## get_period_summaries
`periods[]` je Woche (Schlüssel = Montag), Monat (`YYYY-MM`) oder Jahr (`YYYY`):
`{ period, from, to, days, workouts, trainingDays, trainingH, load, avgDailyLoad, distanceKm, energyKj, bySport: { <sport>: { count, minutes, distanceKm } }, avgRecovery, recoveryDays: { green, yellow, red }, avgHrv, avgRhr, avgSleepH, sleepDebtH, avgStrain, ctlStart, ctlEnd, ctlChange, loadChangePct }`. Erster und laufender Zeitraum sind ggf. unvollständig (`days`).

## get_strain_recovery
- `pairs[]`: `{ day, strain, load, nextRecovery, nextHrv }` – für ein Streudiagramm.
- `byStrain[]` (leicht < 10, moderat 10–14, hoch 14–18, sehr hoch ≥ 18) und `byLoad[]` (Ruhetag, 1–50, 50–100, > 100): `{ key, label, days, avgNextRecovery, avgNextHrv }`.
- `correlation`: `{ strainToNextRecovery, loadToNextRecovery, n }` (Pearson, −1…1).
- `balance`: `{ strain7d, strain28d, recovery7d, recovery28d }`.
- `insights[]`: kurze deutsche Sätze (Beobachtungen, keine Ursache-Wirkung).

## get_recovery_factors (#21)
Je Tag: Erholung bzw. HRV am Morgen gegen Schlaf der Nacht davor und das Training am Vortag.
- `factors[]` (stärkste zuerst), je Ziel `target` = `recovery` oder `hrv`:
  `{ key, label, target, kind: "numeric"|"yesno"|"weekday", n, r, effect, strength: "none"|"weak"|"moderate"|"strong", groups: [{ label, n, avg }], text }`.
  - `key`: `sleep_duration`, `sleep_deep`, `bedtime`, `strain_prev`, `load_prev`, `late_workout` (Training endete am Vorabend nach 19 Uhr), `rest_day_prev`, `weekday`.
  - numeric: `effect` = Mittel des oberen minus unteren Drittels, `groups` = unteres/oberes Drittel. yesno: `effect` = ja minus nein. weekday: `groups` je Wochentag, `effect` = bester minus schlechtester.
  - `text`: ein deutscher Satz ab schwachem Zusammenhang, sonst `null`.
- `highlights[]`: bis zu 5 Sätze mit mindestens deutlichem Zusammenhang – Grundlage für Claudes Deutung im Dashboard.
- `days`, `enoughData` (ab 21 Tagen mit Erholung).

## get_early_warning / get_dashboard.earlyWarning (#24)
Messwerte von heute (oder gestern, falls heute noch keine da sind; fehlt heute nur ein Teil, z. B. Ruhepuls/HRV vor der WHOOP-Auswertung, kommt dieser Wert von gestern und das Signal trägt `fromDay`) gegen die persönliche Basis (Tage −34 … −7, mind. 7 Werte).
- `{ day, level, flaggedCount, consecutiveDays, signals[], headline, advice, disclaimer }`.
- `signals[]`: `{ key: "rhr"|"hrv"|"respRate"|"skinTemp"|"spo2", label, unit, value, baseline, delta, z, flagged, text }`. Auffällig, wenn in ungünstiger Richtung beide Schwellen überschritten sind: Ruhepuls ≥ +4 bpm und z ≥ 1,5; HRV z ≤ −1,5; Atemfrequenz ≥ +0,8/min und z ≥ 2; Hauttemperatur ≥ +0,4 °C und z ≥ 2; SpO2 ≤ −1,5 Punkte und z ≤ −2 (Faustregeln, Schätzung).
- `level`: `none` (0 Signale) · `watch` (1) · `caution` (2: heute schonen) · `alert` (≥ 3, oder 2 an mindestens 2 Tagen in Folge: Ruhetag).
- Artefakt-Abschnitt: `artifact/sections/warning.js` (Reiter heute, ganz oben, nur sichtbar ab `watch`).

## get_sleep_report (#20)
- `nights[]` je Aufwachtag: `{ day, bedtime "HH:MM", wake, inBedH, asleepH, awakeH, lightH, deepH, remH, deepPct, remPct, efficiencyPct, performancePct, consistencyPct, respiratoryRate, napH, debt7dH }`.
- `summary`: `{ nights, avgAsleepH, avgInBedH, avgDeepPct, avgRemPct, avgEfficiencyPct, needMetPct, avgBedtime, avgWake, bedtimeSdMin, wakeSdMin, weekendShiftMin, debt7dH, suggestedBedtime }`.
  - `weekendShiftMin`: Schlafmitte Fr/Sa-Nacht minus Wochentage („sozialer Jetlag“). `suggestedBedtime` = übliche Aufwachzeit − Schlafbedarf − übliche Wachzeit im Bett (Schätzung).
- `sleepNeedH`, `tips[]` (deutsche Sätze zu Schlafschuld, Regelmäßigkeit, Wochenende, Schlafenszeit).
- Artefakt-Abschnitt: `artifact/sections/sleep.js` (Reiter verlauf, order 32), lädt mit dem Zeitraum-Umschalter neu.

## Körperwerte und Export (#30, `core/body.ts`, `body-tools.ts`)

- `get_body_history {days?=180}` → `{today, range, points[{day, weightKg, source, avg7dKg}], summary{latest, heightM, bmi, minKg, maxKg, change7dKg, change30dKg, change90dKg, trendKgPerWeek, manualEntries}, wattsPerKg{value, ftpW, ftpOrigin}, goal{title, targetValue, targetDate, remainingKg, neededKgPerWeek, onTrack} | null, notes[]}`. Ein Wert je Tag; eigener Eintrag (`source: "manual"`) hat Vorrang vor WHOOP. Trend = Ausgleichsgerade der letzten 28 Tage (mind. 4 Werte über 14 Tage). Ziel = aktives Ziel mit `metric: "weightKg"`.
- `log_weight {weightKg, day?}` speichert einen eigenen Eintrag (kein Datum in der Zukunft) und liefert den Bericht über 90 Tage zurück. `delete_weight {day}` löscht nur eigene Einträge.
- `readLatestBody` (Dashboard, Einstellungen) nimmt Größe und Maximalpuls weiter vom Anbieter, das Gewicht vom neuesten Eintrag.
- `export_csv {dataset: daily|sleeps|workouts|body, days?=365, excel?}` → `{fileName, mimeType, rows, columns, csv}`. `excel: true` = Semikolon und Dezimalkomma. Texte, die mit `= + - @` beginnen, bekommen ein `'` vorangestellt (keine Formeln in Excel).
- Abschnitte: `artifact/sections/body.js` (Tab verlauf, order 38, Werkzeuge get_body_history und log_weight) und `artifact/sections/export.js` (Tab mehr, order 85, Werkzeug export_csv, Capability `downloads: true`).

## get_records (#65, `core/records.ts`)

- `get_records {days?=30}` → `{today, range, records[], totalRecords, week, notes[]}`.
- `records[]`, neueste zuerst: `{day, kind: power|strength|distance|duration, key, label, value, unit, previous, previousDay, delta, text}`.
  - Rekord = besser als alle früheren Werte, über die ganze Historie geprüft. Der erste Wert zählt nicht.
  - Leistung: 5 s, 1, 5, 20 und 60 min aus der Leistungskurve.
  - Kraft: geschätztes 1RM je Übung (Epley), erst ab mehr als 1 % Verbesserung.
  - Längste Fahrt: Strecke (ab +0,5 km) und Zeit (ab +5 min), nur Radeinheiten.
- `week`: `{thisWeek, lastWeekSamePeriod, lastWeekFull, change}`.
  - Je Zeitraum `{from, to, days, workouts, trainingH, load, avgRecovery, avgHrv, avgSleepH, avgStrain}`.
  - `change` vergleicht diese Woche bis heute mit denselben Wochentagen der Vorwoche.
- Abschnitt: `artifact/sections/records.js` (Tab heute, order 15).

## FTP-Tests (#64, `core/ftp-test.ts`, `ftp-tools.ts`)

- `analyze_ftp_test {source?, sourceId?, protocol?: auto|ramp|20min}` gibt `{workout{source, sourceId, day, sport, durationS}, result{protocol, detection: auto|manual|none, label, basisW, basisStartS, factor, ftpW, message}}` zurück. Ohne Angabe wird die neueste Fahrt mit Sekundenwerten genommen. Das Werkzeug speichert nichts.
  - Ramp-Test: 75 % der besten Minute. Erkannt wird er, wenn die 1-min-Mittel mindestens 8 Minuten lang steigen und danach die Leistung einbricht oder die Fahrt endet.
  - 20-min-Test: 95 % der besten 20 min. Erkannt wird er, wenn das Fenster gleichmäßig ist (Variationskoeffizient unter 0,15) und mindestens 20 % über dem Rest der Fahrt liegt.
- `save_ftp_test {source, sourceId, protocol?, apply?}` speichert den Test in der Tabelle `ftp_tests` mit dem Gewicht vom Testtag. Mit `apply: true` wird die FTP auch in die Einstellungen übernommen.
- `delete_ftp_test {source, sourceId}` entfernt einen Test aus dem Verlauf.
- `get_ftp_tests` gibt `{today, current{ftpW, origin, estimate}, tests[{day, protocol, label, basisW, ftpW, weightKg, wattsPerKg, changeW, applied}], suggestion{suggest, reason, daysSinceLastTest, tsb, howTo[]}}` zurück. Ein Test wird vorgeschlagen, wenn die Form (TSB) bei mindestens 0 liegt und der letzte Test mindestens 42 Tage her ist. Die Funktion `ftpTestSuggestion` kann auch der Coach nutzen.
- Abschnitt: `artifact/sections/ftp.js` (Tab training, order 46).

## get_endurance_profile (#92, `core/endurance.ts`)

- Rückgabe: `{today, criticalPower, ftpW, cpVsFtpPct, holdTimes[{watts, seconds|null}], efficiency, notes[]}`.
- `criticalPower`: `{cpW, wPrimeKj, r2, points[{durationS, watts, day}], confidence: high|medium|low, note}` oder `null`.
  - Rechnung: 2-Parameter-Modell, Arbeit = CP · t + W′, Regression über die besten 3, 5, 10 und 20 min der letzten 90 Tage (mindestens 3 Dauern).
  - `high`: 4 Dauern, r² ≥ 0,998 und W′ zwischen 6 und 35 kJ. `medium`: r² ≥ 0,99.
- `holdTimes`: haltbare Dauer W′/(P − CP) für 90–150 % der CP. `null` bedeutet unter oder an CP.
- `efficiency`: `{rides[], weekly[{week, rides, ef}], recentEf, previousEf, changePct, verdict}`.
  - EF = NP / mittlerer Puls lockerer Fahrten (IF < 0,8, ab 30 min).
  - `changePct` vergleicht die letzten 4 Wochen mit den 8 Wochen davor.
- Abschnitt: `artifact/sections/endurance.js` (Tab training, order 48).

## Leistungskurve: Datenquelle
Die Bestwerte je Fahrt speichert der FIT-Import (`providers/mywhoosh/import.ts`, `core/power.ts` → `workout_streams.power_curve`). `get_fitness_profile` liest sie über `readPowerCurves` und ergänzt Tag und Quelle je Bestwert; das reine Kurven-Werkzeug ist `get_power_curve`.

## get_workout_detail
Detail einer Fahrt mit Sekundenwerten (FIT-Import), Code `worker/src/core/workout-detail.ts`. Parameter: `source`, `sourceId` (aus `get_workouts`; ohne beide die neueste Fahrt mit Sekundenwerten), `maxPoints` (50–3600, Std. 600).
- `found`: `false` mit `message`, wenn es keine Sekundenwerte gibt. `available[]`: die letzten 20 Fahrten mit Sekundenwerten (`day, source, source_id, start_time, sport, duration_s, avg_power_w, normalized_power_w`) als Auswahlliste.
- `workout`: Zeile aus `workouts`. `reference`: `{ ftpW, thresholdHr }`, `ftpOrigin` (`user`/`data`).
- `stats`: `{ durationS, avgPowerW, normalizedPowerW, maxPowerW, variabilityIndex, intensityFactor, tssEstimate, workKj, avgHr, maxHr, avgCadence }`.
- `series`: `{ stepS, points: [{ t, power, hr, cadence }] }` – Mittel je Abschnitt von `stepS` Sekunden, `t` = Sekunde ab Start.
- `zones`: `{ power, hr }`, je `[...Zone, seconds, sharePct]` aus echten Sekundenwerten (oder `null` ohne FTP bzw. Schwellenpuls).
- `intervals`: `{ thresholdW, basis: "ftp"|"average", intervals: [{ startS, durationS, avgPowerW, pctFtp, avgHr, maxHr, avgCadence }] }` – 30-s-Mittel über 88 % FTP (ohne FTP 115 % des Fahrtdurchschnitts), ab 60 s, Lücken bis 15 s überbrückt.
- `decoupling`: `{ pct, firstHalf, secondHalf }` (Leistung/Puls je Hälfte) oder `null` (unter 20 min Daten).
- `powerCurve`: Bestleistungen dieser Fahrt `{"Sekunden": Watt}`.

## Krafttraining (`core/strength.ts`, #33)

- **Erfassen:** `log_strength_session` (Übungen mit Sätzen, Wiederholungen, Gewicht; `rpe` = Anstrengung der Einheit 1–10). Übungsnamen deutsch oder englisch, ein Katalog ordnet Muskelgruppen zu; unbekannte Übungen mit `muscles`. Verknüpfung mit einem WHOOP-Krafttraining am selben Tag (bei Startzeit höchstens 90 min daneben), Dauer und Startzeit von dort.
- **Belastung:** Session-RPE (Foster) im TSS-Maßstab, Punkte je Stunde nach RPE (7 ≈ 70, 9 ≈ 100, 10 ≈ 120), `loadMethod: "srpe"`. Ersetzt die Puls-Schätzung des verknüpften Workouts, wenn höher; Einheiten ohne Workout zählen als Quelle `manual`. Fließt in Fitness/Ermüdung/Form (Dashboard und Auswertungen).
- **1RM:** Epley, Gewicht · (1 + Wdh/30), nur bis 12 Wiederholungen. Fortschritt je Übung: bestes 1RM je Einheit; `plateau`, wenn die letzten drei Einheiten (mind. 3 in 6 Wochen) keine neue Bestmarke über 1 % bringen; `decline` bei −5 % in 4 Wochen.
- **Volumen:** Arbeitssätze je Muskelgruppe und Woche (Hauptmuskel 1, Hilfsmuskel 0,5) und Tonnage.
- **Coach:** Schwere Beineinheit gestern/heute (≥ 6 Beinsätze oder ≥ 3 bei RPE ≥ 8) → keine harten Rad-Intervalle; nach 14 Tagen ohne Kraft eine Erinnerung.
- **Vorlagen:** `save_strength_template`, `suggest_strength_session` (letztes Gewicht, nach komplett geschafften Sätzen +2,5 kg bzw. +5 kg bei Beinen/Kreuzheben).

## Erholungs-Prognose (`get_recovery_forecast`, #93)

Schätzt die WHOOP-Erholung für morgen früh. Modell: Ridge-Regression (`core/forecast.ts`) nur auf den eigenen letzten 90 Tagen; je Tag D wird die Erholung mit Erholung, Belastung und Strain von D−1, dem Schlaf der Nacht davor und Training nach 19 Uhr (lokal) am Vortag verglichen.

- Eingaben: `sleepH` (geplanter Schlaf, Standard: Median der letzten 14 Nächte), `extraLoad` (heute noch geplante Belastung, zählt als Abendtraining; Strain wird über die eigene Strain-pro-Belastung-Steigung mitgeschätzt).
- Ausgabe: `forecast` mit 80-%-Spanne (±1,28 · RMSE), `scenarios` (±1 h Schlaf, Abendtraining ja/nein), `effects` je Einheit, `quality` (Leave-one-out-Fehler, Vergleich mit „Durchschnitt raten“ und „wie heute“, letzte 14 Tage geschätzt gegen tatsächlich).
- Ehrlichkeit: keine Prognose (`available: false` mit `reason`) unter 30 Tagen Daten, bei mittlerem Fehler über 18 Punkten oder wenn das Modell nicht besser ist als den eigenen Durchschnitt zu raten.
- Dashboard: Abschnitt `sections/forecast.js` im Reiter Heute mit Auswahl für Schlaf und Abendtraining.
- Schätzung, keine Diagnose; Krankheit, Alkohol, Stress oder Reisen kennt das Modell nicht.

## Kraft und Rad im Wechselspiel (`get_strength_cycling_interference`, #113)

Interferenz-Analyse in `core/interference.ts`. Beineinheit = Krafteinheit mit mindestens 3 Sätzen, deren Hauptmuskel Quadrizeps, Beinbizeps oder Gesäß ist (Ende = Start + Dauer, ohne Startzeit Mittag).

- `nextDay`: Erholung und HRV am Folgetag, gruppiert nach dem Vortag (Beineinheit, Radeinheit, anderes Training, Ruhetag), als Abweichung vom eigenen Mittel im Zeitraum. Erst ab 3 Tagen je Gruppe.
- `nextRide`: Radeinheiten ab 20 min nach Abstand zur letzten Beineinheit (unter 24 h, 24–48 h, 48–72 h, 3–7 Tage, keine in 7 Tagen). Effizienz = (normierte) Leistung je Herzschlag gegenüber dem Median ähnlich harter Fahrten (locker bzw. ab IF 0,85); dazu die mittlere Intensität harter Einheiten.
- `suggestion`: kleinster Abstand, ab dem die Effizienz höchstens 2 % unter dem Mittel liegt (und harte Einheiten nicht spürbar weniger intensiv sind); bei zu wenig Gruppen `hours: null`.
- Dashboard: `sections/interference.js`, Reiter Training. Beobachtungen, keine Ursache-Wirkung, keine Diagnose.

## HRV-Trend (`get_hrv_trend`, #125)

`core/hrv-trend.ts` nach Plews u. a.: Für jeden Tag das 7-Tage-Mittel der logarithmierten HRV (lnRMSSD, mindestens 4 Werte) und ein Normalband aus den 60 Tagen davor (Mittel ± 0,5 SD, mindestens 20 Werte), zur Anzeige in ms zurückgerechnet. Schwankung = Variationskoeffizient der lnRMSSD im 7-Tage-Fenster.

- `current`: Lage (`within`/`above`/`below`), Abstand zur Bandmitte, Veränderung in 14 Tagen, CV jetzt, eine Woche vorher und üblich.
- `pattern`: `stable`, `high`, `unsettled` (CV ≥ 1,5 × üblich), `fatigue` (unter dem Band, CV steigt um ≥ 1 Punkt oder ≥ 1,3 × üblich), `saturation` (unter dem Band, CV sinkt oder ≤ 0,6 × üblich; Schätzung), `low`; dazu `label` und `advice`.
- Dashboard: `sections/hrvtrend.js`, Reiter Verlauf. Trainingshinweis, keine Diagnose.

## Beste Trainingszeit (`get_training_timing`, #131)

`core/timing.ts`: Einheiten ab 15 min nach Tageszeit (lokal): morgens (bis 10 Uhr), mittags (10–14), nachmittags (14–18), abends (18–21), spät (ab 21).

- `slots[]`: Anzahl Einheiten (nach Startzeit); Effizienz der Radeinheiten nach Startzeit, also (normierte) Leistung je Herzschlag gegenüber dem Mittel ähnlich harter Fahrten (locker bzw. ab IF 0,85). Dazu Schlafdauer (min), Schlafleistung und Erholung der folgenden Nacht bzw. des nächsten Morgens, zugeordnet nach der Endzeit des letzten Trainings am Tag und gegenüber dem Mittel aller Nächte. Verglichen erst ab 3 Fällen.
- `hints[]`: effizientestes Fenster (ab +1 %), Abend- bzw. Spätfenster mit mindestens 20 min weniger Schlaf oder 5 Punkten weniger Erholung.
- Dashboard: `sections/timing.js`, Reiter Training. Beobachtungen, keine Ursache-Wirkung.

## Ermüdungsresistenz (`get_durability`, #139)

`core/durability.ts` nutzt die Sekundenwerte der FIT-Dateien (`workout_streams.power`, höchstens 120 Fahrten im Zeitraum). Je Fahrt wird die Sekunde bestimmt, ab der 500, 1000 bzw. 1500 kJ geleistet sind. Danach wird die beste 5- und 20-min-Leistung gesucht, die frühestens dort beginnt. „Frisch“ ist die beste Leistung der ganzen Fahrt.

- `table[]`: je Dauer und Arbeitsschwelle die beste Leistung über alle Fahrten, die Anzahl der Fahrten mit genug Arbeit und der Anteil an der frischen Leistung.
- `verdict`: Einordnung über 5 min nach 1000 kJ (ersatzweise 500 kJ): ab 95 % sehr ermüdungsresistent, ab 88 % solide, darunter ausbaufähig.
- Dashboard: `sections/durability.js`, Reiter Training. Schätzung, nur aussagekräftig mit harten Phasen spät in langen Fahrten.

## Aerobe Basis (`get_aerobic_decoupling`, #145)

`core/aerobic.ts` nutzt Fahrten mit Leistung und Puls je Sekunde (FIT-Upload, höchstens 120 im Zeitraum). Je Fahrt ab 50 min werden die ersten 10 min als Aufwärmen verworfen. Gleichmäßig ist eine Fahrt mit Variabilitätsindex (NP / Ø-Leistung) bis 1,10; Intervalltrainings zählen nicht. Für sie wird die Pa:HR-Entkopplung berechnet (Leistung je Herzschlag, zweite gegen erste Hälfte, wie im Workout-Detail).

- `rides[]`: Tag, Dauer, Ø-Leistung, Variabilitätsindex, Entkopplung und Einordnung (`good` unter 5 %, `ok` bis 8 %, sonst `high`).
- `current`: Median der letzten 4 Fahrten und der 4 davor; `trend` ab 1 Prozentpunkt Unterschied besser oder schlechter.
- `longestGood`: längste Fahrt mit unter 5 %; `skipped`: zu kurze bzw. ungleichmäßige Fahrten.
- Dashboard: `sections/aerobic.js`, Reiter Training. Schätzung; Hitze auf der Rolle und wenig Trinken erhöhen die Entkopplung.

## Intervall-Qualität (`get_interval_quality`, #155)

`core/intervals.ts` erkennt in jeder Fahrt mit Sekundenwerten die Intervalle wie das Workout-Detail (`detectIntervals`, mit wirksamer FTP). Die Hauptserie ist die Dauerklasse mit den meisten Wiederholungen (kurz unter 2,5 min, VO2max bis 8 min, Schwelle bis 30 min, lang), ab 3 Wiederholungen.

- `sessions[]` (neueste zuerst, höchstens 12): Serie, Ø-Leistung und % FTP, Leistung je Wiederholung, Abfall (erste gegen letzte Wiederholungen, ab 4 je zwei), CV, Pulsanstieg und Einordnung (`even` bis 3 %, `slight` bis 8 %, `strong` darüber, `building` bei Anstieg über 3 %).
- `classes[]`: je Intervallart Anzahl, letzte und beste Einheit, Veränderung seit der ersten Einheit im Zeitraum, mittlerer Abfall.
- `hints[]`: zu hart angegangen (2 der letzten 3 stark nachgelassen), Steigerung möglich (letzte gleichmäßig), Pulsanstieg ab 10 Schlägen, Veränderung je Art ab 3 %.
- Dashboard: `sections/intervals.js`, Reiter Training. Trainingshinweise, keine Diagnose.

## Trittfrequenz-Profil (`get_cadence_profile`, #161)

`core/cadence.ts` nutzt Fahrten mit Leistung und Trittfrequenz je Sekunde (gelesen wie die Intervall-Qualität). Gezählt werden nur Sekunden mit Tritt und Leistung.

- `bands[]`: Zeit und Anteil je Kadenzbereich (unter 70, 70–80, 80–90, 90–100, über 100 U/min).
- `zones[]` (nur mit FTP): Zeit und Median-Kadenz je Coggan-Zone (Z1 bis Z5+), ab 5 min.
- `weeks[]`: Median-Kadenz in Zone 2 je Woche, ab 5 min.
- `hints[]`: Schwelle unter 80 U/min, Grundlage unter 75 U/min, deutlich höhere Kadenz bei harten Belastungen, Veränderung in Zone 2 ab 3 U/min (erste gegen letzte zwei Wochen).
- Dashboard: `sections/cadence.js`, Reiter Training. Trainingshinweise, keine Diagnose.

## Fahrertyp (`get_rider_profile`, #164)

`core/rider-profile.ts` nimmt die beste 5-s-, 1-min- und 5-min-Leistung der Leistungskurve im Zeitraum (`readPowerCurves`, `combineCurves`) und teilt sie durch die wirksame FTP. Dieses Verhältnis wird mit dem typischen Verhältnis aus der Mitte von Coggans Leistungsprofil verglichen (5 s: 4,14 × FTP, 1 min: 2,07, 5 min: 1,20). 100 Punkte sind typisch, ab 106 eine Stärke, unter 94 eine Schwäche. Das ist gewichtsunabhängig; W/kg wird nur angezeigt.

- `type`/`label`/`text`: Sprinter, Puncheur, Kletterer (VO2max-stark) nach der stärksten Dauer; Zeitfahrer, wenn alle drei schwach sind; Allrounder, wenn alle typisch sind.
- `durations[]`: Watt, W/kg, Verhältnis zur FTP, Punkte, Einordnung und Veränderung zum gleich langen Vorzeitraum.
- `focus`: Training für die schwächste Dauer (nur wenn wirklich schwach), sonst Schwellenarbeit.
- `hints[]`: beste 20 min deutlich über der FTP (FTP vermutlich zu niedrig), geschätzte FTP.
- Dashboard: `sections/riderprofile.js`, Reiter Training. Schätzung, nur mit echten Maximalbelastungen in jeder Dauer aussagekräftig.

## Muskelbalance (`get_muscle_balance`, #171)

`core/muscle-balance.ts` zählt die Arbeitssätze der gespeicherten Krafteinheiten je Muskelgruppe (wie `muscleVolume`: Hauptmuskel ganz, Hilfsmuskel halb) und teilt durch die Wochenzahl (Standard 4).

- `muscles[]`: Sätze pro Woche, Zielbereich (große Gruppen 6–12, Schultern und Rumpf 4–10, Arme und Waden 2–8, gedacht für zwei Einheiten neben dem Radtraining) und Status `none`/`low`/`ok`/`high`.
- `ratios`: Ziehen (Rücken, Bizeps) zu Drücken (Brust, Schultern, Trizeps), Ziel ab 0,8; Beinbeuger zu Beinstrecker, Ziel ab 0,6.
- `hints[]`: gar nicht trainierte und zu schwach trainierte Gruppen mit Übungen aus dem Katalog, unausgewogene Verhältnisse, sehr viel Beinvolumen.
- Dashboard: `sections/musclebalance.js`, Reiter Training nach dem Krafttraining. Trainingsempfehlungen, keine Diagnose.

## Analyse-Highlights (`get_analysis_highlights`, #175)

`core/highlights.ts` fasst die fertigen Berichte zusammen: Erholungsprognose, HRV-Trend, Aerobe Basis, Intervall-Qualität, Ermüdungsresistenz, Fahrertyp, Muskelbalance, Trainingszeit, Kraft/Rad, Trittfrequenz, Erholungskurve, Training nach der Erholungsampel, FTP-Schätzung und Rolle gegen Straße. Je Thema höchstens ein Satz mit Ton (`warn`, `good`, `neutral`) und dem Tool für Details; `warn` zuerst, dann `good`, dann `neutral`, höchstens `limit` (Standard 6), `more` zählt den Rest.

- Der View (`analysisHighlightsView`) liest Kontext (180 Tage) und Sekundenwerte (120 Tage) nur einmal und füttert damit alle Berichte.
- Kein eigener Dashboard-Abschnitt; gedacht als Einstieg für den Coach und für Briefing oder Wochenrückblick.

## Erholungskurve (`get_recovery_curve`, #195)

`core/recovery-curve.ts` nutzt nur Tageswerte (WHOOP). Harte Tage haben einen Strain ab dem 80. Perzentil des Zeitraums (mindestens 14); bevorzugt werden harte Tage ohne weiteren harten Tag in den zwei Tagen danach, sonst alle. Ab 4 harten Tagen gibt es eine Kurve.

- `curve[]`: Tag 0 (Morgen des harten Tags) bis +4 mit Erholung (Punkte), HRV (%) und Ruhepuls (Schläge) gegenüber dem Mittel im Zeitraum.
- `backToNormalDays`: erster Tag ab +1 mit Erholung höchstens 3 Punkte unter dem Mittel; `sleepEffect`: Erholung am Morgen danach bei längerem gegen kürzeren Schlaf als üblich (je mindestens 2 Fälle).
- `hints[]`: Tage bis zur Rückkehr und daraus lockere Tage nach harten Einheiten, Schlaf-Effekt ab 5 Punkten.
- Dashboard: `sections/recoverycurve.js`, Reiter Verlauf nach dem HRV-Trend. Beobachtungen, keine Ursache-Wirkung.

## Training nach der Erholungsampel (`get_readiness_alignment`, #226)

`core/readiness-alignment.ts` nutzt nur Tageswerte (WHOOP): Erholung am Morgen (grün ab 67 %, rot unter 34 %) gegen den Strain desselben Tags (leicht unter 10, hart ab 14). Heute zählt nicht. Ab 14 Tagen gibt es eine Auswertung.

- `matrix[]`: Tage je Zone und Strain-Stufe; `score`: Anteil passender Tage (an grünen Tagen ab Strain 10, an roten unter 10) an allen grünen und roten Tagen.
- `counts.against`: hart an roten Tagen; `redCost`: Erholung am Morgen danach, ruhige gegen harte rote Tage (je mindestens 2 Fälle); `greenUsedPct`, `hardOnGreenPct`.
- `recent[]`: letzte 14 Tage mit Zone, Strain und Bewertung; `hints[]`: gegen die Ampel trainiert, grüne Tage selten genutzt, harte Tage selten auf grün, sonst Lob.
- Dashboard: `sections/readiness.js`, Reiter Verlauf nach der Erholungskurve. Auch in `get_analysis_highlights` (Thema `readiness`).

## eFTP-Verlauf (`get_eftp_trend`, #200)

`core/eftp.ts` schätzt die FTP je Woche aus den Bestwerten der 42 Tage davor (`readPowerCurves`): Critical Power aus 3–20 min, wenn das Modell mindestens „medium“ ist, sonst 95 % der besten 20 min, sonst 90 % der besten 10 min. Die beste 60-min-Leistung gilt als Untergrenze. `low`/`high` ist die Spanne aller verfügbaren Ansätze.

- `points[]`: je Woche `eftpW`, Spanne, Methode, Tag des Bestwerts und ein FTP-Test dieser Woche (`testW`).
- `current` mit W/kg und `stale` (Bestwert älter als 28 Tage); `change` über 6 Wochen, `direction` ab ±2 %.
- `suggestTest`: zwei Wochen in Folge mindestens 5 % Abweichung in dieselbe Richtung von der selbst eingestellten FTP (eine geschätzte FTP zählt nicht).
- Dashboard: `sections/eftp.js`, Reiter Verlauf (Training-Reiter ist voll). Auch in `get_analysis_highlights` (Thema `eftp`).

## Rolle gegen Straße (`get_indoor_outdoor`, #207)

`core/indoor-outdoor.ts` vergleicht Radfahrten ab 20 min aus den Zusammenfassungswerten (keine Sekundenwerte). Drinnen: Quelle MyWhoosh (auch mit virtueller Strecke) oder Sportart mit Indoor/Rolle/virtuell; draußen: Strecke ab 1 km; sonst `unknown`.

- Je Seite: Fahrten, Stunden, Median von NP, IF (mit FTP), Puls und Trittfrequenz, Effizienz `ef` = NP pro Herzschlag (Median).
- `comparison` ab je 3 Fahrten mit Leistung und Puls: Bezugsleistung (Median beider Seiten), Puls drinnen/draußen bei dieser Leistung (Leistung / Effizienz), `hrGap`, `efGapPct`, `cadenceGap`.
- `hints[]`: Puls auf der Rolle ab 4 Schlägen höher (Ventilator, nach Leistung steuern), Kadenzunterschied ab 5 U/min, sonst fehlende Fahrten.
- Dashboard: `sections/indooroutdoor.js`, Reiter Verlauf. Auch in `get_analysis_highlights` (Thema `indoorOutdoor`, nur mit Vergleich).

## W′-Bilanz (`get_workout_detail` › `wbal`, #208)

`core/wbal.ts` rechnet die W′-Bilanz nach Skiba (differenzielles Modell): über CP sinkt W′bal um (P − CP) je Sekunde, darunter füllt es sich mit (W′ − W′bal) · (CP − P) / W′. CP und W′ kommen aus dem CP-Modell der letzten 90 Tage (mindestens „medium“), sonst CP = FTP und W′ = 20 kJ (angenommen).

- `get_workout_detail` liefert additiv `wbal`: `cpW`, `wPrimeKj`, `modelSource` (`cp`/`ftp`), `minKj`, `minPct`, `minAtS`, `below25PctS`, `series` (tiefster Wert je Abschnitt in kJ, gleiches Raster wie `series.points`), `verdict`, `note`.
- `get_interval_quality` liefert je Einheit `wbalMinPct`; der Abschnitt Intervall-Qualität zeigt ihn als „W′ min“.
- Modellschätzung, keine Messung.
