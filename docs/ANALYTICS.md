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

`get_dashboard` enthält zusätzlich `ftpEstimate` (siehe unten); `settings.origin.ftpW` ist `"data"`, wenn die FTP geschätzt ist.

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
- `powerCurve`: `{ last42d, last90d, allTime }`, je `[{ durationS, watts, day, source }]` für 5 s, 15 s, 30 s, 1, 2, 5, 10, 20, 30, 60, 90, 120 min. Leer, solange keine Sekundenwerte importiert sind.

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

## Leistungskurve befüllen (für FIT-Import und Wahoo)
Aus den Sekundenwerten der Leistung einer Fahrt:
```ts
import { bestEfforts } from "./core/performance";
import { runBatched, upsertPowerBests } from "./core/repository";
await runBatched(db, upsertPowerBests(db, { source, sourceId, day }, bestEfforts(watts, sampleRateS)));
```
Tabelle `power_bests` (Migration `0005_power_bests.sql`), ein Wert je Fahrt und Dauer.
