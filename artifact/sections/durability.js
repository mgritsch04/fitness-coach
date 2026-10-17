// Ermüdungsresistenz (#139) aus get_durability: beste 5/20 min frisch und nach 500, 1000, 1500 kJ.
FC.section({
  id: "durability",
  tab: "training",
  order: 51,
  css: `
    .du-tab { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    .du-tab td, .du-tab th { padding: 4px 6px; border-bottom: 1px solid var(--line); text-align: right; }
    .du-tab td:first-child, .du-tab th:first-child { text-align: left; }
    .du-tab th { font-weight: 600; color: var(--ink-2); }
    .du-tab td { white-space: nowrap; }
    .du-good { color: var(--good-ink); } .du-mid { color: var(--warn-ink); } .du-bad { color: var(--bad-ink); }
    @media (max-width: 520px) { .du-tab { font-size: 0.82rem; } .du-tab td, .du-tab th { padding: 4px 3px; } }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-durability">Ermüdungsresistenz</h2><span class="muted" id="duRange"></span></div>
      <div class="panel"><p id="duVerdict"><span class="muted">Lädt …</span></p>
        <table class="du-tab"><thead><tr><th>Nach Arbeit</th><th>5 min</th><th>20 min</th></tr></thead><tbody id="duTab"></tbody></table>
        <p class="chart-cap" id="duNotes"></p></div>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_durability", { days: 90 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de } = FC, r = this.rep;
    const verdict = $("duVerdict");
    if (!verdict || !r) return;
    if (r.error) { verdict.replaceChildren(el("span", { class: "muted", text: r.error })); return; }
    verdict.textContent = r.verdict;
    $("duRange").textContent = r.rides ? `${r.rides} Fahrten, längste ${de(r.longestRideKj)} kJ` : "";
    const cell = (l) => {
      if (l.watts == null) return el("td", { class: "muted", text: "–" });
      const pct = l.pctOfFresh;
      const cls = pct == null ? "" : pct >= 95 ? "du-good" : pct >= 88 ? "du-mid" : "du-bad";
      return el("td", {}, el("div", { text: `${de(l.watts)} W` }), ...[pct == null ? null : el("div", { class: cls, text: `${de(pct, 1)} %` })].filter(Boolean));
    };
    const [five, twenty] = r.table;
    $("duTab").replaceChildren(...five.levels.map((l, i) => el("tr", {},
      el("td", {}, el("div", { text: l.kj ? `${de(l.kj)} kJ` : "frisch" }), el("div", { class: "muted", text: l.kj ? `ca. ${de(l.kj / 500)} h locker · ${l.rides} Fahrten` : `${l.rides} Fahrten` })),
      cell(l), cell(twenty.levels[i]))));
    $("duNotes").textContent = r.notes.join(" ");
  },
});
