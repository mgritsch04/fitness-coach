import { deleteSleep, deleteWorkout, upsertWorkout } from "./core/repository";
import { mapWorkout } from "./providers/wahoo/map";
import { tokensMatch, workoutFromWebhook, type WahooWebhookPayload } from "./providers/wahoo/webhook";
import { d1WhoopTokenStore, ownerForWahooUser, ownerWhoopUserId } from "./store";
import { syncWhoop } from "./providers/whoop/sync";
import { whoopSignatureValid, type WhoopWebhookEvent } from "./providers/whoop/webhook";
import type { Env } from "./env";

// Webhooks holen neue Daten sofort; der stündliche Abgleich bleibt als Sicherheitsnetz.
// Antwort 2xx, sobald die Meldung geprüft ist; die Anbieter wiederholen sonst.

const text = (body: string, status: number) => new Response(body, { status, headers: { "content-type": "text/plain" } });
const MAX_BODY = 256 * 1024;

async function readBody(req: Request): Promise<string | null> {
  if (req.method !== "POST") return null;
  const body = await req.text();
  return body.length > MAX_BODY ? null : body;
}

export async function handleWahooWebhook(req: Request, env: Env): Promise<Response> {
  const body = await readBody(req);
  if (body === null) return text("Bad request", 400);
  if (!env.WAHOO_WEBHOOK_TOKEN) return text("Webhook not configured", 503);
  let payload: WahooWebhookPayload;
  try {
    payload = JSON.parse(body) as WahooWebhookPayload;
  } catch {
    return text("Bad request", 400);
  }
  if (typeof payload.webhook_token !== "string" || !tokensMatch(payload.webhook_token, env.WAHOO_WEBHOOK_TOKEN)) return text("Unauthorized", 401);

  const workout = workoutFromWebhook(payload);
  const ownerId = payload.user?.id != null ? await ownerForWahooUser(env.DB, String(payload.user.id)) : null;
  // Fremde Konten oder andere Ereignisse: annehmen und ignorieren, damit Wahoo nicht wiederholt.
  if (!workout || !ownerId) return text("Ignored", 200);
  await upsertWorkout(env.DB, mapWorkout(workout)).run();
  return text("OK", 200);
}

export async function handleWhoopWebhook(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const body = await readBody(req);
  if (body === null) return text("Bad request", 400);
  const valid = await whoopSignatureValid(
    body,
    req.headers.get("x-whoop-signature-timestamp"),
    req.headers.get("x-whoop-signature"),
    env.WHOOP_CLIENT_SECRET,
  );
  if (!valid) return text("Unauthorized", 401);
  let event: WhoopWebhookEvent;
  try {
    event = JSON.parse(body) as WhoopWebhookEvent;
  } catch {
    return text("Bad request", 400);
  }
  const ownerId = await ownerWhoopUserId(env.DB);
  if (!ownerId || String(event.user_id) !== ownerId || typeof event.type !== "string") return text("Ignored", 200);

  if (event.type === "workout.deleted") await deleteWorkout(env.DB, "whoop", String(event.id)).run();
  else if (event.type === "sleep.deleted") await deleteSleep(env.DB, "whoop", String(event.id)).run();
  else if (event.type.endsWith(".updated")) {
    // Kleiner Abgleich ab dem letzten Erfolg (mit Überlappung) holt den geänderten Datensatz samt Tag.
    const creds = { clientId: env.WHOOP_CLIENT_ID, clientSecret: env.WHOOP_CLIENT_SECRET };
    ctx.waitUntil(syncWhoop(env.DB, creds, d1WhoopTokenStore(env.DB), ownerId).catch(() => undefined));
  }
  return text("OK", 200);
}
