import { scenario } from "./_auto.mjs";
export default scenario(378, "Datensicherung: alle eigenen Daten als Download", "Alle Daten sichern", [
  { action: "„Alle Daten sichern“ auslösen.", expected: "Download einer Datei mit Workouts, Kraft, Tagebuch, Plänen, Notizen.",
    async run(t) {
      await t.tool("log_strength_session", { name: "Beine", exercises: [{ exercise: "Kniebeuge", sets: [{ reps: 5, weightKg: 80 }] }] });
      await t.tool("save_journal", { feeling: 4, notes: "Testeintrag" });
      await t.tool("save_plan", { accept: true });
      await t.tool("save_coach_note", { kind: "insight", body: "Testnotiz" });
      await t.open("mehr"); const sec = await t.section("export");
      await sec.getByRole("button", { name: /Alle Daten sichern/ }).click();
      await t.page.waitForFunction(() => /Einträge gesichert/.test([...document.querySelectorAll("#backupMsg")].map((e) => e.textContent).join(" ") ?? ""), null, { timeout: 10_000 }).catch(() => {});
      const saved = await t.page.evaluate(() => window.__saved ?? null);
      const f = saved && JSON.parse(saved.text); const c = f?.counts ?? {};
      const need = ["workouts", "strength_sessions", "journal", "training_plans", "coach_notes"];
      const miss = need.filter((k) => !(k in (f?.tables ?? {})));
      const msg = await sec.locator("#backupMsg:visible").first().innerText();
      return { status: saved && /\.json$/.test(saved.filename) && !miss.length && c.strength_sessions > 0 && c.journal > 0 && c.training_plans > 0 && c.coach_notes > 0 && /Einträge gesichert/.test(msg) ? "ok" : "fail",
        observed: `Meldung: „${msg.slice(-120)}“; Datei ${saved?.filename}, ${saved?.size} Bytes; Zeilen: workouts ${c.workouts}, Kraft ${c.strength_sessions}, Tagebuch ${c.journal}, Pläne ${c.training_plans}, Notizen ${c.coach_notes}; fehlt: ${miss.join(",") || "nichts"}`, locator: sec };
    } },
  { action: "Datei öffnen.", expected: "Einträge vollständig und lesbar (CSV/JSON).",
    async run(t) {
      const saved = await t.page.evaluate(() => window.__saved ?? null); const f = JSON.parse(saved.text);
      const live = await t.tool("export_backup", {});
      const same = Object.keys(live.counts).every((k) => f.counts[k] === live.counts[k] && f.tables[k].length === live.counts[k]);
      const secret = /access_token|refresh_token|client_secret/i.test(saved.text);
      return { status: same && !secret && f.tables.daily.length > 0 ? "ok" : "fail", observed: `Gültiges JSON, Zeilenzahlen je Tabelle stimmen mit der Datenbank überein: ${same}; Tokens in der Datei: ${secret}`, noFinalShot: true };
    } },
  { action: "Ohne Anmeldung/Token aufrufen.", expected: "Zugriff verweigert.",
    async run() {
      const { readFileSync } = await import("node:fs");
      const idx = readFileSync("worker/src/index.ts", "utf8"); const mcp = readFileSync("worker/src/mcp.ts", "utf8");
      const web = readFileSync("worker/src/index.ts", "utf8").match(/pathname === "[^"]+"/g) ?? [];
      const ok = /apiRoute: "\/mcp"/.test(idx) && /requiredScopes/.test(idx) && /registerBackupTools\(server, env\)/.test(mcp) && !web.some((w) => /backup/i.test(w));
      return { status: ok ? "ok" : "fail", observed: "Code-Prüfung: export_backup hängt nur am Connector (/mcp), den der OAuth-Provider mit Pflicht-Scope schützt; es gibt keine offene Web-Route dafür. Live gegen den deployten Worker erst nach Freigabe möglich.", noFinalShot: true };
    } },
]);
