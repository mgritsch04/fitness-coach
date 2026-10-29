// Eigene schlanke Gym-Seite (#321): aus dashboard.html erzeugt, nur Gym-Modus und Krafttraining (Vorlagen, Übungsverlauf).
// Gleiche Daten wie das Haupt-Dashboard (Connector „Fitness Coach“), kein eigenes Speichern.
//   node artifact/dev/build-gym.mjs   → schreibt artifact/gym.html (nach jeder Änderung an dashboard.html neu erzeugen; die Vorschau prüft das)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const GYM_SECTIONS = ["gym", "exlist", "strength"];

export function buildGym(html) {
  const swap = (from, to) => { if (!html.includes(from)) throw new Error(`build-gym: „${from}“ fehlt in dashboard.html`); html = html.replace(from, to); };
  swap("<title>Fitness Coach</title>", "<title>Gym Tracker</title>");
  swap("<h1>Fitness Coach</h1>", "<h1>Gym</h1>");
  swap('<div class="date" id="date">Tageszustand, Trainingslast und Coach</div>', '<div class="date" id="date">Krafttraining tracken: Einheit starten, Sätze abhaken, Verlauf je Übung</div>');
  // Alle Abschnitts-Skripte raus, nur die für die Gym-Seite rein; Seite als Einzelseite ohne Reiter markieren.
  const tags = html.match(/<script src="sections\/[a-z0-9_-]+\.js"><\/script>\n/g) ?? [];
  if (!tags.length) throw new Error("build-gym: keine Abschnitte gefunden");
  html = html.replace(tags.join(""), GYM_SECTIONS.map((s) => `<script src="sections/${s}.js"></script>\n`).join(""));
  swap('<script src="app/core.js"></script>', '<script>document.documentElement.dataset.page = "single";</script>\n<script src="app/core.js"></script>');
  swap("<title>Gym Tracker</title>", "<title>Gym Tracker</title>\n<!-- Erzeugt aus dashboard.html mit artifact/dev/build-gym.mjs (#321). Nicht von Hand ändern. -->");
  return html;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..");
  writeFileSync(join(dir, "gym.html"), buildGym(readFileSync(join(dir, "dashboard.html"), "utf8")));
  console.log("artifact/gym.html geschrieben");
}
