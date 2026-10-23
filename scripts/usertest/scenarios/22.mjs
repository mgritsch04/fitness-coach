import { scenario, deviceStep, toolOk, D } from "./_auto.mjs";
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
export default scenario(22, "Coach mit Gedächtnis: Ziele, Wochenplan, Plan-Ist-Abgleich", "Coach mit Gedächtnis", [
  { action: "Ziel eintragen: Radmarathon in ca. 10 Wochen, Priorität A.", expected: "Ziel wird bestätigt (set_goals).",
    async run(t) { return toolOk(t, "set_goals", { goals: [{ kind: "event", title: "Radmarathon (Test)", targetDate: inDays(70), priority: "A" }] }, (p) => (p.saved?.length === 1 ? `Ziel gespeichert: ${JSON.stringify(p.saved[0]).slice(0, 160)}` : null)); } },
  { action: "Vorlieben: 8 h/Woche, Sonntag Ruhetag, lange Fahrt Samstag, 2× Kraft.", expected: "Vorlieben gespeichert (set_training_prefs).",
    async run(t) { return toolOk(t, "set_training_prefs", { weeklyHours: 8, restDays: [6], longDay: 5, strengthPerWeek: 2 }, (p) => (JSON.stringify(p).includes("\"longDay\":5") ? "Vorlieben gespeichert (8 h, Ruhetag Sonntag, lange Fahrt Samstag, 2× Kraft)" : null)); } },
  { action: "Wochenplan für nächste Woche zeigen.", expected: "Montag–Sonntag, Phase „Aufbau“, Sonntag frei, Samstag lange Fahrt, 2 Krafteinheiten, keine am Tag vor Intervallen/langer Fahrt.",
    async run(t) { const mon = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
      return toolOk(t, "get_plan", { week: mon }, (p) => { const days = p.plan?.days ?? []; const sun = days.find((d) => d.day === new Date(new Date(mon).getTime() + 6 * 86400000).toISOString().slice(0, 10)); const sat = days.find((d) => d.day === new Date(new Date(mon).getTime() + 5 * 86400000).toISOString().slice(0, 10)); const kraft = days.filter((d) => d.strength).length; const dayAfter = (i) => days[i]; let conflict = false; days.forEach((d, i) => { if (d.strength && days[i + 1] && (days[i + 1].key && /Intervall|Schwelle|VO2|Lange/i.test(days[i + 1].title))) conflict = true; });
        return p.plan?.phase === "build" && sun?.type === "rest" && /Lange/i.test(sat?.title ?? "") && kraft === 2 && !conflict ? `Phase ${p.plan.phase}, So frei, Sa „${sat.title}“, ${kraft} Krafteinheiten, kein Konflikt` : `Phase ${p.plan?.phase}, So ${sun?.type}, Sa ${sat?.title}, Kraft ${kraft}, Konflikt ${conflict}` && null; }); } },
  { action: "Plan übernehmen und Erledigt-Status zeigen.", expected: "Plan gespeichert; vergangene Tage erledigt/teilweise/ausgefallen/extra passend zu echten Workouts.",
    async run(t) { await t.tool("save_plan", { accept: true }); return toolOk(t, "get_plan", {}, (p) => (p.stored && p.comparison ? `Plan gespeichert; Plan-Ist-Vergleich: ${JSON.stringify(p.comparison).slice(0, 300)}` : null)); } },
  deviceStep(5, "„Passt meine heutige Einheit zu meiner Erholung?“", "Claude vergleicht Plan mit Tagesform und schlägt bei schlechter Erholung Tausch vor.", D.chat),
  { action: "Coach-Notiz speichern, neuen Chat: „Was weißt du über meine Beine?“", expected: "Notiz ist noch da (get_coach_context).",
    async run(t) { await t.tool("save_coach_note", { kind: "insight", title: "Beine", body: "Kniebeugen machen mir gerade schwere Beine am Folgetag." }); return toolOk(t, "get_coach_context", {}, (p) => (JSON.stringify(p).includes("schwere Beine") ? "Notiz „schwere Beine“ im Coach-Kontext enthalten" : null)); } },
]);
