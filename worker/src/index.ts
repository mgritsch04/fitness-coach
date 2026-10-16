import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp/server";
import privacyMarkdown from "../../docs/PRIVACY.md";
import { handleAuthorize, handleWhoopCallback } from "./auth";
import { html, markdownToHtml } from "./html";
import { createServer } from "./mcp";
import { handleWahooCallback } from "./wahoo";
import type { AuthProps, Env } from "./env";
import { syncAll } from "./sync";

const WORKER_URL = "https://fitness-coach.fitness-coach-worker.workers.dev";

// Der Connector (/mcp) ist nur mit Anmeldung erreichbar. Alles andere (Anmeldeseiten, Datenschutz)
// läuft über den defaultHandler.
const mcpApi: ExportedHandler<Env> = {
  fetch(request, env, ctx) {
    const props = (ctx as ExecutionContext & { props: AuthProps }).props;
    const origin = new URL(request.url).origin;
    return createMcpHandler(() => createServer(env, props, origin))(request, env, ctx);
  },
};

const site: ExportedHandler<Env> = {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/authorize") return handleAuthorize(request, env);
    if (pathname === "/auth/whoop/callback") return handleWhoopCallback(request, env);
    if (pathname === "/auth/wahoo/callback") return handleWahooCallback(request, env, ctx);
    if (pathname === "/privacy") return html("Privacy Policy – Fitness Coach", markdownToHtml(privacyMarkdown));
    if (pathname === "/") return html("Fitness Coach", '<h1>Fitness Coach</h1><p>Private application. <a href="/privacy">Privacy Policy</a></p>');
    return new Response("Not found", { status: 404 });
  },
};

const provider = new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler: mcpApi as never,
  defaultHandler: site as never,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  clientIdMetadataDocumentEnabled: true,
  scopesSupported: ["fitness:read"],
  requiredScopes: ["fitness:read"],
  resourceMetadata: { resource: `${WORKER_URL}/mcp`, resource_name: "Fitness Coach" },
});

export default {
  fetch: (request, env, ctx) => provider.fetch(request, env, ctx),
  // Stündlicher Abgleich für den Besitzer (es gibt nur einen).
  async scheduled(_event, env) {
    const owner = await env.DB.prepare("SELECT whoop_user_id FROM app_owner WHERE id = 1").first<{ whoop_user_id: string }>();
    if (!owner) return;
    const { whoop, wahoo } = await syncAll(env, owner.whoop_user_id);
    if (!whoop.ok) throw new Error(`WHOOP-Abgleich: ${whoop.message}`);
    if (!wahoo.ok && wahoo.message !== "übersprungen") throw new Error(`Wahoo-Abgleich: ${wahoo.message}`);
  },
} satisfies ExportedHandler<Env>;
