// Zeit in Pulszonen je Woche (WHOOP-Zonen aus get_dashboard.hrZones, #19) als gestapelte Balken.
FC.section({
  id: "hrzones",
  tab: "training",
  order: 47,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-hrzones">Pulszonen</h2><span class="muted">Zeit je Zone und Woche, gemessen von WHOOP</span></div>
      <div class="panel"><div class="pc-stats" id="hzStats"></div><div class="chart" id="cHrZones"></div>
        <p class="chart-cap" id="hzCap">Zonen in % der maximalen Herzfrequenz. Locker = Zone 1–3, mittel = 4, hart = 5; Zone 0 (z. B. Pausen im Krafttraining) zählt nicht zur Verteilung.</p></div>`;
  },
  render(d) {
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
});
