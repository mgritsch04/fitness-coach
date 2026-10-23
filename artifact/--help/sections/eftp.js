// eFTP-Verlauf (#200) aus get_eftp_trend: FTP-Schätzung je Woche gegen die eingestellte FTP und FTP-Tests.
FC.section({
  id: "eftp",
  tab: "verlauf",
  order: 39,
  css: `
    .ef-hints { margin: 0; padding-left: 1.1rem; display: grid; gap: 6px; }
    .ef-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px 18px; margin-top: 12px; }
    .ef-kpis div { display: grid; gap: 2px; } .ef-kpis b { font-family: var(--font-display); font-size: 1.3rem; }
    .ef-test { border-left: 4px solid var(--warn); padding: 4px 0 4px 10px; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-eftp">FTP-Schätzung im Verlauf</h2><span class="muted" id="efRange"></span></div>
      <div class="panel"><ul class="ef-hints" id="efHints"><li class="muted">Lädt …</li></ul><div class="ef-kpis" id="efKpis"></div>
        <div class="chart" id="cEftp" hidden></div></div>
      <p class="chart-cap" id="efNotes"></p>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_eftp_trend", { weeks: 26 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de, cssVar } = FC, r = this.rep;
    const hints = $("efHints");
    if (!hints || !r) return;
    $("efNotes").textContent = `${r.available ? "Fläche: Spanne der Ansätze. Gestrichelt: eingestellte FTP. " : ""}${r.notes?.join(" ") ?? ""}`;
    if (r.error || !r.available) {
      hints.replaceChildren(el("li", { class: "muted", text: r.error ?? r.reason }));
      $("efKpis").replaceChildren(); $("cEftp").hidden = true; $("efRange").textContent = "";
      return;
    }
    hints.replaceChildren(...r.hints.map((h, i) => el("li", { class: r.suggestTest && i === r.hints.length - 1 ? "ef-test" : "", text: h })));
    $("efRange").textContent = `${r.range.weeks} Wochen`;
    const c = r.current, sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±");
    const kpi = (label, value, sub) => el("div", {}, el("span", { class: "label", text: label }), el("b", { text: value }), el("span", { class: "muted", text: sub }));
    $("efKpis").replaceChildren(
      kpi("eFTP", c ? `${c.eftpW} W` : "–", c?.wattsPerKg ? `${de(c.wattsPerKg, 2)} W/kg` : c ? `${c.low}–${c.high} W` : ""),
      kpi("6 Wochen", r.change ? `${sign(r.change.w)}${Math.abs(r.change.w)} W` : "–", r.change ? `${sign(r.change.pct)}${de(Math.abs(r.change.pct), 1)} %` : "zu wenig Daten"),
      kpi("Eingestellt", r.ftpW ? `${r.ftpW} W` : "–", r.deviationPct != null ? `Schätzung ${sign(r.deviationPct)}${de(Math.abs(r.deviationPct), 1)} %` : "keine FTP gesetzt"),
    );
    const box = $("cEftp"); box.hidden = false;
    FC.chart(box, {
      days: r.points,
      series: [
        { label: "eFTP", color: cssVar("--accent") || "#4fb3cf", kind: "line", value: (p) => p.eftpW, dots: true },
        { label: "FTP-Test", color: "#fab219", kind: "line", value: (p) => p.testW, dots: true, width: 0 },
      ],
      bandFn: (p) => (p.low != null ? { lo: p.low, hi: p.high } : null),
      ref: r.ftpW ? { value: r.ftpW } : undefined,
      height: 180,
      aria: "Geschätzte FTP je Woche mit Spanne, gestrichelt die eingestellte FTP",
    });
  },
});
