// Muskelbalance (#171) aus get_muscle_balance: Sätze je Muskelgruppe gegen Zielbereich, Ziehen/Drücken, Beinbeuger/Beinstrecker.
FC.section({
  id: "musclebalance",
  tab: "training",
  order: 45.5,
  css: `
    .mb-hints { margin: 0; padding-left: 1.1rem; display: grid; gap: 6px; }
    .mb-rows { display: grid; gap: 7px; }
    .mb-row { display: grid; grid-template-columns: 112px 1fr 46px; gap: 8px; align-items: center; font-size: 0.9rem; }
    .mb-track { position: relative; height: 12px; background: var(--grid); border-radius: 3px; }
    .mb-target { position: absolute; top: 0; bottom: 0; background: color-mix(in srgb, var(--good) 22%, transparent); border-left: 1px solid var(--good); border-right: 1px solid var(--good); }
    .mb-fill { position: absolute; left: 0; top: 3px; bottom: 3px; border-radius: 2px; background: var(--accent); }
    .mb-low .mb-fill, .mb-none .mb-fill { background: var(--warn); } .mb-high .mb-fill { background: var(--bad); }
    .mb-row b { text-align: right; font-weight: 600; }
    .mb-ratios { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px 18px; margin-top: 12px; }
    .mb-ratios div { display: grid; gap: 2px; } .mb-ratios b { font-family: var(--font-display); font-size: 1.3rem; }
    .mb-warn { color: var(--warn); }
    @media (max-width: 520px) { .mb-row { grid-template-columns: 96px 1fr 40px; font-size: 0.85rem; } }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-musclebalance">Muskelbalance</h2><span class="muted" id="mbRange"></span></div>
      <div class="panel"><ul class="mb-hints" id="mbHints"><li class="muted">Lädt …</li></ul></div>
      <div class="panel"><h3>Sätze pro Woche je Muskelgruppe</h3><div class="mb-rows" id="mbRows"></div>
        <p class="chart-cap">Grüne Fläche: Zielbereich. Balken: dein Wochenmittel.</p><div class="mb-ratios" id="mbRatios"></div></div>
      <p class="chart-cap" id="mbNotes"></p>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_muscle_balance", { weeks: 4 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de } = FC, r = this.rep;
    const hints = $("mbHints");
    if (!hints || !r) return;
    if (r.error) { hints.replaceChildren(el("li", { class: "muted", text: r.error })); return; }
    hints.replaceChildren(...r.hints.map((h) => el("li", { text: h })));
    $("mbRange").textContent = `${r.sessions} Einheiten, ${r.range.weeks} Wochen`;
    $("mbNotes").textContent = r.notes.join(" ");
    const max = Math.max(14, ...r.muscles.map((m) => m.setsPerWeek));
    const pct = (v) => `${Math.min(100, (v / max) * 100)}%`;
    $("mbRows").replaceChildren(...r.muscles.map((m) => {
      const target = el("span", { class: "mb-target" }); target.style.left = pct(m.target.lo); target.style.width = `calc(${pct(m.target.hi)} - ${pct(m.target.lo)})`;
      const fill = el("span", { class: "mb-fill" }); fill.style.width = pct(m.setsPerWeek);
      return el("div", { class: `mb-row mb-${m.status}` }, el("span", { text: m.label }),
        el("div", { class: "mb-track", role: "img", "aria-label": `${m.label}: ${de(m.setsPerWeek, 1)} Sätze pro Woche, Ziel ${m.target.lo} bis ${m.target.hi}` }, target, fill),
        el("b", { text: de(m.setsPerWeek, 1) }));
    }));
    const ratio = (label, v, min, sub) => el("div", {}, el("span", { class: "label", text: label }),
      el("b", { class: v != null && v < min ? "mb-warn" : "", text: v == null ? "–" : `${de(v, 2)} : 1` }), el("span", { class: "muted", text: sub }));
    $("mbRatios").replaceChildren(
      ratio("Ziehen : Drücken", r.ratios.pullPush, r.ratios.minPullPush, `Ziel ab ${de(r.ratios.minPullPush, 1)} : 1`),
      ratio("Rückseite : Vorderseite", r.ratios.hamQuad, r.ratios.minHamQuad, `Oberschenkel, Ziel ab ${de(r.ratios.minHamQuad, 1)} : 1`),
    );
  },
});
