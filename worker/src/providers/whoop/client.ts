// WHOOP-Anbindung (offizielle API, OAuth 2.0). Nur hier steht WHOOP-spezifischer Code.
// Doku: https://developer.whoop.com/docs/developing/oauth

export const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_API = "https://api.prod.whoop.com/developer";

export const WHOOP_SCOPES = [
  "offline",
  "read:profile",
  "read:recovery",
  "read:cycles",
  "read:sleep",
  "read:workout",
  "read:body_measurement",
];

export interface WhoopCredentials {
  clientId: string;
  clientSecret: string;
}

export interface WhoopTokens {
  accessToken: string;
  refreshToken: string;
  /** Ablaufzeit in ms seit Epoche. */
  expiresAt: number;
}

/** Speicher für die WHOOP-Tokens eines Nutzers (in Produktion D1, in Tests ein Objekt). */
export interface WhoopTokenStore {
  get(userId: string): Promise<WhoopTokens | null>;
  put(userId: string, tokens: WhoopTokens): Promise<void>;
}

export class WhoopAuthError extends Error {}

type Fetch = typeof fetch;

export function authorizeUrl(creds: WhoopCredentials, redirectUri: string, state: string): string {
  const url = new URL(WHOOP_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", WHOOP_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(params: Record<string, string>, f: Fetch, now: number): Promise<WhoopTokens> {
  const res = await f(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (res.status === 400 || res.status === 401) throw new WhoopAuthError(`WHOOP lehnt die Anmeldung ab (${res.status})`);
  if (!res.ok) throw new Error(`WHOOP-Token-Endpunkt antwortet ${res.status}`);
  const body = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  if (!body.refresh_token) throw new WhoopAuthError("WHOOP hat kein Refresh-Token geliefert (Scope offline fehlt?)");
  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: now + body.expires_in * 1000 };
}

export function exchangeCode(creds: WhoopCredentials, code: string, redirectUri: string, f: Fetch = fetch, now = Date.now()) {
  return tokenRequest(
    { grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: creds.clientId, client_secret: creds.clientSecret },
    f,
    now,
  );
}

export function refreshTokens(creds: WhoopCredentials, refreshToken: string, f: Fetch = fetch, now = Date.now()) {
  return tokenRequest(
    { grant_type: "refresh_token", refresh_token: refreshToken, client_id: creds.clientId, client_secret: creds.clientSecret, scope: "offline" },
    f,
    now,
  );
}

/**
 * Liefert ein gültiges Access-Token. Läuft es in weniger als einer Minute ab, wird es erneuert.
 * WHOOP rotiert Refresh-Tokens: Das neue Paar wird sofort gespeichert. Schlägt die Erneuerung fehl,
 * weil eine parallele Anfrage schon erneuert hat, wird das gespeicherte Token noch einmal gelesen.
 */
export async function validAccessToken(
  creds: WhoopCredentials,
  store: WhoopTokenStore,
  userId: string,
  f: Fetch = fetch,
  now = Date.now(),
): Promise<string> {
  const current = await store.get(userId);
  if (!current) throw new WhoopAuthError("WHOOP ist nicht verbunden");
  if (current.expiresAt - now > 60_000) return current.accessToken;
  try {
    const next = await refreshTokens(creds, current.refreshToken, f, now);
    await store.put(userId, next);
    return next.accessToken;
  } catch (err) {
    const again = await store.get(userId);
    if (again && again.refreshToken !== current.refreshToken && again.expiresAt - now > 60_000) return again.accessToken;
    throw err;
  }
}

export async function whoopGet<T>(accessToken: string, path: string, f: Fetch = fetch): Promise<T> {
  const res = await f(`${WHOOP_API}${path}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) throw new WhoopAuthError("WHOOP-Token ungültig");
  if (!res.ok) throw new Error(`WHOOP-API ${path} antwortet ${res.status}`);
  return (await res.json()) as T;
}

export interface WhoopProfile {
  user_id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export const getProfile = (token: string, f?: Fetch) => whoopGet<WhoopProfile>(token, "/v2/user/profile/basic", f);
