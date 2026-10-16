import { describe, expect, it } from "vitest";
import { readWorkouts, runBatched, upsertWorkout } from "../src/core/repository";
import type { Env } from "../src/env";
import { tokensMatch, workoutFromWebhook } from "../src/providers/wahoo/webhook";
import { whoopSignatureValid } from "../src/providers/whoop/webhook";
import { d1WahooTokenStore } from "../src/store";
import { handleWahooWebhook, handleWhoopWebhook } from "../src/webhooks";
import { fakeD1 } from "./fake-d1";

// Synthetische Werte, keine echten Tokens oder Messwerte.
const TOKEN = "synthetic-webhook-token";
const SECRET = "synthetic-whoop-secret";

function env(db: D1Database, extra: Partial<Env> = {}): Env {
  return { DB: db, WHOOP_CLIENT_ID: "c", WHOOP_CLIENT_SECRET: SECRET, WAHOO_WEBHOOK_TOKEN: TOKEN, ...extra } as Env;
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://w.example${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers });

const wahooEvent = (token = TOKEN, userId = 77) => ({
  event_type: "workout_summary",
  webhook_token: token,
  user: { id: userId },
  workout_summary: { id: 900, distance_accum: "25000", duration_total_accum: "3000", power_avg: "180" },
  workout: { id: 555, starts: "2026-03-01T08:00:00.000Z", minutes: 50, workout_type_id: 12 },
});

async function connectedDb() {
  const db = fakeD1();
  await d1WahooTokenStore(db).connect("owner", "77", { accessToken: "a", refreshToken: "r", expiresAt: 0 });
  return db;
}

describe("Wahoo-Webhook", () => {
  it("speichert das gemeldete Workout", async () => {
    const db = await connectedDb();
    const res = await handleWahooWebhook(post("/webhooks/wahoo", wahooEvent()), env(db));
    expect(res.status).toBe(200);
    expect(await readWorkouts(db, "2026-01-01")).toEqual([
      expect.objectContaining({ source: "wahoo", source_id: "555", distance_m: 25000, duration_s: 3000, avg_power_w: 180 }),
    ]);
  });

  it("lehnt einen falschen Token ab", async () => {
    const db = await connectedDb();
    expect((await handleWahooWebhook(post("/webhooks/wahoo", wahooEvent("falsch")), env(db))).status).toBe(401);
    expect(await readWorkouts(db, "2026-01-01")).toHaveLength(0);
  });

  it("lehnt ab, solange kein Token eingerichtet ist", async () => {
    const db = await connectedDb();
    expect((await handleWahooWebhook(post("/webhooks/wahoo", wahooEvent()), env(db, { WAHOO_WEBHOOK_TOKEN: undefined }))).status).toBe(503);
  });

  it("ignoriert fremde Wahoo-Konten und kaputte Anfragen", async () => {
    const db = await connectedDb();
    expect((await handleWahooWebhook(post("/webhooks/wahoo", wahooEvent(TOKEN, 999)), env(db))).status).toBe(200);
    expect(await readWorkouts(db, "2026-01-01")).toHaveLength(0);
    expect((await handleWahooWebhook(post("/webhooks/wahoo", "{kaputt"), env(db))).status).toBe(400);
    expect((await handleWahooWebhook(new Request("https://w.example/webhooks/wahoo"), env(db))).status).toBe(400);
  });

  it("findet das Workout auch verschachtelt in der Zusammenfassung", () => {
    const e = wahooEvent();
    const nested = { ...e, workout: undefined, workout_summary: { ...e.workout_summary, workout: e.workout } };
    expect(workoutFromWebhook(nested)?.id).toBe(555);
    expect(workoutFromWebhook({ ...e, event_type: "other" })).toBeNull();
  });

  it("vergleicht Tokens exakt", () => {
    expect(tokensMatch(TOKEN, TOKEN)).toBe(true);
    expect(tokensMatch(TOKEN.slice(0, -1), TOKEN)).toBe(false);
    expect(tokensMatch(TOKEN + "x", TOKEN)).toBe(false);
  });
});

async function sign(timestamp: string, body: string, secret = SECRET) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + body)));
  return btoa(String.fromCharCode(...mac));
}

const ctx = { waitUntil: (p: Promise<unknown>) => void p.catch(() => undefined), passThroughOnException() {} } as unknown as ExecutionContext;

async function ownedDb() {
  const db = fakeD1();
  await db.prepare("INSERT INTO app_owner (id, whoop_user_id) VALUES (1, ?)").bind("10").run();
  return db;
}

describe("WHOOP-Webhook", () => {
  it("prüft die Signatur", async () => {
    const body = '{"user_id":10,"id":"x","type":"workout.updated"}';
    expect(await whoopSignatureValid(body, "1800000000000", await sign("1800000000000", body), SECRET)).toBe(true);
    expect(await whoopSignatureValid(body, "1800000000001", await sign("1800000000000", body), SECRET)).toBe(false);
    expect(await whoopSignatureValid(body, "1800000000000", await sign("1800000000000", body, "anders"), SECRET)).toBe(false);
    expect(await whoopSignatureValid(body, null, "abc", SECRET)).toBe(false);
    expect(await whoopSignatureValid(body, "1", "%%%", SECRET)).toBe(false);
  });

  it("löscht ein gelöschtes Workout, mit gültiger Signatur", async () => {
    const db = await ownedDb();
    await runBatched(db, [
      upsertWorkout(db, {
        source: "whoop", sourceId: "w-1", day: "2026-03-01", startTime: "2026-03-01T08:00:00.000Z", endTime: "2026-03-01T09:00:00.000Z",
        sport: "cycling", durationS: 3600, distanceM: null, energyKj: null, avgHr: null, maxHr: null, avgPowerW: null, normalizedPowerW: null, strain: 10,
      }),
    ]);
    const body = JSON.stringify({ user_id: 10, id: "w-1", type: "workout.deleted", trace_id: "t" });
    const unsigned = await handleWhoopWebhook(post("/webhooks/whoop", body), env(db), ctx);
    expect(unsigned.status).toBe(401);
    expect(await readWorkouts(db, "2026-01-01")).toHaveLength(1);
    const ts = "1800000000000";
    const headers = { "x-whoop-signature-timestamp": ts, "x-whoop-signature": await sign(ts, body) };
    expect((await handleWhoopWebhook(post("/webhooks/whoop", body, headers), env(db), ctx)).status).toBe(200);
    expect(await readWorkouts(db, "2026-01-01")).toHaveLength(0);
  });

  it("ignoriert Meldungen für ein fremdes WHOOP-Konto", async () => {
    const db = await ownedDb();
    const body = JSON.stringify({ user_id: 99, id: "w-1", type: "workout.deleted" });
    const ts = "1";
    const res = await handleWhoopWebhook(post("/webhooks/whoop", body, { "x-whoop-signature-timestamp": ts, "x-whoop-signature": await sign(ts, body) }), env(db), ctx);
    expect(res.status).toBe(200);
  });
});
