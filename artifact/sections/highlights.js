// Auf einen Blick (#180): die auffälligsten Befunde aller Analysen aus get_analysis_highlights, Tippen springt zum Abschnitt.
FC.section({
  id: "highlights",
  tab: "heute",
  order: 6,
  // Tool mit den Details -> Abschnitt, der es zeigt.
  SECTIONS: {
    get_recovery_forecast: "forecast", get_hrv_trend: "hrvtrend", get_aerobic_decoupling: "aerobic", get_interval_quality: "intervals",
    get_durability: "durability", get_rider_profile: "riderprofile", get_muscle_balance: "musclebalance", get_training_timing: "timing",
    get_strength_cycling_interference: "interference", get_cadence_profile: "cadence",
  },
  TONES: { warn: "Achtung", good: "Gut", neutral: "Hinweis" },
  css: `
    .hl-list { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
    .hl-item { display: grid; grid-template-columns: 5.4em minmax(0, 1fr); gap: 4px 10px; align-items: start; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); }
    .hl-item.hl-warn { background: var(--warn-wash); border-color: transparent; }
    .hl-item.hl-good { background: var(--good-wash); border-color: transparent; }
    .hl-tag { font-size: .72rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; padding: 2px 6px; border-radius: 6px; background: var(--panel); color: var(--ink-2); margin-top: 2px; justify-self: start; }
    .hl-body { display: grid; gap: 2px; min-width: 0; }
    .hl-body strong { font-size: .95rem; }
    .hl-body span { font-size: .88rem; color: var(--ink-2); }
    .hl-body .linkish { justify-self: start; font-size: .85rem; }
    #sec-highlights .linkish { border: 0; background: none; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }`,
  mount(root) {
    this.root = root;
    root.innerHTML = `
      <div class="panel" role="region" aria-labelledby="h-highlights">
        <div class="sec-head"><h3 id="h-highlights">Auf einen Blick</h3><span class="muted" id="hlMore"></span></div>
        <ul class="hl-list" id="hlList"><li class="muted">Lädt …</li></ul>
        <p class="fine" id="hlNote"></p>
      </div>`;
  },
  ready() {
    this.stop?.();
    this.stop = FC.watch("get_analysis_highlights", { limit: 4 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el } = FC, r = this.rep, list = $("hlList");
    if (!list || !r) return;
    if (r.error) { list.replaceChildren(el("li", { class: "muted", text: r.error })); return; }
    const live = new Map(FC.layout.list().filter((s) => !s.hidden).map((s) => [s.id, s]));
    $("hlMore").textContent = r.more ? `${r.more} weitere Befunde` : "";
    $("hlNote").textContent = (r.notes ?? []).join(" ");
    if (!r.highlights?.length) { list.replaceChildren(el("li", { class: "muted", text: "Noch keine auffälligen Befunde. Mit mehr Trainings- und Erholungsdaten erscheinen hier die wichtigsten Punkte." })); return; }
    list.replaceChildren(...r.highlights.map((h) => {
      const tone = this.TONES[h.tone] ? h.tone : "neutral", sec = live.get(this.SECTIONS[h.tool]);
      const body = el("div", { class: "hl-body" }, el("strong", { text: h.title }), el("span", { text: h.text }));
      if (sec) {
        const b = el("button", { type: "button", class: "linkish", text: "Details" });
        b.onclick = () => FC.goTo(sec.id);
        body.append(b);
      }
      return el("li", { class: `hl-item hl-${tone}` }, el("span", { class: "hl-tag", text: this.TONES[tone] }), body);
    }));
  },
});
