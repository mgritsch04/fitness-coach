import { describe, expect, it } from "vitest";
import { classifyRider, riderProfile } from "../src/core/rider-profile";

// Synthetische Leistungswerte, keine echten Messwerte.
const TODAY = "2026-04-30";
const base = { previousCurve: {}, ftpW: 250, ftpOrigin: "user", weightKg: 70 };
/** Kurve aus Vielfachen der FTP (250 W). */
const curve = (s5: number, s60: number, s300: number, s1200 = 1.05) => ({ "5": s5 * 250, "60": s60 * 250, "300": s300 * 250, "1200": s1200 * 250 });

describe("Fahrertyp", () => {
  it("klassifiziert nach dem stärksten Bereich", () => {
    expect(classifyRider({ sprint: 120, anaerobic: 105, vo2: 95 })).toBe("sprinter");
    expect(classifyRider({ sprint: 100, anaerobic: 112, vo2: 100 })).toBe("puncheur");
    expect(classifyRider({ sprint: 96, anaerobic: 98, vo2: 110 })).toBe("climber");
    expect(classifyRider({ sprint: 85, anaerobic: 88, vo2: 92 })).toBe("timetrialist");
    expect(classifyRider({ sprint: 99, anaerobic: 102, vo2: 97 })).toBe("allrounder");
  });

  it("Punkte, W/kg, Schwäche und Trainingsvorschlag", () => {
    const r = riderProfile({ ...base, curve: curve(3.4, 2.3, 1.25), previousCurve: { "5": 800, "60": 560, "300": 300 } }, TODAY, 90);
    if (!r.available) throw new Error(r.reason);
    expect(r.type).toBe("puncheur");
    const [sprint, anaerobic, vo2] = r.durations;
    expect(sprint.score).toBe(82);
    expect(sprint.level).toBe("weak");
    expect(anaerobic.level).toBe("strong");
    expect(vo2.level).toBe("typical");
    expect(sprint.wattsPerKg).toBeCloseTo(12.14, 2);
    expect(anaerobic.changePct).toBeCloseTo(2.7, 1);
    expect(r.focus.key).toBe("sprint");
    expect(r.weaknesses).toEqual(["Sprint (5 s)"]);
    expect(r.hints).toHaveLength(0);
  });

  it("ohne Schwäche: Schwelle als Schwerpunkt; FTP-Plausibilität", () => {
    const r = riderProfile({ ...base, ftpOrigin: "data", curve: curve(4.2, 2.1, 1.2, 1.2) }, TODAY, 90);
    if (!r.available) throw new Error(r.reason);
    expect(r.type).toBe("allrounder");
    expect(r.focus.key).toBe("ftp");
    expect(r.hints.join(" ")).toMatch(/FTP um 285 W/);
    expect(r.hints.join(" ")).toMatch(/FTP ist geschätzt/);
  });

  it("ohne FTP oder fehlende Dauern", () => {
    expect(riderProfile({ ...base, ftpW: null, curve: curve(4, 2, 1.2) }, TODAY, 90)).toMatchObject({ available: false });
    const r = riderProfile({ ...base, curve: { "300": 300 } }, TODAY, 90);
    expect(r.available ? "" : r.reason).toMatch(/5 s, 1 min/);
  });
});
