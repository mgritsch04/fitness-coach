// Fahrertyp (#164) aus get_rider_profile: Stärken und Schwächen der Leistungskurve im Verhältnis zur FTP.
// Darunter Leistungskurve Zeitraum gegen Zeitraum (#215) aus get_power_curve mit compare.
FC.section({
  id: "riderprofile",
  tab: "training",
  order: 55,
  css: `
    .rp-type { font-family: var(--font-display); font-size: 1.4rem; margin: 0 0 4px; }
    .rp-rows { display: grid; gap: 12px; margin-top: 12px; }
    .rp-row { display: grid; gap: 4px; }
    .rp-row header { display: flex; justify-content: space-between; gap: 8px; font-size: 0.92rem; }
    .rp-row header b { font-weight: 600; }
    .rp-scale { position: relative; height: 10px; background: var(--grid); border-radius: 5px; }
    .rp-scale .mid { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 2px; background: var(--ink-3); }
    .rp-scale .dot { position: absolute; top: -2px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: var(--accent); }
    .rp-strong .dot { background: var(--good); } .rp-weak .dot { background: var(--warn); }
    .rp-focus { margin: 12px 0 0; padding: 8px 10px; border-left: 3px solid var(--accent); background: var(--grid); border-radius: 4px; }
    .rp-hints { margin: 8px 0 0; padding-left: 1.1rem; }
    .rp-cmp-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; }
    .rp-cmp-head h3 { margin: 0; }
    .rp-cmp { width: 100%; border-collapse: collapse; font-size: 0.92rem; margin-top: 10px; font-variant-numeric: tabular-nums; }
    .rp-cmp td, .rp-cmp th { padding: 5px 6px; border-bottom: 1px solid var(--line); text-align: right; }
    .rp-cmp td:first-child, .rp-cmp th:first-child { text-align: left; }
    .rp-cmp th { font-weight: 600; color: var(--ink-2); }
    .rp-up { color: var(--good-ink); } .rp-down { color: var(--bad-ink); }
    @media (max-width: 520px) { .rp-cmp { font-size: 0.85rem; } .rp-cmp td, .rp-cmp th { padding: 4px 3px; } }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-riderprofile">Fahrertyp</h2><span class="muted" id="rpRange"></span></div>
      <div class="panel"><p class="rp-type" id="rpType"><span class="muted">Lädt …</span></p><p id="rpText"></p>
        <div class="rp-rows" id="rpRows"></div><p class="rp-focus" id="rpFocus" hidden></p><ul class="rp-hints" id="rpHints"></ul></div>
      <div class="panel" id="rpCmpBox"><div class="rp-cmp-head"><h3>Leistungskurve im Vergleich</h3>
        <div class="seg" role="group" aria-label="Vergleichszeitraum" id="rpCmpMode">
          <button type="button" data-m="previous" aria-pressed="true">vorige 90 Tage</button><button type="button" data-m="lastYear" aria-pressed="false">Vorjahr</button></div></div>
        <ul class="rp-hints" id="rpCmpHints"><li class="muted">Lädt …</li></ul>
        <table class="rp-cmp" id="rpCmpTab" hidden><thead><tr><th>Dauer</th><th>jetzt</th><th id="rpCmpRef">vorher</th><th>Änderung</th></tr></thead><tbody></tbody></table></div>
      <p class="chart-cap" id="rpNotes"></p>`;
    this.mode = "previous";
    root.querySelectorAll("#rpCmpMode button").forEach((b) => (b.onclick = () => {
      this.mode = b.dataset.m;
      root.querySelectorAll("#rpCmpMode button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      this.watchCmp();
    }));
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_rider_profile", { days: 90 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
    this.watchCmp();
  },
  watchCmp() {
    this.stopCmp?.();
    this.cmp = null; this.showCmp();
    this.stopCmp = FC.watch("get_power_curve", { days: 90, compare: this.mode }, (data, err) => {
      this.cmp = err ? { error: FC.errText(err) } : data?.comparison ?? { error: "Kein Vergleich verfügbar." };
      this.showCmp();
    });
  },
  render() { this.show(); this.showCmp(); },
  showCmp() {
    const { $, el, de } = FC, c = this.cmp;
    const hints = $("rpCmpHints"), tab = $("rpCmpTab");
    if (!hints) return;
    if (!c || c.error) {
      hints.replaceChildren(el("li", { class: "muted", text: c?.error ?? "Lädt …" }));
      tab.hidden = true;
      return;
    }
    hints.replaceChildren(...c.hints.map((h) => el("li", { text: h })));
    const rows = c.durations.filter((d) => d.currentW != null || d.referenceW != null);
    tab.hidden = !rows.length;
    $("rpCmpRef").textContent = c.mode === "lastYear" ? "Vorjahr" : "davor";
    const w = (v) => (v == null ? "–" : `${de(v)} W`);
    tab.tBodies[0].replaceChildren(...rows.map((d) => el("tr", {},
      el("td", { text: d.label }), el("td", { text: w(d.currentW) }), el("td", { text: w(d.referenceW) }),
      el("td", { class: d.diffPct == null ? "muted" : d.diffPct >= 3 ? "rp-up" : d.diffPct <= -3 ? "rp-down" : "",
        text: d.diffPct == null ? "–" : `${d.diffW > 0 ? "+" : d.diffW < 0 ? "−" : "±"}${Math.abs(d.diffW)} W (${d.diffPct > 0 ? "+" : d.diffPct < 0 ? "−" : "±"}${de(Math.abs(d.diffPct), 1)} %)` }))));
  },
  show() {
    const { $, el, de } = FC, r = this.rep;
    const type = $("rpType");
    if (!type || !r) return;
    if (r.error) { type.replaceChildren(el("span", { class: "muted", text: r.error })); return; }
    $("rpRange").textContent = r.ftpW ? `FTP ${r.ftpW} W, ${r.days} Tage` : "";
    if (!r.available) {
      type.replaceChildren(el("span", { class: "muted", text: r.reason }));
      for (const id of ["rpText", "rpNotes"]) $(id).textContent = "";
      $("rpRows").replaceChildren(); $("rpHints").replaceChildren(); $("rpFocus").hidden = true;
      return;
    }
    type.textContent = r.label;
    $("rpText").textContent = r.text;
    const signed = (v) => (v == null ? "" : ` · ${v > 0 ? "+" : v < 0 ? "−" : "±"}${de(Math.abs(v), 1)} % zum Vorzeitraum`);
    $("rpRows").replaceChildren(...r.durations.map((d) => {
      const dot = el("span", { class: "dot" });
      dot.style.left = `${Math.min(100, Math.max(0, (d.score - 60) / 80 * 100))}%`;
      return el("div", { class: `rp-row rp-${d.level}` },
        el("header", {}, el("b", { text: d.label }), el("span", { text: `${d.score} Punkte` })),
        el("div", { class: "rp-scale", role: "img", "aria-label": `${d.label}: ${d.score} Punkte, 100 ist typisch` }, el("span", { class: "mid" }), dot),
        el("span", { class: "muted", text: `${de(d.watts)} W${d.wattsPerKg == null ? "" : ` (${de(d.wattsPerKg, 1)} W/kg)`} = ${de(d.ratioToFtp, 2)} × FTP, typisch ${de(d.typicalRatio, 2)}${signed(d.changePct)}` }));
    }));
    const focus = $("rpFocus");
    focus.hidden = false;
    focus.textContent = `Trainingsvorschlag: ${r.focus.training}`;
    $("rpHints").replaceChildren(...r.hints.map((h) => el("li", { text: h })));
    $("rpNotes").textContent = r.notes.join(" ");
  },
});
