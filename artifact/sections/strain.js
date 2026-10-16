// Belastung und Erholung am Folgetag (get_strain_recovery): Mittelwerte je Strain- und Belastungsstufe, Beobachtungen.
FC.section({
  id: "strain",
  tab: "verlauf",
  order: 38,
  css: `
    .sr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 16px; }
    .sr-row { display: grid; grid-template-columns: 8.5em minmax(0, 1fr) 6.5em; gap: 8px; align-items: center; font-size: .9rem; padding: 3px 0; }
    .sr-bar { height: 10px; background: var(--line); border-radius: 5px; overflow: hidden; }
    .sr-bar i { display: block; height: 100%; border-radius: 5px; }
    .sr-row .num { text-align: right; }
    .sr-ins { margin: 8px 0 0; padding-left: 1.2em; display: grid; gap: 4px; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-strain">Belastung und Erholung</h2><span class="muted">Wie erholt warst du am Tag nach viel oder wenig Belastung?</span></div>
      <div class="sr-grid">
        <div class="panel"><h3>Nach WHOOP-Strain</h3><div id="srStrain"></div></div>
        <div class="panel"><h3>Nach Trainingsbelastung</h3><div id="srLoad"></div></div>
        <div class="panel"><h3>Was auffällt</h3><div id="srBal"></div><ul class="sr-ins" id="srIns"></ul></div>
      </div>
      <p class="chart-cap" id="srCap"></p>`;
    FC.onRange(() => this.subscribe());
  },
  ready() { this.subscribe(); },
  subscribe() {
    this.unwatch?.();
    this.unwatch = FC.watch("get_strain_recovery", { days: Math.max(30, Math.min(365, FC.state.range)) }, (p, err) => { this.payload = p ?? { error: FC.errText(err) }; if (FC.state.data) this.render(); });
  },
  bars(rows) {
    const { el, de, cssVar, recStatus } = FC;
    const shown = rows.filter((r) => r.days > 0);
    if (!shown.length) return [el("div", { class: "empty", text: "Noch zu wenige Tage." })];
    return shown.map((r) => {
      const i = el("i"); i.style.width = `${r.avgNextRecovery ?? 0}%`;
      i.style.background = cssVar({ good: "--good", warn: "--warn", bad: "--bad", none: "--ink-3" }[recStatus(r.avgNextRecovery)]);
      return el("div", { class: "sr-row", title: r.avgNextHrv != null ? `Ø HRV am Folgetag ${de(r.avgNextHrv)} ms` : "" },
        el("span", { text: r.label }), el("span", { class: "sr-bar" }, i),
        el("span", { class: "num", text: `${r.avgNextRecovery != null ? `${de(r.avgNextRecovery)} %` : "–"} · ${r.days} T` }));
    });
  },
  render() {
    const { $, el, de } = FC, p = this.payload;
    if (!p || p.error) { $("srStrain").replaceChildren(el("div", { class: "empty", text: p?.error ?? "Lädt …" })); $("srLoad").replaceChildren(); return; }
    $("srStrain").replaceChildren(...this.bars(p.byStrain ?? []));
    $("srLoad").replaceChildren(...this.bars(p.byLoad ?? []));
    const b = p.balance ?? {}, c = p.correlation ?? {};
    const corr = (v) => (v == null ? "–" : Math.abs(v) < 0.2 ? `kaum (${de(v, 2)})` : `${v < 0 ? "gegenläufig" : "gleichläufig"} (${de(v, 2)})`);
    $("srBal").replaceChildren(
      el("div", { text: `Strain 7 Tage ${de(b.strain7d, 1)} gegen 28 Tage ${de(b.strain28d, 1)}` }),
      el("div", { text: `Erholung 7 Tage ${de(b.recovery7d)} % gegen 28 Tage ${de(b.recovery28d)} %` }),
      el("div", { class: "muted", text: `Zusammenhang Strain → Erholung am Folgetag: ${corr(c.strainToNextRecovery)}, ${c.n ?? 0} Tagespaare` }));
    $("srIns").replaceChildren(...(p.insights?.length ? p.insights.map((t) => el("li", { text: t })) : [el("li", { class: "muted", text: "Noch kein deutliches Muster." })]));
    $("srCap").textContent = "Beobachtungen aus deinen Daten, keine Ursache-Wirkung. Zeitraum folgt dem Umschalter oben (mindestens 30 Tage).";
  },
  rerender() { if (this.payload) this.render(); },
});
