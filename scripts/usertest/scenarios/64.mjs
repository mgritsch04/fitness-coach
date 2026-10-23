import { scenario, deviceStep, D } from "./_auto.mjs";
export default scenario(64, "FTP-Test-Assistent", "FTP-Test-Assistent", [
  { action: "Abschnitt „FTP-Tests“ ansehen.", expected: "Sagt, ob ein guter Zeitpunkt ist (ausgeruht, letzter Test ≥ 6 Wochen).",
    async run(t) { await t.open("training"); const sec = await t.section("ftp"); const txt = (await sec.innerText()).replace(/\s+/g, " "); return { status: /(Kein Test nötig|Test ist fällig|Guter Zeitpunkt|ausgeruht)/i.test(txt) ? "ok" : "fail", observed: `Hinweis: „${txt.slice(0, 260)}“`, locator: sec }; } },
  { action: "Ramp-Test-FIT hochladen.", expected: "Datei hochgeladen.",
    async run(t) { const fit = await t.fit({ start: new Date().toISOString().slice(0, 10) + "T01:00:00Z", shape: "ramp" }); const p = await t.tool("import_fit", { fileName: "ut-ramp.fit", fileBase64: fit }); return { status: JSON.stringify(p).length > 20 ? "ok" : "fail", observed: `import_fit: ${JSON.stringify(p).slice(0, 200)}`, noFinalShot: true }; } },
  { action: "„Neueste Fahrt als Test auswerten“.", expected: "Protokoll erkannt, FTP passt ungefähr zu MyWhoosh.",
    async run(t) { const sec = t.page.locator("#sec-ftp"); await sec.locator("#ftAnalyze").click(); await t.page.waitForTimeout(2000); const txt = (await sec.locator("#ftRes").innerText()).replace(/\s+/g, " "); return { status: /Ramp/i.test(txt) && /\d{3} W/.test(txt) ? "look" : "fail", observed: `Auswertung: „${txt.slice(0, 260)}“. Ob die FTP zu MyWhoosh passt, kann nur der Nutzer mit echter Fahrt beurteilen.`, locator: sec }; } },
  { action: "„Speichern und FTP übernehmen“.", expected: "FTP in den Einstellungen ist der neue Wert, Test im Verlauf.",
    async run(t) { const sec = t.page.locator("#sec-ftp"); await sec.getByRole("button", { name: /Speichern und FTP/ }).click(); await t.page.waitForTimeout(1500); const prof = await t.tool("get_ftp_tests"); const f = await t.tool("get_fitness_profile"); return { status: prof.tests?.length >= 1 && f.ftp?.origin === "user" ? "ok" : "fail", observed: `Tests im Verlauf: ${prof.tests?.length}; FTP jetzt ${f.ftp?.watts} W (Herkunft ${f.ftp?.origin})`, locator: sec }; } },
  deviceStep(5, "Echten Test fahren und mit MyWhoosh vergleichen.", "FTP passt zur MyWhoosh-Anzeige.", "Echter Test auf der Rolle: nur der Nutzer."),
]);
