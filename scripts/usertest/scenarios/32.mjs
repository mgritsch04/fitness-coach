import { scenario, toolOk, deviceStep, D } from "./_auto.mjs";
export default scenario(32, "Leistungskurve, FTP-Schätzung und Trainingslast aus Leistung", "Trainingslast, FTP, Monatswerte (Werkzeuge)", [
  { action: "get_training_load: Form gerade?", expected: "Fitness, Ermüdung, Form, Form-Bereich; als Schätzung gekennzeichnet.",
    async run(t) { return toolOk(t, "get_training_load", {}, (p) => (p.current?.ctl != null && p.current.atl != null && p.current.tsb != null && p.current.formLabel ? `Fitness ${p.current.ctl}, Ermüdung ${p.current.atl}, Form ${p.current.tsb} (${p.current.formLabel}); Schätzung-Hinweis: ${/Schätz/i.test(JSON.stringify(p))}` : null)); } },
  { action: "get_fitness_profile: FTP und Zonen.", expected: "FTP mit Herkunft, 7 Leistungszonen, 5 Pulszonen.",
    async run(t) { return toolOk(t, "get_fitness_profile", {}, (p) => (p.ftp?.watts && p.ftp.origin && p.zones?.power?.length === 7 && p.zones?.hr?.length === 5 ? `FTP ${p.ftp.watts} W (Herkunft ${p.ftp.origin}), ${p.zones.power.length} Leistungszonen, ${p.zones.hr.length} Pulszonen` : null)); } },
  { action: "get_period_summaries (Monat).", expected: "Je Monat Stunden, Belastung, Erholung (grün/gelb/rot), Schlaf, Veränderung zum Vormonat.",
    async run(t) { return toolOk(t, "get_period_summaries", { period: "month" }, (p) => { const m = p.periods?.[p.periods.length - 2]; return m && m.trainingH != null && m.load != null && m.recoveryDays && m.avgSleepH != null && JSON.stringify(m).match(/vs|delta|previous|change/i) ? `${p.periods.length} Monate; z. B. ${m.period}: ${m.trainingH} h, Belastung ${m.load}, Erholung ${JSON.stringify(m.recoveryDays)}, Schlaf ${m.avgSleepH} h, vs. Vormonat vorhanden` : null; }); } },
  { action: "get_strain_recovery.", expected: "Mittelwerte der Erholung je Strain-Stufe und Erkenntnis als Beobachtung.",
    async run(t) { return toolOk(t, "get_strain_recovery", {}, (p) => (JSON.stringify(p).includes("Beobachtung") || p.byStrain || p.bands ? `Stufen vorhanden: ${Object.keys(p).join(", ")}; Hinweis „Beobachtung“: ${JSON.stringify(p).includes("Beobachtung")}` : null)); } },
  { action: "get_health_trends: HRV/Ruhepuls im Normalbereich? Einschlaf-/Aufwachzeit.", expected: "Status je Wert (normal/darunter/darüber) und mittlere Zeiten.",
    async run(t) { return toolOk(t, "get_health_trends", {}, (p) => (p.metrics?.hrv?.status && p.metrics?.rhr?.status ? `HRV ${p.metrics.hrv.status}, Ruhepuls ${p.metrics.rhr.status}; Schlafzeiten: ${JSON.stringify(p.sleepTiming ?? p.sleep ?? "").slice(0, 120)}` : null)); } },
  { action: "Optional: FTP per update_settings auf 250 W setzen, Profil erneut.", expected: "FTP 250 W, Herkunft „selbst gesetzt“.",
    async run(t) { await t.tool("update_settings", { ftpW: 250 }); return toolOk(t, "get_fitness_profile", {}, (p) => (p.ftp?.watts === 250 && /user|manual|selbst/i.test(p.ftp.origin) ? `FTP 250 W, Herkunft „${p.ftp.origin}“` : null)); } },
  deviceStep(7, "Antworten im echten Chat lesen (Neuer Chat in claude.ai).", "Claude formuliert die Antworten verständlich.", D.chat),
  deviceStep(8, "FTP-Schätzung mit echter MyWhoosh-/Wahoo-Fahrt.", "Schätzung passt zu den Fahrten.", D.whoop),
]);
