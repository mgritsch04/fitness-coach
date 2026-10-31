// Kalender-Abo (#373): Wochenplan als iCalendar-Feed hinter einem geheimen Link.
// Serverseitig, damit das iPhone den Plan ohne geöffnetes Dashboard abonnieren kann.
// Datenschutz: nur Planinhalte (Titel, Dauer, Intensität in Worten, Übungen), keine Mess- oder Gesundheitswerte.
import type { PlannedSession } from "./plan";
import type { StrengthWorkout } from "./strength-plan";

const RIDES = ["recovery", "endurance", "long", "tempo", "threshold", "vo2max", "opener", "race"];

// ---------- Token ----------

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

export const newFeedToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Vergleich in konstanter Zeit (gleich lange Hex-Strings). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function feedStatus(db: D1Database): Promise<{ active: boolean; createdAt: string | null }> {
  const row = await db.prepare("SELECT created_at FROM calendar_feed WHERE id = 1").first<{ created_at: string }>();
  return { active: Boolean(row), createdAt: row?.created_at ?? null };
}

/** Legt einen neuen Link an; ein bisheriger wird damit ungültig. Das Token wird nur hier zurückgegeben. */
export async function createFeed(db: D1Database): Promise<string> {
  const token = newFeedToken();
  const hash = await hashToken(token);
  await db
    .prepare("INSERT INTO calendar_feed (id, token_hash, created_at) VALUES (1, ?, datetime('now')) ON CONFLICT (id) DO UPDATE SET token_hash = excluded.token_hash, created_at = excluded.created_at")
    .bind(hash)
    .run();
  return token;
}

export async function revokeFeed(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM calendar_feed WHERE id = 1").run();
}

export async function verifyFeedToken(db: D1Database, token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(token)) return false;
  const row = await db.prepare("SELECT token_hash FROM calendar_feed WHERE id = 1").first<{ token_hash: string }>();
  return Boolean(row) && safeEqual(row!.token_hash, await hashToken(token));
}

// ---------- iCalendar ----------

const esc = (v: unknown) => String(v ?? "").replace(/[\;,]/g, (c) => "\\" + c).replace(/\r?\n/g, "\\n");

/** Zeilen auf höchstens 74 Byte falten (Umlaute zählen doppelt), Folgezeilen beginnen mit Leerzeichen. */
function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "", n = 0;
  for (const c of line) {
    const b = enc.encode(c).length;
    if (n + b > 73) { out.push(cur); cur = ""; n = 0; }
    cur += c;
    n += b;
  }
  return [...out, cur].join("\r\n ");
}

const ymd = (day: string) => day.replaceAll("-", "");
const nextDay = (day: string) => { const x = new Date(day + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

const exerciseText = (e: StrengthWorkout["exercises"][number]) =>
  `${e.name} ${e.sets}×${e.reps}${e.unit === "s" ? " s" : ""}${e.weightKg != null ? ` ${String(e.weightKg).replace(".", ",")} kg` : ""}`;

/** Kalendereintrag eines Plantags (ganztägig, ohne Ruhetage). `kraft` = ausgearbeitete Krafteinheit, falls vorhanden. */
export function planEvent(x: PlannedSession, kraft: StrengthWorkout | undefined, stamp: string): string[] | null {
  if (x.type === "rest") return null;
  const head = x.type === "strength" ? "Kraft" : RIDES.includes(x.type) ? "Rad" : x.title.split(/[ -]/)[0];
  const extra = x.strength && x.type !== "strength" ? ` + Kraft ${x.strength.durationMin} min` : "";
  const desc = [
    x.intensity,
    x.description,
    kraft ? `Kraft: ${kraft.exercises.map(exerciseText).join(", ")}` : x.strength?.focus ? `Kraft: ${x.strength.focus}` : null,
    "Aus deinem Fitness-Coach-Wochenplan (Trainingsempfehlung, keine medizinische Diagnose).",
  ].filter(Boolean).join("\n");
  return [
    "BEGIN:VEVENT",
    `UID:fc-plan-${x.day}@fitness-coach`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(x.day)}`,
    `DTEND;VALUE=DATE:${ymd(nextDay(x.day))}`,
    `SUMMARY:${esc(`${head}: ${x.title}${x.durationMin ? `, ${x.durationMin} min` : ""}${extra}`)}`,
    `DESCRIPTION:${esc(desc)}`,
    "TRANSP:TRANSPARENT",
    // Erinnerung um 08:00 am Tag selbst (relativ zum Tagesbeginn).
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(`Heute: ${x.title}`)}`, "TRIGGER:PT8H", "END:VALARM",
    "END:VEVENT",
  ];
}

export function buildIcs(days: PlannedSession[], strength: StrengthWorkout[], now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const ev = days.map((d) => planEvent(d, strength.find((k) => k.day === d.day), stamp)).filter((e): e is string[] => e !== null);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fitness Coach//Wochenplan//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Trainingsplan", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
    ...ev.flat(),
    "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}
