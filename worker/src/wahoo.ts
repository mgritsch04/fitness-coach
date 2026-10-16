import { authorizeUrl, exchangeCode, getUser, WahooAuthError, type WahooCredentials } from "./providers/wahoo/client";
import { consumeWahooLinkState, createWahooLinkState, d1WahooTokenStore } from "./store";
import { escape, html } from "./html";
import type { Env } from "./env";

// Wahoo verbinden: Der Connector (schon über WHOOP angemeldet) erzeugt einen Einmal-Link. Wer ihn öffnet,
// meldet sich bei Wahoo an; die Tokens landen beim Besitzer. Ohne gültigen Link nimmt der Callback nichts an.

export const wahooCallbackUrl = (origin: string) => `${origin}/auth/wahoo/callback`;

export function wahooCredentials(env: Env): WahooCredentials | null {
  return env.WAHOO_CLIENT_ID && env.WAHOO_CLIENT_SECRET ? { clientId: env.WAHOO_CLIENT_ID, clientSecret: env.WAHOO_CLIENT_SECRET } : null;
}

export async function wahooConnectLink(env: Env, origin: string, ownerId: string): Promise<string | null> {
  const creds = wahooCredentials(env);
  if (!creds) return null;
  const state = await createWahooLinkState(env.DB, ownerId);
  return authorizeUrl(creds, wahooCallbackUrl(origin), state);
}

const page = (title: string, text: string, status = 200) =>
  html(`${title} – Fitness Coach`, `<h1>${escape(title)}</h1><p>${escape(text)}</p>`, undefined, status);

export async function handleWahooCallback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const ownerId = state ? await consumeWahooLinkState(env.DB, state) : null;
  if (!ownerId) return page("Link ungültig", "Dieser Wahoo-Link ist abgelaufen oder wurde schon benutzt. Bitte im Fitness Coach einen neuen anfordern.", 400);
  if (url.searchParams.get("error") || !code) return page("Abgebrochen", "Die Wahoo-Anmeldung wurde abgebrochen. Es wurde nichts verbunden.", 400);
  const creds = wahooCredentials(env);
  if (!creds) return page("Nicht eingerichtet", "Die Wahoo-Zugangsdaten fehlen im Worker.", 500);
  try {
    const tokens = await exchangeCode(creds, code, wahooCallbackUrl(url.origin));
    const user = await getUser(tokens.accessToken);
    await d1WahooTokenStore(env.DB).connect(ownerId, String(user.id), tokens);
    return page("Wahoo verbunden", "Fertig. Du kannst dieses Fenster schließen und zu Claude zurückgehen.");
  } catch (err) {
    if (err instanceof WahooAuthError) return page("Anmeldung fehlgeschlagen", err.message, 400);
    throw err;
  }
}
