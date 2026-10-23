// Ausdauer-Profil (#92) aus get_endurance_profile: Critical Power, W′, Haltezeiten und Effizienz-Trend.
FC.section({
  id: "endurance",
  tab: "training",
  order: 48,
  css: `
    .en-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px 20px; margin-bottom: 10px; }
    .en-stats div { display: grid; gap: 2px; } .en-stats b { font-family: var(--font-display); font-size: 1.3rem; }
    .en-hold { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    .en-hold td, .en-hold th { padding: 4px 6px; border-bottom: 1px solid var(--line); text-align: left; }
    .en-hold th { font-weight: 600; color: var(--ink-2); }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-endurance">Ausdauer-Profil</h2><span class="muted">Critical Power und Effizienz</span></div>
      <div class="grid2">
        <div class="panel"><h3>Critical Power</h3><div class="en-stats" id="enStats"><span class="muted">Lädt …</span></div><p class="chart-cap" id="enNote"></p>
          <table class="en-hold"><thead><tr><th>Leistung</th><th>etwa haltbar</th></tr></thead><tbody id="enHold"></tbody></table></div>
        <div class="panel"><h3>Effizienz (Watt je Herzschlag)</h3><p id="enVerdict"></p><div class="chart" id="cEf"></div>
          <p class="chart-cap">Normierte Leistung geteilt durch den mittleren Puls lockerer Fahrten ab 30 min, Wochenmittel. Höher ist besser.</p></div>
      </div>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_endurance_profile", {}, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de, chart, cssVar, fmtDay } = FC, r = this.rep;
    const stats = $("enStats");
    if (!stats || !r) return;
    if (r.error) { stats.replaceChildren(el("div", { class: "muted", text: r.error })); return; }
    const cp = r.criticalPower;
    const stat = (label, value, sub) => el("div", {}, el("span", { class: "label", text: label }), el("b", { text: value }), sub ? el("span", { class: "muted", text: sub }) : null);
    const CONF = { high: "gute Datenbasis", medium: "mittlere Datenbasis", low: "unsichere Datenbasis" };
    const dur = (s) => (s == null ? "sehr lange" : s < 120 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${de(s / 3600, 1)} h`);
    if (!cp) {
      stats.replaceChildren(el("div", { class: "muted", text: "Noch zu wenige Bestleistungen über 3, 5, 10 und 20 min (aus FIT-Dateien der letzten 90 Tage)." }));
      $("enNote").textContent = ""; $("enHold").replaceChildren();
    } else {
      stats.replaceChildren(...[
        stat("CP", `${de(cp.cpW)} W`, CONF[cp.confidence]),
        stat("W′", `${de(cp.wPrimeKj, 1)} kJ`, "Vorrat über CP"),
        r.cpVsFtpPct != null ? stat("gegen FTP", `${r.cpVsFtpPct > 0 ? "+" : r.cpVsFtpPct < 0 ? "−" : "±"}${de(Math.abs(r.cpVsFtpPct), 1)} %`, `FTP ${de(r.ftpW)} W`) : null,
      ].filter(Boolean));
      $("enNote").textContent = cp.note;
      $("enHold").replaceChildren(...r.holdTimes.map((h) => el("tr", {}, el("td", { text: `${de(h.watts)} W` }), el("td", { text: h.seconds == null ? (h.watts >= cp.cpW ? "lange, an der Grenze" : "sehr lange") : dur(h.seconds) }))));
    }
    const ef = r.efficiency;
    $("enVerdict").textContent = ef.weekly.length < 2 ? "" : ef.verdict;
    const box = $("cEf");
    if (ef.weekly.length < 2) { box.replaceChildren(el("div", { class: "empty", text: "Noch zu wenige lockere Fahrten mit Leistung und Puls." })); return; }
    chart(box, { days: ef.weekly.map((w) => ({ ...w, day: w.week })), aria: "Effizienz-Faktor je Woche", xFmt: (p) => fmtDay(p.week), series: [
      { label: "EF", kind: "line", color: cssVar("--accent"), width: 2.5, dots: true, value: (w) => w.ef, fmt: (v) => de(v, 2) },
    ], extraTip: [{ label: "Fahrten", color: cssVar("--ink-3"), value: (w) => w.rides, fmt: (v) => String(v) }] });
  },
});
