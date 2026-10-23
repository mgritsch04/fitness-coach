// Fehler: doppelte Element-ID rcRange im Dashboard
// Voraussetzung: Dashboard mit synthetischen Daten (Vorschau) oder echte Daten, mindestens ein Abschnitt „Erholung nach harten Tagen“ sichtbar.
// Prüft DOM: jede ID genau einmal; Zusatzzeile je Abschnitt im eigenen Element.
const count = (t, id) => t.page.evaluate((i) => document.querySelectorAll(`[id="${i}"]`).length, id);

export default {
  issue: 352,
  title: "Fehler: doppelte Element-ID rcRange im Dashboard",
  name: "Fehler: doppelte Element-ID rcRange im Dashboard",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Dashboard öffnen und im Tab **Verlauf** zum Abschnitt „Erholung nach harten Tagen“ gehen.",
      expected: "Unter der Überschrift steht eine Zusatzzeile „N harte Tage (Strain ab X)“ oder der Hinweis, dass die Erholungskurve noch nicht verfügbar ist.",
      async run(t) {
        await t.open("verlauf");
        const sec = await t.section("recoverycurve");
        const n = await count(t, "rcRange");
        const range = (await sec.locator("#rcRange").textContent())?.trim() ?? "";
        const hints = (await sec.locator("#rcHints").textContent())?.trim() ?? "";
        const ok = n === 1 && (/harte Tage/.test(range) || hints.length > 0);
        return {
          status: ok ? "ok" : "fail",
          observed: `#rcRange ${n}× im Dashboard, Zusatzzeile: „${range}“, Hinweise: „${hints.slice(0, 120)}“`,
          locator: sec,
        };
      },
    },
    {
      nr: 2,
      action: "Im Tab **Heute** zum Abschnitt „Diese Woche und Bestleistungen“ gehen.",
      expected: "Unter der Überschrift steht „N Rekorde insgesamt“, oder die Zeile ist leer, wenn es keine Rekorde gibt. Die Zusatzzeile des Abschnitts „Erholung nach harten Tagen“ wird dadurch nicht verändert.",
      async run(t) {
        await t.open("heute");
        const sec = await t.section("records");
        const range = (await sec.locator("#recRange").textContent())?.trim() ?? "";
        const ok = (await count(t, "recRange")) === 1 && (range === "" || /Rekorde insgesamt/.test(range));
        return {
          status: ok ? "ok" : "fail",
          observed: `#recRange ${await count(t, "recRange")}× im Dashboard, Zusatzzeile: „${range}“`,
          locator: sec,
        };
      },
    },
    {
      nr: 3,
      action: "Im Browser die Elemente mit der ID `rcRange` und `recRange` prüfen (Entwicklerwerkzeuge oder Suche im Seitenquelltext).",
      expected: "`rcRange` kommt genau einmal vor (Erholungskurve), `recRange` genau einmal (Bestleistungen). Keine Element-ID ist doppelt.",
      async run(t) {
        const dups = await t.page.evaluate(() => {
          const seen = {}; const d = [];
          document.querySelectorAll("[id]").forEach((e) => { seen[e.id] = (seen[e.id] || 0) + 1; });
          for (const [k, v] of Object.entries(seen)) if (v > 1) d.push(k);
          return d;
        });
        const ok = dups.length === 0 && (await count(t, "rcRange")) === 1 && (await count(t, "recRange")) === 1;
        return {
          status: ok ? "ok" : "fail",
          observed: `doppelte IDs im Dashboard: ${dups.length ? dups.join(", ") : "keine"}; rcRange ${await count(t, "rcRange")}×, recRange ${await count(t, "recRange")}×`,
        };
      },
    },
  ],
};
