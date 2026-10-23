// #185 Coach-Chat kennt alle Analysen (Coach › Chat).
// In der Testumgebung antwortet Claude nicht echt; geprüft wird, welche Analysen der Chat holt („… geholt“).
const ask = async (t, q) => {
  await t.page.fill("#askInput", q);
  await t.page.click("#askBtn");
  await t.page.waitForTimeout(3500);
  return (await t.text("#chat")).replace(/\s+/g, " ");
};
export default {
  issue: 185,
  feature: 185,
  title: "Coach-Chat kennt alle Analysen (#185)",
  name: "Coach-Chat holt Analysen",
  device: "desktop",
  realDevice: ["Die eigentliche Antwort des Coaches schreibt Claude und ist nur im Live-Dashboard prüfbar."],
  steps: [
    {
      nr: 1,
      action: "Tab „Coach“ öffnen und den Vorschlag „Was fällt in meinen Analysen auf?“ antippen.",
      expected: "Über der Antwort erscheint „Wichtigste Befunde geholt“; die Antwort nennt die auffälligsten Punkte.",
      async run(t) {
        await t.open("coach");
        await t.section("coach");
        const chip = t.page.locator("#askChips button", { hasText: "Was fällt in meinen Analysen auf?" });
        const there = await chip.count();
        if (there) await chip.first().click();
        await t.page.waitForTimeout(3500);
        const chat = (await t.text("#chat")).replace(/\s+/g, " ");
        return { status: there && /Wichtigste Befunde geholt/.test(chat) ? "device" : "fail", observed: `Vorschlag vorhanden: ${there ? "ja" : "nein"}. Chat: „${chat.slice(0, 260)}“. Die inhaltliche Antwort kann nur der echte Coach geben.`, locator: t.page.locator("#sec-coach") };
      },
    },
    {
      nr: 2,
      action: "Eine gezielte Frage stellen: „Trainiere ich meine Muskeln ausgewogen?“",
      expected: "Über der Antwort steht, welche Analyse geholt wurde (z. B. „Muskelbalance geholt“).",
      async run(t) {
        await t.page.locator("#chatClear").click().catch(() => {});
        const chat = await ask(t, "Trainiere ich meine Muskeln ausgewogen?");
        return { status: "device", observed: `Die Auswahl der Analyse („Muskelbalance geholt“) trifft in der Testumgebung eine Beispielantwort, nicht der echte Coach. Chat: „${chat.slice(0, 200)}“. Bitte live prüfen.`, locator: t.page.locator("#sec-coach") };
      },
    },
    {
      nr: 3,
      action: "Optional: Falls claude.ai nach Erlaubnis für den Connector-Zugriff fragt, zustimmen.",
      expected: "Die Anfrage erscheint, danach funktionieren Schritt 1 und 2.",
      async run() {
        return { status: "skip", observed: "Optional; die Erlaubnisabfrage gibt es nur in claude.ai." };
      },
    },
  ],
};
