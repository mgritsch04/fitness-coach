import { describe, expect, it } from "vitest";
import { mergeWorkouts, type WorkoutRow } from "../src/core/analysis";
import { meanMaxPower, normalizedPower } from "../src/core/power";
import { readPowerCurves, readWorkouts, readWorkoutStream, runBatched, upsertWorkout } from "../src/core/repository";
import { FitError, parseFit } from "../src/providers/mywhoosh/fit";
import { FitImportError, importFit } from "../src/providers/mywhoosh/import";
import { mapFit } from "../src/providers/mywhoosh/map";
import { mapWorkout } from "../src/providers/wahoo/map";
import { fakeD1 } from "./fake-d1";
import { FitBuilder, fitTime, syntheticRide, toBase64 } from "./fit-builder";

describe("FIT-Leser", () => {
  it("liest Definitionen, Daten, Big-Endian und komprimierte Zeitstempel", () => {
    const t = fitTime("2026-03-01T10:00:00Z");
    const f = new FitBuilder()
      .message(0, 20, [[253, 0x86, t], [7, 0x84, 200]], true)
      .message(0, 20, [[253, 0x86, t + 1], [7, 0x84, 210]], true)
      // komprimierter Header: Zeit = letzte volle Zeit + 5-Bit-Versatz
      .message(1, 20, [[7, 0x84, 220]])
      .compressed(1, (t + 5) & 0x1f, [230], [2]);
    const msgs = parseFit(f.build());
    expect(msgs.map((m) => m.fields.get(7))).toEqual([200, 210, 220, 230]);
    expect(msgs[3].fields.get(253)).toBe(t + 5);
  });

  it("weist fremde und beschädigte Dateien ab", () => {
    expect(() => parseFit(new TextEncoder().encode("das ist keine fit-datei"))).toThrow(FitError);
    expect(() => parseFit(syntheticRide({ seconds: 5 }).slice(0, 40))).toThrow(FitError);
    const bad = new FitBuilder().message(0, 20, [[7, 0x84, 1]]).build({ badCrc: true });
    expect(() => parseFit(bad)).toThrow(/Prüfsumme/);
  });

  it("überspringt ungültige Werte", () => {
    const msgs = parseFit(new FitBuilder().message(0, 20, [[7, 0x84, null], [3, 0x02, 140]]).build());
    expect(msgs[0].fields.has(7)).toBe(false);
    expect(msgs[0].fields.get(3)).toBe(140);
  });
});

describe("Leistungskennzahlen", () => {
  it("NP bei konstanter Leistung = Leistung, Mean-Max korrekt", () => {
    expect(normalizedPower(new Array(600).fill(200))).toBeCloseTo(200, 6);
    expect(normalizedPower(new Array(20).fill(200))).toBeNull();
    const curve = meanMaxPower([...new Array(60).fill(100), ...new Array(5).fill(500), ...new Array(60).fill(100)]);
    expect(curve["5"]).toBe(500);
    expect(curve["10"]).toBe(300);
    expect(curve["60"]).toBe(Math.round((5 * 500 + 55 * 100) / 60));
    expect(curve["300"]).toBeUndefined();
  });
});

describe("MyWhoosh-FIT ins Datenmodell", () => {
  it("übernimmt die Kennzahlen der session-Nachricht und den Tag aus der Ortszeit", () => {
    const { workout, stream } = mapFit(syntheticRide({ start: "2026-03-01T23:30:00Z", utcOffsetS: 3600 }), "UTC");
    expect(workout).toMatchObject({
      source: "mywhoosh",
      sourceId: "fit-2026-03-01T23:30:00.000Z",
      day: "2026-03-02",
      startTime: "2026-03-01T23:30:00.000Z",
      endTime: "2026-03-01T23:40:00.000Z",
      sport: "cycling",
      durationS: 600,
      distanceM: 4800,
      energyKj: Math.round(300 * 4.184),
      avgHr: 135,
      maxHr: 149,
      avgPowerW: 200,
      normalizedPowerW: 212,
      avgCadenceRpm: 90,
      tss: 12.3,
    });
    expect(stream?.power).toHaveLength(600);
    expect(stream?.powerCurve?.["300"]).toBe(250);
    expect(stream?.powerCurve?.["600"]).toBe(200);
  });

  it("berechnet fehlende Kennzahlen aus den Sekundenwerten, Tag über Zeitzone der Einstellungen", () => {
    const { workout } = mapFit(syntheticRide({ start: "2026-03-01T23:30:00Z", withSession: false, utcOffsetS: null }), "America/New_York");
    expect(workout.day).toBe("2026-03-01");
    expect(workout.avgPowerW).toBe(200);
    expect(workout.normalizedPowerW).toBeGreaterThan(200);
    expect(workout.durationS).toBe(599);
    expect(workout.distanceM).toBe(4800);
    expect(workout.avgHr).toBeGreaterThan(120);
  });

  it("füllt kurze Aufzeichnungslücken, lange bleiben leer", () => {
    const t = fitTime("2026-03-01T10:00:00Z");
    const f = new FitBuilder();
    for (const s of [0, 1, 4, 20]) f.message(0, 20, [[253, 0x86, t + s], [7, 0x84, 100 + s]]);
    const { stream } = mapFit(f.build(), "UTC");
    expect(stream?.power?.slice(0, 5)).toEqual([100, 101, 101, 101, 104]);
    expect(stream?.power?.[10]).toBeNull();
    expect(stream?.power?.[20]).toBe(120);
  });
});

describe("Import in D1", () => {
  it("speichert, aktualisiert beim erneuten Upload und führt mit Wahoo/WHOOP zusammen", async () => {
    const db = fakeD1();
    const wahoo = mapWorkout({ id: 1, starts: "2026-03-01T17:02:00Z", minutes: 10, workout_type_id: 12, workout_summary: { heart_rate_avg: 133 } });
    await runBatched(db, [upsertWorkout(db, wahoo)]);

    const file = toBase64(syntheticRide());
    const first = await importFit(db, file);
    expect(first).toMatchObject({ imported: true, updated: false, sameRideIn: ["wahoo"], secondsOfData: 600 });
    const second = await importFit(db, `data:application/octet-stream;base64,${file}`);
    expect(second.updated).toBe(true);

    const rows = (await readWorkouts(db, "2026-01-01")) as unknown as WorkoutRow[];
    expect(rows.filter((r) => r.source === "mywhoosh")).toHaveLength(1);
    expect(rows.find((r) => r.source === "mywhoosh")).toMatchObject({ normalized_power_w: 212, avg_cadence_rpm: 90, tss: 12.3 });
    const merged = mergeWorkouts(rows);
    expect(merged).toHaveLength(1);
    expect(merged[0].sources).toEqual(["mywhoosh", "wahoo"]);

    const curves = await readPowerCurves(db, "2026-01-01");
    expect(curves[0].power_curve["600"]).toBe(200);
    const stream = await readWorkoutStream(db, "mywhoosh", "fit-2026-03-01T17:00:00.000Z");
    expect(stream?.power).toHaveLength(600);
  });

  it("meldet kaputte Dateien verständlich", async () => {
    const db = fakeD1();
    await expect(importFit(db, "%%%")).rejects.toThrow(FitImportError);
    await expect(importFit(db, toBase64(new TextEncoder().encode("keine fit-datei hier")))).rejects.toThrow(/Keine FIT-Datei/);
  });
});
