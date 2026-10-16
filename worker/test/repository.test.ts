import { describe, expect, it } from "vitest";
import { readDaily, readSleeps, runBatched, setSyncState, getSyncState, updateRecovery, upsertDaily, upsertSleep } from "../src/core/repository";
import { mapCycle, mapRecovery, mapSleep } from "../src/providers/whoop/map";
import { fakeD1 } from "./fake-d1";

describe("Repository", () => {
  it("erneuter Abgleich aktualisiert statt zu verdoppeln, Recovery landet am Tag", async () => {
    const db = fakeD1();
    const cycle = { id: 7, start: "2026-03-01T22:00:00.000Z", timezone_offset: "+02:00", score_state: "SCORED", score: { strain: 9 } };
    await runBatched(db, [upsertDaily(db, mapCycle(cycle))]);
    await runBatched(db, [
      upsertDaily(db, mapCycle({ ...cycle, score: { strain: 11 } })),
      updateRecovery(db, mapRecovery({ cycle_id: 7, score_state: "SCORED", score: { recovery_score: 70, hrv_rmssd_milli: 55 } })),
    ]);
    const rows = await readDaily(db, "2026-01-01");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: "2026-03-02", strain: 11, recovery_score: 70, hrv_ms: 55 });
  });

  it("Schlaf wird gespeichert und nach Tag gefiltert", async () => {
    const db = fakeD1();
    const sleep = mapSleep({ id: "s", start: "2026-03-01T22:00:00.000Z", end: "2026-03-02T06:00:00.000Z", nap: false, score_state: "PENDING_SCORE" });
    await runBatched(db, [upsertSleep(db, sleep)]);
    expect(await readSleeps(db, "2026-03-02")).toHaveLength(1);
    expect(await readSleeps(db, "2026-03-03")).toHaveLength(0);
  });

  it("Fehler überschreibt den letzten Erfolg nicht", async () => {
    const db = fakeD1();
    await setSyncState(db, "whoop", true, null, "2026-03-01T10:00:00.000Z");
    await setSyncState(db, "whoop", false, "kaputt", "2026-03-01T11:00:00.000Z");
    expect(await getSyncState(db, "whoop")).toEqual({
      last_success_at: "2026-03-01T10:00:00.000Z",
      last_attempt_at: "2026-03-01T11:00:00.000Z",
      last_error: "kaputt",
    });
  });
});
