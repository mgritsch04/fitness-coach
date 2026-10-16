// Was beeinflusst deine Erholung? Faktoren aus get_recovery_factors (#21), Deutung durch Claude (sample).
FC.section({
  id: "insights",
  tab: "verlauf",
  order: 35,
  css: `
    .fx-list { display: grid; gap: 6px; margin-top: 8px; }
    .fx { display: grid; grid-template-columns: minmax(0, 1fr) 6.5em 5.5em; gap: 10px; align-items: center; font-size: .9rem; }
    .fx .bar { height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; }
    .fx .bar i { display: block; height: 100%; border-radius: 4px; }
    .fx .num { text-align: right; }
    .fx-hl { margin: 0; padding-left: 1.2em; display: grid; gap: 6px; }
    .fx-tabs { margin-bottom: 8px; }`,
  rules: "Du bist ein Trainingscoach. Die Daten sind Zusammenhänge aus den eigenen Messwerten des Nutzers (Beobachtungen, keine Ursache-Wirkung). Keine medizinischen Diagnosen. Antworte auf Deutsch, freundlich und konkret, höchstens 160 Wörter.",
  target: "recovery",
  mount(root) {
    this.root = root;
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-insights">Was beeinflusst deine Erholung?</h2><span class="muted">letzte 90 Tage, Beobachtungen aus deinen Daten</span></div>
      <div class="grid2">
        <div class="panel"><h3>Erkenntnisse</h3><ul class="fx-hl" id="fxHl"><li class="muted">Lädt …</li></ul>
          <div style="margin-top:12px"><button type="button" id="fxAsk">Von Claude deuten lassen</button></div>
          <div id="fxOut" class="muted" style="margin-top:10px"></div></div>
        <div class="panel"><h3>Faktoren</h3>
          <div class="seg fx-tabs" role="group" aria-label="Zielwert" id="fxTarget">
            <button type="button" data-t="recovery">Erholung</button><button type="button" data-t="hrv">HRV</button></div>
          <div class="fx-list" id="fxList"></div>
          <p class="chart-cap">Balken: Stärke des Zusammenhangs. Zahl: Unterschied im Mittel (oberes gegen unteres Drittel bzw. ja gegen nein). Grün = mehr, Rot = weniger.</p></div>
      </div>`;
    const btns = root.querySelectorAll("#fxTarget button");
    const mark = () => btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === this.target)));
    btns.forEach((b) => b.addEventListener("click", () => { this.target = b.dataset.t; mark(); this.show(); }));
    mark();
    FC.$("fxAsk").onclick = () => this.ask();
  },
  ready() {
    if (!FC.state.sample) FC.$("fxAsk").hidden = true;
    FC.watch("get_recovery_factors", { days: 90 }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, de, cssVar } = FC, r = this.rep, hl = $("fxHl"), list = $("fxList");
    if (!hl || !r) return;
    if (r.error) { hl.replaceChildren(el("li", { class: "muted", text: r.error })); list.replaceChildren(); return; }
    hl.replaceChildren(...(r.highlights.length
      ? r.highlights.map((t) => el("li", { text: t }))
      : [el("li", { class: "muted", text: r.enoughData ? "Noch keine deutlichen Zusammenhänge." : `Erst ${r.days} Tage mit Erholung – ab 21 Tagen wird es aussagekräftig.` })]));
    const unit = this.target === "hrv" ? "ms" : "Pkt.";
    const W = { none: 0.08, weak: 0.33, moderate: 0.66, strong: 1 };
    const rows = r.factors.filter((f) => f.target === this.target && f.n > 0);
    list.replaceChildren(...rows.map((f) => {
      const i = el("i"); i.style.width = `${W[f.strength] * 100}%`;
      i.style.background = f.strength === "none" ? cssVar("--ink-3") : f.kind === "weekday" ? cssVar("--accent") : f.effect >= 0 ? cssVar("--good") : cssVar("--bad");
      const eff = f.effect == null ? "–" : f.kind === "weekday" ? `±${de(f.effect)} ${unit}` : `${f.effect >= 0 ? "+" : "−"}${de(Math.abs(f.effect))} ${unit}`;
      return el("div", { class: "fx", title: f.text ?? `${f.n} Tage` }, el("span", { text: f.label }), el("span", { class: "bar" }, i), el("span", { class: "num", text: eff }));
    }));
  },
  async ask() {
    const { $, el, richText, sampleErrText, state } = FC, out = $("fxOut");
    if (!state.sample || !this.rep || this.rep.error) return;
    out.classList.remove("muted"); out.textContent = "Denke nach …"; $("fxAsk").disabled = true;
    const data = JSON.stringify({ zeitraum: this.rep.range, tageMitErholung: this.rep.days, erkenntnisse: this.rep.highlights,
      faktoren: this.rep.factors.filter((f) => f.strength !== "none").map((f) => ({ faktor: f.label, ziel: f.target, staerke: f.strength, unterschied: f.effect, tage: f.n, gruppen: f.groups })) });
    try {
      await state.sample(`${this.rules}\n\nAufgabe: Erkläre in 3–4 Punkten, was nach diesen Daten am meisten mit meiner Erholung und HRV zusammenhängt, und gib 2 konkrete, alltagstaugliche Vorschläge (z. B. Schlafenszeit, spätes Training). Sag dazu, wie sicher die Aussagen sind (Anzahl Tage, Stärke).\n\nDaten:\n${data}`,
        { cache: { gcTime: 3_600_000 }, onText: ({ text }) => richText(out, text) });
    } catch (e) { out.textContent = ""; out.append(el("p", { class: "muted", text: sampleErrText(e) })); }
    finally { $("fxAsk").disabled = false; }
  },
});
