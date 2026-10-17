#!/usr/bin/env node
/*
 * Warteschlange der automatischen User-Tests: offene Feature-Issues mit Label auto-user-test, älteste zuerst.
 *
 *   node scripts/usertest/issues.mjs            # Liste (über `gh api`, in der Cloud über den Proxy)
 *   node scripts/usertest/issues.mjs list.json  # dasselbe aus einer gespeicherten Issue-Liste der GitHub-API
 *   node scripts/usertest/issues.mjs --json     # als JSON
 *
 * Je Issue: Nummer, Titel und ob es schon ein Szenario scenarios/<nr>.mjs gibt. Liest nur, ändert nichts.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "mgritsch04/fitness-coach";
const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));

function load() {
  if (file) return JSON.parse(readFileSync(file, "utf8"));
  const all = [];
  for (let page = 1; page < 10; page++) {
    const out = execFileSync("gh", ["api", `repos/${REPO}/issues?state=open&labels=auto-user-test&per_page=100&page=${page}`], { encoding: "utf8" });
    const rows = JSON.parse(out);
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all;
}

const queue = load()
  .filter((i) => !i.pull_request && i.labels.some((l) => (l.name ?? l) === "auto-user-test"))
  .sort((a, b) => a.number - b.number)
  .map((i) => ({ nr: i.number, title: i.title, scenario: existsSync(join(here, "scenarios", `${i.number}.mjs`)) }));

if (args.includes("--json")) console.log(JSON.stringify(queue, null, 2));
else {
  for (const q of queue) console.log(`#${q.nr}\t${q.scenario ? "Szenario da" : "ohne Szenario"}\t${q.title}`);
  console.log(`${queue.length} offen, davon ${queue.filter((q) => q.scenario).length} mit Szenario`);
}
