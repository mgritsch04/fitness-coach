// Connector-Werkzeuge für die Wetter-Empfehlung (#66): Ort setzen (Open-Meteo-Geocoding) und Radwetter für heute und morgen.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { addDays, DEFAULT_TIMEZONE, weekStart } from "./core/analysis";
import { buildDashboard } from "./core/dashboard";
import { weekView } from "./core/training";
import { bestWindow, FORECAST_URL, GEOCODE_URL, parseForecast, parseGeocode, readLocation, rideAdvice, round1, writeLocation, type WeatherHour, type WeatherLocation } from "./core/weather";
import type { Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (error: string, message: string) => ({ ...json({ error, message }), isError: true });

const CACHE_TTL_S = 1800;

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "fitness-coach (privat)" } });
  if (!r.ok) throw new Error(`Open-Meteo antwortet mit ${r.status}`);
  return r.json();
}

export function registerWeatherTools(server: McpServer, env: Env, fetchJson: (url: string) => Promise<unknown> = getJson) {
  const db = env.DB;

  // Vorhersage je Ort 30 min im KV zwischenspeichern (Open-Meteo aktualisiert stündlich).
  async function forecast(loc: WeatherLocation, tz: string): Promise<{ hours: WeatherHour[]; fetchedAt: string }> {
    const key = `weather:${loc.lat}:${loc.lon}:${tz}`;
    const hit = await env.OAUTH_KV?.get(key, "json").catch(() => null) as { raw: unknown; fetchedAt: string } | null;
    if (hit) return { hours: parseForecast(hit.raw), fetchedAt: hit.fetchedAt };
    const raw = await fetchJson(FORECAST_URL(loc, tz));
    const fetchedAt = new Date().toISOString();
    await env.OAUTH_KV?.put(key, JSON.stringify({ raw, fetchedAt }), { expirationTtl: CACHE_TTL_S }).catch(() => {});
    return { hours: parseForecast(raw), fetchedAt };
  }

  server.registerTool(
    "set_weather_location",
    {
      description:
        "Ort für die Wetter-Empfehlung setzen: name (Ort, z. B. „Graz“) wird über die Open-Meteo-Suche aufgelöst, oder lat/lon direkt. " +
        "Gespeichert wird nur auf eine Nachkommastelle gerundet (ca. 10 km). clear=true löscht den Ort.",
      inputSchema: {
        name: z.string().min(2).max(80).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lon: z.number().min(-180).max(180).optional(),
        clear: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ name, lat, lon, clear }) => {
      if (clear) return json({ location: await writeLocation(db, null) });
      if (lat != null && lon != null) return json({ location: await writeLocation(db, { name: name ?? `${round1(lat)}, ${round1(lon)}`, lat, lon }) });
      if (!name) return fail("missing_location", "name oder lat und lon angeben.");
      let loc: WeatherLocation | null;
      try {
        loc = parseGeocode(await fetchJson(GEOCODE_URL(name)));
      } catch (err) {
        return fail("geocode_failed", (err as Error).message);
      }
      if (!loc) return fail("not_found", `Ort „${name}“ nicht gefunden.`);
      return json({ location: await writeLocation(db, loc) });
    },
  );

  server.registerTool(
    "get_ride_weather",
    {
      description:
        "Radwetter für heute und morgen am eingestellten Ort (Open-Meteo): Stunden mit Bewertung 0–100, bestes Zeitfenster in Länge der geplanten Einheit " +
        "und eine Empfehlung draußen oder Rolle, die Wochenplan und Tagesform berücksichtigt. Bewertung nach Faustregeln, keine Unwetterwarnung.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      const loc = await readLocation(db);
      if (!loc) return fail("no_location", "Noch kein Ort eingestellt (set_weather_location).");
      const dash = await buildDashboard(db, { days: 56 });
      const tz = dash.settings.timezone ?? DEFAULT_TIMEZONE;
      let fc;
      try {
        fc = await forecast(loc, tz);
      } catch (err) {
        return fail("forecast_failed", (err as Error).message);
      }
      // Jetzt in Ortszeit, um vergangene Stunden von heute auszulassen.
      const now = new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).format(new Date()).replace(" ", "T");
      const days = [dash.today, addDays(dash.today, 1)];
      const views = new Map<string, Awaited<ReturnType<typeof weekView>>>();
      const out = [];
      for (const [i, day] of days.entries()) {
        const ws = weekStart(day);
        if (!views.has(ws)) views.set(ws, await weekView(db, dash, ws));
        const s = views.get(ws)!.plan.days.find((x) => x.day === day) ?? null;
        const planned = s && { type: s.type, title: s.title, durationMin: s.durationMin };
        const hours = Math.ceil(Math.max(60, Math.min(360, planned?.durationMin || 120)) / 60);
        const best = bestWindow(fc.hours, day, hours, i === 0 ? now : undefined);
        out.push({
          day,
          planned,
          best,
          advice: rideAdvice(best, planned, i === 0 ? dash.coach.readiness : null),
          hours: fc.hours.filter((h) => h.time.startsWith(day)),
        });
      }
      return json({ location: loc, timezone: tz, fetchedAt: fc.fetchedAt, source: "Open-Meteo (open-meteo.com, CC BY 4.0)", days: out,
        note: "Bewertung nach Faustregeln für Rennrad (Temperatur, Regen, Wind, Tageslicht); keine Unwetterwarnung." });
    },
  );
}
