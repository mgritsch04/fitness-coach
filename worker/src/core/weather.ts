// Wetter für Radfahrten draußen (#66): Open-Meteo-Vorhersage (offizielle API, ohne Schlüssel) je Stunde bewerten,
// bestes Zeitfenster für heute und morgen finden und mit der geplanten Einheit und der Tagesform zu einer Empfehlung verbinden.
// Bewertung und Empfehlung sind Faustregeln für Training, keine Wetterwarnung. Ort nur grob (eine Nachkommastelle).
import type { SessionType } from "./plan";

export interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
}

export interface WeatherHour {
  /** Ortszeit "YYYY-MM-DDTHH:00". */
  time: string;
  tempC: number | null;
  rainProb: number | null;
  rainMm: number | null;
  windKmh: number | null;
  gustKmh: number | null;
  code: number | null;
  isDay: boolean;
  score: number;
  /** Was die Bewertung drückt (leer, wenn nichts). */
  issues: string[];
}

export interface RideWindow {
  start: string;
  end: string;
  hours: number;
  score: number;
  rating: "gut" | "geht" | "schlecht";
  tempMin: number | null;
  tempMax: number | null;
  rainProbMax: number | null;
  windMax: number | null;
  issues: string[];
}

export interface DayWeather {
  day: string;
  best: RideWindow | null;
  hours: WeatherHour[];
}

const LOC_KEY = "weatherLocation";
export const round1 = (x: number) => Math.round(x * 10) / 10;

export async function readLocation(db: D1Database): Promise<WeatherLocation | null> {
  const r = await db.prepare("SELECT value FROM settings WHERE key = ?").bind(LOC_KEY).first<{ value: string }>();
  return r ? (JSON.parse(r.value) as WeatherLocation) : null;
}

export async function writeLocation(db: D1Database, loc: WeatherLocation | null) {
  if (!loc) {
    await db.prepare("DELETE FROM settings WHERE key = ?").bind(LOC_KEY).run();
    return null;
  }
  const v = { name: loc.name.slice(0, 80), lat: round1(loc.lat), lon: round1(loc.lon) };
  await db
    .prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(LOC_KEY, JSON.stringify(v))
    .run();
  return v;
}

