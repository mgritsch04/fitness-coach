// Verpflegungszettel (#374) für längere Einheiten: Kohlenhydrate, Trinken und Natrium je Stunde und insgesamt.
// Rechnet im Dashboard aus Plan-Einheit, Körpergewicht, persönlicher Schweißrate (#282) und Wetter (#66);
// „vorher“ und „danach“ kommen aus der Verpflegung je Einheit (#87, fueling.ts). Richtwert, keine Ernährungsberatung.
globalThis.FuelSheet = (() => {
  const MIN_SHEET = 75;
  const HARD = new Set(["threshold", "vo2max", "tempo", "sweetspot", "intervals", "anaerobic", "race"]);
  const r5 = (v) => Math.round(v / 5) * 5, r50 = (v) => Math.round(v / 50) * 50, r1 = (v) => Math.round(v * 10) / 10;

  // Ab 75 min immer „vorher“ und „danach“; die Verpflegung je Einheit (#87) liefert beides erst ab 90 min oder bei harten Einheiten.
  const beforeText = (kg) => `2–3 h vorher kohlenhydratreich essen${kg ? ` (etwa ${r5(kg * 1.5)} g, z. B. Haferflocken, Reis, Brot)` : " (z. B. Haferflocken, Reis, Brot)"}; nicht nüchtern fahren.`;
  const afterText = (after, kg) => (after?.startsWith("Danach") ? after : `Danach innerhalb von 1–2 h ${kg ? `${r5(kg)} g Kohlenhydrate und ${r5(kg * 0.3)} g Eiweiß` : "Kohlenhydrate und Eiweiß"} essen.${after ? ` ${after}` : ""}`);

  /** Zettel für eine Einheit oder null (unter 75 min, Kraft, Ruhetag). */
  function compute({ session: s, fuel, sweat, weatherDay, weightKg }) {
    if (!s || !fuel || s.type === "rest" || s.type === "strength" || (s.durationMin ?? 0) < MIN_SHEET) return null;
    const min = s.durationMin, h = min / 60, hard = HARD.has(s.type) || /schwelle|vo2|intervall/i.test(s.title ?? "");
    const notes = [], kg = weightKg && weightKg > 30 ? weightKg : null;
    // Kohlenhydrate je Stunde nach Dauer, bei harter Einheit eine Stufe mehr; höchstens 90 g/h.
    let lo = min >= 150 ? 70 : min >= 105 ? 60 : 40, hi = lo + (min >= 150 ? 20 : 20);
    if (hard) { lo += 10; hi += 10; }
    hi = Math.min(90, hi); lo = Math.min(lo, hi - 10);
    // Ort: draußen nur, wenn die Wetter-Empfehlung für den Tag „draußen“ lautet, sonst Rolle.
    const outside = weatherDay?.advice?.verdict === "outside";
    const tempC = outside ? (weatherDay.best ? (weatherDay.best.tempMin + weatherDay.best.tempMax) / 2 : null) : null;
    const grp = (outside ? sweat?.outdoor ?? sweat?.indoor : sweat?.indoor ?? sweat?.outdoor) ?? null;
    let drink, drinkBasis;
    if (grp) { drink = grp.drinkLph; drinkBasis = `deine Schweißrate ${String(grp.rateLph).replace(".", ",")} l/h`; }
    else { drink = outside ? 0.65 : 0.85; drinkBasis = "Faustregel; mit einer Schweißraten-Messung wird es persönlich"; }
    let heat = false;
    if (tempC != null && tempC >= 25) { const add = tempC >= 30 ? 0.3 : 0.2; drink += add; heat = true; notes.push(`Wetter: etwa ${Math.round(tempC)} °C, daher ${String(add).replace(".", ",")} l/h mehr trinken und mehr Salz.`); }
    else if (tempC != null && tempC <= 5) { drink -= 0.1; notes.push(`Wetter: etwa ${Math.round(tempC)} °C, du schwitzt weniger, trotzdem regelmäßig trinken (warmes Getränk hilft).`); }
    else if (tempC != null) notes.push(`Wetter: etwa ${Math.round(tempC)} °C, keine Anpassung nötig.`);
    else if (outside) notes.push("Kein Temperaturwert für diese Fahrt, Menge ohne Wetteranpassung.");
    else if (weatherDay == null) notes.push("Wetter nur für heute und morgen; bei Hitze draußen etwas mehr trinken.");
    drink = r1(Math.min(1.5, Math.max(0.4, drink)));
    const sodium = r50(drink * (heat ? 700 : 500)); // mg Natrium je Stunde (Salz ≈ 2,5 × Natrium)
    if (hard) notes.push("Harte Einheit: Kohlenhydrate eher am oberen Ende, damit die Intervalle bis zum Schluss tragen.");
    return {
      minutes: min, hard, outside, tempC, drinkBasis,
      perHour: { carbsG: [lo, hi], drinkL: drink, sodiumMg: sodium },
      total: { carbsG: [r5(lo * h), r5(hi * h)], drinkL: r1(drink * h), sodiumMg: r50(sodium * h) },
      before: fuel.before ?? beforeText(kg), after: afterText(fuel.after, kg), notes,
      note: `Richtwert nach Faustregeln der Sporternährung, keine Ernährungsberatung und keine medizinische Aussage. Auf Hunger, Verträglichkeit und Wetter hören; Natrium nur als Orientierung.`,
    };
  }

  /** Kurzer Hinweis für Einheiten unter 75 min. */
  const shortNote = (s) => (s && s.type !== "rest" && s.type !== "strength" && (s.durationMin ?? 0) < MIN_SHEET ? "Unter 75 min brauchst du keinen Zettel: vorher normal essen, unterwegs Wasser (bei harten Einheiten etwas Kohlenhydrate)." : null);

  function render(z) {
    const { el, de } = FC, g = (a) => `${a[0]}–${a[1]}`, l = (v) => `${de(v, 1)} l`;
    const row = (name, perH, tot) => el("tr", {}, el("th", { scope: "row", text: name }), el("td", { text: perH }), el("td", { text: tot }));
    return el("div", { class: "fz", role: "group", "aria-label": "Verpflegungszettel" },
      el("p", {}, el("strong", { text: `Verpflegungszettel (${z.minutes} min${z.hard ? ", hart" : ""}${z.outside ? ", draußen" : ", Rolle"})` })),
      el("table", { class: "fz-t" },
        el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "" }), el("th", { scope: "col", text: "pro Stunde" }), el("th", { scope: "col", text: "gesamt" }))),
        el("tbody", {},
          row("Kohlenhydrate", `${g(z.perHour.carbsG)} g`, `${g(z.total.carbsG)} g`),
          row("Trinken", l(z.perHour.drinkL), l(z.total.drinkL)),
          row("Natrium", `${z.perHour.sodiumMg} mg`, `${z.total.sodiumMg} mg`))),
      el("p", { class: "fine", text: `Trinken: ${z.drinkBasis}.` }),
      ...z.notes.map((n) => el("p", { class: "fine", text: n })),
      el("p", {}, el("strong", { text: "Essen vor und nach der Einheit" })),
      z.before ? el("p", { text: z.before }) : null,
      z.after ? el("p", { text: z.after }) : null,
      el("p", { class: "fine", text: z.note }));
  }
  return { MIN_SHEET, compute, shortNote, render };
})();
