// Hilfe für Szenarien: Zustände, die sich mit den synthetischen Cloud-Testdaten nicht herstellen lassen, werden über den
// passenden Unit-Test des Workers belegt (vitest, wörtlicher Testname). Liefert { pass, line }.
import { execSync } from "node:child_process";

export function unit(file, name) {
  const cwd = new URL("../../../worker", import.meta.url).pathname;
  let out = "";
  try { out = execSync(`npx vitest run test/${file} --reporter=verbose 2>&1`, { cwd, encoding: "utf8" }); } catch (e) { out = String(e.stdout ?? e); }
  const line = out.split("\n").find((l) => l.includes(name)) ?? "";
  return { pass: /✓|√/.test(line) && !/✗|×|FAIL/.test(line) && /Tests\s+\d+ passed/.test(out) && !/\d+ failed/.test(out), line: line.trim().slice(0, 140) };
}
