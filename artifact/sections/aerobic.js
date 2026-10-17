// Aerobe Basis (#145) aus get_aerobic_decoupling: Pa:HR-Entkopplung gleichmäßiger Fahrten im Verlauf.
FC.section({
  id: "aerobic",
  tab: "training",
  order: 52,
  css: `
    .ae-top { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px 18px; margin-top: 10px; }
    .ae-top div { display: grid; gap: 2px; } .ae-top b { font-family: var(--font-display); font-size: 1.3rem; }
    .ae-good { color: var(--good-ink); } .ae-ok { color: var(--warn-ink); } .ae-high { color: var(--bad-ink); }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-aerobic">Aerobe Basis</h2><span class="muted" id="aeRange"></span></div>
      <div class="grid2">
        <div class="panel"><p id="aeVerdict"><span class="muted">Lädt …</span></p><p id="aeTrend"></p><div class="ae-top" id="aeTop"></div></div>
        <div class="panel"><h3>Entkopplung je Fahrt</h3><div class="chart" id="cAe"></div>
          <p class="chart-cap">Punkte: gleichmäßige Fahrten ab 50 min. Fläche: unter 5 %, gute Grundlagenausdauer. Weniger ist besser.</p></div>
      </div>
      <p class="chart-cap" id="aeNotes"></p>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_aerobic_decoupling", { days: 120 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de, chart, cssVar, fmtDay } = FC, r = this.rep;
    const verdict = $("aeVerdict");
    if (!verdict || !r) return;
    if (r.error) { verdict.replaceChildren(el("span", { class: "muted", text: r.error })); return; }
    verdict.textContent = r.verdict;
    $("aeTrend").textContent = r.trend ? r.trend.text : "";
    $("aeNotes").textContent = r.notes.join(" ");
    const skipped = r.skipped.variable + r.skipped.short;
    $("aeRange").textContent = `${r.rides.length} gleichmäßige Fahrten${skipped ? `, ${skipped} andere` : ""}`;
    const c = r.current;
    const stat = (label, value, sub, cls) => el("div", {}, el("span", { class: "label", text: label }), el("b", { class: cls || "", text: value }), ...[sub ? el("span", { class: "muted", text: sub }) : null].filter(Boolean));
    $("aeTop").replaceChildren(...(c.medianPct == null ? [] : [
      stat("Aktuell", `${de(c.medianPct, 1)} %`, "Median letzte 4", `ae-${c.band}`),
      stat("Davor", c.previousMedianPct == null ? "–" : `${de(c.previousMedianPct, 1)} %`, "4 Fahrten davor"),
      stat("Längste unter 5 %", r.longestGood ? `${de(r.longestGood.durationMin)} min` : "–", r.longestGood ? fmtDay(r.longestGood.day) : "noch keine"),
    ]));
    chart($("cAe"), {
      days: r.rides, aria: "Entkopplung je gleichmäßiger Fahrt", xFmt: (p) => fmtDay(p.day),
      bandFn: () => ({ lo: 0, hi: 5 }),
      series: [{ label: "Entkopplung", kind: "line", color: cssVar("--accent"), width: 1.5, dots: true, value: (p) => p.decouplingPct, fmt: (v) => `${de(v, 1)} %` }],
      extraTip: [
        { label: "Dauer", color: cssVar("--ink-3"), value: (p) => p.durationMin, fmt: (v) => `${de(v)} min` },
        { label: "Ø Leistung", color: cssVar("--ink-3"), value: (p) => p.avgPowerW, fmt: (v) => `${de(v)} W` },
      ],
    });
  },
});
