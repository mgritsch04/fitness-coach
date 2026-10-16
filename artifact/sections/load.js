// Trainingslast: Fitness/Ermüdung, Form, Tagesbelastung.
FC.section({
  id: "load",
  tab: "training",
  order: 40,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-load">Trainingslast</h2><span class="muted">Belastung im TSS-Maßstab (1 Stunde an der Schwelle ≈ 100), geschätzt</span></div>
      <div class="grid2">
        <div class="panel"><h3>Fitness und Ermüdung</h3><div class="chart" id="cCtl"></div><p class="chart-cap" id="ctlCap"></p></div>
        <div class="panel"><h3>Form</h3><div class="chart" id="cTsb"></div><p class="chart-cap">Fitness minus Ermüdung. Unter −30 sehr müde, −30 bis −10 (Band) produktives Training, über +5 ausgeruht.</p></div>
        <div class="panel span2"><h3>Tagesbelastung</h3><div class="chart" id="cLoad"></div></div>
      </div>`;
  },
  render(d) {
    const { $, chart, cssVar, de, state } = FC;
    const rows = d.days.slice(-state.range);
    // Formprognose bis zum Ziel-Event (#26), gestrichelt hinter der echten Kurve.
    const proj = d.training?.projection;
    const future = (proj?.days ?? []).filter((p) => p.day > d.today).map((p) => ({ day: p.day, ctlP: p.ctl, tsbP: p.tsb }));
    const last = rows.at(-1);
    const ctlRows = future.length ? [...rows.slice(0, -1), { ...last, ctlP: last?.ctl }, ...future] : rows;
    chart($("cCtl"), { days: ctlRows, yMin: 0, aria: "Fitness und Ermüdung", series: [
      { label: "Fitness (CTL)", kind: "line", color: cssVar("--s1"), value: (p) => p.ctl },
      { label: "Ermüdung (ATL)", kind: "line", color: cssVar("--s2"), value: (p) => p.atl },
      ...(future.length ? [{ label: "Prognose", kind: "line", color: cssVar("--s1"), dash: "5 4", width: 1.5, value: (p) => p.ctlP }] : []),
    ] });
    $("ctlCap").textContent = future.length
      ? `Fitness = 42-Tage-Mittel der Belastung, Ermüdung = 7-Tage-Mittel. Gestrichelt: Prognose bis „${proj.goal.title}“ (${proj.daysLeft} Tage), wenn du den Plan einhältst – eine Schätzung.`
      : "Fitness = 42-Tage-Mittel der Belastung, Ermüdung = 7-Tage-Mittel.";
    chart($("cTsb"), { days: rows, zero: true, aria: "Form", zones: [{ from: -30, to: -10, color: cssVar("--band") }],
      series: [{ label: "Form (TSB)", kind: "bar", color: cssVar("--s3"), barColor: (p) => (p.tsb < 0 ? cssVar("--s2") : cssVar("--s3")), value: (p) => p.tsb }] });
    chart($("cLoad"), { days: rows, yMin: 0, height: 160, aria: "Tagesbelastung", series: [{ label: "Belastung", kind: "bar", color: cssVar("--accent"), value: (p) => p.load || null }],
      extraTip: [{ label: "Training", color: cssVar("--ink-3"), value: (p) => p.trainingMin || null, fmt: (v) => `${de(v)} min` }, { label: "Strain", color: cssVar("--ink-3"), value: (p) => p.strain, fmt: (v) => de(v, 1) }] });
  },
});
