// Trittfrequenz-Profil (#161) aus get_cadence_profile: Verteilung, Median je Leistungszone, Verlauf in Zone 2.
FC.section({
  id: "cadence",
  tab: "training",
  order: 54,
  css: `
    .cd-hints { margin: 0; padding-left: 1.1rem; display: grid; gap: 6px; }
    .cd-bands { display: grid; gap: 6px; }
    .cd-band { display: grid; grid-template-columns: 72px 1fr 52px; gap: 8px; align-items: center; font-size: 0.9rem; }
    .cd-band .bar { height: 12px; background: var(--grid); border-radius: 3px; overflow: hidden; }
    .cd-band .bar span { display: block; height: 100%; background: var(--accent); }
    .cd-band b { text-align: right; font-weight: 600; }
    .cd-tab { width: 100%; border-collapse: collapse; font-size: 0.92rem; margin-top: 10px; }
    .cd-tab td, .cd-tab th { padding: 4px 6px; border-bottom: 1px solid var(--line); text-align: left; }
    .cd-tab th { font-weight: 600; color: var(--ink-2); }
    .cd-tab td:not(:first-child), .cd-tab th:not(:first-child) { text-align: right; white-space: nowrap; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-cadence">Trittfrequenz</h2><span class="muted" id="cdRange"></span></div>
      <div class="panel"><ul class="cd-hints" id="cdHints"><li class="muted">Lädt …</li></ul></div>
      <div class="grid2">
        <div class="panel"><h3>Verteilung (U/min)</h3><div class="cd-bands" id="cdBands"></div>
          <table class="cd-tab"><thead><tr><th>Zone</th><th>Zeit</th><th>Kadenz</th></tr></thead><tbody id="cdZones"></tbody></table></div>
        <div class="panel"><h3>Kadenz in der Grundlage je Woche</h3><div class="chart" id="cCd"></div>
          <p class="chart-cap">Median der Trittfrequenz in Zone 2 (56–75 % der FTP), Wochen ab 5 min.</p></div>
      </div>
      <p class="chart-cap" id="cdNotes"></p>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_cadence_profile", { days: 90 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de, chart, cssVar, fmtDay } = FC, r = this.rep;
    const hints = $("cdHints");
    if (!hints || !r) return;
    if (r.error) { hints.replaceChildren(el("li", { class: "muted", text: r.error })); return; }
    hints.replaceChildren(...r.hints.map((h) => el("li", { text: h })));
    $("cdRange").textContent = r.rides ? `${r.rides} Fahrten, Median ${r.medianRpm} U/min` : "";
    $("cdNotes").textContent = r.notes.join(" ");
    const max = Math.max(1, ...r.bands.map((b) => b.sharePct));
    $("cdBands").replaceChildren(...r.bands.map((b) => {
      const fill = el("span"); fill.style.width = `${(b.sharePct / max) * 100}%`;
      return el("div", { class: "cd-band" }, el("span", { text: b.label }), el("div", { class: "bar" }, fill), el("b", { text: `${de(b.sharePct, 0)} %` }));
    }));
    $("cdZones").replaceChildren(...(r.zones ? r.zones.map((z) => el("tr", {},
      el("td", { text: z.label }), el("td", { text: `${de(z.minutes)} min` }), el("td", { class: z.medianRpm == null ? "muted" : "", text: z.medianRpm == null ? "–" : `${z.medianRpm} U/min` }),
    )) : [el("tr", {}, el("td", { colspan: "3", class: "muted", text: "Zonen erst mit FTP." }))]));
    chart($("cCd"), {
      days: r.weeks.map((w) => ({ day: w.week, rpm: w.medianRpm, minutes: w.minutes })), aria: "Kadenz in Zone 2 je Woche", xFmt: (p) => `Woche ab ${fmtDay(p.day)}`,
      series: [{ label: "Kadenz Z2", kind: "line", color: cssVar("--accent"), width: 2, dots: true, value: (p) => p.rpm, fmt: (v) => `${de(v)} U/min` }],
      extraTip: [{ label: "Zeit in Z2", color: cssVar("--ink-3"), value: (p) => p.minutes, fmt: (v) => `${de(v)} min` }],
    });
  },
});
