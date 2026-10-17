// Erholungs-Prognose (#93) aus get_recovery_forecast: geschätzte Erholung für morgen früh, Was-wäre-wenn und Trefferquote.
FC.section({
  id: "forecast",
  tab: "heute",
  order: 16,
  css: `
    .fo-top { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 10px 22px; }
    .fo-num { font-family: var(--font-display); font-size: 2.6rem; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
    .fo-num small { font-size: 1rem; font-weight: 500; color: var(--ink-3); margin-left: 3px; }
    .fo-green { color: var(--good-ink); } .fo-yellow { color: var(--warn-ink); } .fo-red { color: var(--bad-ink); }
    .fo-ctl { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 12px; }
    .fo-ctl label { display: grid; gap: 3px; font-size: 0.85rem; color: var(--ink-2); }
    .fo-sc { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .fo-sc li { display: flex; justify-content: space-between; gap: 10px; }
    .fo-up { color: var(--good-ink); } .fo-down { color: var(--bad-ink); }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-forecast">Erholung morgen (Prognose)</h2><span class="muted" id="foDay"></span></div>
      <div class="grid2">
        <div class="panel">
          <div id="foMain"><span class="muted">Lädt …</span></div>
          <div class="fo-ctl">
            <label>Schlaf heute Nacht<select id="foSleep" aria-label="Geplanter Schlaf"><option value="">wie üblich</option>${[6, 6.5, 7, 7.5, 8, 8.5, 9].map((h) => `<option value="${h}">${String(h).replace(".", ",")} h</option>`).join("")}</select></label>
            <label>Heute noch Training<select id="foExtra" aria-label="Geplantes Training heute Abend"><option value="">keins</option><option value="30">locker, kurz (30)</option><option value="60">locker, 1 h (60)</option><option value="100">intensiv (100)</option><option value="150">lang und hart (150)</option></select></label>
          </div>
          <p class="chart-cap" id="foAssume"></p>
        </div>
        <div class="panel"><h3>Was wäre, wenn …</h3><ul class="fo-sc" id="foSc"></ul><p class="chart-cap" id="foQuality"></p></div>
      </div>
      <div class="panel" id="foCheckBox"><h3>So gut hat die Prognose bisher getroffen (14 Tage)</h3><div class="chart" id="cFo"></div></div>`;
    const change = () => this.ready();
    FC.$("foSleep").addEventListener("change", change);
    FC.$("foExtra").addEventListener("change", change);
  },
  ready() {
    this.stop?.();
    const sleep = FC.$("foSleep")?.value, extra = FC.$("foExtra")?.value;
    const args = { ...(sleep ? { sleepH: Number(sleep) } : {}), ...(extra ? { extraLoad: Number(extra) } : {}) };
    this.stop = FC.watch("get_recovery_forecast", args, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de, fmtDay, fmtDayLong, chart, cssVar } = FC, r = this.rep;
    const main = $("foMain");
    if (!main || !r) return;
    const sc = $("foSc"), q = $("foQuality"), box = $("cFo");
    if (r.error) { main.replaceChildren(el("div", { class: "muted", text: r.error })); sc.replaceChildren(); q.textContent = ""; box.replaceChildren(); return; }
    $("foDay").textContent = r.tomorrow ? `für ${fmtDayLong(r.tomorrow)}` : "";
    const quality = r.quality;
    q.textContent = quality
      ? `Trefferquote: im Mittel ${de(quality.maePct, 1)} Punkte daneben (nur den Durchschnitt raten: ${de(quality.maeIfGuessingAverage, 1)}, „wie heute“: ${de(quality.maeIfSameAsToday, 1)}). Aus ${r.observations} Tagen.`
      : "";
    if (!r.available) {
      main.replaceChildren(el("div", { class: "muted", text: r.reason }));
      sc.replaceChildren(el("li", { class: "muted", text: "Keine Prognose, daher auch kein Was-wäre-wenn." }));
      $("foAssume").textContent = r.notes?.[0] ?? "";
    } else {
      const f = r.forecast, a = r.assumptions;
      main.replaceChildren(el("div", { class: "fo-top" },
        el("div", {}, el("span", { class: "label", text: "Erwartete Erholung" }), el("div", { class: `fo-num fo-${f.zone}` }, el("span", { text: String(f.recovery) }), el("small", { text: "%" }))),
        el("div", { class: "muted", text: `Spanne etwa ${f.low}–${f.high} % (Schätzung)` })));
      $("foAssume").textContent = `Annahmen: ${de(a.sleepH, 1)} h Schlaf${a.sleepFromInput ? "" : " (dein üblicher)"}, heute Erholung ${a.todayRecovery} %, Belastung ${a.todayLoad}${a.extraLoad ? ` plus ${a.extraLoad} geplant` : ""}${a.lateTraining ? ", Training am Abend" : ""}. ${r.notes[1]}`;
      sc.replaceChildren(...r.scenarios.map((s) => el("li", {}, el("span", { text: s.label }),
        el("b", { class: s.delta > 0 ? "fo-up" : s.delta < 0 ? "fo-down" : "muted", text: `${s.recovery} % (${s.delta > 0 ? "+" : s.delta < 0 ? "−" : "±"}${Math.abs(s.delta)})` }))));
    }
    const recent = quality?.recent ?? [];
    $("foCheckBox").hidden = recent.length < 3;
    if (recent.length >= 3)
      chart(box, { days: recent, aria: "Geschätzte und tatsächliche Erholung", xFmt: (p) => fmtDay(p.day), series: [
        { label: "Tatsächlich", kind: "line", color: cssVar("--accent"), width: 2.5, dots: true, value: (p) => p.actual, fmt: (v) => `${de(v)} %` },
        { label: "Geschätzt", kind: "line", color: cssVar("--ink-3"), width: 1.5, dots: true, value: (p) => p.predicted, fmt: (v) => `${de(v)} %` },
      ] });
  },
});
