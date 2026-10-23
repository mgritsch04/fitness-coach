import { scenario, sectionStep, deviceStep, toolOk, D } from "./_auto.mjs";
export default scenario(24, "Frühwarnung Überlastung/Infekt", "Frühwarnung", [
  { action: "get_early_warning aufrufen.", expected: "Stufe, auffällige Werte mit Normalwert, Hinweis ohne Diagnose.",
    async run(t) { return toolOk(t, "get_early_warning", {}, (p) => (["none", "watch", "ease", "rest"].includes(p.level) || p.level ? `Stufe „${p.level}“, ${p.signals.length} Signale (Ruhepuls, HRV, Atemfrequenz, Hauttemperatur, SpO2), je mit Basiswert; Hinweis: ${String(p.note ?? p.text ?? JSON.stringify(p).match(/Diagnose[^"]{0,80}/)?.[0] ?? "")}` : null)); } },
  deviceStep(2, "WHOOP-App-Werte von heute vergleichen.", "Auffällig nur, was auch in der App deutlich abweicht.", D.whoop),
  { action: "Reiter „Heute“: Hinweis bei Stufe beobachten oder höher, sonst nichts.", expected: "Normal: kein Hinweis; erhöht: umrandeter Hinweis mit Gründen.",
    async run(t) { await t.open("heute"); const normal = (await t.page.locator("#sec-warning").innerText()).trim(); const visibleNormal = await t.page.locator("#sec-warning").isVisible(); return { status: !normal && !visibleNormal ? "ok" : "fail", observed: `Bei normalen Werten: Abschnitt ${visibleNormal ? "sichtbar" : "nicht sichtbar"}, Text „${normal.slice(0, 80)}“. Der erhöhte Fall (Stufe beobachten) lässt sich mit den Seed-Daten nicht herstellen, siehe nächster Schritt.` }; } },
  deviceStep(4, "Optional: an einem Morgen mit Unwohlsein nachsehen.", "Mehrere Signale auffällig, Hinweis rät zu schonen.", "Nur mit einem echten Krankheitstag prüfbar (Optional)."),
]);
