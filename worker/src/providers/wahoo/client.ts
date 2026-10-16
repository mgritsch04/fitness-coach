// Wahoo-Anbindung (offizielle Cloud API, OAuth 2.0). Nur hier steht Wahoo-spezifischer Code.
// Doku: https://cloud-api.wahooligan.com/ (Authentication, Workouts, Workout Summary)
import type { WahooWorkoutRaw } from "./map";

export const WAHOO_AUTH_URL = "https://api.wahooligan.com/oauth/authorize";
export const WAHOO_TOKEN_URL = "https://api.wahooligan.com/oauth/token";
export const WAHOO_API = "https://api.wahooligan.com";

/** `offline_data` liefert das Refresh-Token; Lesen von Profil und Workouts reicht. */
export const WAHOO_SCOPES = ["user_read", "workouts_read", "offline_data"];

export interface WahooCredentials {
  clientId: string;
  clientSecret: string;
}

export interface WahooTokens {
  accessToken: string;
  refreshToken: string;
  /** Ablaufzeit in ms seit Epoche. */
  expiresAt: number;
}

/** Speicher für die Wahoo-Tokens eines Besitzers (in Produktion D1, in Tests ein Objekt). */
export interface WahooTokenStore {
  get(ownerId: string): Promise<WahooTokens | null>;
  put(ownerId: string, tokens: WahooTokens): Promise<void>;
}

export class WahooAuthError extends Error {}

type Fetch = typeof fetch;

export function authorizeUrl(creds: WahooCredentials, redirectUri: string, state: string): string {
  const url = new URL(WAHOO_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", WAHOO_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

async function tokenRequest(params: Record<string, string>, f: Fetch, now: number): Promise<WahooTokens> {
  const res = await f(WAHOO_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  if (res.status === 400 || res.status === 401) throw new WahooAuthError(`Wahoo lehnt die Anmeldung ab (${res.status})`);
  if (!res.ok) throw new Error(`Wahoo-Token-Endpunkt antwortet ${res.status}`);
  const body = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  if (!body.refresh_token) throw new WahooAuthError("Wahoo hat kein Refresh-Token geliefert (Scope offline_data fehlt?)");
  return { accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: now + body.expires_in * 1000 };
}

export function exchangeCode(creds: WahooCredentials, code: string, redirectUri: string, f: Fetch = fetch, now = Date.now()) {
  return tokenRequest(
    { grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: creds.clientId, client_secret: creds.clientSecret },
    f,
    now,
  );
}

export function refreshTokens(creds: WahooCredentials, refreshToken: string, f: Fetch = fetch, now = Date.now()) {
  return tokenRequest(
    { grant_type: "refresh_token", refresh_token: refreshToken, client_id: creds.clientId, client_secret: creds.clientSecret },
    f,
    now,
  );
}

/**
 * Liefert ein gültiges Access-Token. Wahoo bittet, erst kurz vor einem Aufruf zu erneuern (sonst sammeln sich
 * offene Tokens an), daher erst unter einer Minute Restlaufzeit. Refresh-Tokens rotieren: das neue Paar wird
 * sofort gespeichert. Hat eine parallele Anfrage schon erneuert, wird deren Token übernommen.
 */
export async function validAccessToken(
  creds: WahooCredentials,
  store: WahooTokenStore,
  ownerId: string,
  f: Fetch = fetch,
  now = Date.now(),
): Promise<string> {
  const current = await store.get(ownerId);
  if (!current) throw new WahooAuthError("Wahoo ist nicht verbunden");
  if (current.expiresAt - now > 60_000) return current.accessToken;
  try {
    const next = await refreshTokens(creds, current.refreshToken, f, now);
    await store.put(ownerId, next);
    return next.accessToken;
  } catch (err) {
    const again = await store.get(ownerId);
    if (again && again.refreshToken !== current.refreshToken && again.expiresAt - now > 60_000) return again.accessToken;
    throw err;
  }
}

export async function wahooGet<T>(accessToken: string, path: string, f: Fetch = fetch): Promise<T> {
  const res = await f(`${WAHOO_API}${path}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (res.status === 401) throw new WahooAuthError("Wahoo-Token ungültig");
  if (res.status === 429) throw new Error("Wahoo-Anfragelimit erreicht, später noch einmal versuchen");
  if (!res.ok) throw new Error(`Wahoo-API ${path} antwortet ${res.status}`);
  return (await res.json()) as T;
}

export interface WahooUser {
  id: number;
  first?: string;
  last?: string;
}

export const getUser = (token: string, f?: Fetch) => wahooGet<WahooUser>(token, "/v1/user", f);

export interface WahooWorkoutPage {
  workouts: WahooWorkoutRaw[];
  total?: number;
  page?: number;
  per_page?: number;
}

export function listWorkouts(token: string, page = 1, perPage = 10, f?: Fetch) {
  return wahooGet<WahooWorkoutPage>(token, `/v1/workouts?page=${page}&per_page=${perPage}`, f);
}