export const GEOCODE_URL = (name: string) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=de&format=json`;
export const FORECAST_URL = (loc: WeatherLocation, tz: string) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
  "&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,weather_code,is_day" +
  `&timezone=${encodeURIComponent(tz)}&forecast_days=2&wind_speed_unit=kmh`;

/** Antwort der Geocoding-API → Ort (gerundet) oder null. */
export function parseGeocode(json: unknown): WeatherLocation | null {
  const r = (json as { results?: { name: string; latitude: number; longitude: number; admin1?: string; country?: string }[] })?.results?.[0];
  if (!r || typeof r.latitude !== "number") return null;
  return { name: [r.name, r.admin1 && r.admin1 !== r.name ? r.admin1 : null, r.country].filter(Boolean).join(", "), lat: round1(r.latitude), lon: round1(r.longitude) };
}

/** Antwort der Forecast-API → bewertete Stunden. */
export function parseForecast(json: unknown): WeatherHour[] {
  const h = (json as { hourly?: Record<string, unknown[]> })?.hourly;
  if (!h || !Array.isArray(h.time)) return [];
  const num = (k: string, i: number) => (typeof h[k]?.[i] === "number" ? (h[k][i] as number) : null);
  return h.time.map((t, i) => {
    const hour = {
      time: String(t),
      tempC: num("temperature_2m", i),
      rainProb: num("precipitation_probability", i),
      rainMm: num("precipitation", i),
      windKmh: num("wind_speed_10m", i),
      gustKmh: num("wind_gusts_10m", i),
      code: num("weather_code", i),
      isDay: num("is_day", i) !== 0,
    };
    return { ...hour, ...scoreHour(hour) };
  });
}

/** Bewertung 0–100 für eine Stunde auf dem Rennrad. */
export function scoreHour(h: Omit<WeatherHour, "score" | "issues">): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (!h.isDay) return { score: 0, issues: ["dunkel"] };
  let s = 100;
  // Temperatur stufenlos: unter 3 °C 0, ab 16 °C bis 24 °C voll, darüber wieder abnehmend.
  const t = h.tempC;
  if (t != null) {
    s = interp(t, [[3, 0], [8, 40], [12, 75], [16, 100], [24, 100], [28, 75], [32, 35]]);
    if (t < 3) issues.push("Glättegefahr/sehr kalt");
    else if (t < 8) issues.push("kalt");
    else if (t < 12) issues.push("frisch");
    else if (t > 30) issues.push("heiß");
    else if (t > 26) issues.push("warm");
  }
  const code = h.code ?? 0;
  if (code >= 95) { s = 0; issues.push("Gewitter"); }
  else if ((code >= 71 && code <= 77) || code === 85 || code === 86) { s = 0; issues.push("Schnee"); }
  else if (code === 45 || code === 48) { s *= 0.6; issues.push("Nebel"); }
  if (h.rainMm != null && h.rainMm >= 0.3) { s *= 0.2; issues.push("Regen"); }
  else if (h.rainProb != null && h.rainProb >= 30) { s *= 1 - (h.rainProb / 100) * 0.8; issues.push(`Regenrisiko ${Math.round(h.rainProb)} %`); }
  const w = h.windKmh ?? 0;
  if (w >= 35) { s *= 0.3; issues.push("Sturm"); }
  else if (w >= 25) { s *= 0.6; issues.push("starker Wind"); }
  else if (w >= 15) { s *= 0.85; issues.push("windig"); }
  if ((h.gustKmh ?? 0) >= 55) { s *= 0.4; issues.push("Böen"); }
  return { score: Math.round(s), issues };
}

function interp(x: number, pts: [number, number][]) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); }
  return pts.at(-1)![1];
}

const rating = (s: number): RideWindow["rating"] => (s >= 70 ? "gut" : s >= 45 ? "geht" : "schlecht");

/**
 * Bestes zusammenhängendes Fenster von `hours` Stunden an einem Tag (ab `from`, z. B. jetzt).
 * Maß: Mittel der Stundenwerte, die schwächste Stunde zieht stärker (Mittel aus Mittelwert und Minimum).
 */
export function bestWindow(all: readonly WeatherHour[], day: string, hours: number, from?: string): RideWindow | null {
  const list = all.filter((h) => h.time.startsWith(day) && (!from || h.time.slice(0, 13) >= from.slice(0, 13)));
  const n = Math.max(1, Math.min(8, Math.round(hours)));
  let best: { i: number; v: number } | null = null;
  for (let i = 0; i + n <= list.length; i++) {
    const w = list.slice(i, i + n);
    const v = (w.reduce((a, h) => a + h.score, 0) / n + Math.min(...w.map((h) => h.score))) / 2;
    if (!best || v > best.v) best = { i, v };
  }
  if (!best || best.v <= 0) return null;
  const w = list.slice(best.i, best.i + n);
  const vals = (k: "tempC" | "rainProb" | "windKmh") => w.map((h) => h[k]).filter((x): x is number => x != null);
  const temps = vals("tempC"), rain = vals("rainProb"), wind = vals("windKmh");
  const endHour = Number(w.at(-1)!.time.slice(11, 13)) + 1;
  return {
    start: w[0].time,
    end: `${day}T${String(endHour).padStart(2, "0")}:00`,
    hours: n,
    score: Math.round(best.v),
    rating: rating(best.v),
    tempMin: temps.length ? Math.round(Math.min(...temps)) : null,
    tempMax: temps.length ? Math.round(Math.max(...temps)) : null,
    rainProbMax: rain.length ? Math.round(Math.max(...rain)) : null,
    windMax: wind.length ? Math.round(Math.max(...wind)) : null,
    issues: [...new Set(w.flatMap((h) => h.issues))],
  };
}

export interface RideAdvice {
  verdict: "outside" | "indoor" | "rest" | "no_ride";
  text: string;
}

const INTERVALS: SessionType[] = ["tempo", "threshold", "vo2max"];
const RIDES: SessionType[] = ["recovery", "endurance", "long", "tempo", "threshold", "vo2max", "opener", "race"];
const hhmm = (t: string) => t.slice(11, 16);

/** Empfehlung aus Wetterfenster, geplanter Einheit und Tagesform (readiness aus der Tagesempfehlung). */
export function rideAdvice(win: RideWindow | null, planned: { type: SessionType; title: string } | null, readiness: string | null): RideAdvice {
  if (readiness === "rest") return { verdict: "rest", text: "Heute ist Erholung dran, das Wetter spielt keine Rolle." };
  if (planned && !RIDES.includes(planned.type)) return { verdict: "no_ride", text: `Heute ist keine Radeinheit geplant (${planned.title}).` };
  if (!win || win.rating === "schlecht") {
    const why = win?.issues.length ? ` (${win.issues.slice(0, 2).join(", ")})` : "";
    return { verdict: "indoor", text: `Heute lieber auf der Rolle${why}.` };
  }
  const temp = win.tempMin === win.tempMax ? `${win.tempMin ?? "?"}` : `${win.tempMin ?? "?"}–${win.tempMax ?? "?"}`;
  const when = `${hhmm(win.start)}–${hhmm(win.end)} Uhr, ${temp} °C, Regenrisiko bis ${win.rainProbMax ?? 0} %, Wind bis ${win.windMax ?? 0} km/h`;
  if (planned && INTERVALS.includes(planned.type)) {
    return { verdict: "indoor", text: `Draußen ginge es (${when}). Die Intervalle fährst du auf der Rolle aber gleichmäßiger. Wenn du raus willst, nimm stattdessen eine Grundlageneinheit.` };
  }
  return { verdict: "outside", text: `${win.rating === "gut" ? "Gutes Radwetter" : "Draußen fahren geht"}: ${when}.${win.issues.length ? ` Achte auf: ${win.issues.join(", ")}.` : ""}` };
}
