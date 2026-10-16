import { describe, expect, it } from "vitest";
import { authorizeUrl, validAccessToken, WhoopAuthError, type WhoopTokens, type WhoopTokenStore } from "../src/providers/whoop/client";

// Synthetische Werte, keine echten Tokens.
const creds = { clientId: "test-client", clientSecret: "test-secret" };
const NOW = 1_800_000_000_000;

function memoryStore(initial?: WhoopTokens): WhoopTokenStore & { value?: WhoopTokens } {
  const s: WhoopTokenStore & { value?: WhoopTokens } = {
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
  const calls: URLSearchParams[] = [];
  const f = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new URLSearchParams(init?.body as URLSearchParams));
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { f, calls };
}

describe("authorizeUrl", () => {
  it("fordert offline und die Lese-Scopes an", () => {
    const url = new URL(authorizeUrl(creds, "https://w.example/auth/whoop/callback", "state-12345"));
    expect(url.searchParams.get("scope")).toContain("offline");
    expect(url.searchParams.get("scope")).toContain("read:recovery");
    expect(url.searchParams.get("state")).toBe("state-12345");
    expect(url.searchParams.get("redirect_uri")).toBe("https://w.example/auth/whoop/callback");
  });
});

describe("validAccessToken", () => {
  it("nutzt ein noch gültiges Token ohne Erneuerung", async () => {
    const store = memoryStore({ accessToken: "a1", refreshToken: "r1", expiresAt: NOW + 3_600_000 });
    const { f, calls } = tokenFetch(200, {});
    expect(await validAccessToken(creds, store, "u", f, NOW)).toBe("a1");
    expect(calls).toHaveLength(0);
  });

  it("erneuert ein bald ablaufendes Token und speichert das neue Refresh-Token", async () => {
    const store = memoryStore({ accessToken: "a1", refreshToken: "r1", expiresAt: NOW + 30_000 });
    const { f, calls } = tokenFetch(200, { access_token: "a2", refresh_token: "r2", expires_in: 3600 });
    expect(await validAccessToken(creds, store, "u", f, NOW)).toBe("a2");
    expect(calls[0].get("grant_type")).toBe("refresh_token");
    expect(calls[0].get("refresh_token")).toBe("r1");
    expect(store.value).toEqual({ accessToken: "a2", refreshToken: "r2", expiresAt: NOW + 3_600_000 });
  });

  it("meldet einen widerrufenen Zugang als WhoopAuthError", async () => {
    const store = memoryStore({ accessToken: "a1", refreshToken: "r1", expiresAt: NOW - 1 });
    const { f } = tokenFetch(400, { error: "invalid_grant" });
    await expect(validAccessToken(creds, store, "u", f, NOW)).rejects.toBeInstanceOf(WhoopAuthError);
  });

  it("übernimmt ein parallel erneuertes Token, statt zu scheitern", async () => {
    const store = memoryStore({ accessToken: "a1", refreshToken: "r1", expiresAt: NOW - 1 });
    const f = (async () => {
      store.value = { accessToken: "a2", refreshToken: "r2", expiresAt: NOW + 3_600_000 };
      return new Response("{}", { status: 400 });
    }) as typeof fetch;
    expect(await validAccessToken(creds, store, "u", f, NOW)).toBe("a2");
  });

  it("ohne gespeicherte Tokens: nicht verbunden", async () => {
    await expect(validAccessToken(creds, memoryStore(), "u", tokenFetch(200, {}).f, NOW)).rejects.toThrow("nicht verbunden");
  });
});
