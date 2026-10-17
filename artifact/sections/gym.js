// Gym-Modus (#107): Einheit aus Vorlage oder letzter Einheit starten, Sätze abhaken, Pausen-Timer, am Ende mit
// Einzelsätzen, Startzeit und Dauer speichern (get_strength, suggest_strength_session, log_strength_session).
// Der laufende Stand liegt nur in diesem Browser (localStorage), damit ein Neuladen nichts verliert.
FC.section({
  id: "gym",
  tab: "training",
  order: 39,
  KEY: "fc-gym",
  RESTS: [60, 90, 120, 180, 240],
  css: `
    .gy-start { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
    .gy-start label { display: grid; gap: 4px; font-size: .88rem; color: var(--ink-2); flex: 1 1 14em; min-width: 0; }
    .gy-bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between;
      background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; margin-bottom: 12px; }
    .gy-clock { font-variant-numeric: tabular-nums; color: var(--ink-2); font-size: .9rem; }
    .gy-rest { display: flex; align-items: center; gap: 8px; }
    .gy-rest b { font-family: var(--font-display); font-size: 1.7rem; font-variant-numeric: tabular-nums; min-width: 3.2em; }
    .gy-rest.over b { color: var(--good-ink); }
    .gy-rest button { padding: 6px 9px; }
    .gy-ex { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: grid; gap: 8px; }
    .gy-ex.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .gy-ex.done { opacity: .75; }
    .gy-exh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .gy-exh h3 { margin: 0; }
    .gy-set { display: grid; grid-template-columns: 3.2em minmax(0, 1fr) minmax(0, 1fr) 3.2em; gap: 8px; align-items: center; }
    .gy-set input { width: 100%; min-width: 0; font-size: 1rem; padding: 8px; text-align: center; }
    .gy-plates { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; margin: 2px 0 8px; font-size: .9rem; }
    .gy-warm { margin: -4px 0 8px; font-size: .85rem; color: var(--ink-2); }
    .gy-warm ol { margin: 2px 0 0; padding-left: 1.4em; }
    .gy-plates strong { font-variant-numeric: tabular-nums; }
    .gy-set .n { color: var(--ink-3); font-size: .85rem; }
    .gy-set .ok { height: 44px; border-radius: 10px; font-size: 1.2rem; padding: 0; }
    .gy-set.on .ok { background: var(--good); border-color: var(--good); color: var(--panel); }
    .gy-set.on input { color: var(--ink-2); }
    .gy-head { display: grid; grid-template-columns: 3.2em minmax(0, 1fr) minmax(0, 1fr) 3.2em; gap: 8px; font-size: .78rem; color: var(--ink-3); text-align: center; }
    .gy-note { flex-basis: 100%; font-weight: 600; color: var(--good-ink); }
    .gy-last { font-size: .85rem; margin-top: -4px; }
    .gy-list { display: grid; gap: 12px; }
    .gy-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .gy-rpe { display: flex; flex-wrap: wrap; gap: 6px; }
    .gy-rpe button { min-width: 2.6em; padding: 8px 0; }
    .gy-rpe button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink, #fff); }
    #sec-gym .linkish { border: 0; background: none; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-gym">Gym-Modus</h2><span class="muted">Sätze abhaken, während du trainierst</span></div>
      <div id="gyBody"></div>
      <p class="muted" id="gyMsg" role="status" style="margin:8px 0 0"></p>`;
    this.root = root;
    this.st = this.loadState();
    FC.state.gym = this; // „Heute dran“ startet von dort die geplante Krafteinheit
  },
  ready() {
    FC.call("get_strength", { weeks: 12 }, { cache: { staleTime: 60_000, gcTime: 86_400_000 } })
      .then((d) => { this.data = d; if (!this.st || !FC.$("gyBody")?.contains(document.activeElement)) this.draw(); })
      .catch((err) => { this.err = FC.errText(err); if (!this.st) this.draw(); });
    this.draw();
  },
  render() { if (!this.drawn) this.draw(); },

  loadState() { try { const v = JSON.parse(localStorage.getItem(this.KEY) ?? "null"); return v?.exercises ? v : null; } catch { return null; } },
  persist() { try { if (this.st) localStorage.setItem(this.KEY, JSON.stringify(this.st)); else localStorage.removeItem(this.KEY); } catch {} },
  restFor(name) { return /kniebeuge|kreuzheben|bankdr|schulterdr|rudern|klimmzug|beinpresse|hip thrust|dips|squat|deadlift|bench|press|row|pull/i.test(name) ? 180 : 90; },
  /** Verlauf einer Übung aus get_strength (nach Name, da Vorlagen und Plan Namen liefern). */
  prog(name) { const n = name.trim().toLowerCase(); return this.data?.progress?.find((p) => p.name.toLowerCase() === n || p.exercise === n) ?? null; },
  /** Langhantel-Übung? Dann zeigt der Scheibenrechner (#143) die Scheiben je Seite. */
  isBar(name) { return !/kurzhantel|dumbbell|maschine|kabel|beinpresse|leg press/i.test(name) && /kniebeuge|kreuzheben|bankdr|schulterdr|langhantel|hip thrust|squat|deadlift|bench|overhead|military/i.test(name); },
  PLATES: [25, 20, 15, 10, 5, 2.5, 1.25],
  BARS: [20, 15, 10],
  bar() { try { const b = Number(localStorage.getItem("fc-gym-bar")); return this.BARS.includes(b) ? b : 20; } catch { return 20; } },
  /** Scheiben je Seite für ein Gesamtgewicht (gierig, größte zuerst). */
  plates(kg, bar) {
    if (!(kg > 0)) return null;
    if (kg < bar) return { text: `leichter als die Stange (${bar} kg)` };
    let side = (kg - bar) / 2;
    const out = [];
    for (const p of this.PLATES) while (side >= p - 1e-9) { out.push(p); side -= p; }
    const f = (n) => (Math.round(n * 100) / 100).toLocaleString("de-DE");
    const rest = side > 0.01 ? ` (Rest ${f(side)} kg je Seite nicht steckbar)` : "";
    return { text: out.length ? `${out.map(f).join(" + ")} kg${rest}` : `nur die Stange${rest}` };
  },
  mmss(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; },
  msg(t) { FC.$("gyMsg").textContent = t ?? ""; },

  draw() {
    this.drawn = true;
    clearInterval(this.tick);
    if (this.st) { this.drawActive(); this.lock(true); } else { this.drawStart(); this.lock(false); }
  },

  // --- Start ---------------------------------------------------------------------------------------
  drawStart() {
    const { $, el, fmtDayLong } = FC, body = $("gyBody"), d = this.data;
    if (!d) { body.replaceChildren(el("div", { class: "empty", text: this.err ?? "Lädt …" })); return; }
    const today = FC.state.data?.today, planned = (FC.state.data?.training?.strengthWorkouts?.days ?? []).filter((w) => w.day >= today).slice(0, 3);
    const sel = el("select", { id: "gySrc" },
      planned.length ? el("optgroup", { label: "Aus dem Wochenplan" }, ...planned.map((w) => el("option", { value: `p:${w.day}`, text: `${w.day === today ? "Heute" : fmtDayLong(w.day)}: ${w.focus}` }))) : null,
      d.templates.length ? el("optgroup", { label: "Vorlage (mit Gewichtsvorschlag)" }, ...d.templates.map((t) => el("option", { value: `t:${t.name}`, text: t.name }))) : null,
      d.sessions.length ? el("optgroup", { label: "Wie eine letzte Einheit" }, ...d.sessions.slice(0, 6).map((s) => el("option", { value: `s:${s.id}`, text: `${fmtDayLong(s.day)}${s.name ? ` · ${s.name}` : ""}` }))) : null,
      el("option", { value: "", text: "Leer starten" }));
    const go = el("button", { type: "button", class: "primary", text: "Einheit starten" });
    go.onclick = () => this.start(sel.value, go);
    body.replaceChildren(el("div", { class: "panel" },
      el("div", { class: "gy-start" }, el("label", { for: "gySrc" }, "Was trainierst du?", sel), go),
      el("p", { class: "chart-cap", text: "Nach jedem Satz läuft eine Pause (Grundübungen 3 min, sonst 90 s). Gewichte aus Vorlagen sind Vorschläge, nach Gefühl anpassen." })));
  },
  /** Geplante Krafteinheit eines Tages starten (läuft schon eine Einheit, bleibt sie). */
  startPlan(day) { if (!this.st) this.start(`p:${day}`); },
  async start(src, btn) {
    if (btn) btn.disabled = true;
    this.msg("");
    try {
      let list = [], name = null;
      if (src.startsWith("p:")) {
        const w = FC.state.data.training.strengthWorkouts.days.find((x) => x.day === src.slice(2));
        name = w?.focus ?? null;
        list = (w?.exercises ?? []).map((x) => ({ name: x.name, unit: x.unit, sets: Array.from({ length: x.sets }, () => ({ reps: x.reps, kg: x.weightKg })) }));
        if (w?.exercises.some((x) => x.weightKg == null && x.unit !== "s")) this.msg("Wo kein Gewicht steht: eines wählen, bei dem noch 2 Wiederholungen Reserve bleiben.");
      } else if (src.startsWith("t:")) {
        name = src.slice(2);
        const s = await FC.call("suggest_strength_session", { template: name });
        list = s.exercises.map((x) => ({ name: x.name, sets: Array.from({ length: x.sets }, () => ({ reps: x.reps, kg: x.weightKg ?? 0 })) }));
        const down = s.coachNotes?.find((n) => n.effect === "down");
        if (down) this.msg(down.text);
      } else if (src.startsWith("s:")) {
        const s = this.data.sessions.find((x) => x.id === src.slice(2));
        name = s?.name ?? null;
        const by = new Map();
        for (const x of s?.sets ?? []) { if (!by.has(x.exercise)) by.set(x.exercise, { name: x.exerciseName, sets: [] }); by.get(x.exercise).sets.push({ reps: x.reps, kg: x.weightKg }); }
        list = [...by.values()];
      }
      this.st = { startedAt: new Date().toISOString(), name, cur: 0, restEnd: null, rpe: null, finishing: false,
        exercises: list.map((x) => ({ name: x.name, unit: x.unit === "s" ? "s" : undefined, rest: this.restFor(x.name), sets: x.sets.map((y) => ({ ...y, done: false })) })) };
      if (!this.st.exercises.length) this.st.exercises.push({ name: "", rest: 90, sets: [{ reps: 8, kg: 0, done: false }] });
      this.persist(); this.draw();
    } catch (err) { this.msg(err?.code === "tool_error" ? `Vorschlag nicht verfügbar: ${String(err.message).slice(0, 160)}` : FC.errText(err)); }
    finally { if (btn) btn.disabled = false; }
  },

  // --- Laufende Einheit ----------------------------------------------------------------------------
  drawActive() {
    const { $, el } = FC, st = this.st, body = $("gyBody");
    const clock = el("span", { class: "gy-clock", id: "gyClock" });
    const restB = el("b", { id: "gyRestT" });
    const minus = el("button", { type: "button", text: "−15", "aria-label": "Pause 15 Sekunden kürzer" });
    const plus = el("button", { type: "button", text: "+15", "aria-label": "Pause 15 Sekunden länger" });
    const skip = el("button", { type: "button", text: "Weiter", "aria-label": "Pause beenden" });
    minus.onclick = () => this.shiftRest(-15); plus.onclick = () => this.shiftRest(15); skip.onclick = () => { st.restEnd = null; this.persist(); this.tickNow(); };
    const rest = el("div", { class: "gy-rest", id: "gyRest" }, el("span", { class: "muted", text: "Pause" }), restB, minus, plus, skip);
    const note = el("div", { class: "gy-note", role: "status", text: this.note ?? "" }); note.hidden = !this.note;
    const bar = el("div", { class: "gy-bar" }, clock, rest, note);

    const list = el("div", { class: "gy-list" }, ...st.exercises.map((x, i) => this.exCard(x, i)));
    const addName = el("input", { type: "text", list: "stEx", maxlength: 80, placeholder: "Übung hinzufügen", "aria-label": "Übung hinzufügen", style: "flex:1 1 12em;min-width:0" });
    const add = el("button", { type: "button", text: "+ Übung" });
    add.onclick = () => { const n = addName.value.trim(); if (!n) { addName.focus(); return; } st.exercises.push({ name: n, rest: this.restFor(n), sets: [{ reps: 8, kg: 0, done: false }] }); st.cur = st.exercises.length - 1; this.persist(); this.draw(); };
    const finish = el("button", { type: "button", class: "primary", text: "Einheit beenden" });
    finish.onclick = () => { st.finishing = true; this.persist(); this.draw(); FC.$("gyFinish")?.scrollIntoView({ block: "nearest" }); };

    body.replaceChildren(bar, list, el("div", { class: "gy-row", style: "margin-top:12px" }, addName, add), st.finishing ? this.finishPanel() : el("div", { class: "gy-row", style: "margin-top:12px" }, finish));
    this.tickNow();
    this.tick = setInterval(() => this.tickNow(), 500);
  },
  exCard(x, i) {
    const { el } = FC, st = this.st;
    const doneSets = x.sets.filter((s) => s.done).length;
    const restBtn = el("button", { type: "button", class: "linkish", text: `Pause ${this.mmss(x.rest)}`, "aria-label": `Pausenlänge für ${x.name || "diese Übung"} ändern` });
    restBtn.onclick = () => { const r = this.RESTS; x.rest = r[(r.indexOf(x.rest) + 1) % r.length] ?? 90; this.persist(); restBtn.textContent = `Pause ${this.mmss(x.rest)}`; };
    const title = x.name ? el("h3", { text: x.name }) : (() => { const inp = el("input", { type: "text", list: "stEx", maxlength: 80, placeholder: "Übung", "aria-label": "Name der Übung" }); inp.onchange = () => { x.name = inp.value.trim(); x.rest = this.restFor(x.name); this.persist(); }; return inp; })();
    const card = el("div", { class: `gy-ex${i === st.cur ? " cur" : ""}${doneSets === x.sets.length ? " done" : ""}` },
      el("div", { class: "gy-exh" }, title, el("span", { class: "muted" }, `${doneSets}/${x.sets.length} Sätze · `, restBtn)),
      (() => {
        const last = x.name ? this.prog(x.name)?.history?.at(-1) : null;
        if (!last) return null;
        const kg = last.topSet.weightKg ? ` mit ${FC.de(last.topSet.weightKg, last.topSet.weightKg % 1 ? 1 : 0)} kg` : "";
        return el("div", { class: "muted gy-last", text: `Letztes Mal (${FC.fmtDayLong(last.day)}): ${last.sets} ${last.sets === 1 ? "Satz" : "Sätze"}, bester Satz ${last.topSet.reps}${x.unit === "s" ? " s" : ""}${kg}` });
      })(),
      i === st.cur && this.isBar(x.name) ? this.plateRow(x) : null,
      el("div", { class: "gy-head", "aria-hidden": "true" }, el("span", { text: "Satz" }), el("span", { text: x.unit === "s" ? "Sekunden" : "Wdh" }), el("span", { text: "kg" }), el("span", { text: "" })));
    const kgs = [];
    x.sets.forEach((s, j) => {
      const reps = el("input", { type: "number", min: 1, max: 100, step: 1, inputmode: "numeric", "aria-label": `${x.name} Satz ${j + 1} ${x.unit === "s" ? "Sekunden" : "Wiederholungen"}` });
      const kg = el("input", { type: "number", min: 0, max: 500, step: 0.5, inputmode: "decimal", "aria-label": `${x.name} Satz ${j + 1} Gewicht in kg` });
      reps.value = s.reps ?? ""; kg.value = s.kg ?? ""; kgs[j] = kg;
      const num = (v) => { const n = Number(String(v).replace(",", ".")); return v === "" || !Number.isFinite(n) ? null : n; };
      reps.onchange = () => { s.reps = num(reps.value); this.persist(); };
      kg.oninput = () => { if (x.sets.findIndex((t) => !t.done) === j) this.showPlates(num(kg.value)); };
      kg.onchange = () => {
        s.kg = num(kg.value);
        // Folgesätze übernehmen das neue Gewicht (ohne Neuzeichnen, sonst ginge ein Tipp auf den Haken verloren)
        x.sets.forEach((t, k) => { if (k > j && !t.done) { t.kg = s.kg; if (kgs[k]) kgs[k].value = s.kg ?? ""; } });
        this.persist();
      };
      const ok = el("button", { type: "button", class: "ok", text: "✓", "aria-pressed": String(!!s.done), "aria-label": `${x.name} Satz ${j + 1} geschafft` });
      ok.onclick = () => this.toggle(x, i, s, num(reps.value), num(kg.value));
      card.append(el("div", { class: `gy-set${s.done ? " on" : ""}` }, el("span", { class: "n", text: `${j + 1}.` }), reps, kg, ok));
    });
    const more = el("button", { type: "button", text: "+ Satz" });
    more.onclick = () => { const l = x.sets.at(-1) ?? { reps: 8, kg: 0 }; x.sets.push({ reps: l.reps, kg: l.kg, done: false }); this.persist(); this.draw(); };
    const less = el("button", { type: "button", text: "− Satz" }); less.disabled = x.sets.length <= 1 || x.sets.at(-1).done;
    less.onclick = () => { x.sets.pop(); this.persist(); this.draw(); };
    const row = el("div", { class: "gy-row" }, more, less);
    if (i !== st.cur) { const sel = el("button", { type: "button", class: "linkish", text: "Jetzt diese Übung" }); sel.onclick = () => { st.cur = i; this.persist(); this.draw(); }; row.append(sel); }
    card.append(row);
    return card;
  },
  plateRow(x) {
    const { el } = FC;
    const barB = el("button", { type: "button", class: "linkish", "aria-label": "Stangengewicht ändern" });
    const out = el("strong", { id: "gyPlates" });
    const row = el("div", { class: "gy-plates", role: "status" }, el("span", { class: "muted", text: "Je Seite:" }), out, barB);
    const upd = () => { barB.textContent = `Stange ${this.bar()} kg`; this.showPlates(x.sets.find((t) => !t.done)?.kg ?? x.sets.at(-1)?.kg); };
    barB.onclick = () => { const b = this.BARS; try { localStorage.setItem("fc-gym-bar", String(b[(b.indexOf(this.bar()) + 1) % b.length])); } catch { /* nur Komfort */ } upd(); };
    queueMicrotask(upd);
    // Aufwärm-Treppe (#148) nur vor dem ersten Arbeitssatz.
    return x.sets.some((t) => t.done) ? row : el("div", {}, row, el("div", { class: "gy-warm", id: "gyWarm" }));
  },
  /** Aufwärmsätze zum Arbeitsgewicht: Stange × 10, dann ~40/60/80 % (Faustregel, auf 5 kg gerundet). */
  warmup(kg, bar) {
    if (!(kg >= 40) || kg <= bar) return [];
    const out = [{ kg: bar, reps: 10 }];
    [[0.4, 5], [0.6, 3], [0.8, 2]].forEach(([f, reps]) => {
      const w = Math.round((kg * f) / 5) * 5; // 5-kg-Schritte: ohne 1,25er-Scheiben
      if (w > out.at(-1).kg && w < kg) out.push({ kg: w, reps });
    });
    return out;
  },
  showPlates(kg) {
    const out = FC.$("gyPlates"); if (!out) return;
    const p = this.plates(kg, this.bar());
    out.textContent = p ? p.text : "Gewicht eintragen";
    const warm = FC.$("gyWarm"); if (!warm) return;
    const bar = this.bar(), steps = this.warmup(kg, bar);
    warm.hidden = !steps.length;
    const f = (n) => n.toLocaleString("de-DE");
    warm.replaceChildren(FC.el("span", { text: "Aufwärmen (Faustregel, nicht gespeichert):" }), FC.el("ol", {}, ...steps.map((w) => FC.el("li", { text: w.kg === bar ? `Leere Stange × ${w.reps}` : `${f(w.kg)} kg × ${w.reps} (je Seite ${this.plates(w.kg, bar).text})` }))));
  },
  toggle(x, i, s, reps, kg) {
    const st = this.st;
    if (!s.done && !reps) { this.msg("Bitte die Wiederholungen eintragen."); return; }
    s.reps = reps; s.kg = kg ?? 0; s.done = !s.done; this.msg(""); this.note = null;
    if (s.done) {
      st.restEnd = Date.now() + x.rest * 1000; this.beeped = false;
      if (x.sets.every((y) => y.done)) { const next = st.exercises.findIndex((y, k) => k > i && y.sets.some((z) => !z.done)); st.cur = next >= 0 ? next : i; }
      else st.cur = i;
      this.checkBest(x, s);
      this.audio(); // AudioContext nach einer Berührung anlegen, damit der Ton am Pausenende spielen darf
    }
    this.persist(); this.draw();
  },
  /** Neuer Bestwert? Geschätztes 1RM nach Epley (bis 12 Wdh.), verglichen mit dem bisher besten. */
  checkBest(x, s) {
    const best = this.prog(x.name)?.bestE1rmKg;
    if (!best || x.unit === "s" || !s.kg || s.reps > 12) return;
    const e1 = Math.round(s.kg * (1 + s.reps / 30) * 10) / 10;
    if (e1 <= best || e1 <= (x.pr ?? 0)) return;
    x.pr = e1;
    this.note = `Neuer Bestwert bei ${x.name}: geschätztes 1RM ${FC.de(e1, 1)} kg (bisher ${FC.de(best, 1)} kg).`;
  },
  shiftRest(d) { const st = this.st; if (!st.restEnd) st.restEnd = Date.now(); st.restEnd = Math.max(Date.now(), st.restEnd + d * 1000); this.beeped = false; this.persist(); this.tickNow(); },
  tickNow() {
    const { $ } = FC, st = this.st;
    if (!st || !$("gyClock")) { clearInterval(this.tick); return; }
    const sets = st.exercises.flatMap((x) => x.sets), done = sets.filter((s) => s.done).length;
    $("gyClock").textContent = `${this.mmss((Date.now() - Date.parse(st.startedAt)) / 1000)} · ${done}/${sets.length} Sätze`;
    const left = st.restEnd ? (st.restEnd - Date.now()) / 1000 : null;
    $("gyRest").hidden = left == null;
    if (left == null) return;
    $("gyRest").classList.toggle("over", left <= 0);
    $("gyRestT").textContent = left > 0 ? this.mmss(left) : "los";
    if (left <= 0 && !this.beeped) { this.beeped = true; this.ring(); }
    if (left < -60) { st.restEnd = null; this.persist(); }
  },
  audio() { try { this.ac ??= new AudioContext(); if (this.ac.state === "suspended") this.ac.resume(); } catch {} },
  ring() {
    try { navigator.vibrate?.([200, 100, 200]); } catch {}
    try {
      const ac = this.ac; if (!ac) return;
      for (const t of [0, 0.25]) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.value = 0.15; o.connect(g).connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.15); }
    } catch {}
  },
  async lock(on) {
    if (!on) { this.wake?.release().catch(() => {}); this.wake = null; return; }
    if (!this.visHook) { this.visHook = true; document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && this.st) this.lock(true); }); }
    if (this.wake && !this.wake.released) return;
    try { this.wake = await navigator.wakeLock?.request("screen"); } catch { this.wake = null; }
  },

  // --- Abschluss -----------------------------------------------------------------------------------
  finishPanel() {
    const { el } = FC, st = this.st;
    const rpe = el("div", { class: "gy-rpe", role: "group", "aria-label": "Anstrengung der Einheit 1 bis 10" }, ...Array.from({ length: 10 }, (_, k) => {
      const b = el("button", { type: "button", text: String(k + 1), "aria-pressed": String(st.rpe === k + 1) });
      b.onclick = () => { st.rpe = k + 1; this.persist(); for (const c of rpe.children) c.setAttribute("aria-pressed", String(c === b)); };
      return b;
    }));
    const save = el("button", { type: "button", class: "primary", text: "Speichern" });
    save.onclick = () => this.save(save);
    const back = el("button", { type: "button", text: "Weiter trainieren" });
    back.onclick = () => { st.finishing = false; this.persist(); this.draw(); };
    const drop = el("button", { type: "button", class: "linkish", text: "Einheit verwerfen" });
    drop.onclick = () => {
      if (drop.dataset.sure) { this.st = null; this.persist(); this.msg("Verworfen."); this.draw(); return; }
      drop.dataset.sure = "1"; drop.textContent = "Wirklich verwerfen? Nochmal tippen.";
    };
    return el("div", { class: "panel", id: "gyFinish", style: "margin-top:12px;display:grid;gap:10px" },
      el("h3", { text: "Wie anstrengend war die Einheit?" }), rpe,
      el("p", { class: "chart-cap", style: "margin:0", text: "1 sehr leicht, 10 maximal. Daraus schätzt der Coach die Belastung (Dauer × Anstrengung). Gespeichert werden nur abgehakte Sätze." }),
      el("div", { class: "gy-row" }, save, back, drop));
  },
  async save(btn) {
    const st = this.st;
    const exercises = st.exercises.filter((x) => x.name).map((x) => ({ exercise: x.name, sets: x.sets.filter((s) => s.done && s.reps).map((s) => ({ reps: Math.round(s.reps), weightKg: s.kg ?? 0 })) })).filter((x) => x.sets.length);
    if (!exercises.length) { this.msg("Noch kein Satz abgehakt."); return; }
    const start = new Date(st.startedAt);
    const input = { day: start.toLocaleDateString("sv-SE"), startTime: start.toISOString(), durationMin: Math.max(1, Math.min(600, Math.round((Date.now() - start) / 60000))), exercises };
    if (st.rpe) input.rpe = st.rpe;
    if (st.name) input.name = st.name;
    btn.disabled = true; this.msg("Speichere …");
    try {
      const r = await FC.call("log_strength_session", input);
      const best = (r.exercises ?? []).filter((x) => x.newBest).map((x) => x.name);
      this.st = null; this.persist();
      this.msg(["Gespeichert.", r.load?.value != null ? `Belastung ≈ ${FC.de(r.load.value)} (Schätzung).` : "", best.length ? `Neue Bestwerte: ${best.join(", ")}.` : ""].filter(Boolean).join(" "));
      this.draw();
      await FC.state.mcp?.invalidate(FC.SERVER, "get_strength").catch(() => {});
      FC.reload();
    } catch (err) { this.msg(err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err)); btn.disabled = false; }
  },
});
