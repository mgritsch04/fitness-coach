// #338 Coach zeigt bei Fehlern den Fehlercode statt nur „nicht erreichbar“.
// Hinweis: Die Claude-Antworten sind in der Testumgebung Beispielantworten (kein echter Claude-Aufruf); der echte Fehlerfall tritt nur mit dem Live-Coach auf.
export default {
  issue: 338,
  feature: 338,
  title: "Coach-Fehler mit Fehlercode (#338)",
  name: "Coach-Fehlermeldung mit Code",
  device: "desktop",
  realDevice: ["Antwort des echten Coaches (Claude-Kontingent) und ein echter Fehlercode lassen sich nur im Live-Dashboard prüfen."],
  steps: [
    {
      nr: 1,
      action: "Reiter „Coach“, im Feld „Fragen“ „Hallo“ eingeben und abschicken.",
      expected: "Es kommt eine Antwort des Coaches. Falls nicht, steht in der Meldung „(Fehlercode: …)“ mit einem Code statt nur „nicht erreichbar“.",
      async run(t) {
        await t.open("coach");
        await t.section("coach");
        await t.page.fill("#askInput", "Hallo");
        await t.page.click("#askBtn");
        await t.page.waitForTimeout(3000);
        const chat = (await t.text("#chat")).replace(/\s+/g, " ");
        const hasCode = /Fehlercode: \w+/.test(chat);
        const answered = chat.length > "Hallo".length + 10;
        return { status: "device", observed: `Chat-Verlauf in der Testumgebung (Beispielantwort): „${chat.slice(0, 200)}“. ${hasCode ? "Fehlermeldung mit Code vorhanden." : "Keine Fehlermeldung."} ${answered ? "" : "Keine Antwort."} Die echte Claude-Antwort ist hier nicht prüfbar.`, locator: t.page.locator("#sec-coach") };
      },
    },
    {
      nr: 2,
      action: "Optional: Knopf „Erklären“ im Coach drücken.",
      expected: "Erklärung erscheint, oder eine Meldung mit „(Fehlercode: …)“.",
      async run(t) {
        return { status: "skip", observed: "Optional und nur mit dem echten Coach prüfbar." };
      },
    },
    {
      nr: 3,
      action: "Optional: Kommt ein Fehlercode, ihn hier im Issue notieren.",
      expected: "Code ist lesbar (z. B. upstream_error, rate_limited).",
      async run(t) {
        return { status: "skip", observed: "Optional; Handgriff der Nutzerin bzw. des Nutzers." };
      },
    },
  ],
};
