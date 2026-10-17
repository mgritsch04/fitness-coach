// Konstanz und Serien (#209) aus get_consistency: Wochenziel (Kraft + Rad), Serie, Quote der letzten
// 12 Wochen und Plan-Treue. Wochenkacheln wie ein Kalender, erreichte Wochen grün markiert.
FC.section({
  id: "consistency",
  tab: "coach",
  order: 16,
  css: `
    .cs-weeks { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; margin: 10px 0 6px; }
    .cs-w { border: 1px solid var(--line); border-radius: 8px; padding: 6px 4px; text-align: center; min-width: 0; display: grid; gap: 2px; font-size: .85rem; }
    .cs-w.met { background: var(--good-wash); border-color: var(--good); }
    .cs-w.met b { color: var(--good-ink); }
    .cs-w.current { border-color: var(--accent); border-width: 2px; }
    .cs-w small { color: var(--ink-2); }
    .cs-n { white-space: nowrap; font-size: .8rem; }
    .cs-kpi { display: flex; flex-wrap: wrap; gap: 6px 18px; }
    .cs-kpi b { font-family: var(--font-display); font-size: 1.4rem; }`,
  mount(root) {
    this.root = root;
    root.hidden = true;
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-consistency">Konstanz und Serien</h2><span class="muted" id="csGoal"></span></div>
      <div class="panel">
        <div class="cs-kpi" id="csKpi"></div>
        <p id="csText" style="margin:8px 0 0"></p>
        <div class="cs-weeks" id="csWeeks" role="list" aria-label="Letzte 12 Wochen"></div>
        <p class="fine muted" id="csFine"></p>
      </div>`;
  },
  async render(d) {
    if (!FC.state.mcp || this.loadedFor === d.today) return;
    this.loadedFor = d.today;
    const r = await FC.call("get_consistency", {}).catch(() => null);
    this.root.hidden = !r;
    if (r) this.show(r);
  },
  show(r) {
    const { $, el, fmtDay } = FC;
    $("csGoal").textContent = `Ziel: ${r.target.strength}× Kraft + ${r.target.rides}× Rad pro Woche`;
    const kpi = (v, label) => el("span", {}, el("b", { text: v }), " ", label);
    $("csKpi").replaceChildren(
      kpi(String(r.streak), r.streak === 1 ? "Woche Serie" : "Wochen Serie"),
      kpi(String(r.bestStreak), "beste Serie"),
      ...(r.ratePct != null ? [kpi(`${r.ratePct} %`, "der Wochen erreicht")] : []),
      ...(r.planAdherencePct != null ? [kpi(`${r.planAdherencePct} %`, "Plan-Treue")] : []));
    $("csText").textContent = r.text;
    $("csWeeks").replaceChildren(...r.weeks.map((w) => el("div", {
      class: `cs-w${w.met ? " met" : ""}${w.current ? " current" : ""}`, role: "listitem",
      "aria-label": `Woche ab ${fmtDay(w.week)}: ${w.strength}× Kraft, ${w.rides}× Rad${w.met ? ", Ziel erreicht" : w.current ? ", läuft noch" : ", Ziel verfehlt"}`,
    }, el("small", { text: fmtDay(w.week) }), el("b", { text: w.met ? "✓" : w.current ? "…" : "–" }), el("span", { class: "cs-n", text: `${w.strength}K ${w.rides}R` }))));
    $("csFine").textContent = `${r.note} K = Kraft, R = Rad.`;
  },
});
