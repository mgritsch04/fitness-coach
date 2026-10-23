import { scenario, deviceStep, toolOk, D } from "./_auto.mjs";
const lvl = ["rest", "easy", "normal", "hard"];
export default scenario(23, "Tagebuch: Befinden, RPE, Muskelkater, Stress, Notizen, Tags", "Tagebuch und Empfehlung", [
  { action: "Empfehlung für heute abfragen.", expected: "Stufe Ruhe/Locker/Normal/Hart.",
    async run(t) { const p = await t.tool("get_coach_context"); t.base = p.readiness?.readiness; return /rest|easy|normal|hard/.test(String(t.base)) ? { status: "ok", observed: `Empfehlung vorher: ${t.base} (${p.readiness.headline})`, noFinalShot: true } : { status: "fail", observed: JSON.stringify(p.readiness) }; } },
  { action: "Tagebuch: Befinden 4, Energie 2, Muskelkater 5, Stress 2, Tag Reise.", expected: "Eintrag bestätigt (save_journal).",
    async run(t) { return toolOk(t, "save_journal", { mood: 4, energy: 2, soreness: 5, stress: 2, tags: ["reise"] }, (p) => (JSON.stringify(p).includes("reise") ? "Eintrag gespeichert" : null)); } },
  { action: "Empfehlung erneut abfragen.", expected: "Ein bis zwei Stufen leichter (nie härter); Gründe „Starker Muskelkater“, „Wenig Energie“.",
    async run(t) { const p = await t.tool("get_coach_context"); const now = p.readiness?.readiness; const txt = JSON.stringify(p.readiness); const ok = lvl.indexOf(now) <= lvl.indexOf(t.base) && lvl.indexOf(now) >= lvl.indexOf(t.base) - 2 && /Muskelkater/i.test(txt) && /Energie/i.test(txt); return { status: ok ? "ok" : "fail", observed: `${t.base} → ${now}; Gründe: ${(p.readiness?.reasons ?? []).map((r) => r.text).filter((x) => /Muskelkater|Energie/i.test(x)).join(" | ")}`, noFinalShot: true }; } },
  { action: "Tag „krank“ eintragen.", expected: "Empfehlung „Ruhe“ mit Hinweis bei Krankheitszeichen.",
    async run(t) { await t.tool("save_journal", { tags: ["krank"] }); const p = await t.tool("get_coach_context"); return { status: p.readiness?.readiness === "rest" && /krank|Krankheit/i.test(JSON.stringify(p.readiness)) ? "ok" : "fail", observed: `Empfehlung: ${p.readiness?.readiness} – ${p.readiness?.headline}`, noFinalShot: true }; } },
  { action: "Workout-RPE 8 speichern.", expected: "Anstrengung gespeichert; Session-RPE (Dauer × 8) beim Workout.",
    async run(t) { const w = (await t.tool("get_workouts", { days: 3 }))[0]; await t.tool("save_workout_rpe", { source: w.source, sourceId: w.source_id, rpe: 8 }); const j = await t.tool("get_journal"); return { status: JSON.stringify(j.rpe).includes("8") ? "ok" : "fail", observed: `RPE 8 für ${w.source}/${w.source_id} gespeichert: ${JSON.stringify(j.rpe).slice(0, 200)}`, noFinalShot: true }; } },
  { action: "Tagebucheintrag von heute löschen.", expected: "Eintrag entfernt.",
    async run(t) { await t.tool("save_journal", { remove: true }); const j = await t.tool("get_journal"); return { status: (j.entries ?? []).length === 0 ? "ok" : "fail", observed: `Einträge danach: ${(j.entries ?? []).length}`, noFinalShot: true }; } },
  deviceStep(7, "Im echten Chat nachfragen.", "Claude formuliert die Antworten.", D.chat),
]);
