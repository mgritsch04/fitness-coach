// Frühwarnung Überlastung/Infekt (#24) aus get_dashboard.earlyWarning. Nur sichtbar, wenn ein Signal auffällig ist.
FC.section({
  id: "warning",
  tab: "heute",
  order: 5,
  css: `
    .ew { border-left: 4px solid var(--warn); }
    .ew.alert, .ew.caution { border-color: var(--bad); }
    .ew h3 { margin: 0 0 6px; }
    .ew ul { margin: 8px 0; padding-left: 1.2em; display: grid; gap: 4px; }
    .ew .fine { margin: 6px 0 0; }`,
  mount(root) {
    this.root = root;
    root.hidden = true;
    root.innerHTML = `<div class="panel ew" id="ewBox" role="status"><h3 id="ewHead"></h3><p id="ewAdvice"></p><ul id="ewSignals"></ul><p class="fine muted" id="ewFine"></p></div>`;
  },
  render(d) {
    const { $, el, de, fmtDayLong } = FC, w = d.earlyWarning;
    this.root.hidden = !w || w.level === "none";
    if (this.root.hidden) return;
    $("ewBox").className = `panel ew ${w.level}`;
    $("ewHead").textContent = w.headline;
    $("ewAdvice").textContent = w.advice;
    const digits = { rhr: 0, hrv: 0, respRate: 1, skinTemp: 1, spo2: 1 };
    $("ewSignals").replaceChildren(...w.signals.filter((s) => s.flagged).map((s) =>
      el("li", { text: `${s.label}: ${de(s.value, digits[s.key])} ${s.unit} (sonst ${de(s.baseline, digits[s.key])} ${s.unit})` })));
    $("ewFine").textContent = `${w.day ? `Werte vom ${fmtDayLong(w.day)}. ` : ""}${w.disclaimer}`;
  },
});
