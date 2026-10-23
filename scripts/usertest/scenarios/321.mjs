// #321 Eigene schlanke Seite nur fürs Krafttraining-Tracking (artifact/gym.html).
import { res, dev } from "./_q.mjs";
export default {
  issue: 321, feature: 321, title: "Eigene Gym-Seite (#321)", name: "Gym-Seite", device: "phone",
  realDevice: ["Die Gym-Seite ist ein eigenes veröffentlichtes Artefakt mit Verbindung zu den echten Daten; das lässt sich nur mit dem echten Link prüfen."],
  steps: [
    { nr: 1, action: "Die Gym-Seite am Handy öffnen.", expected: "Titel „Gym“, nur Krafttraining, keine Reiter und keine anderen Abschnitte.",
      async run(t) { await t.page.goto("/preview-gym.html"); await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 }); await t.page.waitForTimeout(1200);
        const info = await t.page.evaluate(() => ({ title: document.title, h1: document.querySelector("h1")?.innerText, tabs: !![...document.querySelectorAll("#tabbar, .tabbar")].find((e) => e.offsetParent), secs: [...document.querySelectorAll("section.sec, [id^=sec-]")].filter((e) => e.offsetParent && e.id).map((e) => e.id) }));
        return res(/gym/i.test(info.h1 ?? info.title) && !info.tabs && info.secs.length >= 1 && info.secs.length <= 4, `Titel „${info.title}“, Überschrift „${info.h1}“, Reiterleiste sichtbar: ${info.tabs}, sichtbare Abschnitte: ${info.secs.join(", ")}.`, t.page.locator("body")); } },
    { nr: 2, action: "Eine Übung mit Satz, Wiederholungen und Gewicht eintragen und die Einheit speichern.", expected: "Wird gespeichert und erscheint im Kraftverlauf.",
      async run() { return dev("Die Gym-Seite ist ein eigenes Artefakt, das über den Connector speichert; in der Testumgebung läuft sie nur mit Beispielantworten. Der Speicherweg des Gym-Modus selbst ist in den Tests zu #320 und #319 geprüft."); } },
    { nr: 3, action: "Das normale Dashboard öffnen.", expected: "Die eben gespeicherte Einheit ist dort ebenfalls zu sehen.", async run() { return dev("Setzt Schritt 2 mit dem echten Artefakt voraus (gleiche Datenbank, kein Doppelpflegen)."); } },
    { nr: 4, action: "Optional: Gym-Seite am PC öffnen.", expected: "Gleicher Inhalt, gut lesbar in voller Breite.", async run() { return { status: "skip", observed: "Optional (Optik am PC)." }; } },
  ],
};
