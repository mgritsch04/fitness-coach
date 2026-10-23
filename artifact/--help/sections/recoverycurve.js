// Erholungskurve (#195) aus get_recovery_curve: Erholung, HRV, Ruhepuls an den Tagen nach harten Tagen.
FC.section({
  id: "recoverycurve",
  tab: "verlauf",
  order: 37,
  css: `
    .rc-hints { margin: 0; padding-left: 1.1rem; display: grid; gap: 6px; }
    .rc-tab { width: 100%; border-collapse: collapse; font-size: 0.92rem; margin-top: 10px; }
    .rc-tab td, .rc-tab th { padding: 4px 6px; border-bottom: 1px solid var(--line); text-align: right; white-space: nowrap; }
    .rc-tab td:first-child, .rc-tab th:first-child { text-align: left; }
    .rc-tab th { font-weight: 600; color: var(--ink-2); }
    .rc-up { color: var(--good-ink); } .rc-down { color: var(--bad-ink); }
    @media (max-width: 520px) { .rc-tab { font-size: 0.82rem; } .rc-tab td, .rc-tab th { padding: 4px 3px; } }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-recoverycurve">Erholung nach harten Tagen</h2><span class="muted" id="rcRange"></span></div>
      <div class="panel"><ul class="rc-hints" id="rcHints"><li class="muted">Lädt …</li></ul>
        <table class="rc-tab"><thead><tr><th>Tag</th><th>Erholung</th><th>HRV</th><th>Ruhepuls</th></tr></thead><tbody id="rcTab"></tbody></table>
        <p class="chart-cap" id="rcNotes"></p></div>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_recovery_curve", { days: 180 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de } = FC, r = this.rep;
    const hints = $("rcHints");
    if (!hints || !r) return;
    if (r.error) { hints.replaceChildren(el("li", { class: "muted", text: r.error })); return; }
    if (!r.available) {
      hints.replaceChildren(el("li", { class: "muted", text: r.reason }));
      $("rcTab").replaceChildren(); $("rcRange").textContent = ""; $("rcNotes").textContent = "";
      return;
    }
    hints.replaceChildren(...r.hints.map((h) => el("li", { text: h })));
    $("rcRange").textContent = `${r.hardDays} harte Tage (Strain ab ${de(r.threshold, 1)})`;
    $("rcNotes").textContent = `Gegenüber deinem Mittel: Erholung ${r.averages.recovery} %, HRV ${r.averages.hrv} ms, Ruhepuls ${r.averages.rhr}. ${r.notes.join(" ")}`;
    // goodUp: ob ein höherer Wert gut ist (Ruhepuls: niedriger ist gut).
    const cell = (v, digits, unit, goodUp, threshold) => {
      if (v == null) return el("td", { class: "muted", text: "–" });
      if (Number(Math.abs(v).toFixed(digits)) === 0) return el("td", { text: `±0${unit}` });
      const good = goodUp ? v > 0 : v < 0;
      const cls = Math.abs(v) < threshold ? "" : good ? "rc-up" : "rc-down";
      return el("td", { class: cls, text: `${v > 0 ? "+" : v < 0 ? "−" : "±"}${de(Math.abs(v), digits)}${unit}` });
    };
    const label = (d) => (d === 0 ? "harter Tag" : d === 1 ? "+1 (Morgen danach)" : `+${d}`);
    $("rcTab").replaceChildren(...r.curve.map((c) => el("tr", { class: c.day === r.backToNormalDays ? "rc-back" : "" },
      el("td", {}, el("div", { text: label(c.day) }), ...[c.day === r.backToNormalDays ? el("div", { class: "muted", text: "wieder normal" }) : null].filter(Boolean)),
      cell(c.recoveryVsAvg, 0, "", true, 3), cell(c.hrvVsAvgPct, 0, " %", true, 3), cell(c.rhrVsAvg, 1, "", false, 1))));
  },
});
