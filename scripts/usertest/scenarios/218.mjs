// #218 Wochenbilanz als Bild speichern (Coach › Wochenrückblick › „Als Bild speichern“).
export default {
  issue: 218,
  feature: 218,
  title: "Wochenbilanz als Bild speichern (#218)",
  name: "Wochenbilanz als PNG",
  device: "phone",
  realDevice: ["Download-Dialog und das gespeicherte Bild (Handy, Hell/Dunkel) lassen sich nur am echten Gerät in claude.ai prüfen."],
  steps: [
    {
      nr: 1,
      action: "Tab „Coach“, Abschnitt „Wochenrückblick“: unten „Als Bild speichern“ antippen.",
      expected: "Der Download-Dialog erscheint.",
      async run(t) {
        await t.open("coach");
        await t.section("review");
        await t.page.locator("#rvImg:not([disabled])").waitFor({ timeout: 15_000 }).catch(() => {});
        const dis = await t.page.locator("#rvImg").isDisabled();
        const dl = t.page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
        if (!dis) await t.page.click("#rvImg");
        const d = await dl;
        const msg = (await t.text("#rvMsg")).trim();
        return { status: "device", observed: `Knopf ${dis ? "gesperrt (Download-Funktion nur in claude.ai)" : "aktiv"}. Download-Ereignis: ${d ? d.suggestedFilename() : "keines (Testumgebung)"}. Meldung: „${msg}“. Der Systemdialog ist nur im echten claude.ai prüfbar.`, locator: t.page.locator("#sec-review") };
      },
    },
    {
      nr: 2,
      action: "Den Download-Dialog bestätigen.",
      expected: "Eine PNG-Datei wochenbilanz-<Datum>.png (1080 × 1350) wird gespeichert.",
      async run(t) {
        return { status: "device", observed: "Das Speichern geht über die claude.ai-Funktion „downloads“ und ist in der Testumgebung nicht vorhanden." };
      },
    },
    {
      nr: 3,
      action: "Die gespeicherte Datei öffnen.",
      expected: "Kennzahlen gegen die Vorwoche, Trainingszeit nach Sport und Highlights; im Dunkelmodus ist die Karte dunkel.",
      async run(t) {
        return { status: "look", observed: "Bildurteil nötig: Layout und Lesbarkeit der Karte kann nur ein Mensch am Bild beurteilen." };
      },
    },
    {
      nr: 4,
      action: "Im Wochenrückblick „Diese Woche bisher“ wählen und das Bild nochmal speichern.",
      expected: "Das Bild zeigt „läuft noch“.",
      async run(t) {
        const st = (await t.text("#rvState")).trim();
        return { status: "device", observed: `Aktuelle Anzeige im Abschnitt: „${st}“. Das Bild selbst ist nur am echten Gerät prüfbar (Code setzt bei unvollständiger Woche „· läuft noch“ auf die Karte).` };
      },
    },
  ],
};
