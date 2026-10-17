#!/usr/bin/env node
/*
 * Testschritte aus einem Issue lesen (gleiches Format wie im Wohnungsplaner, PR #194 dort).
 *
 *   node scripts/usertest/steps.mjs <issue.json | issue.md>              # Schritte als JSON
 *   node scripts/usertest/steps.mjs <issue.json> --scaffold <nr> [title] # Gerüst scenarios/<nr>.mjs anlegen
 *
 * issue.json = { "title", "labels": [..], "body", "comments": [{ "body" }, ..] } (z. B. aus issue_read get + get_comments).
 * Feature-Issue mit Label auto-user-test: neuester Kommentar, der mit „## Testschritte“, „### Testschritte“ oder
 * „**Testschritte**“ beginnt. Altes [USERTEST]-Issue (oder kein solcher Kommentar): der Issue-Text.
 * Format: optional „**Voraussetzung:** …“, dann nummerierte Schritte, je Schritt darunter „→ Erwartet: …“;
 * Schritte mit „Optional:“ dürfen fehlen (im Szenario dann status skip).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HEAD = /^\s*(#{2,3}\s*Testschritte|\*\*Testschritte\*\*)/i;

/** Text mit den Testschritten wählen: neuester „Testschritte“-Kommentar, sonst der Issue-Text. */
export function stepSource(issue) {
  const c = [...(issue.comments ?? [])].reverse().find((x) => HEAD.test(x.body ?? ""));
  return c ? { from: "comment", text: c.body } : { from: "body", text: issue.body ?? "" };
}

/** { precondition, steps: [{ nr, action, expected, optional }] } */
export function parseSteps(text) {
  const out = { precondition: null, steps: [] };
  let cur = null;
  for (const raw of String(text).replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    const pre = line.match(/^\*\*Voraussetzung:?\*\*:?\s*(.*)$/i);
    if (pre) { out.precondition = pre[1].trim(); continue; }
    const step = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (step) {
      const action = step[2].trim();
      cur = { nr: Number(step[1]), action: action.replace(/^\*?Optional:\*?\s*/i, ""), expected: "", optional: /^\*?Optional:/i.test(action) };
      out.steps.push(cur);
      continue;
    }
    const exp = line.match(/^(?:[-*]\s*)?(?:→|->)\s*\*?\*?Erwartet:?\*?\*?:?\s*(.*)$/i);
    if (exp && cur) { cur.expected = [cur.expected, exp[1].trim()].filter(Boolean).join(" "); continue; }
    if (cur && line && !HEAD.test(line) && !/^#/.test(line) && !/^(Hinweis|Bitte)/i.test(line) && raw.startsWith(" ")) cur.action += ` ${line}`;
  }
  return out;
}

const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, ...rest] = process.argv.slice(2);
  if (!file) { console.error("Aufruf: node scripts/usertest/steps.mjs <issue.json | issue.md> [--scaffold <nr> [title]]"); process.exit(2); }
  const raw = readFileSync(file, "utf8");
  const issue = file.endsWith(".json") ? JSON.parse(raw) : { body: raw };
  const src = stepSource(issue);
  const parsed = { from: src.from, ...parseSteps(src.text) };
  const i = rest.indexOf("--scaffold");
  if (i < 0) { console.log(JSON.stringify(parsed, null, 2)); process.exit(0); }
  const nr = rest[i + 1], title = rest[i + 2] ?? issue.title ?? `#${nr}`;
  const target = join(here, "scenarios", `${nr}.mjs`);
  if (existsSync(target)) { console.error(`${target} gibt es schon`); process.exit(1); }
  const q = (s) => JSON.stringify(s);
  writeFileSync(target, `// ${title}${parsed.precondition ? `\n// Voraussetzung: ${parsed.precondition}` : ""}
// Gerüst aus scripts/usertest/steps.mjs: jeden Schritt ausprogrammieren (ok nur, wenn nachweislich geprüft).
export default {
  issue: ${nr},
  title: ${q(title)},
  name: ${q(String(title).replace(/^\\[USERTEST\\]\\s*/, ""))},
  device: "phone",
  steps: [
${parsed.steps.map((s) => `    {
      nr: ${s.nr},
      action: ${q(s.action)},
      expected: ${q(s.expected)},
      async run(t) {
        await t.open("heute");
        return { status: ${s.optional ? '"skip"' : '"look"'}, observed: "noch nicht automatisiert" };
      },
    },`).join("\n")}
  ],
};
`);
  console.log(`angelegt: ${target} (${parsed.steps.length} Schritte aus ${src.from === "comment" ? "Kommentar „Testschritte“" : "Issue-Text"})`);
}
