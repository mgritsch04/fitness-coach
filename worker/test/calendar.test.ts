import { describe, expect, it } from "vitest";
import { buildIcs, createFeed, feedStatus, revokeFeed, verifyFeedToken } from "../src/core/calendar";
import { handleCalendarFeed } from "../src/calendar-feed";
import type { PlannedSession } from "../src/core/plan";
import type { Env } from "../src/env";
import { fakeD1 } from "./fake-d1";

const day = (d: string, over: Partial<PlannedSession>): PlannedSession => ({
  day: d, type: "endurance", title: "Grundlage Rad", durationMin: 90, targetLoad: 70, intensity: "Zone 2", description: "Locker, gleichmäßig.", key: false, strength: null, ...over,
});

describe("Kalender-Token", () => {
  it("erzeugt, prüft, ersetzt und sperrt den Link", async () => {
    const db = fakeD1();
    expect((await feedStatus(db)).active).toBe(false);
    const t1 = await createFeed(db);
    expect(t1).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await verifyFeedToken(db, t1)).toBe(true);
    expect(await verifyFeedToken(db, t1.slice(0, -1) + (t1.endsWith("A") ? "B" : "A"))).toBe(false);
    expect(await verifyFeedToken(db, "")).toBe(false);
    const t2 = await createFeed(db);
    expect(await verifyFeedToken(db, t1)).toBe(false);
    expect(await verifyFeedToken(db, t2)).toBe(true);
    await revokeFeed(db);
    expect(await verifyFeedToken(db, t2)).toBe(false);
  });
  it("speichert nur den Hash", async () => {
    const db = fakeD1();
    const t = await createFeed(db);
    const row = await db.prepare("SELECT token_hash FROM calendar_feed").first<{ token_hash: string }>();
    expect(row!.token_hash).not.toContain(t);
    expect(row!.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("buildIcs", () => {
  const ics = buildIcs(
    [day("2026-11-02", {}), day("2026-11-03", { type: "rest", title: "Ruhe" }), day("2026-11-04", { type: "strength", title: "Kraft Beine", durationMin: 45, strength: { durationMin: 45, focus: "Beine" } })],
    [{ day: "2026-11-04", focus: "Beine", durationMin: 45, text: "", exercises: [{ exercise: "back_squat", name: "Kniebeuge", sets: 4, reps: 6, unit: "Wdh", weightKg: 82.5, basis: "repeat", lastDay: null }] }],
    new Date("2026-11-01T10:00:00Z"),
  );
  it("ist ein gültiger Kalender mit Namen und CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Trainingsplan");
    expect(ics.replaceAll("\r\n", "").includes("\n")).toBe(false);
  });
  it("hat Einträge ohne Ruhetage, mit stabiler UID und Erinnerung", () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:fc-plan-2026-11-02@fitness-coach");
    expect(ics).not.toContain("2026-11-03");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261102");
    expect(ics).toContain("DTEND;VALUE=DATE:20261103");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics).toContain("SUMMARY:Rad: Grundlage Rad\\, 90 min");
    expect(ics.replaceAll("\r\n ", "")).toContain("Kniebeuge 4×6 82\\,5 kg");
  });
  it("faltet lange Zeilen auf höchstens 75 Byte", () => {
    const long = buildIcs([day("2026-11-02", { description: "ä".repeat(200) })], []);
    for (const l of long.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});

describe("Feed-Route", () => {
  it("liefert ohne gültiges Token 404", async () => {
    const env = { DB: fakeD1() } as unknown as Env;
    expect((await handleCalendarFeed("/calendar/abc.ics", env)).status).toBe(404);
    expect((await handleCalendarFeed("/calendar/", env)).status).toBe(404);
    const t = await createFeed(env.DB);
    expect((await handleCalendarFeed(`/calendar/${t}x.ics`, env)).status).toBe(404);
    expect((await handleCalendarFeed(`/calendar/${t}`, env)).status).toBe(404);
  });
  it("liefert mit Token den Kalender", async () => {
    const env = { DB: fakeD1() } as unknown as Env;
    const t = await createFeed(env.DB);
    const r = await handleCalendarFeed(`/calendar/${t}.ics`, env);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/calendar");
    const body = await r.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("BEGIN:VEVENT");
  });
});
