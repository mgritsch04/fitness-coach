// Morgen-Briefing (#28): einmal am Tag 3–4 Sätze von Claude oben auf „Heute“; im Browser für den Tag gemerkt.
FC.section({
  id: "briefing",
  tab: "heute",
  order: 5,
  css: `
    .briefing { border-left: 4px solid var(--accent); }
    .briefing .bf-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .briefing .bf-text p { margin: 6px 0 0; }
    .briefing .bf-text p:first-child { margin-top: 8px; }`,
  mount(root) {
    root.innerHTML = `
      <div class="panel briefing">
        <div class="bf-head"><h3 id="h-briefing">Dein Morgen-Briefing</h3>
          <div class="row"><button type="button" id="bfMake">Briefing erstellen</button><button type="button" id="bfStop" hidden>Stopp</button></div></div>
        <div class="bf-text" id="bfText"><p class="muted">Claude fasst deinen Tag in drei, vier Sätzen zusammen.</p></div>
        <p class="fine" id="bfFine" hidden></p>
      </div>`;
    this.root = root;
    root.hidden = true;
    FC.$("bfMake").onclick = () => this.make(true);
    FC.$("bfStop").onclick = () => this.ctl?.abort();
  },
  key(day) { return `fc-briefing-${day}`; },
  load(day) { try { return JSON.parse(localStorage.getItem(this.key(day)) ?? "null"); } catch { return null; } },
  save(day, v) {
    try {
      localStorage.setItem(this.key(day), JSON.stringify(v));
      for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith("fc-briefing-") && k < this.key(FC.addDays(day, -7))) localStorage.removeItem(k); }
    } catch {}
  },
  ready() { if (FC.state.sample) { this.root.hidden = false; if (FC.state.data) this.render(FC.state.data); } },
  render(d) {
    if (!FC.state.sample || this.running) return;
    const saved = this.load(d.today);
    if (saved?.text) { this.show(saved); return; }
    // Einmal pro Tag und Seitenaufruf automatisch, sobald Daten da sind.
    if (this.autoDay !== d.today) { this.autoDay = d.today; this.make(false); }
  },
  rerender() {},
  show(v) {
    const { $, richText, ago } = FC;
    richText($("bfText"), v.text);
    $("bfMake").textContent = "Neu erstellen";
    const f = $("bfFine"); f.hidden = false;
    f.textContent = `Erstellt ${ago(v.at)} aus deinen Daten. Trainingsempfehlung, keine medizinische Diagnose; Belastung und Form sind Schätzungen.`;
  },
  async make(manual) {
    const { $, el, richText, sampleErrText, state } = FC, d = state.data, coach = state.coach;
    if (!state.sample || !d || !coach || this.running) return;
    this.running = true; this.ctl = new AbortController();
    $("bfMake").disabled = true; $("bfStop").hidden = false;
    const out = $("bfText"); out.replaceChildren(el("p", { class: "muted", text: "Claude schreibt dein Briefing …" }));
    const task = `Schreibe das Morgen-Briefing für ${d.today}: genau 3–4 kurze Sätze als ein Absatz, ohne Aufzählung. ` +
      "1) Wie erholt bin ich (Erholung, HRV, Schlaf gegen meine Basis)? 2) Was heißt das fürs Training heute (konkret: Kraft, Rad locker/Intervalle oder Ruhe, mit Dauer)? " +
      "3) Ein Hinweis zur Woche (Belastung, Form, Schlafschuld). Beginne mit dem wichtigsten Punkt in **fett**. Keine Begrüßung.";
    try {
      const { text } = await state.sample(`${coach.rules}\n\n${task}\n\nDaten:\n${coach.data()}`, { signal: this.ctl.signal, cache: manual ? false : { gcTime: 3_600_000 }, onText: ({ text }) => richText(out, text) });
      const v = { text, at: new Date().toISOString() };
      this.save(d.today, v); this.show(v);
    } catch (e) {
      if (e?.code === "cancelled") { out.replaceChildren(el("p", { class: "muted", text: "Abgebrochen." })); }
      else if (["not_granted", "sampling_disabled"].includes(e?.code)) { this.root.hidden = true; }
      else { if (e?.text) richText(out, e.text); else out.replaceChildren(); out.append(el("p", { class: "muted", text: sampleErrText(e) })); }
    } finally {
      this.running = false; $("bfMake").disabled = false; $("bfStop").hidden = true;
    }
  },
});
