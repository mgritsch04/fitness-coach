// HRV-Trend nach Plews (#125) aus get_hrv_trend: 7-Tage-Mittel gegen Normalband, Schwankung (CV) und Deutung.
FC.section({
  id: "hrvtrend",
  tab: "verlauf",
  order: 36,
  css: `
    .hv-top { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px 18px; margin-bottom: 10px; }
    .hv-top div { display: grid; gap: 2px; } .hv-top b { font-family: var(--font-display); font-size: 1.3rem; }
    .hv-state { font-weight: 600; margin: 0 0 4px; }
    .hv-within, .hv-stable, .hv-high { color: var(--good); } .hv-unsettled, .hv-low { color: var(--warn); } .hv-fatigue, .hv-saturation, .hv-below { color: var(--bad); }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-hrvtrend">HRV-Trend</h2><span class="muted">7-Tage-Mittel und Normalbereich</span></div>
      <div class="grid2">
        <div class="panel"><p class="hv-state" id="hvState"><span class="muted">Lädt …</span></p><p id="hvAdvice"></p><div class="hv-top" id="hvTop"></div></div>
        <div class="panel"><h3>Verlauf (90 Tage)</h3><div class="chart" id="cHv"></div>
          <p class="chart-cap">Linie: 7-Tage-Mittel, Punkte: einzelne Morgen, Fläche: dein Normalbereich (60 Tage davor ± 0,5 Standardabweichungen).</p></div>
      </div>
      <p class="chart-cap" id="hvNotes"></p>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_hrv_trend", { days: 90 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de, chart, cssVar, fmtDay } = FC, r = this.rep;
    const state = $("hvState");
    if (!state || !r) return;
    if (r.error) { state.replaceChildren(el("span", { class: "muted", text: r.error })); return; }
    $("hvNotes").textContent = r.notes.join(" ");
    const box = $("cHv");
    chart(box, {
      days: r.points, aria: "HRV mit 7-Tage-Mittel und Normalbereich", xFmt: (p) => fmtDay(p.day),
      bandFn: (p) => (p.bandLow == null ? null : { lo: p.bandLow, hi: p.bandHigh }),
      series: [
        { label: "Morgen", kind: "line", color: cssVar("--ink-3"), width: 0.8, dash: "1 5", dots: true, value: (p) => p.hrv, fmt: (v) => `${de(v)} ms` },
        { label: "7-Tage-Mittel", kind: "line", color: cssVar("--accent"), width: 2.5, value: (p) => p.avg7, fmt: (v) => `${de(v)} ms` },
      ],
      extraTip: [{ label: "Schwankung (CV)", color: cssVar("--ink-3"), value: (p) => p.cv7, fmt: (v) => `${de(v, 1)} %` }],
    });
    if (!r.available) {
      state.replaceChildren(el("span", { class: "muted", text: r.reason }));
      $("hvAdvice").textContent = ""; $("hvTop").replaceChildren();
      return;
    }
    const c = r.current;
    state.className = `hv-state hv-${r.pattern}`;
    state.textContent = r.label;
    $("hvAdvice").textContent = r.advice;
    const stat = (label, value, sub) => el("div", {}, el("span", { class: "label", text: label }), el("b", { text: value }), ...[sub ? el("span", { class: "muted", text: sub }) : null].filter(Boolean));
    const pct = (v) => (v == null ? "" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${de(Math.abs(v), 1)} %`);
    $("hvTop").replaceChildren(
      stat("7-Tage-Mittel", `${de(c.avg7)} ms`, c.change14dPct == null ? "" : `${pct(c.change14dPct)} in 14 Tagen`),
      stat("Normalbereich", `${de(c.bandLow)}–${de(c.bandHigh)} ms`, c.state === "within" ? "du liegst darin" : c.state === "above" ? "du liegst darüber" : "du liegst darunter"),
      stat("Schwankung", c.cv7 == null ? "–" : `${de(c.cv7, 1)} %`, c.cvTypical == null ? "" : `üblich ${de(c.cvTypical, 1)} %`),
    );
  },
});
