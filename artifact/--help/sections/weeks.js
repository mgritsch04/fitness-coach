// Wochenübersicht als Tabelle.
FC.section({
  id: "weeks",
  tab: "training",
  order: 50,
  mount(root) {
    root.innerHTML = `
      <h2 id="h-weeks">Wochen</h2>
      <div class="panel tablewrap"><table id="tWeeks" class="cards"><thead><tr>
        <th class="l">Woche</th><th>Einheiten</th><th>Stunden</th><th>Belastung</th><th>Fitness</th><th>Ø Erholung</th><th>Ø HRV</th><th>Ø Ruhepuls</th><th>Ø Schlaf</th><th>Schlafschuld</th>
      </tr></thead><tbody><tr><td colspan="10" class="empty">Noch keine Daten.</td></tr></tbody></table></div>`;
  },
  render(d) {
    const { $, el, de, fmtDay, fmtH, addDays, state } = FC;
    const from = d.days.at(-state.range)?.day ?? d.range.from;
    const wb = $("tWeeks").tBodies[0]; wb.replaceChildren();
    const weeks = d.weeks.filter((w) => addDays(w.week, 6) >= from).slice().reverse();
    if (!weeks.length) wb.append(el("tr", {}, el("td", { colspan: 10, class: "empty", text: "Keine Wochen im Zeitraum." })));
    for (const w of weeks) wb.append(el("tr", {},
      el("td", { text: `${fmtDay(w.week)}–${fmtDay(addDays(w.week, 6))}` }), el("td", { "data-k": "Einheiten", text: de(w.workouts) }), el("td", { "data-k": "Stunden", text: fmtH(w.trainingH) }), el("td", { "data-k": "Belastung", text: de(w.load) }),
      el("td", { "data-k": "Fitness", text: `${de(w.ctlEnd)} (${w.ctlChange >= 0 ? "+" : ""}${de(w.ctlChange, 1)})` }),
      el("td", { "data-k": "Ø Erholung", text: w.avgRecovery == null ? "–" : `${de(w.avgRecovery)} %` }), el("td", { "data-k": "Ø HRV", text: de(w.avgHrv) }), el("td", { "data-k": "Ø Ruhepuls", text: de(w.avgRhr) }),
      el("td", { "data-k": "Ø Schlaf", text: w.avgSleepH == null ? "–" : `${fmtH(w.avgSleepH)} h` }), el("td", { "data-k": "Schlafschuld", text: w.sleepDebtH == null ? "–" : `${fmtH(Math.max(0, w.sleepDebtH))} h` })));
  },
});
