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
