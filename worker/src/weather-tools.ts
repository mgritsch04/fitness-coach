// Connector-Werkzeuge für die Wetter-Empfehlung (#66): Ort setzen (Open-Meteo-Geocoding) und Radwetter für heute und morgen.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { addDays, DEFAULT_TIMEZONE, weekStart } from "./core/analysis";
import { buildDashboard } from "./core/dashboard";
import { weekView } from "./core/training";
import { bestWindow, clothingAdvice, FORECAST_URL, GEOCODE_URL, parseForecast, parseGeocodeAll, readLocation, rideAdvice, round1, writeLocation, type WeatherHour, type WeatherLocation } from "./core/weather";
import { indoorState, readIndoor } from "./core/indoor";
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
        "Ort für die Wetter-Empfehlung setzen: name (Ort, z. B. „Graz“) wird über die Open-Meteo-Suche aufgelöst, oder lat/lon direkt (mit name als Anzeigename). " +
        "Passt der Name zu mehreren Orten, wird nichts gespeichert: die Antwort enthält candidates (Name mit Region und Land, lat, lon); " +
        "den richtigen Treffer dann mit name, lat und lon dieses Treffers setzen (oder pick=1 für den ersten). " +
        "Gespeichert wird nur auf eine Nachkommastelle gerundet (ca. 10 km). clear=true löscht den Ort.",
      inputSchema: {
        name: z.string().min(2).max(80).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lon: z.number().min(-180).max(180).optional(),
        clear: z.boolean().optional(),
        pick: z.number().int().min(1).max(5).optional(),
      },
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ name, lat, lon, clear, pick }) => {
      if (clear) return json({ location: await writeLocation(db, null) });
      if (lat != null && lon != null) return json({ location: await writeLocation(db, { name: name ?? `${round1(lat)}, ${round1(lon)}`, lat, lon }) });
      if (!name) return fail("missing_location", "name oder lat und lon angeben.");
      let found: WeatherLocation[];
      try {
        found = parseGeocodeAll(await fetchJson(GEOCODE_URL(name)));
      } catch (err) {
        return fail("geocode_failed", (err as Error).message);
      }
      if (!found.length) return fail("not_found", `Ort „${name}“ nicht gefunden.`);
      // Mehrdeutig (#325): nicht raten, sondern Auswahl zurückgeben; gespeichert wird erst der gewählte Treffer.
      const loc = pick ? found[pick - 1] : found.length === 1 ? found[0] : null;
      if (pick && !loc) return fail("bad_pick", `Es gibt nur ${found.length} Treffer.`);
      if (!loc) return json({ location: null, candidates: found, message: `„${name}“ passt zu ${found.length} Orten. Bitte den richtigen wählen.` });
      return json({ location: await writeLocation(db, loc) });
    },
  );

  server.registerTool(
    "get_ride_weather",
    {
      description:
        "Radwetter für heute und morgen am eingestellten Ort (Open-Meteo): Stunden mit Bewertung 0–100, bestes Zeitfenster in Länge der geplanten Einheit, Kleidungsempfehlung (clothing: gefühlte Temperatur mit Fahrtwind, Stufe, Liste, Hinweise zu Regen und Licht) " +
        "und eine Empfehlung draußen oder Rolle, die Wochenplan und Tagesform berücksichtigt. Bewertung nach Faustregeln, keine Unwetterwarnung.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      const loc = await readLocation(db);
      if (!loc) return fail("no_location", "Noch kein Ort eingestellt (set_weather_location).");
      const dash = await buildDashboard(db, { days: 56 });
      const tz = dash.settings.timezone ?? DEFAULT_TIMEZONE;
      // Winterbetrieb (#326): Vorhersage zeigen, aber nicht zum Fahren draußen raten.
      const indoor = dash.indoor ?? indoorState(await readIndoor(db), dash.today);
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
        let advice = rideAdvice(best, planned, i === 0 ? dash.coach.readiness : null);
        if (indoor.active && (advice.verdict === "outside" || advice.verdict === "indoor")) advice = { verdict: "indoor", text: "Winterbetrieb: Radeinheiten auf der Rolle (MyWhoosh, ERG-Modus). Ventilator an und genug trinken." };
        out.push({
          day,
          planned,
          best,
          advice,
          // Kleidung (#224) nur, wenn draußen fahren überhaupt in Frage kommt (nicht im Winterbetrieb).
          clothing: !indoor.active && best && best.rating !== "schlecht" ? clothingAdvice(best, fc.hours.filter((h) => h.time.startsWith(day))) : null,
          hours: fc.hours.filter((h) => h.time.startsWith(day)),
        });
      }
      return json({ location: loc, timezone: tz, indoor, fetchedAt: fc.fetchedAt, source: "Open-Meteo (open-meteo.com, CC BY 4.0)", days: out,
        note: "Bewertung nach Faustregeln für Rennrad (Temperatur, Regen, Wind, Tageslicht); keine Unwetterwarnung." });
    },
  );
}
