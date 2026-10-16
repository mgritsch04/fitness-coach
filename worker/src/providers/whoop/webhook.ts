// WHOOP-Webhooks (Modell v2): {user_id, id, type, trace_id}, signiert mit dem Client-Secret.
// Signatur laut Doku: base64(HMAC-SHA256(Zeitstempel-Header + roher Body, Client-Secret)).
// Doku: https://developer.whoop.com/docs/developing/webhooks

export interface WhoopWebhookEvent {
  user_id: number | string;
  id: string;
  type: string;
  trace_id?: string;
}

export async function whoopSignatureValid(rawBody: string, timestamp: string | null, signature: string | null, secret: string): Promise<boolean> {
  if (!timestamp || !signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let sig: Uint8Array;
  try {
    sig = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  // crypto.subtle.verify vergleicht in konstanter Zeit.
  return crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(timestamp + rawBody));
}
