import { describe, expect, it } from "vitest";
import { buildBikeWorkout, estimateLoad, toZwo, zwoFileName } from "../src/core/bike-workout";

describe("strukturierte Radeinheiten (#63)", () => {
  it("kein Rad an Ruhe- und Krafttagen", () => {
    expect(buildBikeWorkout("rest", 60)).toBeNull();
    expect(buildBikeWorkout("strength", 60)).toBeNull();
  });

  it("Grundlage füllt die geplante Dauer mit Zone 2", () => {
    const w = buildBikeWorkout("endurance", 90)!;
    expect(w.durationMin).toBe(90);
    expect(w.steps.map((s) => s.kind)).toEqual(["warmup", "steady", "cooldown"]);
    expect(w.steps[1].power).toBeCloseTo(0.68);
    expect(w.intensityFactor).toBeGreaterThan(0.6);
    expect(w.intensityFactor).toBeLessThan(0.75);
  });

  it("Schwelle: Wiederholungen passen in die Dauer, Rest in Grundlage", () => {
    const w = buildBikeWorkout("threshold", 75)!;
    const iv = w.steps.find((s) => s.kind === "intervals")!;
    expect(iv.repeat).toBe(3); // 75 − 15 − 10 = 50 min → 3 × 15 min, 5 min Grundlage
    expect(iv.onPower).toBeCloseTo(0.97);
    expect(w.durationMin).toBe(75);
    expect(w.steps.some((s) => s.kind === "steady" && s.durationS === 300)).toBe(true);
  });

  it("zu kurze Dauer wird für die Mindestzahl an Intervallen verlängert", () => {
    const w = buildBikeWorkout("vo2max", 30)!;
    expect(w.steps.find((s) => s.kind === "intervals")!.repeat).toBe(3);
    expect(w.durationMin).toBe(15 + 18 + 10);
  });

  it("Belastung: eine Stunde an der FTP ergibt 100", () => {
    expect(estimateLoad([{ kind: "steady", durationS: 3600, power: 1, label: "" }])).toEqual({ load: 100, intensityFactor: 1 });
  });

  it("ZWO enthält die Schritte in Reihenfolge und escaped Text", () => {
    const w = buildBikeWorkout("tempo", 75)!;
    const x = toZwo({ ...w, name: "A & B <C>" });
    expect(x).toContain("<sportType>bike</sportType>");
    expect(x).toContain("<name>A &amp; B &lt;C&gt;</name>");
    expect(x.indexOf("<Warmup")).toBeLessThan(x.indexOf("<IntervalsT"));
    expect(x.indexOf("<IntervalsT")).toBeLessThan(x.indexOf("<Cooldown"));
    expect(x).toMatch(/<IntervalsT Repeat="2" OnDuration="900" OffDuration="300" OnPower="0.85" OffPower="0.60"\/>/);
  });

  it("Dateiname ohne Umlaute", () => {
    expect(zwoFileName(buildBikeWorkout("recovery", 45)!, "2026-03-31")).toBe("2026-03-31-locker-ausrollen-45min.zwo");
  });
});
