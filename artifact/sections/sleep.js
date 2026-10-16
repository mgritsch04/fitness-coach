// Schlaf-Detail (#20) aus get_sleep_report: Phasen je Nacht, Schlafschuld-Verlauf, Uhrzeiten und Tipps.
FC.section({
  id: "sleep",
  tab: "verlauf",
  order: 32,
  css: `
    .sl-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px 20px; margin-bottom: 12px; }
    .sl-stats div { display: grid; gap: 2px; } .sl-stats b { font-family: var(--font-display); font-size: 1.3rem; }
    .sl-tips { margin: 8px 0 0; padding-left: 1.2em; display: grid; gap: 4px; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-sleep">Schlaf im Detail</h2><span class="muted" id="slRange"></span></div>
      <div class="panel"><div class="sl-stats" id="slStats"></div><ul class="sl-tips" id="slTips"></ul></div>
      <div class="grid2">
        <div class="panel"><h3>Schlafphasen je Nacht</h3><div class="chart" id="cPhases"></div><p class="chart-cap">Gestrichelt: dein Schlafbedarf.</p></div>
        <div class="panel"><h3>Schlafschuld (7 Nächte)</h3><div class="chart" id="cDebt"></div><p class="chart-cap">Summe aus Schlafbedarf minus Schlaf der letzten 7 Nächte; unter 0 = mehr geschlafen als nötig.</p></div>
      </div>`;
  },
  ready() { this.load(); FC.onRange(() => this.load()); },
  load() {
    this.stop?.();
    const days = Math.min(180, FC.state.range);
    this.stop = FC.watch("get_sleep_report", { days }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, chart, cssVar, de, fmtH } = FC, r = this.rep;
    const stats = $("slStats");
    if (!stats || !r) return;
    if (r.error) { stats.replaceChildren(el("div", { class: "muted", text: r.error })); return; }
    const s = r.summary;
    $("slRange").textContent = `${s.nights} Nächte`;
    const stat = (label, value, sub) => el("div", {}, el("span", { class: "label", text: label }), el("b", { text: value }), sub ? el("span", { class: "muted", text: sub }) : null);
    stats.replaceChildren(...[
      stat("Ø Schlaf", s.avgAsleepH == null ? "–" : `${fmtH(s.avgAsleepH)} h`, `Bedarf ${fmtH(r.sleepNeedH)} h, erreicht in ${de(s.needMetPct)} % der Nächte`),
      stat("Einschlafen", s.avgBedtime ?? "–", s.bedtimeSdMin != null ? `± ${de(s.bedtimeSdMin)} min` : null),
      stat("Aufwachen", s.avgWake ?? "–", s.wakeSdMin != null ? `± ${de(s.wakeSdMin)} min` : null),
      stat("Schlafschuld 7 Nächte", s.debt7dH == null ? "–" : `${fmtH(Math.max(0, s.debt7dH))} h`, s.debt7dH != null && s.debt7dH < 0 ? "ausgeglichen" : null),
      stat("Tief / REM", s.avgDeepPct == null ? "–" : `${de(s.avgDeepPct)} / ${de(s.avgRemPct)} %`, "Anteil am Schlaf"),
      stat("Wochenende", s.weekendShiftMin == null ? "–" : Math.abs(s.weekendShiftMin) < 15 ? "gleich" : `${s.weekendShiftMin > 0 ? "+" : "−"}${fmtH(Math.abs(s.weekendShiftMin) / 60)} h`, "Verschiebung der Schlafmitte"),
      s.suggestedBedtime ? stat("Ins Bett gegen", s.suggestedBedtime, "für deinen Schlafbedarf (Schätzung)") : null,
    ].filter(Boolean));
    $("slTips").replaceChildren(...r.tips.map((t) => el("li", { text: t })));
    chart($("cPhases"), { days: r.nights, yMin: 0, ref: { value: r.sleepNeedH }, aria: "Schlafphasen je Nacht", series: [
      { label: "Tief", kind: "stack", color: cssVar("--s1"), value: (n) => n.deepH, fmt: (v) => `${fmtH(v)} h` },
      { label: "REM", kind: "stack", color: cssVar("--s7"), value: (n) => n.remH, fmt: (v) => `${fmtH(v)} h` },
      { label: "Leicht", kind: "stack", color: cssVar("--s3"), value: (n) => n.lightH, fmt: (v) => `${fmtH(v)} h` },
    ], extraTip: [
      { label: "Einschlafen", color: cssVar("--ink-3"), value: (n) => n.bedtime, fmt: (v) => v },
      { label: "Aufwachen", color: cssVar("--ink-3"), value: (n) => n.wake, fmt: (v) => v },
      { label: "Wach im Bett", color: cssVar("--ink-3"), value: (n) => n.awakeH, fmt: (v) => `${fmtH(v)} h` },
    ] });
    chart($("cDebt"), { days: r.nights, zero: true, aria: "Schlafschuld der letzten 7 Nächte", series: [
      { label: "Schlafschuld", kind: "line", color: cssVar("--warn"), width: 2.5, dots: true, value: (n) => n.debt7dH, fmt: (v) => `${de(v, 1)} h` },
    ] });
  },
});
