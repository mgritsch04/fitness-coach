// Kraft und Rad im Wechselspiel (#113) aus get_strength_cycling_interference: Folgetag nach Beinen und nächste Radeinheit je Abstand.
FC.section({
  id: "interference",
  tab: "training",
  order: 49,
  css: `
    .if-tip { font-weight: 600; margin: 0 0 6px; }
    .if-tab { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    .if-tab td, .if-tab th { padding: 4px 6px; border-bottom: 1px solid var(--line); text-align: left; }
    .if-tab th { font-weight: 600; color: var(--ink-2); white-space: normal; }
    .if-tab td:not(:first-child), .if-tab th:not(:first-child) { text-align: right; }
    .if-tab td:not(:first-child) { white-space: nowrap; }
    @media (max-width: 520px) { .if-tab { font-size: 0.82rem; } .if-tab td, .if-tab th { padding: 4px 3px; } }
    .if-up { color: var(--good); } .if-down { color: var(--bad); }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-interference">Kraft und Rad im Wechselspiel</h2><span class="muted" id="ifRange"></span></div>
      <div class="panel"><p class="if-tip" id="ifTip"><span class="muted">Lädt …</span></p><p class="chart-cap" id="ifCount"></p></div>
      <div class="grid2">
        <div class="panel"><h3>Am Tag danach</h3>
          <table class="if-tab"><thead><tr><th></th><th>Tage</th><th>Erholung</th><th>HRV</th></tr></thead><tbody id="ifDay"></tbody></table>
          <p class="chart-cap">Abweichung vom eigenen Mittel im Zeitraum (Erholung in Punkten, HRV in Prozent).</p></div>
        <div class="panel"><h3>Nächste Radeinheit</h3>
          <table class="if-tab"><thead><tr><th>Abstand zu Beinen</th><th>Fahrten</th><th>Effizienz</th><th>IF hart</th></tr></thead><tbody id="ifRide"></tbody></table>
          <p class="chart-cap">Effizienz: Watt je Herzschlag gegenüber ähnlich harten Fahrten. IF hart: mittlere Intensität harter Einheiten (ab 0,85).</p></div>
      </div>
      <p class="chart-cap" id="ifNotes"></p>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_strength_cycling_interference", { days: 180 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de } = FC, r = this.rep;
    const tip = $("ifTip");
    if (!tip || !r) return;
    if (r.error) { tip.replaceChildren(el("span", { class: "muted", text: r.error })); return; }
    const signed = (v, digits, unit, goodUp = true) => {
      if (v == null) return el("td", { class: "muted", text: "–" });
      const cls = Math.abs(v) < 2 ? "" : (v > 0) === goodUp ? "if-up" : "if-down";
      return el("td", { class: cls, text: `${v > 0 ? "+" : v < 0 ? "−" : "±"}${de(Math.abs(v), digits)}${unit}` });
    };
    tip.textContent = r.suggestion.text;
    $("ifCount").textContent = `${r.legSessions} Beineinheiten in den letzten ${r.range.days} Tagen.`;
    $("ifRange").textContent = "Beobachtung, keine Ursache-Wirkung";
    $("ifDay").replaceChildren(...r.nextDay.groups.map((g) => el("tr", {},
      el("td", { text: g.label }), el("td", { text: String(g.days) }), signed(g.recoveryVsAvg, 0, ""), signed(g.hrvVsAvgPct, 0, " %"))));
    $("ifRide").replaceChildren(...r.nextRide.map((b) => el("tr", {},
      el("td", { text: b.label }), el("td", { text: String(b.rides) }), signed(b.efVsTypicalPct, 1, " %"),
      el("td", { class: b.hardIntensity == null ? "muted" : "", text: b.hardIntensity == null ? "–" : de(b.hardIntensity, 2), title: `${b.hardRides} harte Einheiten` }))));
    $("ifNotes").textContent = r.notes.join(" ");
  },
});
