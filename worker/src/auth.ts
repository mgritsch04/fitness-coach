import { AuthorizationError, CimdFetchError, authorizationErrorRedirect, type ConsentDescription } from "@cloudflare/workers-oauth-provider";
import { authorizeUrl, exchangeCode, getProfile } from "./providers/whoop/client";
import { claimOrCheckOwner, d1WhoopTokenStore } from "./store";
import { escape, html } from "./html";
import type { AuthProps, Env } from "./env";

// Anmeldung für den Connector: claude.ai fragt hier nach Zugriff, du bestätigst und meldest dich
// bei WHOOP an. Der erste WHOOP-Account, der sich anmeldet, wird Besitzer; alle anderen werden abgewiesen.

const callbackUrl = (req: Request) => `${new URL(req.url).origin}/auth/whoop/callback`;

export async function handleAuthorize(req: Request, env: Env): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  try {
    if (req.method === "GET") {
      const authReq = await oauth.parseAuthRequest(req);
      const details = await oauth.describeConsent(authReq);
      const consent = await oauth.beginConsent(authReq);
      return html("Zugriff erlauben – Fitness Coach", consentBody(details, consent.handle), consent.headers);
    }
    if (req.method === "POST") {
      const form = await req.formData();
      const handle = String(form.get("handle") ?? "");
      if (form.get("decision") !== "approve") {
        const denied = await oauth.denyConsent(req, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      const approved = await oauth.approveConsent(req, handle);
      const { state, headers } = await oauth.beginUpstream(approved.request, { headers: approved.headers });
      headers.set("Location", authorizeUrl({ clientId: env.WHOOP_CLIENT_ID, clientSecret: env.WHOOP_CLIENT_SECRET }, callbackUrl(req), state));
      return new Response(null, { status: 302, headers });
    }
    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    return authErrorResponse(err);
  }
}

export async function handleWhoopCallback(req: Request, env: Env): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  const params = new URL(req.url).searchParams;
  try {
    const { request: original, headers } = await oauth.finishUpstream(req);
    const code = params.get("code");
    if (params.get("error") || !code) {
      headers.set("Location", authorizationErrorRedirect(original, "access_denied", "WHOOP-Anmeldung abgebrochen"));
      return new Response(null, { status: 302, headers });
    }
    const creds = { clientId: env.WHOOP_CLIENT_ID, clientSecret: env.WHOOP_CLIENT_SECRET };
    const tokens = await exchangeCode(creds, code, callbackUrl(req));
    const profile = await getProfile(tokens.accessToken);
    const whoopUserId = String(profile.user_id);
    if (!(await claimOrCheckOwner(env.DB, whoopUserId))) {
      return html("Kein Zugriff – Fitness Coach", "<h1>Kein Zugriff</h1><p>Dieser Fitness Coach gehört einem anderen WHOOP-Konto.</p>", headers, 403);
    }
    await d1WhoopTokenStore(env.DB).put(whoopUserId, tokens);
    const props: AuthProps = { whoopUserId };
    const { redirectTo } = await oauth.completeAuthorization({
      request: original,
      userId: whoopUserId,
      metadata: {},
      scope: original.scope,
      props,
    });
    headers.set("Location", redirectTo);
    return new Response(null, { status: 302, headers });
  } catch (err) {
    return authErrorResponse(err);
  }
}

function authErrorResponse(err: unknown): Response {
  if (err instanceof AuthorizationError && err.redirectTo) return Response.redirect(err.redirectTo, 302);
  if (err instanceof AuthorizationError || err instanceof CimdFetchError) {
    const message = err instanceof AuthorizationError ? err.description : "Diese App konnte nicht geprüft werden.";
    return html("Anmeldung fehlgeschlagen – Fitness Coach", `<h1>Anmeldung fehlgeschlagen</h1><p>${escape(message)}</p><p>Bitte die Verbindung in claude.ai neu starten.</p>`, undefined, 400);
  }
  throw err;
}

function consentBody(d: ConsentDescription, handle: string): string {
  const origin = d.clientDomain
    ? `Herausgeber: <strong>${escape(d.clientDomain)}</strong>.`
    : "Die App hat sich selbst registriert, ihr Name ist nicht geprüft.";
  const loopback = d.redirectIsLoopback
    ? "<p><strong>Achtung:</strong> Der Zugriff geht an ein Programm auf diesem Computer. Nur fortfahren, wenn du die Anmeldung gerade selbst dort gestartet hast.</p>"
    : "";
  return `<h1>${escape(d.clientName)} Zugriff auf deinen Fitness Coach erlauben?</h1>
<p>${origin} Der Zugriff geht an <strong>${escape(d.redirectHost)}</strong>.</p>
${loopback}
<p>Danach meldest du dich bei WHOOP an. Nur dein WHOOP-Konto hat Zugriff.</p>
<form method="post">
  <input type="hidden" name="handle" value="${escape(handle)}">
  <p><button name="decision" value="approve">Erlauben und bei WHOOP anmelden</button> <button name="decision" value="deny">Ablehnen</button></p>
</form>`;
}
