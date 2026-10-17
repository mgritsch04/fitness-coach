// 4-Wochen-Block (#206) aus get_dashboard.training.block: Wochenziele (3 Aufbau + 1 Entlastung), Soll/Ist,
// Anpassungen. „Block starten“ speichert ihn (save_training_block); danach richtet sich der Wochenplan danach.
FC.section({
  id: "block",
  tab: "coach",
  order: 17,
  css: `
    .bk-weeks { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }
    .bk-w { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; min-width: 0; display: grid; gap: 4px; }
    .bk-w.current { border-color: var(--accent); }
    .bk-w.deload { background: var(--panel-2, transparent); }
    .bk-w b { font-size: 1.05rem; }
    .bk-bar { height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
    .bk-bar span { display: block; height: 100%; background: var(--accent); }
    .bk-w small { color: var(--ink-3); }
    .bk-act { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 10px; }`,
  mount(root) {
    this.root = root;
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-block">Trainingsblock</h2><span class="muted" id="bkState"></span></div>
      <div class="panel">
        <p id="bkText" style="margin:0 0 10px"></p>
        <div class="bk-weeks" id="bkWeeks"></div>
        <div class="bk-act"><button type="button" class="primary" id="bkSave" hidden>Block starten</button><span class="muted" id="bkMsg" role="status"></span></div>
        <p class="fine muted" id="bkFine"></p>
      </div>`;
    FC.$("bkSave").onclick = () => this.save();
  },
  render(d) {
    const { $, el, de, fmtDay } = FC, b = d.training?.block;
    this.root.hidden = !b;
    if (!b) return;
    $("bkState").textContent = b.saved ? "gespeichert" : "Vorschlag";
    $("bkText").textContent = b.text;
    $("bkSave").hidden = b.saved || !FC.state.mcp;
    $("bkWeeks").replaceChildren(...b.weeks.map((w) => {
      const pct = w.compliancePct != null ? Math.min(100, w.compliancePct) : 0;
      const bar = el("div", { class: "bk-bar" }, el("span")); bar.firstChild.style.width = `${pct}%`;
      return el("div", { class: `bk-w${w.status === "current" ? " current" : ""}${w.deload ? " deload" : ""}` },
        el("small", { text: `Woche ${w.index + 1} · ab ${fmtDay(w.week)}` }),
        el("b", { text: `~${de(w.targetLoad)} Punkte` }),
        el("span", { text: w.focus }),
        w.actualLoad != null ? bar : null,
        w.actualLoad != null ? el("small", { text: `Ist ${de(w.actualLoad)} (${w.compliancePct ?? "–"} %)` }) : null,
        w.adjusted ? el("small", { text: w.adjusted }) : null);
    }));
    $("bkFine").textContent = b.note;
  },
  async save() {
    const msg = FC.$("bkMsg");
    msg.textContent = "Speichere …";
    try { await FC.call("save_training_block", {}); msg.textContent = "Block gespeichert, der Wochenplan richtet sich danach."; await FC.reload(); }
    catch (e) { msg.textContent = `Speichern fehlgeschlagen: ${e.message ?? e}`; }
  },
});
