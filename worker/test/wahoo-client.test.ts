import { describe, expect, it } from "vitest";
import { authorizeUrl, validAccessToken, WahooAuthError, type WahooTokens, type WahooTokenStore } from "../src/providers/wahoo/client";

// Synthetische Werte, keine echten Tokens oder Messwerte.
const creds = { clientId: "test-client", clientSecret: "test-secret" };
const NOW = 1_800_000_000_000;

function memoryStore(initial?: WahooTokens): WahooTokenStore & { value?: WahooTokens } {
  const s: WahooTokenStore & { value?: WahooTokens } = {
    value: initial,
    async get() {
      return s.value ?? null;
    },
    async put(_id, t) {
      s.value = t;
    },
  };
  return s;
}

function tokenFetch(status: number, body: unknown) {
  const calls: { url: string; body: URLSearchParams }[] = [];
  const f = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: new URLSearchParams(init?.body as URLSearchParams) });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { f, calls };
}

describe("authorizeUrl", () => {
  it("fordert offline_data und workouts_read an", () => {
    const url = new URL(authorizeUrl(creds, "https://w.example/auth/wahoo/callback", "state-abc"));
    expect(url.origin + url.pathname).toBe("https://api.wahooligan.com/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe("user_read workouts_read offline_data");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("redirect_uri")).toBe("https://w.example/auth/wahoo/callback");
  });
});

describe("validAccessToken", () => {
  it("nutzt ein noch gültiges Token ohne Erneuerung", async () => {
    const store = memoryStore({ accessToken: "a1", refreshToken: "r1", expiresAt: NOW + 3_600_000 });
    const { f, calls } = tokenFetch(200, {});
    expect(await validAccessToken(creds, store, "owner", f, NOW)).toBe("a1");
    expect(calls).toHaveLength(0);
  });

  it("erneuert ein bald ablaufendes Token und speichert das neue Refresh-Token", async () => {
    const store = memoryStore({ accessToken: "a1", refreshToken: "r1", expiresAt: NOW + 30_000 });
    const { f, calls } = tokenFetch(200, { access_token: "a2", refresh_token: "r2", expires_in: 7200 });
    expect(await validAccessToken(creds, store, "owner", f, NOW)).toBe("a2");
    expect(calls[0].url).toBe("https://api.wahooligan.com/oauth/token");
    expect(calls[0].body.get("grant_type")).toBe("refresh_token");
    expect(calls[0].body.get("refresh_token")).toBe("r1");
    expect(store.value).toEqual({ accessToken: "a2", refreshToken: "r2", expiresAt: NOW + 7_200_000 });
  });

  it("meldet einen widerrufenen Zugang als WahooAuthError", async () => {
    const store = memoryStore({ accessToken: "a1", refreshToken: "r1", expiresAt: NOW - 1 });
    await expect(validAccessToken(creds, store, "owner", tokenFetch(401, {}).f, NOW)).rejects.toBeInstanceOf(WahooAuthError);
  });

  it("übernimmt ein parallel erneuertes Token, statt zu scheitern", async () => {
    const store = memoryStore({ accessToken: "a1", refreshToken: "r1", expiresAt: NOW - 1 });
    const f = (async () => {
      store.value = { accessToken: "a2", refreshToken: "r2", expiresAt: NOW + 7_200_000 };
      return new Response("{}", { status: 400 });
    }) as typeof fetch;
    expect(await validAccessToken(creds, store, "owner", f, NOW)).toBe("a2");
  });

  it("ohne gespeicherte Tokens: nicht verbunden", async () => {
    await expect(validAccessToken(creds, memoryStore(), "owner", tokenFetch(200, {}).f, NOW)).rejects.toThrow("nicht verbunden");
  });
});
