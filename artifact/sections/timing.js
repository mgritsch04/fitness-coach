// Beste Trainingszeit (#131) aus get_training_timing: Tageszeit gegen Effizienz, Schlaf der Nacht danach und Erholung.
FC.section({
  id: "timing",
  tab: "training",
  order: 50,
  css: `
    .tm-hints { margin: 0; padding-left: 1.1rem; display: grid; gap: 6px; }
    .tm-tab { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    .tm-tab td, .tm-tab th { padding: 4px 6px; border-bottom: 1px solid var(--line); text-align: left; }
    .tm-tab th { font-weight: 600; color: var(--ink-2); white-space: normal; }
    .tm-tab td:not(:first-child), .tm-tab th:not(:first-child) { text-align: right; }
    .tm-tab td:not(:first-child) { white-space: nowrap; }
    .tm-up { color: var(--good-ink); } .tm-down { color: var(--bad-ink); }
    @media (max-width: 520px) { .tm-tab { font-size: 0.82rem; } .tm-tab td, .tm-tab th { padding: 4px 3px; } }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-timing">Beste Trainingszeit</h2><span class="muted" id="tmRange"></span></div>
      <div class="panel"><ul class="tm-hints" id="tmHints"><li class="muted">Lädt …</li></ul></div>
      <div class="panel"><h3>Je Tageszeit</h3>
        <table class="tm-tab"><thead><tr><th>Zeit</th><th>Einh.</th><th>Effizienz</th><th>Schlaf danach</th><th>Erholung</th></tr></thead><tbody id="tmTab"></tbody></table>
        <p class="chart-cap" id="tmCap"></p></div>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_training_timing", { days: 120 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de } = FC, r = this.rep;
    const hints = $("tmHints");
    if (!hints || !r) return;
    if (r.error) { hints.replaceChildren(el("li", { class: "muted", text: r.error })); return; }
    hints.replaceChildren(...r.hints.map((h) => el("li", { text: h })));
    $("tmRange").textContent = `${r.sessions} Einheiten, ${r.range.days} Tage`;
    const signed = (v, digits, unit, threshold) => {
      if (v == null) return el("td", { class: "muted", text: "–" });
      const cls = Math.abs(v) < threshold ? "" : v > 0 ? "tm-up" : "tm-down";
      return el("td", { class: cls, text: `${v > 0 ? "+" : v < 0 ? "−" : "±"}${de(Math.abs(v), digits)}${unit}` });
    };
    // Kurzform der Zeitfenster für die Tabelle („morgens (bis 10 Uhr)“ → „morgens“, Uhrzeit darunter).
    const name = (label) => { const m = label.match(/^(\S+) \((.+)\)$/); return m ? el("td", {}, el("div", { text: m[1] }), el("div", { class: "muted", text: m[2] })) : el("td", { text: label }); };
    $("tmTab").replaceChildren(...r.slots.map((s) => el("tr", {},
      name(s.label), el("td", { text: String(s.sessions) }),
      signed(s.efVsTypicalPct, 1, " %", 1), signed(s.sleepVsAvgMin, 0, " min", 10), signed(s.recoveryVsAvg, 0, "", 3))));
    const a = r.averages;
    $("tmCap").textContent = `Gegenüber deinem Mittel: ${a.sleepH == null ? "–" : de(a.sleepH, 1)} h Schlaf, Erholung ${a.recovery ?? "–"} %. ${r.notes.join(" ")}`;
  },
});
