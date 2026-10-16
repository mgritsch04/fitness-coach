import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { addDays, todayIn } from "../src/core/analysis";
import { analyzeFtpTest, bestWindow, detect20, detectRamp, ftpHistory, ftpTestSuggestion } from "../src/core/ftp-test";
import { upsertWorkout, upsertWorkoutStream } from "../src/core/repository";
import { readSettings } from "../src/core/settings";
import type { Env } from "../src/env";
import { registerFtpTools } from "../src/ftp-tools";
import { fakeD1 } from "./fake-d1";

// Synthetische Leistungsreihen (1 Wert je Sekunde), keine echten Messwerte.
const flat = (s: number, w: number) => Array.from({ length: s }, () => w);
const wobble = (s: number, w: number, amp: number) => Array.from({ length: s }, (_, i) => w + Math.round(amp * Math.sin(i / 7)));
/** Ramp: 5 min Einfahren, dann je Minute +20 W ab 120 W bis 380 W, danach Ausrollen. */
const ramp = [...flat(300, 100), ...Array.from({ length: 14 }, (_, k) => flat(60, 120 + 20 * k)).flat(), ...flat(240, 80)];
/** 20-min-Test: 15 min Einfahren, 20 min um 280 W, 10 min locker. */
const twenty = [...wobble(900, 150, 30), ...wobble(1200, 280, 15), ...flat(600, 110)];
/** Normale Grundlagenfahrt. */
const endurance = wobble(3600, 180, 40);

describe("FTP-Test erkennen und auswerten", () => {
  it("bestes Fenster", () => {
    expect(bestWindow([1, 5, 5, 1], 2)).toEqual({ watts: 5, startS: 1 });
    expect(bestWindow([1], 2)).toBeNull();
  });

  it("Ramp-Test: 75 % der besten Minute", () => {
    expect(detectRamp(ramp)).toMatchObject({ ok: true });
    expect(detect20(ramp).ok).toBe(false);
    expect(analyzeFtpTest(ramp)).toMatchObject({ protocol: "ramp", detection: "auto", basisW: 380, ftpW: 285, factor: 0.75 });
  });

  it("20-min-Test: 95 % der besten 20 min", () => {
    expect(detectRamp(twenty).ok).toBe(false);
    const r = analyzeFtpTest(twenty);
    expect(r).toMatchObject({ protocol: "20min", detection: "auto" });
    expect(r.basisW).toBeGreaterThanOrEqual(279);
    expect(r.ftpW).toBe(Math.round(r.basisW! * 0.95));
  });

  it("normale Fahrt ist kein Test, außer das Protokoll wird vorgegeben", () => {
    expect(analyzeFtpTest(endurance).protocol).toBeNull();
    expect(analyzeFtpTest(endurance, "20min")).toMatchObject({ protocol: "20min", detection: "manual" });
    expect(analyzeFtpTest(null).message).toContain("keine Leistungsdaten");
    expect(analyzeFtpTest(flat(600, 200), "20min").ftpW).toBeNull();
  });

  it("Vorschlag nur ausgeruht und nach 6 Wochen", () => {
    expect(ftpTestSuggestion(5, null, "2026-03-31").suggest).toBe(true);
    expect(ftpTestSuggestion(-12, null, "2026-03-31").suggest).toBe(false);
    expect(ftpTestSuggestion(5, "2026-03-01", "2026-03-31")).toMatchObject({ suggest: false, daysSinceLastTest: 30 });
    expect(ftpTestSuggestion(5, "2026-02-01", "2026-03-31").suggest).toBe(true);
  });

  it("Verlauf mit W/kg und Veränderung", () => {
    const h = ftpHistory([
      { day: "2026-01-10", source: "mywhoosh", source_id: "a", protocol: "ramp", basis_w: 340, ftp_w: 255, weight_kg: 75, applied: 1, created_at: "" },
      { day: "2026-03-10", source: "mywhoosh", source_id: "b", protocol: "20min", basis_w: 280, ftp_w: 266, weight_kg: null, applied: 0, created_at: "" },
    ]);
    expect(h.map((t) => [t.ftpW, t.wattsPerKg, t.changeW, t.applied])).toEqual([[255, 3.4, null, true], [266, null, 11, false]]);
  });
});

function tools() {
  const db = fakeD1();
  const server = new McpServer({ name: "t", version: "0" });
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>>();
  const orig = server.registerTool.bind(server);
  (server as unknown as { registerTool: unknown }).registerTool = (name: string, cfg: unknown, cb: never) => {
    handlers.set(name, cb);
    return orig(name, cfg as never, cb);
  };
  registerFtpTools(server, { DB: db } as unknown as Env);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await handlers.get(name)!(args);
    return { error: r.isError ?? false, value: JSON.parse(r.content[0].text) };
  };
  return { db, handlers, call };
}

describe("FTP-Test-Werkzeuge", () => {
  it("auswerten, speichern mit Übernahme, Verlauf, löschen", async () => {
    const { db, handlers, call } = tools();
    expect([...handlers.keys()].sort()).toEqual(["analyze_ftp_test", "delete_ftp_test", "get_ftp_tests", "save_ftp_test"]);
    expect((await call("analyze_ftp_test")).error).toBe(true);

    const day = addDays(todayIn("Europe/Berlin"), -1);
    const start = `${day}T16:00:00.000Z`;
    await upsertWorkout(db, { source: "mywhoosh", sourceId: "r1", day, startTime: start, endTime: new Date(Date.parse(start) + ramp.length * 1000).toISOString(), sport: "cycling",
      durationS: ramp.length, distanceM: null, energyKj: null, avgHr: null, maxHr: null, avgPowerW: 200, normalizedPowerW: 240, strain: null }).run();
    await upsertWorkoutStream(db, { source: "mywhoosh", sourceId: "r1", startTime: start, power: ramp, heartRate: null, cadence: null, powerCurve: { 60: 380 } }).run();

    const a = await call("analyze_ftp_test");
    expect(a.value.workout).toMatchObject({ source: "mywhoosh", sourceId: "r1", day });
    expect(a.value.result).toMatchObject({ protocol: "ramp", ftpW: 285 });

    const s = await call("save_ftp_test", { source: "mywhoosh", sourceId: "r1", apply: true });
    expect(s.value.applied).toBe(true);
    expect(s.value.tests).toHaveLength(1);
    expect(s.value.current).toMatchObject({ ftpW: 285, origin: "user" });
    expect((await readSettings(db)).ftpW).toBe(285);

    const g = await call("get_ftp_tests");
    expect(g.value.suggestion).toMatchObject({ suggest: false, daysSinceLastTest: 1 });
    expect((await call("save_ftp_test", { source: "mywhoosh", sourceId: "nope" })).error).toBe(true);
    expect((await call("delete_ftp_test", { source: "mywhoosh", sourceId: "r1" })).value.deleted).toBe(true);
    expect((await call("get_ftp_tests")).value.tests).toEqual([]);
  });
});
