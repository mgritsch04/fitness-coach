import { describe, expect, it } from "vitest";
import { getSyncState, readWorkouts } from "../src/core/repository";
import type { WahooTokens } from "../src/providers/wahoo/client";
import { mapWorkout, wahooDay, type WahooWorkoutRaw } from "../src/providers/wahoo/map";
import { syncWahoo } from "../src/providers/wahoo/sync";
import { consumeWahooLinkState, createWahooLinkState, d1WahooTokenStore } from "../src/store";
import { fakeD1 } from "./fake-d1";

// Synthetische Werte, keine echten Tokens oder Messwerte.
const creds = { clientId: "test-client", clientSecret: "test-secret" };
const NOW = Date.parse("2026-03-31T12:00:00.000Z");
const DAY = 86_400_000;

const ride = (id: number, daysAgo: number): WahooWorkoutRaw => ({
  id,
  starts: new Date(NOW - daysAgo * DAY).toISOString(),
  minutes: 60,
  workout_type_id: 12,
  workout_summary: { duration_total_accum: "3600", distance_accum: "30000", calories_accum: "700", heart_rate_avg: "141.6", power_avg: "200", power_bike_np_last: "215" },
});

describe("mapWorkout", () => {
  it("wandelt Strings in Zahlen, kcal in kJ und berechnet das Ende", () => {
    const w = mapWorkout({ ...ride(42, 0), starts: "2026-01-02T07:00:00.000Z" });
    expect(w).toEqual({
      source: "wahoo",
      sourceId: "42",
      day: "2026-01-02",
      startTime: "2026-01-02T07:00:00.000Z",
      endTime: "2026-01-02T08:00:00.000Z",
      sport: "cycling",
      durationS: 3600,
      distanceM: 30000,
      energyKj: 2929,
      avgHr: 142,
      maxHr: null,
      avgPowerW: 200,
      normalizedPowerW: 215,
      strain: null,
      avgCadenceRpm: null,
      tss: null,
    });
  });

  it("kommt ohne Zusammenfassung aus", () => {
    const w = mapWorkout({ id: 7, starts: "2026-01-03T18:00:00.000Z", minutes: "45", workout_type_id: 999 });
    expect(w).toMatchObject({ sport: null, durationS: 2700, distanceM: null, energyKj: null, endTime: "2026-01-03T18:45:00.000Z" });
  });

  it("nutzt die Zeitzone für den lokalen Tag", () => {
    expect(wahooDay("2026-01-02T23:30:00.000Z", "Europe/Berlin")).toBe("2026-01-03");
    expect(wahooDay("2026-01-02T23:30:00.000Z", "Kein/Ort")).toBe("2026-01-02");
    expect(wahooDay("2026-01-02T23:30:00.000Z", null)).toBe("2026-01-02");
  });
});

function setup() {
  const db = fakeD1();
  const store = d1WahooTokenStore(db);
  const tokens: WahooTokens = { accessToken: "a1", refreshToken: "r1", expiresAt: NOW + 7_200_000 };
  return { db, store, connect: () => store.connect("owner", "wahoo-1", tokens) };
}

function apiFetch(pages: WahooWorkoutRaw[][]) {
  const urls: string[] = [];
  const f = (async (url: RequestInfo | URL) => {
    urls.push(String(url));
    const page = Number(new URL(String(url)).searchParams.get("page"));
    return new Response(JSON.stringify({ workouts: pages[page - 1] ?? [] }));
  }) as typeof fetch;
  return { f, urls };
}

describe("syncWahoo", () => {
  it("Erstabgleich speichert die letzten 30 Tage und hört bei älteren Workouts auf", async () => {
    const { db, store, connect } = setup();
    await connect();
    const page1 = Array.from({ length: 30 }, (_, i) => ride(100 - i, i * 0.5));
    const page2 = [ride(60, 20), ride(59, 40), ride(58, 41)];
    const { f, urls } = apiFetch([page1, page2, [ride(1, 50)]]);
    const result = await syncWahoo(db, creds, store, "owner", { now: NOW, fetch: f });
    expect(result.workouts).toBe(31);
    expect(urls).toHaveLength(2);
    const rows = await readWorkouts(db, "2026-01-01");
    expect(rows).toHaveLength(31);
    expect(rows[0]).toMatchObject({ source: "wahoo", source_id: "100", sport: "cycling", avg_power_w: 200 });
    expect((await getSyncState(db, "wahoo"))?.last_success_at).toBe(new Date(NOW).toISOString());
  });

  it("erneuter Abgleich verdoppelt nichts", async () => {
    const { db, store, connect } = setup();
    await connect();
    const { f } = apiFetch([[ride(5, 1), ride(4, 2)]]);
    await syncWahoo(db, creds, store, "owner", { now: NOW, fetch: f });
    await syncWahoo(db, creds, store, "owner", { now: NOW + 3_600_000, fetch: f });
    expect(await readWorkouts(db, "2026-01-01")).toHaveLength(2);
  });

  it("merkt sich den Fehler, wenn Wahoo nicht verbunden ist", async () => {
    const { db, store } = setup();
    await expect(syncWahoo(db, creds, store, "owner", { now: NOW, fetch: apiFetch([]).f })).rejects.toThrow("nicht verbunden");
    expect(await getSyncState(db, "wahoo")).toMatchObject({ last_success_at: null, last_error: "Wahoo ist nicht verbunden" });
  });
});

describe("Wahoo-Einmal-Link", () => {
  it("lässt sich genau einmal und nur vor Ablauf einlösen", async () => {
    const db = fakeD1();
    const state = await createWahooLinkState(db, "owner", NOW);
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    expect(await consumeWahooLinkState(db, state, NOW + 60_000)).toBe("owner");
    expect(await consumeWahooLinkState(db, state, NOW + 60_000)).toBeNull();
    const late = await createWahooLinkState(db, "owner", NOW);
    expect(await consumeWahooLinkState(db, late, NOW + 16 * 60_000)).toBeNull();
    expect(await consumeWahooLinkState(db, "unbekannt", NOW)).toBeNull();
  });
});
