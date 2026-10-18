import { describe, expect, it } from "vitest";
import { localDay } from "../src/core/model";
import { mapCycle, mapRecovery, mapSleep, mapWorkout } from "../src/providers/whoop/map";
import { fetchAll, syncWindow } from "../src/providers/whoop/sync";

// Alle Werte synthetisch, keine echten Messwerte.

describe("localDay", () => {
  it("verschiebt UTC in die lokale Zeitzone", () => {
    expect(localDay("2026-03-01T23:30:00.000Z", "+02:00")).toBe("2026-03-02");
    expect(localDay("2026-03-01T03:30:00.000Z", "-05:00")).toBe("2026-02-28");
    expect(localDay("2026-03-01T12:00:00.000Z", undefined)).toBe("2026-03-01");
  });
});

describe("WHOOP-Mapping", () => {
  it("Zyklus mit Score wird zum Tageswert", () => {
    const d = mapCycle({
      id: 101,
      start: "2026-03-01T22:00:00.000Z",
      end: null,
      timezone_offset: "+02:00",
      score_state: "SCORED",
      score: { strain: 12.5, kilojoule: 9000, average_heart_rate: 70, max_heart_rate: 160 },
    });
    expect(d).toMatchObject({ source: "whoop", sourceId: "101", day: "2026-03-02", strain: 12.5, energyKj: 9000, endTime: null });
  });

  it("Zyklus zählt zum Tag des Aufwachens, auch wenn vor Mitternacht eingeschlafen", () => {
    const base = { score_state: "SCORED", timezone_offset: "+02:00", score: { strain: 10 } };
    // 22:30 Ortszeit eingeschlafen → nächster Tag
    expect(mapCycle({ ...base, id: 1, start: "2026-03-01T20:30:00.000Z" }).day).toBe("2026-03-02");
    // 01:15 Ortszeit eingeschlafen → derselbe Tag
    expect(mapCycle({ ...base, id: 2, start: "2026-03-01T23:15:00.000Z" }).day).toBe("2026-03-02");
    // 11:00 Ortszeit (z. B. Nachtschicht) → derselbe Tag
    expect(mapCycle({ ...base, id: 3, start: "2026-03-02T09:00:00.000Z" }).day).toBe("2026-03-02");
  });

  it("ungewertete Daten bleiben leer statt 0", () => {
    const d = mapCycle({ id: 1, start: "2026-03-01T06:00:00.000Z", score_state: "PENDING_SCORE" });
    expect(d.strain).toBeNull();
    const r = mapRecovery({ cycle_id: 1, score_state: "UNSCORABLE", score: { recovery_score: 50 } });
    expect(r.recoveryScore).toBeNull();
  });

  it("Recovery hängt am Zyklus", () => {
    const r = mapRecovery({
      cycle_id: 101,
      score_state: "SCORED",
      score: { recovery_score: 64, resting_heart_rate: 52, hrv_rmssd_milli: 61.2, spo2_percentage: 96, skin_temp_celsius: 33.4 },
    });
    expect(r).toEqual({ source: "whoop", dailySourceId: "101", recoveryScore: 64, restingHr: 52, hrvMs: 61.2, spo2Pct: 96, skinTempC: 33.4 });
  });

  it("Schlaf zählt zum Tag des Aufwachens, Phasen in Sekunden", () => {
    const s = mapSleep({
      id: "s-1",
      start: "2026-03-01T21:30:00.000Z",
      end: "2026-03-02T05:30:00.000Z",
      timezone_offset: "+01:00",
      nap: false,
      score_state: "SCORED",
      score: {
        stage_summary: {
          total_in_bed_time_milli: 28_800_000,
          total_awake_time_milli: 1_800_000,
          total_light_sleep_time_milli: 12_600_000,
          total_slow_wave_sleep_time_milli: 7_200_000,
          total_rem_sleep_time_milli: 7_200_000,
        },
        sleep_performance_percentage: 88,
        respiratory_rate: 15.2,
      },
    });
    expect(s).toMatchObject({ day: "2026-03-02", inBedS: 28_800, asleepS: 27_000, deepS: 7_200, performancePct: 88, isNap: false });
  });

  it("Workout mit Dauer aus Start und Ende", () => {
    const w = mapWorkout({
      id: "w-1",
      start: "2026-03-01T16:00:00.000Z",
      end: "2026-03-01T17:30:00.000Z",
      sport_name: "cycling",
      score_state: "SCORED",
      score: { strain: 14.1, kilojoule: 3000, distance_meter: 45000, average_heart_rate: 140, max_heart_rate: 172 },
    });
    expect(w).toMatchObject({ sourceId: "w-1", sport: "cycling", durationS: 5400, distanceM: 45000, avgPowerW: null });
  });
});

describe("Abgleich", () => {
  const NOW = Date.parse("2026-03-31T12:00:00.000Z");

  it("Erstabgleich holt 30 Tage, danach ab letztem Erfolg minus 3 Tage", () => {
    expect(syncWindow(null, NOW).start).toBe("2026-03-01T12:00:00.000Z");
    expect(syncWindow("2026-03-30T12:00:00.000Z", NOW).start).toBe("2026-03-27T12:00:00.000Z");
  });

  it("folgt next_token über alle Seiten", async () => {
    const seen: string[] = [];
    const f = (async (url: RequestInfo | URL) => {
      const u = new URL(String(url));
      seen.push(u.searchParams.get("nextToken") ?? "-");
      const body = u.searchParams.get("nextToken") ? { records: [{ id: 2 }], next_token: null } : { records: [{ id: 1 }], next_token: "p2" };
      return new Response(JSON.stringify(body));
    }) as typeof fetch;
    const rows = await fetchAll<{ id: number }>("t", "/v2/cycle", "a", "b", f);
    expect(rows.map((r) => r.id)).toEqual([1, 2]);
    expect(seen).toEqual(["-", "p2"]);
  });
});
