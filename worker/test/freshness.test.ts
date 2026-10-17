import { describe, expect, it } from "vitest";
import { buildDashboard } from "../src/core/dashboard";
import { agoText, dataFreshness, readLatestBySource } from "../src/core/freshness";
import { runBatched, setSyncState, upsertWorkout } from "../src/core/repository";
import { fakeD1 } from "./fake-d1";

// Alle Werte synthetisch, keine echten Messwerte.
const NOW = Date.parse("2026-03-10T08:00:00Z");
const hAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const sync = (h: number | null, error: string | null = null, attemptH = h) => ({ last_success_at: h == null ? null : hAgo(h), last_attempt_at: attemptH == null ? null : hAgo(attemptH), last_error: error });
const by = (f: ReturnType<typeof dataFreshness>, s: string) => f.sources.find((x) => x.source === s)!;

describe("Datenstand je Quelle (#212)", () => {
  it("frisch abgeglichen und neue Daten: alles ok, kein Hinweis", () => {
    const f = dataFreshness({ now: NOW, sync: { whoop: sync(1) }, latest: { whoop: hAgo(2), mywhoosh: hAgo(30) } });
    expect(by(f, "whoop")).toMatchObject({ level: "ok", ageH: 1, error: false, text: "abgeglichen vor 1 Stunde" });
    expect(by(f, "wahoo").level).toBe("none");
    expect(by(f, "mywhoosh")).toMatchObject({ level: "ok", text: "letzte Fahrt vor 30 Stunden" });
    expect(f.stale).toBe(false);
    expect(f.note).toBeNull();
  });

  it("WHOOP seit zwei Tagen nicht abgeglichen: veraltet, mit Hinweis", () => {
    const f = dataFreshness({ now: NOW, sync: { whoop: sync(50) }, latest: { whoop: hAgo(55) } });
    expect(by(f, "whoop")).toMatchObject({ level: "stale", ageH: 50 });
    expect(by(f, "whoop").text).toBe("abgeglichen vor 2 Tagen, neueste Daten vor 2 Tagen");
    expect(f.stale).toBe(true);
    expect(f.note).toContain("WHOOP");
  });

  it("Abgleich frisch, aber keine neue Nacht: veraltet wegen der Daten", () => {
    const f = dataFreshness({ now: NOW, sync: { whoop: sync(1) }, latest: { whoop: hAgo(40) } });
    expect(by(f, "whoop").level).toBe("stale");
    expect(by(f, "whoop").text).toContain("neueste Daten vor 2 Tagen");
  });

  it("fehlgeschlagener letzter Abgleich zählt als veraltet", () => {
    const f = dataFreshness({ now: NOW, sync: { whoop: sync(3, "401", 1) }, latest: { whoop: hAgo(4) } });
    expect(by(f, "whoop")).toMatchObject({ level: "stale", error: true });
    expect(by(f, "whoop").text).toContain("fehlgeschlagen");
  });

  it("MyWhoosh nach einer Woche ohne Upload: markiert, aber ohne Hinweis im Briefing", () => {
    const f = dataFreshness({ now: NOW, sync: { whoop: sync(1) }, latest: { whoop: hAgo(2), mywhoosh: hAgo(9 * 24) } });
    expect(by(f, "mywhoosh")).toMatchObject({ level: "stale", text: "letzte Fahrt vor 9 Tagen" });
    expect(f.stale).toBe(true);
    expect(f.note).toBeNull();
  });

  it("Zeittexte", () => {
    expect(agoText(0.2)).toBe("vor weniger als einer Stunde");
    expect(agoText(5)).toBe("vor 5 Stunden");
    expect(agoText(72)).toBe("vor 3 Tagen");
  });

  it("liest den jüngsten Datensatz je Quelle und liefert freshness in get_dashboard", async () => {
    const db = fakeD1();
    const w = (source: string, id: string, end: string) => upsertWorkout(db, {
      source, sourceId: id, day: end.slice(0, 10), startTime: end, endTime: end, sport: "cycling", durationS: 3600, distanceM: null, energyKj: null,
      avgHr: 120, maxHr: 150, avgPowerW: null, normalizedPowerW: null, strain: 8,
    } as never);
    await runBatched(db, [w("whoop", "a", hAgo(30)), w("whoop", "b", hAgo(5)), w("mywhoosh", "c", hAgo(48))]);
    expect(await readLatestBySource(db)).toEqual({ whoop: hAgo(5), mywhoosh: hAgo(48) });
    await setSyncState(db, "whoop", true, null, hAgo(2));
    const dash = await buildDashboard(db, { days: 7, now: NOW });
    expect(dash.freshness.sources.map((s) => `${s.source}:${s.level}`)).toEqual(["whoop:ok", "wahoo:none", "mywhoosh:ok"]);
  });
});
