// #325 Fehler: Radwetter zeigt nach Ortswechsel weiter den alten Ort.
import { dev } from "./_q.mjs";
export default {
  issue: 325, feature: 325, title: "Radwetter nach Ortswechsel (#325)", name: "Ortswechsel Radwetter", device: "phone",
  steps: [
    { nr: 1, action: "Im Radwetter „Ort ändern“, mehrdeutigen Namen (z. B. „Wolfsberg“) eingeben, „Speichern“.", expected: "Liste mit mehreren Orten mit Region und Land.",
      async run(t) { await t.open("heute"); const w = await t.section("weather"); await w.getByRole("button", { name: /Ort ändern/ }).click().catch(() => {});
        const form = await t.page.locator("#wxForm").isVisible(); return dev(`Ort suchen braucht das Internet (Geocoding), in der Testumgebung gibt es nur Beispielwetter „${(await t.text("#wxLoc")).trim()}“. Das Formular „Ort für die Vorhersage“ öffnet sich: ${form}.`); } },
    { nr: 2, action: "Den richtigen Ort antippen.", expected: "Ortszeile zeigt sofort genau diesen Ort mit Region und Land, Vorhersage lädt neu.", async run() { return dev("Braucht echte Ortssuche und Wetterdaten."); } },
    { nr: 3, action: "Einen eindeutigen Ort (z. B. „Graz“) eingeben und speichern.", expected: "Wird direkt gespeichert, Ortszeile zeigt sofort den neuen Namen.", async run() { return dev("Braucht echte Ortssuche und Wetterdaten."); } },
    { nr: 4, action: "Die Seite neu laden.", expected: "Weiter der neue Ort, Vorhersage passt.", async run() { return dev("Braucht echte Ortssuche und Wetterdaten."); } },
    { nr: 5, action: "Optional: Dashboard auf einem zweiten Gerät öffnen.", expected: "Nach etwa 5 Minuten steht dort ebenfalls der neue Ort.", async run() { return { status: "skip", observed: "Optional und nur mit zwei Geräten und echtem Wetterdienst prüfbar." }; } },
  ],
};
