// Intervall-Qualität (#155) aus get_interval_quality: Leistungsabfall je Serie und Verlauf je Intervallart.
FC.section({
  id: "intervals",
  tab: "training",
  order: 53,
  css: `
    .iq-hints { margin: 0; padding-left: 1.1rem; display: grid; gap: 6px; }
    .iq-tab { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    .iq-tab td, .iq-tab th { padding: 4px 6px; border-bottom: 1px solid var(--line); text-align: left; }
    .iq-tab th { font-weight: 600; color: var(--ink-2); white-space: normal; }
    .iq-tab td:not(:first-child), .iq-tab th:not(:first-child) { text-align: right; }
    .iq-tab td:not(:first-child) { white-space: nowrap; }
    .iq-even, .iq-building { color: var(--good); } .iq-slight { color: var(--warn); } .iq-strong { color: var(--bad); }
    .iq-bars { display: flex; gap: 2px; align-items: flex-end; height: 18px; justify-content: flex-end; margin-top: 2px; }
    .iq-bars span { width: 5px; background: var(--accent); border-radius: 1px; }
    @media (max-width: 520px) { .iq-tab { font-size: 0.82rem; } .iq-tab td, .iq-tab th { padding: 4px 3px; } }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-intervals">Intervall-Qualität</h2><span class="muted" id="iqRange"></span></div>
      <div class="panel"><ul class="iq-hints" id="iqHints"><li class="muted">Lädt …</li></ul></div>
      <div class="grid2">
        <div class="panel"><h3>Letzte Intervalltrainings</h3>
          <table class="iq-tab"><thead><tr><th>Tag</th><th>Serie</th><th>Ø Leistung</th><th>Abfall</th></tr></thead><tbody id="iqSessions"></tbody></table></div>
        <div class="panel"><h3>Je Intervallart</h3>
          <table class="iq-tab"><thead><tr><th>Art</th><th>Einh.</th><th>Zuletzt</th><th>Seit Beginn</th></tr></thead><tbody id="iqClasses"></tbody></table></div>
      </div>
      <p class="chart-cap" id="iqNotes"></p>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_interval_quality", { days: 90 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de, fmtDay } = FC, r = this.rep;
    const hints = $("iqHints");
    if (!hints || !r) return;
    if (r.error) { hints.replaceChildren(el("li", { class: "muted", text: r.error })); return; }
    hints.replaceChildren(...r.hints.map((h) => el("li", { text: h })));
    $("iqRange").textContent = r.totalSessions ? `${r.totalSessions} Intervalltrainings, ${r.range.days} Tage` : "";
    $("iqNotes").textContent = r.notes.join(" ");
    const dur = (s) => (s >= 90 ? `${de(Math.round(s / 60))} min` : `${de(s)} s`);
    const labels = { even: "gleichmäßig", slight: "leicht", strong: "stark", building: "steigend" };
    const bars = (ws) => {
      const max = Math.max(...ws), min = Math.min(...ws) * 0.9;
      return el("div", { class: "iq-bars", "aria-hidden": "true" }, ...ws.map((w) => { const b = el("span"); b.style.height = `${Math.max(15, ((w - min) / (max - min || 1)) * 100)}%`; return b; }));
    };
    const sign = (v) => `${v > 0 ? "−" : v < 0 ? "+" : "±"}${de(Math.abs(v), 1)} %`;
    $("iqSessions").replaceChildren(...(r.sessions.length ? r.sessions.map((s) => el("tr", {},
      el("td", { text: fmtDay(s.day) }),
      el("td", {}, el("div", { text: `${s.reps} × ${dur(s.repDurationS)}` }), bars(s.repPowers)),
      el("td", {}, el("div", { text: `${de(s.avgPowerW)} W` }), ...[s.pctFtp == null ? null : el("div", { class: "muted", text: `${s.pctFtp} % FTP` })].filter(Boolean)),
      el("td", {}, el("div", { class: `iq-${s.execution}`, text: sign(s.fadePct) }), el("div", { class: "muted", text: labels[s.execution] })),
    )) : [el("tr", {}, el("td", { colspan: "4", class: "muted", text: "Noch keine Intervalltrainings erkannt." }))]));
    $("iqClasses").replaceChildren(...(r.classes.length ? r.classes.map((c) => {
      const m = c.label.match(/^(\S+) \((.+)\)$/);
      return el("tr", {},
        el("td", {}, el("div", { text: m ? m[1] : c.label }), ...[m ? el("div", { class: "muted", text: m[2] }) : null].filter(Boolean)),
        el("td", { text: String(c.sessions) }),
        el("td", {}, el("div", { text: `${de(c.latest.avgPowerW)} W` }), el("div", { class: "muted", text: `${c.latest.reps} × ${dur(c.latest.repDurationS)}` })),
        el("td", { class: c.changePct == null ? "muted" : c.changePct >= 1 ? "iq-even" : c.changePct <= -1 ? "iq-strong" : "", text: c.changePct == null ? "–" : `${c.changePct > 0 ? "+" : c.changePct < 0 ? "−" : "±"}${de(Math.abs(c.changePct), 1)} %` }),
      );
    }) : [el("tr", {}, el("td", { colspan: "4", class: "muted", text: "–" }))]));
  },
});
