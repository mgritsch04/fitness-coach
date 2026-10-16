// Workout-Liste. Andere Abschnitte können eine Detailansicht über FC.state.openWorkout(w) anbieten.
FC.section({
  id: "workouts",
  tab: "training",
  order: 60,
  mount(root) {
    root.innerHTML = `
      <h2 id="h-workouts">Workouts</h2>
      <div class="panel tablewrap"><table id="tWorkouts" class="cards"><thead><tr>
        <th class="l">Tag</th><th class="l">Sport</th><th>Dauer</th><th>Ø Puls</th><th>Max</th><th>Leistung</th><th>Strain</th><th>Belastung</th><th class="l">Quelle</th>
      </tr></thead><tbody><tr><td colspan="9" class="empty">Noch keine Daten.</td></tr></tbody></table>
      <div class="row" style="margin-top:10px"><button type="button" id="btnAllWorkouts" hidden>Alle anzeigen</button></div></div>`;
    this.all = false;
    FC.$("btnAllWorkouts").onclick = () => { this.all = !this.all; this.render(FC.state.data); };
  },
  render(d) {
    const { $, el, de, fmtDayLong, sport, SOURCES, state } = FC;
    const from = d.days.at(-state.range)?.day ?? d.range.from;
    const tb = $("tWorkouts").tBodies[0]; tb.replaceChildren();
    const ws = d.workouts.filter((w) => w.day >= from);
    const more = $("btnAllWorkouts"); more.hidden = ws.length <= 25; more.textContent = this.all ? "Weniger anzeigen" : `Alle ${ws.length} anzeigen`;
    if (!ws.length) tb.append(el("tr", {}, el("td", { colspan: 9, class: "empty", text: "Keine Workouts im Zeitraum." })));
    for (const w of this.all ? ws : ws.slice(0, 25)) {
      const name = state.openWorkout ? el("button", { type: "button", class: "link", text: sport(w.sport) }) : document.createTextNode(sport(w.sport));
      if (state.openWorkout) name.onclick = () => state.openWorkout(w);
      tb.append(el("tr", {},
        el("td", { class: "l", text: fmtDayLong(w.day) }), el("td", { class: "l" }, name), el("td", { "data-k": "Dauer", text: `${de(w.durationMin)} min` }), el("td", { "data-k": "Ø Puls", text: de(w.avgHr) }), el("td", { "data-k": "Max", text: de(w.maxHr) }),
        el("td", { "data-k": "Leistung", text: w.normalizedPowerW ? `${de(w.normalizedPowerW)} W NP` : w.avgPowerW ? `${de(w.avgPowerW)} W` : "–" }), el("td", { "data-k": "Strain", text: de(w.strain, 1) }),
        el("td", { "data-k": "Belastung" }, w.load == null ? "–" : de(w.load), " ", el("span", { class: `badge ${w.loadMethod === "power" ? "pw" : ""}`, text: w.loadMethod === "power" ? "Leistung" : w.loadMethod === "hr" ? "Puls" : "–" })),
        el("td", { class: "l", "data-k": "Quelle", text: w.sources.map((s) => SOURCES[s] ?? s).join(" + ") })));
    }
  },
});
