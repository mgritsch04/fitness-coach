// Körpersignale: jede Kennzahl gegen den eigenen Normalbereich (get_health_trends), dazu Schlafrhythmus.
FC.section({
  id: "health",
  tab: "verlauf",
  order: 35,
  css: `
    .hs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 16px; }
    .hs-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .hs-val { font-family: var(--font-display); font-size: 1.6rem; font-weight: 600; font-variant-numeric: tabular-nums; }
    .hs-val small { font-size: .9rem; color: var(--ink-3); margin-left: 3px; font-weight: 500; }
    .pill.st-ok { background: var(--good-wash); color: var(--good); }
    .pill.st-watch { background: var(--warn-wash); color: var(--warn); }
    .pill.st-none { background: var(--line); color: var(--ink-2); }
    .rhythm { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; }
    .rhythm b { display: block; font-family: var(--font-display); font-size: 1.4rem; }`,
  METRICS: [
    { key: "hrv", label: "HRV", unit: "ms", good: "above", dec: 0, color: "--s1" },
    { key: "rhr", label: "Ruhepuls", unit: "bpm", good: "below", dec: 0, color: "--s2" },
    { key: "respRate", label: "Atemfrequenz", unit: "/min", good: "below", dec: 1, color: "--s3" },
    { key: "skinTemp", label: "Hauttemperatur", unit: "°C", good: null, dec: 1, color: "--s2" },
    { key: "spo2", label: "Sauerstoffsättigung", unit: "%", good: "above", dec: 1, color: "--s1" },
    { key: "sleepH", label: "Schlaf", unit: "h", good: "above", dec: 1, color: "--s7" },
  ],
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-health">Körpersignale</h2><span class="muted">gegen deinen Normalbereich (Mittel ± 1 Standardabweichung der Tage −34 bis −7)</span></div>
      <div class="hs-grid" id="hsGrid"></div>
      <div class="panel" style="margin-top:16px"><h3>Schlafrhythmus (14 Nächte)</h3><div class="rhythm" id="hsRhythm"></div><p class="chart-cap" id="hsNote"></p></div>`;
    this.root = root;
    FC.onRange(() => this.subscribe());
  },
  ready() { this.subscribe(); },
  subscribe() {
    this.unwatch?.();
    const days = Math.min(365, FC.state.range);
    this.unwatch = FC.watch("get_health_trends", { days }, (p, err) => { this.payload = p ?? { error: FC.errText(err) }; if (FC.state.data) this.render(); });
  },
  statusText(m, st) {
    if (st === "unknown") return ["zu wenig Daten", "st-none"];
    if (st === "normal") return ["im Normalbereich", "st-ok"];
    const word = st === "above" ? "über Normal" : "unter Normal";
    if (!m.good) return [word, "st-watch"];
    return [word, st === m.good ? "st-ok" : "st-watch"];
  },
  render() {
    const { $, el, chart, cssVar, de } = FC, p = this.payload, grid = $("hsGrid");
    if (!p) { grid.replaceChildren(el("div", { class: "empty", text: "Lädt …" })); return; }
    if (p.error) { grid.replaceChildren(el("div", { class: "empty", text: p.error })); return; }
    grid.replaceChildren();
    for (const m of this.METRICS) {
      const t = p.metrics?.[m.key];
      if (!t || !t.band?.some((b) => b.value != null)) continue;
      const [stText, stCls] = this.statusText(m, t.status);
      const box = el("div", { class: "chart" });
      const panel = el("div", { class: "panel" },
        el("div", { class: "hs-head" }, el("h3", { text: m.label }), el("span", { class: `pill ${stCls}`, text: stText })),
        el("div", { class: "hs-val" }, t.avg7 != null ? de(t.avg7, m.dec) : "–", el("small", { text: `${m.unit} · 7-Tage-Mittel` })),
        el("div", { class: "muted", text: t.baseline != null ? `Basis ${de(t.baseline, m.dec)} ${m.unit}, zuletzt ${t.last != null ? de(t.last, m.dec) : "–"} ${m.unit}` : "Basis braucht mindestens 7 Werte" }),
        box);
      grid.append(panel);
      chart(box, { days: t.band, height: 140, aria: `${m.label} mit Normalbereich`, bandFn: (b) => ({ lo: b.low, hi: b.high }), series: [
        { label: m.label, kind: "line", color: cssVar(m.color), width: 1, dots: true, value: (b) => b.value, fmt: (v) => `${de(v, m.dec)} ${m.unit}` },
        { label: "7-Tage-Mittel", kind: "line", color: cssVar(m.color), width: 2.5, value: (b) => b.avg7, fmt: (v) => `${de(v, m.dec)} ${m.unit}` },
      ] });
    }
    if (!grid.children.length) grid.append(el("div", { class: "empty", text: "Noch keine Werte im Zeitraum." }));
    const s = p.sleep?.last14d, r = $("hsRhythm");
    const cell = (label, v, hint) => el("div", {}, el("span", { class: "muted", text: label }), el("b", { text: v }), ...(hint ? [el("span", { class: "muted", text: hint })] : []));
    r.replaceChildren(...(s?.nights ? [
      cell("Ins Bett", s.avgBedtime ?? "–", s.bedtimeSdMin != null ? `± ${de(s.bedtimeSdMin)} min` : null),
      cell("Aufstehen", s.avgWake ?? "–", s.wakeSdMin != null ? `± ${de(s.wakeSdMin)} min` : null),
      cell("Schlafschuld 7 Tage", s.debt7dH != null ? `${de(s.debt7dH, 1)} h` : "–", `Bedarf ${de(p.sleep.sleepNeedH, 1)} h/Nacht`),
      cell("HRV-Unruhe", p.hrvStabilityCvPct != null ? `${de(p.hrvStabilityCvPct, 1)} %` : "–", "Schwankung der letzten 7 Tage"),
    ] : [el("div", { class: "empty", text: "Noch keine Nächte." })]));
    $("hsNote").textContent = "Je kleiner die ± Minuten, desto regelmäßiger dein Rhythmus. Werte außerhalb des Normalbereichs sind ein Hinweis, keine Diagnose.";
  },
  rerender() { if (this.payload) this.render(); },
});
