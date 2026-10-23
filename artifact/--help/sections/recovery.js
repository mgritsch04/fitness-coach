// Erholung und Schlaf: Verläufe mit Zeitraum-Umschalter (gilt für alle Verlaufs-Abschnitte).
FC.section({
  id: "recovery",
  tab: "verlauf",
  order: 30,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head">
        <h2 id="h-recovery">Erholung und Schlaf</h2>
        <div class="seg" role="group" aria-label="Zeitraum" id="range">
          <button type="button" data-days="30">30 Tage</button>
          <button type="button" data-days="90">90 Tage</button>
          <button type="button" data-days="180">180 Tage</button>
        </div>
      </div>
      <div class="grid2">
        <div class="panel"><h3>Erholung</h3><div class="chart" id="cRecovery"></div><p class="chart-cap">Grün ab 67 %, rot unter 34 % (WHOOP-Skala).</p></div>
        <div class="panel"><h3>HRV</h3><div class="chart" id="cHrv"></div><p class="chart-cap">Dicke Linie: 7-Tage-Mittel. Band: deine Basis (28 Tage) ± halbe Standardabweichung.</p></div>
        <div class="panel"><h3>Ruhepuls</h3><div class="chart" id="cRhr"></div></div>
        <div class="panel"><h3>Schlaf</h3><div class="chart" id="cSleep"></div><p class="chart-cap" id="sleepCap">Gestrichelt: dein Schlafbedarf.</p></div>
      </div>`;
    const btns = root.querySelectorAll("#range button");
    const mark = () => btns.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.days) === FC.state.range)));
    btns.forEach((b) => b.addEventListener("click", () => FC.setRange(Number(b.dataset.days))));
    FC.onRange(mark); mark();
  },
  render(d) {
    const { $, chart, cssVar, de, fmtH, rolling, recStatus, state } = FC;
    const hrv7 = rolling(d.days, "hrv").slice(-state.range), rhr7 = rolling(d.days, "rhr").slice(-state.range);
    const rows = d.days.slice(-state.range).map((p, i) => ({ ...p, hrv7: hrv7[i], rhr7: rhr7[i] }));
    const statusColor = (p) => cssVar({ good: "--good", warn: "--warn", bad: "--bad", none: "--ink-3" }[recStatus(p.recovery)]);
    chart($("cRecovery"), { days: rows, yMin: 0, yMax: 100, aria: "Erholung pro Tag", series: [{ label: "Erholung", kind: "bar", color: cssVar("--good"), barColor: statusColor, value: (p) => p.recovery, fmt: (v) => `${de(v)} %` }] });
    const t = d.trends.hrv;
    chart($("cHrv"), { days: rows, band: t.baseline != null && t.baselineSd != null ? { lo: t.baseline - t.baselineSd / 2, hi: t.baseline + t.baselineSd / 2 } : null, aria: "HRV", series: [
      { label: "HRV", kind: "line", color: cssVar("--s1"), width: 1, dots: true, value: (p) => p.hrv, fmt: (v) => `${de(v)} ms` },
      { label: "7-Tage-Mittel", kind: "line", color: cssVar("--s1"), width: 2.5, value: (p) => p.hrv7, fmt: (v) => `${de(v)} ms` },
    ] });
    chart($("cRhr"), { days: rows, aria: "Ruhepuls", series: [
      { label: "Ruhepuls", kind: "line", color: cssVar("--s2"), width: 1, dots: true, value: (p) => p.rhr, fmt: (v) => `${de(v)} bpm` },
      { label: "7-Tage-Mittel", kind: "line", color: cssVar("--s2"), width: 2.5, value: (p) => p.rhr7, fmt: (v) => `${de(v)} bpm` },
    ] });
    chart($("cSleep"), { days: rows, yMin: 0, ref: { value: d.settings.sleepNeedH }, aria: "Schlafdauer",
      series: [{ label: "Schlaf", kind: "bar", color: cssVar("--s7"), value: (p) => p.sleepH, fmt: (v) => `${fmtH(v)} h` }],
      extraTip: [{ label: "Tiefschlaf", color: cssVar("--ink-3"), value: (p) => p.deepH, fmt: (v) => `${fmtH(v)} h` }, { label: "REM", color: cssVar("--ink-3"), value: (p) => p.remH, fmt: (v) => `${fmtH(v)} h` }, { label: "Leistung", color: cssVar("--ink-3"), value: (p) => p.sleepPerf, fmt: (v) => `${de(v)} %` }] });
    $("sleepCap").textContent = `Gestrichelt: dein Schlafbedarf (${de(d.settings.sleepNeedH, 1)} h${d.settings.origin.sleepNeedH === "user" ? "" : ", Standardwert"}).`;
  },
});
