import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp/server";
import privacyMarkdown from "../../docs/PRIVACY.md";
import { handleAuthorize, handleWhoopCallback } from "./auth";
import { html, markdownToHtml } from "./html";
import { createServer } from "./mcp";
import type { AuthProps, Env } from "./env";

const WORKER_URL = "https://fitness-coach.fitness-coach-worker.workers.dev";

// Der Connector (/mcp) ist nur mit Anmeldung erreichbar. Alles andere (Anmeldeseiten, Datenschutz)
// läuft über den defaultHandler.
const mcpApi: ExportedHandler<Env> = {
  fetch(request, env, ctx) {
    const props = (ctx as ExecutionContext & { props: AuthProps }).props;
    return createMcpHandler(() => createServer(env, props))(request, env, ctx);
  },
};

const site: ExportedHandler<Env> = {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/authorize") return handleAuthorize(request, env);
    if (pathname === "/auth/whoop/callback") return handleWhoopCallback(request, env);
    if (pathname === "/privacy") return html("Privacy Policy – Fitness Coach", markdownToHtml(privacyMarkdown));
    if (pathname === "/") return html("Fitness Coach", '<h1>Fitness Coach</h1><p>Private application. <a href="/privacy">Privacy Policy</a></p>');
    return new Response("Not found", { status: 404 });
  },
};

export default new OAuthProvider<Env>({
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
