// Training nach der Erholungsampel (#226) aus get_readiness_alignment: Strain je Erholungszone, Treffer-Quote, letzte 14 Tage.
FC.section({
  id: "readiness",
  tab: "verlauf",
  order: 38,
  css: `
    .ra-hints { margin: 0; padding-left: 1.1rem; display: grid; gap: 6px; }
    .ra-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px 18px; margin-top: 12px; }
    .ra-kpis div { display: grid; gap: 2px; } .ra-kpis b { font-family: var(--font-display); font-size: 1.3rem; }
    .ra-tab { width: 100%; border-collapse: collapse; font-size: 0.92rem; margin-top: 12px; }
    .ra-tab td, .ra-tab th { padding: 5px 6px; border-bottom: 1px solid var(--line); text-align: center; }
    .ra-tab td:first-child, .ra-tab th:first-child { text-align: left; }
    .ra-tab th { font-weight: 600; color: var(--ink-2); }
    .ra-ok { background: color-mix(in srgb, var(--good) 16%, transparent); }
    .ra-bad { background: color-mix(in srgb, var(--bad) 16%, transparent); }
    .ra-miss { background: color-mix(in srgb, var(--warn) 14%, transparent); }
    .ra-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: 1px; }
    .ra-green { background: var(--good); } .ra-yellow { background: var(--warn); } .ra-red { background: var(--bad); }
    .ra-strip { display: grid; grid-template-columns: repeat(14, 1fr); gap: 3px; margin-top: 12px; }
    .ra-day { height: 30px; border-radius: 3px; position: relative; opacity: 0.85; }
    .ra-day span { position: absolute; left: 0; right: 0; bottom: 0; background: color-mix(in srgb, var(--ink) 45%, transparent); border-radius: 0 0 3px 3px; }
    .ra-day.ra-against, .ra-day.ra-missed { outline: 2px solid var(--ink); outline-offset: -2px; }
    @media (max-width: 520px) { .ra-tab { font-size: 0.82rem; } .ra-tab td, .ra-tab th { padding: 4px 3px; } }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-readiness">Training nach der Erholungsampel</h2><span class="muted" id="raRange"></span></div>
      <div class="panel"><ul class="ra-hints" id="raHints"><li class="muted">Lädt …</li></ul><div class="ra-kpis" id="raKpis"></div></div>
      <div class="panel" id="raDetail" hidden><h3>Tage je Erholungszone und Strain</h3>
        <table class="ra-tab"><thead><tr><th>Erholung</th><th>leicht</th><th>moderat</th><th>hart</th></tr></thead><tbody id="raTab"></tbody></table>
        <h3 style="margin-top:14px">Letzte 14 Tage</h3><div class="ra-strip" id="raStrip"></div>
        <p class="chart-cap">Farbe: Erholung am Morgen. Graue Höhe: Strain des Tages. Umrandet: hart an rotem oder locker an grünem Tag.</p></div>
      <p class="chart-cap" id="raNotes"></p>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_readiness_alignment", { days: 90 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de } = FC, r = this.rep;
    const hints = $("raHints");
    if (!hints || !r) return;
    if (r.error || !r.available) {
      hints.replaceChildren(el("li", { class: "muted", text: r.error ?? r.reason }));
      $("raKpis").replaceChildren(); $("raDetail").hidden = true; $("raRange").textContent = ""; $("raNotes").textContent = "";
      return;
    }
    hints.replaceChildren(...r.hints.map((h) => el("li", { text: h })));
    $("raRange").textContent = `${r.days} Tage`;
    $("raNotes").textContent = r.notes.join(" ");
    const pct = (v) => (v == null ? "–" : `${v} %`);
    const kpi = (label, value, sub) => el("div", {}, el("span", { class: "label", text: label }), el("b", { text: value }), el("span", { class: "muted", text: sub }));
    $("raKpis").replaceChildren(
      kpi("Passend", pct(r.score), "grüne und rote Tage"),
      kpi("Hart an roten Tagen", String(r.counts.against), r.redCost != null ? `danach ${de(r.redCost, 0)} Punkte tiefer` : "Tage"),
      kpi("Grüne Tage genutzt", pct(r.greenUsedPct), "ab Strain 10"),
    );
    // Zellen nach Bewertung einfärben: passend, gegen die Ampel, verschenkt.
    const cls = { green: { light: "ra-miss", moderate: "ra-ok", hard: "ra-ok" }, yellow: {}, red: { light: "ra-ok", moderate: "", hard: "ra-bad" } };
    $("raTab").replaceChildren(...r.matrix.map((m) => el("tr", {},
      el("td", {}, el("span", { class: `ra-dot ra-${m.zone}` }), m.label),
      ...["light", "moderate", "hard"].map((l) => el("td", { class: cls[m.zone][l] || "", text: String(m.counts[l]) })))));
    $("raStrip").replaceChildren(...r.recent.map((d) => {
      const box = el("div", { class: `ra-day ra-${d.zone} ra-${d.verdict}`, title: `${d.day}: Erholung ${d.recovery} %, Strain ${de(d.strain, 1)}` });
      const bar = el("span"); bar.style.height = `${Math.min(100, (d.strain / 21) * 100)}%`; box.append(bar);
      return box;
    }));
    $("raDetail").hidden = false;
  },
});
