// Mobility nach der Einheit (#223) aus get_dashboard.training.mobilityToday, mit Timer je Übung.
// Andere Routinen (nach langer Fahrt, Beintag …) holt der Abschnitt über get_mobility_routine.
FC.section({
  id: "mobility",
  tab: "heute",
  order: 11.5,
  css: `
    .mo-list { margin: 8px 0 0; padding-left: 1.3em; display: grid; gap: 6px; }
    .mo-list li.on { font-weight: 600; }
    .mo-run { margin-top: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; }
    .mo-run b { font-family: var(--font-display); font-size: 2rem; }
    .mo-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: center; }`,
  KINDS: { ride_long: "Nach langer Fahrt", ride_intervals: "Nach Intervallen", legs: "Nach Beintag", upper: "Nach Oberkörper", general: "Allgemein" },
  mount(root) {
    this.root = root;
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-mobility">Mobility nach der Einheit</h2><span class="muted" id="moMin"></span></div>
      <div class="panel">
        <div class="mo-row"><label for="moKind">Routine</label><select id="moKind"></select></div>
        <p id="moTitle"></p>
        <ol class="mo-list" id="moList"></ol>
        <div class="mo-run" id="moRun" hidden aria-live="polite"></div>
        <div class="mo-row"><button type="button" class="primary" id="moStart">Mobility starten</button></div>
        <p class="fine muted" id="moFine"></p>
      </div>`;
    const sel = FC.$("moKind");
    sel.replaceChildren(...Object.entries(this.KINDS).map(([k, v]) => FC.el("option", { value: k, text: v })));
    sel.onchange = async () => {
      this.stop();
      const r = await FC.call("get_mobility_routine", { kind: sel.value }).catch(() => null);
      if (r) { this.routine = r; this.show(); }
    };
    FC.$("moStart").onclick = () => (this.timer ? this.stop() : this.start());
  },
  render(d) {
    const r = d.training?.mobilityToday;
    this.root.hidden = !r;
    if (!r || this.timer) return;
    this.routine = r;
    FC.$("moKind").value = r.kind;
    this.show();
  },
  show() {
    const { $, el } = FC, r = this.routine;
    $("moMin").textContent = `etwa ${r.minutes} min`;
    $("moTitle").textContent = r.title;
    $("moList").replaceChildren(...r.exercises.map((e, i) => el("li", { class: this.timer && i === this.i ? "on" : "", text: `${e.name}: ${e.seconds} s${e.sides ? " je Seite" : ""}. ${e.cue}` })));
    $("moFine").textContent = r.note;
  },
  start() {
    this.i = 0; this.side = 0; this.left = this.routine.exercises[0].seconds;
    FC.$("moStart").textContent = "Stoppen";
    FC.$("moRun").hidden = false;
    this.timer = setInterval(() => this.tick(), 1000);
    FC.state.mobilityRunning = true;
    this.draw();
  },
  stop() {
    clearInterval(this.timer); this.timer = null; FC.state.mobilityRunning = false;
    const b = FC.$("moStart"); if (b) b.textContent = "Mobility starten";
    const run = FC.$("moRun"); if (run) run.hidden = true;
    if (this.routine) this.show();
  },
  tick() {
    if (--this.left > 0) return this.draw();
    const e = this.routine.exercises[this.i];
    if (e.sides && this.side === 0) { this.side = 1; this.left = e.seconds; }
    else if (++this.i < this.routine.exercises.length) { this.side = 0; this.left = this.routine.exercises[this.i].seconds; }
    else { this.stop(); FC.$("moRun").hidden = false; FC.$("moRun").textContent = "Fertig. Gut gemacht."; return; }
    try { navigator.vibrate?.(200); } catch {}
    this.draw();
  },
  draw() {
    const e = this.routine.exercises[this.i];
    FC.$("moRun").replaceChildren(
      FC.el("p", { text: `${this.i + 1}/${this.routine.exercises.length}: ${e.name}${e.sides ? (this.side ? " (zweite Seite)" : " (erste Seite)") : ""}` }),
      FC.el("b", { text: `${this.left} s` }),
      FC.el("p", { class: "muted", text: e.cue }));
    this.show();
  },
});
