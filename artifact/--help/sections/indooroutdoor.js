// Rolle gegen Straße (#207) aus get_indoor_outdoor: drinnen und draußen nebeneinander, Puls bei gleicher Leistung.
FC.section({
  id: "indooroutdoor",
  tab: "verlauf",
  order: 40,
  css: `
    .io-hints { margin: 0; padding-left: 1.1rem; display: grid; gap: 6px; }
    .io-tab { width: 100%; border-collapse: collapse; font-size: 0.92rem; margin-top: 12px; }
    .io-tab td, .io-tab th { padding: 5px 6px; border-bottom: 1px solid var(--line); text-align: right; }
    .io-tab td:first-child, .io-tab th:first-child { text-align: left; }
    .io-tab th { font-weight: 600; color: var(--ink-2); }
    @media (max-width: 520px) { .io-tab { font-size: 0.84rem; } .io-tab td, .io-tab th { padding: 4px 3px; } }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-indooroutdoor">Rolle gegen Straße</h2><span class="muted" id="ioRange"></span></div>
      <div class="panel"><ul class="io-hints" id="ioHints"><li class="muted">Lädt …</li></ul>
        <table class="io-tab"><thead><tr><th></th><th>Rolle</th><th>Draußen</th></tr></thead><tbody id="ioTab"></tbody></table></div>
      <p class="chart-cap" id="ioNotes"></p>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_indoor_outdoor", { days: 180 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de } = FC, r = this.rep;
    const hints = $("ioHints");
    if (!hints || !r) return;
    if (r.error) { hints.replaceChildren(el("li", { class: "muted", text: r.error })); return; }
    hints.replaceChildren(...r.hints.map((h) => el("li", { text: h })));
    $("ioRange").textContent = `${r.range.days} Tage`;
    $("ioNotes").textContent = r.notes.join(" ");
    const c = r.comparison, v = (x, unit = "", d = 0) => (x == null ? "–" : `${de(x, d)}${unit}`);
    const row = (label, a, b) => el("tr", {}, el("td", { text: label }), el("td", { text: a }), el("td", { text: b }));
    $("ioTab").replaceChildren(
      row("Fahrten", `${r.indoor.rides} (${de(r.indoor.hours, 1)} h)`, `${r.outdoor.rides} (${de(r.outdoor.hours, 1)} h)`),
      row("Leistung (NP, Median)", v(r.indoor.medianPowerW, " W"), v(r.outdoor.medianPowerW, " W")),
      row("Intensität (IF)", v(r.indoor.medianIf, "", 2), v(r.outdoor.medianIf, "", 2)),
      row("Effizienz (W pro Schlag)", v(r.indoor.ef, "", 2), v(r.outdoor.ef, "", 2)),
      ...[c ? row(`Puls bei ${c.refPowerW} W`, v(c.hrIndoor), v(c.hrOutdoor)) : null].filter(Boolean),
      row("Trittfrequenz", v(r.indoor.medianCadence, " U/min"), v(r.outdoor.medianCadence, " U/min")),
    );
  },
});
