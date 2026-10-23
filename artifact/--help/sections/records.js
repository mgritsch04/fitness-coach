// Bestleistungen-Feed (#65) aus get_records: neue Rekorde der letzten 30 Tage und „diese Woche gegen letzte Woche“.
FC.section({
  id: "records",
  tab: "heute",
  order: 15,
  css: `
    .rc-week { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px 18px; }
    .rc-week div { display: grid; gap: 2px; } .rc-week b { font-family: var(--font-display); font-size: 1.2rem; }
    .rc-up { color: var(--good-ink); } .rc-down { color: var(--bad-ink); }
    .rc-feed { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .rc-feed li { display: grid; grid-template-columns: 4.8rem 1fr; gap: 2px 10px; align-items: baseline; }
    .rc-feed .rc-tag { grid-row: span 2; justify-self: start; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 7px; border-radius: 999px; background: var(--line); color: var(--ink-2); }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-records">Diese Woche und Bestleistungen</h2><span class="muted" id="rcRange"></span></div>
      <div class="grid2">
        <div class="panel"><h3>Diese Woche gegen letzte Woche</h3><div class="rc-week" id="rcWeek"><span class="muted">Lädt …</span></div><p class="chart-cap" id="rcWeekCap"></p></div>
        <div class="panel"><h3>Neue Bestleistungen (30 Tage)</h3><ul class="rc-feed" id="rcFeed"></ul></div>
      </div>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_records", { days: 30 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de, fmtDay, fmtDayLong } = FC, r = this.rep;
    const week = $("rcWeek"), feed = $("rcFeed");
    if (!week || !r) return;
    if (r.error) { week.replaceChildren(el("div", { class: "muted", text: r.error })); feed.replaceChildren(); return; }
    const w = r.week, t = w.thisWeek, c = w.change;
    // good: +1 = mehr ist besser, 0 = neutral (Training)
    const stat = (label, value, delta, unit, digits, good) => {
      const cls = delta == null || delta === 0 || good === 0 ? "muted" : (delta > 0) === (good > 0) ? "rc-up" : "rc-down";
      const d = delta == null ? "" : `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${de(Math.abs(delta), digits)}${unit}`;
      return el("div", {}, el("span", { class: "label", text: label }), el("b", { text: value == null ? "–" : `${de(value, digits)}${unit}` }), el("span", { class: cls, text: d ? `${d} zur Vorwoche` : "" }));
    };
    week.replaceChildren(
      stat("Training", t.trainingH, c.trainingH, " h", 1, 0),
      stat("Belastung", t.load, c.load, "", 0, 0),
      stat("Einheiten", t.workouts, c.workouts, "", 0, 0),
      stat("Ø Erholung", t.avgRecovery, c.avgRecovery, " %", 0, 1),
      stat("Ø HRV", t.avgHrv, c.avgHrv, " ms", 0, 1),
      stat("Ø Schlaf", t.avgSleepH, c.avgSleepH, " h", 1, 1),
    );
    $("rcWeekCap").textContent = `${fmtDay(t.from)}–${fmtDay(t.to)} gegen dieselben Tage der Vorwoche. Ganze Vorwoche: ${de(w.lastWeekFull.trainingH, 1)} h, Belastung ${de(w.lastWeekFull.load)}.`;
    const TAG = { power: "Watt", strength: "Kraft", distance: "Strecke", duration: "Dauer" };
    feed.replaceChildren(...(r.records.length
      ? r.records.slice(0, 8).map((e) => el("li", {}, el("span", { class: "rc-tag", text: TAG[e.kind] ?? "Rekord" }), el("span", { text: e.text }),
          el("span", { class: "muted", text: `${fmtDayLong(e.day)} · vorher ${de(e.previous, e.unit === "kg" ? 1 : 0)} ${e.unit} am ${fmtDay(e.previousDay)}` })))
      : [el("li", { class: "muted", text: "In den letzten 30 Tagen keine neue Bestleistung. Rekorde zählen ab dem zweiten Wert einer Dauer oder Übung." })]));
    $("rcRange").textContent = r.totalRecords ? `${r.totalRecords} Rekorde insgesamt` : "";
  },
});
