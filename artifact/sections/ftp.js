// FTP-Test-Assistent (#64): Vorschlag, Auswertung der neuesten Fahrt (analyze_ftp_test), Speichern/Übernehmen und Verlauf.
FC.section({
  id: "ftp",
  tab: "training",
  order: 46,
  css: `
    .ft-top { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px 20px; margin-bottom: 10px; }
    .ft-top div { display: grid; gap: 2px; } .ft-top b { font-family: var(--font-display); font-size: 1.3rem; }
    .ft-sug { border-left: 4px solid var(--line); padding: 6px 0 6px 12px; margin: 8px 0; }
    .ft-sug.go { border-color: var(--good); }
    .ft-sug ul { margin: 6px 0 0; padding-left: 1.2em; display: grid; gap: 3px; }
    .ft-act { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 10px; }
    .ft-res { margin: 10px 0 0; }
    .ft-list { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-ftp">FTP-Tests</h2><span class="muted">Ramp- oder 20-min-Test aus der FIT-Datei</span></div>
      <div class="panel">
        <div class="ft-top" id="ftTop"></div>
        <div class="ft-sug" id="ftSug"></div>
        <div class="ft-act"><button type="button" class="primary" id="ftAnalyze">Neueste Fahrt als Test auswerten</button>
          <select id="ftProto" aria-label="Protokoll"><option value="auto">automatisch erkennen</option><option value="ramp">Ramp-Test</option><option value="20min">20-min-Test</option></select></div>
        <div class="ft-res" id="ftRes" role="status"></div>
        <div class="chart" id="cFtp" hidden></div><ul class="ft-list" id="ftList"></ul>
      </div>`;
    FC.$("ftAnalyze").addEventListener("click", () => this.analyze());
  },
  ready() { this.load(); },
  load() {
    this.stop?.();
    this.stop = FC.watch("get_ftp_tests", {}, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  async analyze() {
    const { $, el } = FC, res = $("ftRes");
    $("ftAnalyze").disabled = true; res.textContent = "Werte aus …";
    try {
      const a = await FC.call("analyze_ftp_test", { protocol: $("ftProto").value });
      const r = a.result, w = a.workout;
      const head = el("p", { text: `Fahrt vom ${FC.fmtDayLong(w.day)}: ${r.message}` });
      if (!r.ftpW) { res.replaceChildren(head); return; }
      const save = (apply) => async () => {
        res.querySelectorAll("button").forEach((b) => (b.disabled = true));
        try {
          this.rep = await FC.call("save_ftp_test", { source: w.source, sourceId: w.sourceId, protocol: r.protocol, apply });
          res.replaceChildren(el("p", { text: apply ? `Gespeichert, FTP ist jetzt ${r.ftpW} W.` : "Im Verlauf gespeichert." }));
          this.show(); this.load();
          if (apply) { FC.invalidate(); FC.reload(); }
        } catch (e) { res.append(el("p", { class: "muted", text: e?.code === "tool_error" ? String(e.message).slice(0, 160) : FC.errText(e) })); }
      };
      const b1 = el("button", { type: "button", class: "primary", text: `Speichern und FTP ${r.ftpW} W übernehmen` }), b2 = el("button", { type: "button", text: "Nur speichern" });
      b1.onclick = save(true); b2.onclick = save(false);
      res.replaceChildren(head, el("div", { class: "ft-act" }, b1, b2));
    } catch (e) { res.textContent = e?.code === "tool_error" ? String(e.message).slice(0, 160) : FC.errText(e); }
    finally { $("ftAnalyze").disabled = false; }
  },
  show() {
    const { $, el, de, chart, cssVar, fmtDay, fmtDayLong } = FC, r = this.rep;
    const top = $("ftTop");
    if (!top || !r) return;
    if (r.error) { top.replaceChildren(el("div", { class: "muted", text: r.error })); return; }
    const ORIGIN = { user: "selbst gesetzt", data: "aus Leistungsdaten geschätzt", none: "unbekannt" };
    const last = r.tests.at(-1);
    const stat = (label, value, sub) => el("div", {}, el("span", { class: "label", text: label }), el("b", { text: value }), sub ? el("span", { class: "muted", text: sub }) : null);
    top.replaceChildren(...[
      stat("Aktuelle FTP", r.current.ftpW ? `${de(r.current.ftpW)} W` : "–", ORIGIN[r.current.origin] ?? r.current.origin),
      stat("Letzter Test", last ? `${de(last.ftpW)} W` : "–", last ? `${last.label}, ${fmtDayLong(last.day)}${last.wattsPerKg ? ` · ${de(last.wattsPerKg, 2)} W/kg` : ""}` : "noch keiner gespeichert"),
      last?.changeW != null ? stat("Seit dem Test davor", `${last.changeW > 0 ? "+" : last.changeW < 0 ? "−" : "±"}${de(Math.abs(last.changeW))} W`) : null,
    ].filter(Boolean));
    const s = r.suggestion, sug = $("ftSug");
    sug.className = `ft-sug${s.suggest ? " go" : ""}`;
    sug.replaceChildren(...[el("b", { text: s.suggest ? "Guter Zeitpunkt für einen FTP-Test" : "Kein Test nötig" }), el("div", { text: s.reason }),
      s.suggest ? el("ul", {}, ...s.howTo.map((t) => el("li", { text: t }))) : null].filter(Boolean));
    const box = $("cFtp");
    box.hidden = r.tests.length < 2;
    if (!box.hidden) chart(box, { days: r.tests, aria: "FTP-Verlauf aus Tests", series: [
      { label: "FTP", kind: "line", color: cssVar("--accent"), width: 2.5, dots: true, value: (t) => t.ftpW, fmt: (v) => `${de(v)} W` },
    ] });
    $("ftList").replaceChildren(...[...r.tests].reverse().slice(0, 6).map((t) =>
      el("li", { class: "muted", text: `${fmtDay(t.day)} · ${t.label} · ${de(t.ftpW)} W${t.wattsPerKg ? ` (${de(t.wattsPerKg, 2)} W/kg)` : ""}${t.applied ? " · übernommen" : ""}` })));
  },
});
