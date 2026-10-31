// HTTP-Route des Kalender-Abos (#373): GET /calendar/<token>.ics. Ohne gültiges Token immer 404 (kein Hinweis, ob es einen Feed gibt).
import { addDays, weekStart } from "./core/analysis";
import { buildDashboard } from "./core/dashboard";
import { buildIcs, verifyFeedToken } from "./core/calendar";
import { weekView } from "./core/training";
import type { Env } from "./env";

const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function handleCalendarFeed(pathname: string, env: Env): Promise<Response> {
  const m = /^\/calendar\/([A-Za-z0-9_-]+)\.ics$/.exec(pathname);
  if (!m || !(await verifyFeedToken(env.DB, m[1]))) return notFound();
  const dash = await buildDashboard(env.DB, { days: 56 });
  const ws = weekStart(dash.today);
  const next = await weekView(env.DB, dash, addDays(ws, 7));
  const days = [...dash.training.thisWeek.plan.days, ...next.plan.days];
  const ics = buildIcs(days, dash.training.strengthWorkouts.days);
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "private, max-age=300",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
    },
  });
}
