// Zeit in Pulszonen je Woche (WHOOP-Zonen aus get_dashboard.hrZones, #19) als gestapelte Balken.
FC.section({
  id: "hrzones",
  tab: "training",
  order: 47,
  css: `
    .hz-t { display: grid; gap: 6px; margin-top: 8px; }
    .hz-row { display: grid; grid-template-columns: 120px 1fr 92px; gap: 8px; align-items: center; font-size: 0.9rem; }
    .hz-track { position: relative; height: 12px; background: var(--grid); border-radius: 3px; }
    .hz-track span { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; }
    .hz-track .hz-plan { border: 1px dashed var(--ink-3); background: transparent; }
    .hz-track .hz-done { top: 3px; bottom: 3px; }
    .hz-row b { text-align: right; font-weight: 600; }
    .hz-hints { margin: 8px 0 0; padding-left: 1.1rem; display: grid; gap: 4px; }
    @media (max-width: 520px) { .hz-row { grid-template-columns: 92px 1fr 84px; font-size: 0.84rem; } }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-hrzones">Pulszonen</h2><span class="muted">Zeit je Zone und Woche, gemessen von WHOOP</span></div>
      <div class="panel"><div class="pc-stats" id="hzStats"></div><div class="chart" id="cHrZones"></div>
        <div id="hzTargets" hidden><h3>Diese Woche: Plan gegen Ist</h3><div class="hz-t" id="hzRows"></div><ul class="hz-hints" id="hzHints"></ul></div>
        <p class="chart-cap" id="hzCap">Zonen in % der maximalen Herzfrequenz. Locker = Zone 1–3, mittel = 4, hart = 5; Zone 0 (z. B. Pausen im Krafttraining) zählt nicht zur Verteilung.</p></div>`;
  },
  render(d) {
    this.targets(d.zoneTargets);
    const { $, el, chart, cssVar, de, fmtDay, addDays, state } = FC, z = d.hrZones;
    const box = $("cHrZones"), stats = $("hzStats");
    if (!z) { box.replaceChildren(el("div", { class: "empty", text: "Noch keine Pulszonen." })); stats.replaceChildren(); return; }
    const from = d.days.at(-state.range)?.day ?? d.range.from;
    const weeks = z.weeks.filter((w) => addDays(w.week, 6) >= from).map((w) => ({ ...w, day: w.week }));
    const colors = ["--ink-3", "--s7", "--s1", "--good", "--warn", "--bad"].map(cssVar);
    chart(box, {
      days: weeks, yMin: 0, maxBar: 28, aria: "Minuten je Pulszone und Woche", xFmt: (p) => fmtDay(p.week),
      series: z.scheme.map((s, i) => ({ label: `Z${s.zone}`, kind: "stack", color: colors[i], value: (p) => p.minutes[i] || null, fmt: (v) => `${de(v)} min · ${s.name}` })),
      extraTip: [{ label: "locker / mittel / hart", color: cssVar("--ink-3"), value: (p) => (p.totalMin ? `${de(p.easyPct)} / ${de(p.moderatePct)} / ${de(p.hardPct)} %` : null), fmt: (v) => v }],
    });
    const t = weeks.reduce((a, w) => { w.minutes.forEach((m, i) => (a[i] += m)); return a; }, [0, 0, 0, 0, 0, 0]);
    const active = t.slice(1).reduce((a, b) => a + b, 0);
    const pct = (xs) => (active ? Math.round((xs.reduce((a, b) => a + b, 0) / active) * 100) : 0);
    stats.replaceChildren(
      el("span", {}, el("b", { text: `${pct(t.slice(1, 4))} %` }), " locker"),
      el("span", {}, el("b", { text: `${pct([t[4]])} %` }), " mittel"),
      el("span", {}, el("b", { text: `${pct([t[5]])} %` }), " hart"),
      el("span", { class: "muted", text: z.verdict ?? "" }),
    );
  },
  // Zeit-in-Zone-Ziele (#214): gestrichelt = Soll der ganzen Woche, gefüllt = gemessen.
  targets(t) {
    const { $, el, cssVar, de } = FC;
    const box = $("hzTargets");
    if (!box) return;
    box.hidden = !t || !t.target.totalMin;
    if (box.hidden) return;
    const max = Math.max(1, ...t.rows.map((r) => Math.max(r.targetMin, r.actualMin ?? 0)));
    const colors = { easy: cssVar("--good"), moderate: cssVar("--warn"), hard: cssVar("--bad") };
    $("hzRows").replaceChildren(...t.rows.map((r) => {
      const plan = el("span", { class: "hz-plan" }); plan.style.width = `${(r.targetMin / max) * 100}%`;
      const done = el("span", { class: "hz-done" }); done.style.width = `${((r.actualMin ?? 0) / max) * 100}%`; done.style.background = colors[r.bucket];
      return el("div", { class: "hz-row" }, el("span", { text: r.label }),
        el("div", { class: "hz-track", role: "img", "aria-label": `${r.label}: ${r.actualMin ?? 0} von geplant ${r.targetMin} Minuten` }, plan, done),
        el("b", { text: `${r.actualMin == null ? "–" : de(r.actualMin)} / ${de(r.targetMin)} min` }));
    }));
    $("hzHints").replaceChildren(...t.hints.map((h) => el("li", { text: h })));
  },
});
