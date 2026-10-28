// Jahresübersicht (#25): Kalender-Heatmap der Tagesbelastung über 12 Monate, Serien und Spitzenwerte (get_training_load).
FC.section({
  id: "year",
  tab: "training",
  order: 58,
  css: `
    .yr-wrap { overflow-x: auto; padding-bottom: 4px; }
    .yr-wrap svg { display: block; }
    .yr-wrap text { font-size: 11px; fill: var(--ink-3); }
    .yr-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 12px; }
    .yr-stats b { display: block; font-family: var(--font-display); font-size: 1.5rem; font-variant-numeric: tabular-nums; }
    .yr-legend { display: flex; align-items: center; gap: 4px; font-size: .8rem; color: var(--ink-2); margin-top: 6px; }
    .yr-legend i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-year">Jahr im Überblick</h2><span class="muted">Belastung je Tag, letzte 12 Monate</span></div>
      <div class="panel"><div class="yr-stats" id="yrStats"></div><div class="yr-wrap" id="yrMap" tabindex="0" role="region" aria-label="Jahreskalender, waagrecht scrollbar"></div><div class="yr-legend" id="yrLegend"></div>
        <p class="chart-cap">Kästchen = ein Tag, je dunkler, desto mehr Belastung (geschätzt, TSS-Maßstab). Eine Serie zählt Tage mit Training ohne Unterbrechung.</p></div>`;
  },
  ready() {
    this.unwatch?.();
    this.unwatch = FC.watch("get_training_load", { days: 365 }, (p, err) => { this.payload = p ?? { error: FC.errText(err) }; if (FC.state.data) this.render(); },
      { cache: { staleTime: 600_000, gcTime: 86_400_000 } });
  },
  STEPS: [0, 1, 40, 80, 120],
  level(v) { let l = 0; for (let i = 1; i < this.STEPS.length; i++) if (v >= this.STEPS[i]) l = i; return l; },
  render() {
    const { $, el, sv, de, fmtDayLong, cssVar } = FC, p = this.payload, map = $("yrMap");
    if (!p || p.error) { map.replaceChildren(el("div", { class: "empty", text: p?.error ?? "Lädt …" })); $("yrStats").replaceChildren(); return; }
    const days = p.days ?? [];
    if (!days.length) { map.replaceChildren(el("div", { class: "empty", text: "Noch keine Daten." })); return; }
    // Spalten = Wochen (Mo–So), erste Spalte ab dem Montag vor dem ersten Tag.
    const dow = (d) => (new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7;
    const cell = 13, gap = 3, top = 16, left = 22;
    const weeks = Math.ceil((dow(days[0].day) + days.length) / 7);
    const W = left + weeks * (cell + gap), H = top + 7 * (cell + gap);
    const svg = sv("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Kalender der Tagesbelastung" });
    const accent = cssVar("--accent"), empty = cssVar("--line");
    const opac = [0, 0.3, 0.5, 0.75, 1];
    ["Mo", "", "Mi", "", "Fr", "", ""].forEach((t, i) => { if (t) { const x = sv("text", { x: 0, y: top + i * (cell + gap) + 10 }); x.textContent = t; svg.append(x); } });
    let lastMonth = "";
    days.forEach((p, i) => {
      const idx = dow(days[0].day) + i, col = Math.floor(idx / 7), row = idx % 7;
      const x = left + col * (cell + gap), y = top + row * (cell + gap);
      const m = p.day.slice(0, 7);
      if (m !== lastMonth && (row === 0 || i === 0)) { const t = sv("text", { x, y: 10 }); t.textContent = new Date(p.day + "T00:00:00Z").toLocaleDateString("de-DE", { month: "short", timeZone: "UTC" }); svg.append(t); lastMonth = m; }
      const l = this.level(p.load ?? 0);
      const r = sv("rect", { x, y, width: cell, height: cell, rx: 3, fill: l ? accent : empty, "fill-opacity": l ? opac[l] : 1 });
      const tt = sv("title"); tt.textContent = `${fmtDayLong(p.day)}: ${p.load ? `Belastung ${de(p.load)}` : "kein Training"}`; r.append(tt);
      svg.append(r);
    });
    map.replaceChildren(svg);
    map.scrollLeft = map.scrollWidth;
    $("yrLegend").replaceChildren(el("span", { text: "weniger" }), ...opac.map((o, i) => { const k = el("i"); k.style.background = i ? accent : empty; k.style.opacity = i ? o : 1; return k; }), el("span", { text: "mehr" }));
    // Serien und Spitzen
    let longest = 0, run = 0;
    for (const p of days) { run = p.load > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
    let current = 0; for (let i = days.length - 1; i >= 0 && days[i].load > 0; i--) current++;
    const trained = days.filter((p) => p.load > 0).length;
    const top1 = days.reduce((a, b) => ((b.load ?? 0) > (a.load ?? 0) ? b : a));
    const peakCtl = days.reduce((a, b) => ((b.ctl ?? 0) > (a.ctl ?? 0) ? b : a));
    const stat = (label, v, hint) => el("div", {}, el("span", { class: "muted", text: label }), el("b", { text: v }), ...(hint ? [el("span", { class: "muted", text: hint })] : []));
    $("yrStats").replaceChildren(
      stat("Trainingstage", `${de(trained)}`, `von ${de(days.length)} Tagen`),
      stat("Längste Serie", `${de(longest)} Tage`),
      stat("Aktuelle Serie", `${de(current)} Tage`, current >= 6 ? "Ruhetag einplanen" : null),
      stat("Härtester Tag", top1.load ? de(top1.load) : "–", top1.load ? fmtDayLong(top1.day) : null),
      stat("Höchste Fitness", peakCtl.ctl ? de(peakCtl.ctl) : "–", peakCtl.ctl ? fmtDayLong(peakCtl.day) : null));
  },
  rerender() { const m = FC.$("yrMap"); if (m) m.scrollLeft = m.scrollWidth; }, // nach Tab-Wechsel zum heutigen Ende scrollen
});
