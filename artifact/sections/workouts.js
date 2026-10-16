// Workout-Liste. Andere Abschnitte können eine Detailansicht über FC.state.openWorkout(w) anbieten.
// Anstrengung (RPE 1–10) je Workout eintragen (#134); FC.state.rpePicker(w) nutzt auch „Heute dran“.
FC.section({
  id: "workouts",
  tab: "training",
  order: 60,
  mount(root) {
    root.innerHTML = `
      <h2 id="h-workouts">Workouts</h2>
      <div class="panel tablewrap"><table id="tWorkouts" class="cards"><thead><tr>
        <th class="l">Tag</th><th class="l">Sport</th><th>Dauer</th><th>Ø Puls</th><th>Max</th><th>Leistung</th><th>Strain</th><th>Belastung</th><th>Anstrengung</th><th class="l">Quelle</th>
      </tr></thead><tbody><tr><td colspan="10" class="empty">Noch keine Daten.</td></tr></tbody></table>
      <div class="row" style="margin-top:10px"><button type="button" id="btnAllWorkouts" hidden>Alle anzeigen</button></div></div>`;
    this.all = false;
    FC.$("btnAllWorkouts").onclick = () => { this.all = !this.all; this.render(FC.state.data); };
    FC.state.rpePicker = (w, done) => this.picker(w, done);
  },
  /** Knöpfe 1–10; speichert sofort (save_workout_rpe) und lädt das Dashboard neu. */
  picker(w, done) {
    const { el } = FC;
    const msg = el("span", { class: "muted", role: "status" });
    const box = el("div", { class: "rpe-pick", role: "group", "aria-label": "Anstrengung 1 bis 10" }, ...Array.from({ length: 10 }, (_, k) => {
      const b = el("button", { type: "button", text: String(k + 1), "aria-pressed": String(w.rpe === k + 1), title: ["sehr leicht", "leicht", "moderat", "etwas schwer", "schwer", "schwer", "sehr schwer", "sehr schwer", "extrem", "maximal"][k] });
      b.onclick = async () => {
        for (const c of box.querySelectorAll("button")) c.disabled = true;
        msg.textContent = "Speichere …";
        try {
          await FC.call("save_workout_rpe", { source: w.source ?? w.sources[0], sourceId: w.sourceId, rpe: k + 1 });
          msg.textContent = `Gespeichert: ${k + 1}.`; done?.(k + 1);
          FC.reload();
        } catch (err) { msg.textContent = FC.errText(err); for (const c of box.querySelectorAll("button")) c.disabled = false; }
      };
      return b;
    }), msg);
    return box;
  },
  render(d) {
    const { $, el, de, fmtDayLong, sport, SOURCES, state } = FC;
    const from = d.days.at(-state.range)?.day ?? d.range.from;
    const tb = $("tWorkouts").tBodies[0]; tb.replaceChildren();
    const ws = d.workouts.filter((w) => w.day >= from);
    const more = $("btnAllWorkouts"); more.hidden = ws.length <= 25; more.textContent = this.all ? "Weniger anzeigen" : `Alle ${ws.length} anzeigen`;
    if (!ws.length) tb.append(el("tr", {}, el("td", { colspan: 10, class: "empty", text: "Keine Workouts im Zeitraum." })));
    for (const w of this.all ? ws : ws.slice(0, 25)) {
      const name = state.openWorkout ? el("button", { type: "button", class: "link", text: sport(w.sport) }) : document.createTextNode(sport(w.sport));
      if (state.openWorkout) name.onclick = () => state.openWorkout(w);
      const rpe = el("button", { type: "button", class: "link", text: w.rpe ? `${w.rpe}${w.sessionRpe ? ` (${de(w.sessionRpe)})` : ""}` : "eintragen", "aria-label": `Anstrengung für ${sport(w.sport)} am ${fmtDayLong(w.day)}${w.rpe ? `: ${w.rpe}` : " eintragen"}` });
      const row = el("tr", {},
        el("td", { class: "l", text: fmtDayLong(w.day) }), el("td", { class: "l" }, name), el("td", { "data-k": "Dauer", text: `${de(w.durationMin)} min` }), el("td", { "data-k": "Ø Puls", text: de(w.avgHr) }), el("td", { "data-k": "Max", text: de(w.maxHr) }),
        el("td", { "data-k": "Leistung", text: w.normalizedPowerW ? `${de(w.normalizedPowerW)} W NP` : w.avgPowerW ? `${de(w.avgPowerW)} W` : "–" }), el("td", { "data-k": "Strain", text: de(w.strain, 1) }),
        el("td", { "data-k": "Belastung" }, w.load == null ? "–" : de(w.load), " ", el("span", { class: `badge ${w.loadMethod === "power" ? "pw" : ""}`, text: w.loadMethod === "power" ? "Leistung" : w.loadMethod === "hr" ? "Puls" : "–" })),
        el("td", { "data-k": "Anstrengung" }, rpe),
        el("td", { class: "l", "data-k": "Quelle", text: w.sources.map((s) => SOURCES[s] ?? s).join(" + ") }));
      tb.append(row);
      // Offene Auswahl überlebt ein Neuzeichnen (z. B. wenn neue Daten kommen).
      const key = `${w.source ?? w.sources[0]}:${w.sourceId}`;
      const openPick = () => row.after(el("tr", { class: "rpe-row" }, el("td", { colspan: 10, class: "l" }, el("span", { class: "muted", text: "Wie anstrengend war es? 1 sehr leicht, 10 maximal. " }), this.picker(w, () => { this.openKey = null; }))));
      if (this.openKey === key) openPick();
      rpe.onclick = () => {
        if (row.nextElementSibling?.classList.contains("rpe-row")) { row.nextElementSibling.remove(); this.openKey = null; return; }
        this.openKey = key; openPick();
      };
    }
  },
});
