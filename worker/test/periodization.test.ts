import { describe, expect, it } from "vitest";
import type { WeekSummary } from "../src/core/analysis";
import { blockView, buildBlock } from "../src/core/periodization";
import { buildWeekPlan } from "../src/core/plan";

const wk = (week: string, load: number) => ({ week, load } as WeekSummary);

describe("4-Wochen-Block", () => {
  it("Rampe: drei Aufbauwochen +5 %, dann Entlastung 60 %", () => {
    const b = buildBlock("2026-03-04", 40); // Mittwoch → Block ab Montag 2.3.
    expect(b.startWeek).toBe("2026-03-02");
    expect(b.weeks.map((w) => w.targetLoad)).toEqual([294, 308, 322, 168]);
    expect(b.weeks.map((w) => w.deload)).toEqual([false, false, false, true]);
  });
  it("Soll/Ist: zu wenig geschafft → Ziel gehalten", () => {
    const b = buildBlock("2026-03-02", 40);
    const v = blockView(b, [wk("2026-03-02", 150), wk("2026-03-09", 0)], "2026-03-11", null);
    expect(v.weeks[0]).toMatchObject({ status: "short", compliancePct: 51 });
    expect(v.weeks[1]).toMatchObject({ status: "current", targetLoad: 294 });
    expect(v.weeks[1].adjusted).toContain("51 %");
    expect(v.text).toContain("Woche 2 von 4");
  });
  it("Warnzeichen ziehen die Entlastung vor, danach endet der Block", () => {
    const b = buildBlock("2026-03-02", 40);
    const v = blockView(b, [wk("2026-03-02", 300)], "2026-03-04", "Ruhepuls erhöht");
    // Woche 1 läuft (zu früh für Entlastung), Woche 2 wird Entlastung.
    expect(v.weeks.map((w) => w.deload)).toEqual([false, true]);
    expect(v.weeks[1].adjusted).toContain("Ruhepuls erhöht");
    expect(v.text).toContain("Nächste Woche Entlastung");
    const later = blockView(b, [wk("2026-03-02", 300), wk("2026-03-09", 100)], "2026-03-11", "HRV niedrig");
    expect(later.current).toMatchObject({ index: 1, deload: true, targetLoad: 168 });
    expect(later.weeks).toHaveLength(2);
  });
  it("abgeschlossener Block", () => {
    const v = blockView(buildBlock("2026-03-02", 40), [], "2026-04-06", null);
    expect(v.current).toBeNull();
    expect(v.text).toContain("abgeschlossen");
  });
  it("Wochenplan übernimmt Blockziel und Entlastung", () => {
    const base = { weekStart: "2026-03-09", goals: [], prefs: { weeklyHours: 8, restDays: [], longDay: null, maxWeekdayMin: null, mainSport: "cycling", strengthPerWeek: 2, strengthMin: 45 }, weeks: [], ctl: 40, tsb: 0, ftpW: 250, thresholdHr: 170, maxHr: 190 } as unknown as Parameters<typeof buildWeekPlan>[0];
    const up = buildWeekPlan({ ...base, block: { targetLoad: 330, deload: false, label: "Block Woche 2" } });
    expect(up.targetLoad).toBe(330);
    expect(up.phaseReason).toContain("Block Woche 2");
    const down = buildWeekPlan({ ...base, block: { targetLoad: 168, deload: true, label: "Block Woche 4 (Entlastung)" } });
    expect(down.phase).toBe("recovery");
    expect(down.targetLoad).toBeLessThanOrEqual(168);
  });
});
