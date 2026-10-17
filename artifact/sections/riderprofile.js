// Fahrertyp (#164) aus get_rider_profile: Stärken und Schwächen der Leistungskurve im Verhältnis zur FTP.
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
    .rp-hints { margin: 8px 0 0; padding-left: 1.1rem; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-riderprofile">Fahrertyp</h2><span class="muted" id="rpRange"></span></div>
      <div class="panel"><p class="rp-type" id="rpType"><span class="muted">Lädt …</span></p><p id="rpText"></p>
        <div class="rp-rows" id="rpRows"></div><p class="rp-focus" id="rpFocus" hidden></p><ul class="rp-hints" id="rpHints"></ul></div>
      <p class="chart-cap" id="rpNotes"></p>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_rider_profile", { days: 90 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
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
