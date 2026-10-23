// #207 Rolle gegen Straße: Leistung und Puls im Vergleich.
import { res, dev, look, unit } from "./_q.mjs";
export default {
  issue: 207, feature: 207, title: "Rolle gegen Straße (#207)", name: "Rolle gegen Straße", device: "desktop",
  steps: [
    { nr: 1, action: "Verlauf › „Rolle gegen Straße“ aufklappen, solange du nur drinnen fährst.", expected: "Hinweis, dass Fahrten draußen fehlen; Tabelle zeigt nur die Spalte Rolle mit Werten.",
      async run(t) { await t.open("verlauf"); const sec = await t.section("indooroutdoor"); const txt = (await sec.innerText()).replace(/\s+/g, " ");
        const io = await t.tool("get_indoor_outdoor", {});
        return res(io.indoor.rides > 0 && io.outdoor.rides === 0 && /Fahrten mit Leistung und Puls draußen/.test(txt) && /ROLLE/i.test(txt) && !io.comparison, `Hinweis: „${io.hints[0]}“. Tabelle: Rolle ${io.indoor.rides} Fahrten, ${io.indoor.medianPowerW} W, Effizienz ${io.indoor.ef}; draußen 0 Fahrten (–).`, sec); } },
    { nr: 2, action: "Sobald je mindestens 3 Fahrten drinnen und draußen vorliegen: „Puls bei … W“ und den Hinweis prüfen.", expected: "Beides passt zum eigenen Gefühl.",
      async run(t) { const u = unit("indoor-outdoor.test.ts", "höherer Puls auf der Rolle");
        return dev(`Braucht echte Fahrten draußen (Wahoo, derzeit nicht verbunden). Rechenregel „höherer Puls auf der Rolle“ per Unit-Test ${u.pass ? "bestanden" : "nicht bestanden"}; ob es zum Gefühl passt, beurteilt G.`); } },
  ],
};
