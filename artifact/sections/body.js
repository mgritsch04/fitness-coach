// Körperwerte (#30) aus get_body_history: Gewichtsverlauf mit 7-Tage-Mittel, W/kg, Ziel und eigener Eintrag (log_weight).
FC.section({
  id: "body",
  tab: "verlauf",
  order: 38,
  css: `
    .bd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px 20px; margin-bottom: 12px; }
    .bd-stats div { display: grid; gap: 2px; } .bd-stats b { font-family: var(--font-display); font-size: 1.3rem; }
    .bd-log { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; margin-top: 10px; }
    .bd-log label { display: grid; gap: 4px; font-size: 0.88rem; color: var(--ink-2); }
    .bd-log input { width: 8em; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-body">Gewicht</h2><span class="muted" id="bdRange"></span></div>
      <div class="panel"><div class="bd-stats" id="bdStats"></div><div class="chart" id="cWeight"></div>
        <p class="chart-cap" id="bdCap">Punkte: einzelne Werte (WHOOP-Profil oder eigener Eintrag), Linie: 7-Tage-Mittel.</p>
        <form class="bd-log" id="bdForm" autocomplete="off">
          <label for="bdKg">Gewicht heute (kg)<input id="bdKg" type="number" min="30" max="250" step="0.1" inputmode="decimal" required></label>
          <button type="submit" class="primary" id="bdSave">Eintragen</button><span class="muted" id="bdMsg" role="status"></span>
        </form></div>`;
    FC.$("bdForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { $ } = FC, kg = Number($("bdKg").value.replace(",", "."));
      if (!(kg >= 30 && kg <= 250)) return;
      $("bdSave").disabled = true; $("bdMsg").textContent = "Speichere …";
      try {
        this.rep = await FC.call("log_weight", { weightKg: kg });
        $("bdMsg").textContent = "Gespeichert."; $("bdKg").value = "";
        this.show(); this.load(); FC.invalidate();
      } catch (err) { $("bdMsg").textContent = err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err); }
      finally { $("bdSave").disabled = false; }
    });
  },
  ready() { this.load(); FC.onRange(() => this.load()); },
  load() {
    this.stop?.();
    this.stop = FC.watch("get_body_history", { days: Math.max(30, FC.state.range) }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, chart, cssVar, de, fmtDay } = FC, r = this.rep;
    const stats = $("bdStats");
    if (!stats || !r) return;
    if (r.error) { stats.replaceChildren(el("div", { class: "muted", text: r.error })); return; }
    const s = r.summary, kg = (v, d = 1) => (v == null ? "–" : `${de(v, d)} kg`);
    const signed = (v) => (v == null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${de(Math.abs(v), 1)} kg`);
    $("bdRange").textContent = s.latest ? `zuletzt ${fmtDay(s.latest.day)}${s.latest.source === "manual" ? " (eigener Eintrag)" : ""}` : "";
    const stat = (label, value, sub) => el("div", {}, el("span", { class: "label", text: label }), el("b", { text: value }), sub ? el("span", { class: "muted", text: sub }) : null);
    stats.replaceChildren(...[
      stat("Aktuell", kg(s.latest?.weightKg), s.bmi != null ? `BMI ${de(s.bmi, 1)}` : null),
      stat("30 Tage", signed(s.change30dKg), s.change7dKg != null ? `7 Tage ${signed(s.change7dKg)}` : null),
      stat("Trend", s.trendKgPerWeek == null ? "–" : `${signed(s.trendKgPerWeek)}/Woche`, "Schätzung aus 4 Wochen"),
      stat("W/kg", r.wattsPerKg.value == null ? "–" : de(r.wattsPerKg.value, 2), r.wattsPerKg.ftpW ? `FTP ${de(r.wattsPerKg.ftpW)} W${r.wattsPerKg.ftpOrigin === "user" ? "" : " (geschätzt)"}` : "FTP unbekannt"),
      r.goal ? stat(r.goal.title, kg(r.goal.targetValue), r.goal.remainingKg == null ? null : `noch ${signed(r.goal.remainingKg)}${r.goal.neededKgPerWeek != null ? `, nötig ${signed(r.goal.neededKgPerWeek)}/Woche` : ""}${r.goal.onTrack === true ? " · auf Kurs" : r.goal.onTrack === false ? " · nicht auf Kurs" : ""}`) : null,
    ].filter(Boolean));
    const box = $("cWeight");
    if (!r.points.length) { box.replaceChildren(el("div", { class: "empty", text: "Noch kein Gewicht. Trag oben einen Wert ein oder pflege es im WHOOP-Profil." })); return; }
    chart(box, { days: r.points, aria: "Gewichtsverlauf", ref: r.goal?.targetValue != null ? { value: r.goal.targetValue } : undefined, series: [
      { label: "Gewicht", kind: "line", color: cssVar("--ink-3"), width: 1, dots: true, value: (p) => p.weightKg, fmt: (v) => `${de(v, 1)} kg` },
      { label: "7-Tage-Mittel", kind: "line", color: cssVar("--accent"), width: 2.5, value: (p) => p.avg7dKg, fmt: (v) => `${de(v, 1)} kg` },
    ] });
    $("bdCap").textContent = `Punkte: einzelne Werte (WHOOP-Profil oder eigener Eintrag), Linie: 7-Tage-Mittel${r.goal?.targetValue != null ? ", gestrichelt: Ziel" : ""}.`;
  },
});
