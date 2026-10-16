import { McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { registerBodyTools } from "../src/body-tools";
import { addDays, todayIn } from "../src/core/analysis";
import { bodyReport, toCsv, weightByDay, type BodyRow } from "../src/core/body";
import { readLatestBody, upsertBody } from "../src/core/repository";
import type { Env } from "../src/env";
import { fakeD1 } from "./fake-d1";

// Synthetische Körperwerte, keine echten Messwerte.

const whoop = (day: string, kg: number): BodyRow => ({ source: "whoop", measured_at: day, height_m: 1.8, weight_kg: kg, max_hr: 190 });
const manual = (day: string, kg: number): BodyRow => ({ source: "manual", measured_at: day, height_m: null, weight_kg: kg, max_hr: null });

describe("Gewichtsverlauf", () => {
  const T = "2026-03-31";
  // 60 Tage lang 0,1 kg pro Tag weniger (0,7 kg pro Woche), dazu ein eigener Eintrag am letzten Tag.
  const rows: BodyRow[] = Array.from({ length: 60 }, (_, i) => whoop(addDays(T, i - 59), Number((80 - i * 0.1).toFixed(1))));
  rows.push(manual(T, 74));

  it("ein Wert je Tag, eigener Eintrag hat Vorrang", () => {
    const pts = weightByDay(rows);
    expect(pts).toHaveLength(60);
    expect(pts.at(-1)).toEqual({ day: T, weightKg: 74, source: "manual" });
  });

  it("Veränderung, Trend, BMI, W/kg und Ziel", () => {
    const r = bodyReport(rows, addDays(T, -29), T, { watts: 222, origin: "data" }, { title: "Wettkampfgewicht", targetValue: 72, targetDate: addDays(T, 28) });
    expect(r.points).toHaveLength(30);
    expect(r.summary.latest).toEqual({ day: T, weightKg: 74, source: "manual" });
    expect(r.summary.change7dKg).toBe(-0.8); // 74,8 → 74
    expect(r.summary.change90dKg).toBeNull();
    expect(r.summary.trendKgPerWeek).toBeLessThan(-0.6);
    expect(r.summary.bmi).toBe(22.8);
    expect(r.summary.manualEntries).toBe(1);
    expect(r.wattsPerKg).toEqual({ value: 3, ftpW: 222, ftpOrigin: "data" });
    expect(r.goal).toMatchObject({ remainingKg: -2, neededKgPerWeek: -0.5, onTrack: true });
    expect(r.notes.some((n) => n.includes("geschätzten FTP"))).toBe(true);
  });

  it("ohne Daten leer", () => {
    const r = bodyReport([], "2026-01-01", T, { watts: null, origin: "none" });
    expect(r.points).toEqual([]);
    expect(r.summary.latest).toBeNull();
    expect(r.wattsPerKg.value).toBeNull();
    expect(r.goal).toBeNull();
  });
});

describe("CSV", () => {
  it("Standard und deutsches Excel, Sonderzeichen und Formeln entschärft", () => {
    const rows = [{ a: 1.5, b: 'Rad "Ausfahrt", lang', c: null }, { a: 2, b: "=SUMME(A1)", c: "x" }];
    expect(toCsv(rows, ["a", "b", "c"])).toBe('a,b,c\r\n1.5,"Rad ""Ausfahrt"", lang",\r\n2,\'=SUMME(A1),x\r\n');
    expect(toCsv(rows, ["a", "c"], true)).toBe("a;c\r\n1,5;\r\n2;x\r\n");
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
  registerBodyTools(server, { DB: db } as unknown as Env);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await handlers.get(name)!(args);
    return { error: r.isError ?? false, value: JSON.parse(r.content[0].text) };
  };
  return { db, handlers, call };
}

describe("Körperwerte-Werkzeuge", () => {
  it("eintragen, lesen, exportieren, löschen", async () => {
    const { db, handlers, call } = tools();
    expect([...handlers.keys()].sort()).toEqual(["delete_weight", "export_csv", "get_body_history", "log_weight"]);
    const today = todayIn("Europe/Berlin");
    const y = addDays(today, -1);
    await upsertBody(db, { source: "whoop", measuredAt: y, heightM: 1.8, weightKg: 78, maxHr: 191 }).run();

    const saved = await call("log_weight", { weightKg: 77.25 });
    expect(saved.value.saved).toEqual({ day: today, weightKg: 77.25 });
    expect(saved.value.summary.latest).toMatchObject({ weightKg: 77.25, source: "manual" });
    expect((await call("log_weight", { weightKg: 77, day: addDays(today, 2) })).error).toBe(true);

    // Gewicht vom eigenen Eintrag, Größe und Maximalpuls weiter von WHOOP.
    expect(await readLatestBody(db)).toMatchObject({ weight_kg: 77.25, max_hr: 191, height_m: 1.8 });

    const csv = await call("export_csv", { dataset: "body", days: 7, excel: true });
    expect(csv.value.rows).toBe(2);
    expect(csv.value.csv.split("\r\n")[2]).toBe(`${today};manual;77,25;;`);

    expect((await call("delete_weight", { day: today })).value.deleted).toBe(true);
    expect((await call("delete_weight", { day: y })).value.deleted).toBe(false);
    expect(await readLatestBody(db)).toMatchObject({ weight_kg: 78, max_hr: 191 });
  });

  it("nur eigene Einträge: Gewicht trotzdem vorhanden", async () => {
    const { db, call } = tools();
    expect(await readLatestBody(db)).toBeNull();
    await call("log_weight", { weightKg: 70 });
    expect(await readLatestBody(db)).toMatchObject({ weight_kg: 70, max_hr: null });
  });
});
