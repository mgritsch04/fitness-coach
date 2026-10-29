// Gym-Modus (#107): Einheit aus Vorlage oder letzter Einheit starten, Sätze abhaken, Pausen-Timer, am Ende mit
// Einzelsätzen, Startzeit und Dauer speichern (get_strength, suggest_strength_session, log_strength_session).
// Der laufende Stand liegt im Browser (localStorage) und zusätzlich als Entwurf auf dem Server (save_gym_draft/get_gym_draft):
// Der Browserspeicher des Handys kann nach einer Pause im Hintergrund leer zurückkommen, der Entwurf holt die Einheit dann zurück.
FC.section({
  id: "gym",
  simple: true,
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
    .gy-since { display: flex; align-items: baseline; gap: 6px; }
    .gy-since b { font-family: var(--font-display); font-size: 1.7rem; font-variant-numeric: tabular-nums; }
    .gy-rest { display: flex; align-items: center; gap: 8px; }
    .gy-rest b { font-family: var(--font-display); font-size: 1.7rem; font-variant-numeric: tabular-nums; min-width: 3.2em; }
    .gy-rest.over b { color: var(--good-ink); }
    .gy-rest button { padding: 6px 9px; }
    .gy-ex { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: grid; gap: 8px; }
    .gy-ex.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    .gy-ex.done { opacity: .75; }
    .gy-exh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .gy-exh h3 { margin: 0; }
    .gy-swapbox { border-top: 1px dashed var(--line); padding-top: 8px; }
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
    .gy-rir { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: -2px 0 6px; }
    .gy-rir button { min-width: 3.2em; padding: 6px 0; }
    .gy-rir button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink, #fff); }
    .gy-rpe { display: flex; flex-wrap: wrap; gap: 6px; }
    .gy-rpe button { min-width: 2.6em; padding: 8px 0; }
    .gy-rpe button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink, #fff); }
    #sec-gym .linkish { border: 0; background: none; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-gym">Gym-Modus</h2><span class="muted">Sätze abhaken, während du trainierst</span></div>
      <div id="gyBody"></div>
      <datalist id="gyEx"></datalist>
      <p class="muted" id="gyMsg" role="status" style="margin:8px 0 0"></p>`;
    this.root = root;
    this.st = this.loadState();
    this.restoreDraft();
    FC.state.gym = this; // „Heute dran“ startet von dort die geplante Krafteinheit
  },
  ready() {
    FC.call("get_strength", { weeks: 12 }, { cache: { staleTime: 60_000, gcTime: 86_400_000 } })
      .then((d) => { this.data = d; if (!this.st || !FC.$("gyBody")?.contains(document.activeElement)) this.draw(); })
      .catch((err) => { this.err = FC.errText(err); if (!this.st) this.draw(); });
    this.loadEx(false);
    this.draw();
  },
  render() { if (!this.drawn) this.draw(); },

  // --- Meine Übungen (#399): Auswahl beim Tauschen/Hinzufügen und „wie letztes Mal“ ---------------------
  loadEx(fresh) {
    return FC.call("get_exercises", {}, fresh ? { cache: false } : { cache: { staleTime: 60_000, gcTime: 86_400_000 } })
      .then((d) => { this.ex = d; this.fillEx(); })
      .catch(() => {});
  },
  /** Auswahlliste: alle nicht ausgeblendeten Übungen. */
  fillEx() {
    const dl = FC.$("gyEx"); if (!dl) return;
    dl.replaceChildren(...(this.ex?.exercises ?? []).filter((e) => !e.hidden).map((e) => FC.el("option", { value: e.name })));
  },
  /** Übung nach Name (auch nach einem Namen, der in sie zusammengeführt wurde). */
  exByName(name) {
    const k = String(name ?? "").trim().toLowerCase();
    return k ? this.ex?.exercises.find((e) => e.name.toLowerCase() === k || e.mergedFrom.some((m) => m.name.toLowerCase() === k)) ?? null : null;
  },
  /** Sätze, Wdh. und Gewicht vom letzten Mal in die offenen Sätze übernehmen (true, wenn es ein letztes Mal gibt). */
  fillLast(x) {
    const known = this.exByName(x.name), last = known?.last?.sets;
    if (known?.unilateral) x.unilateral = true;
    if (!last?.length) { if (x.unilateral) this.setSides(x, true); return false; }
    if (!x.sets.some((s) => s.done)) x.sets = last.slice(0, 20).map((s) => ({ reps: s.reps, kg: s.weightKg, ...(s.side ? { side: s.side } : {}), done: false }));
    else { const top = Math.max(...last.map((s) => s.weightKg)); for (const t of x.sets) if (!t.done) t.kg = top; }
    if (x.sets.some((s) => s.side)) x.unilateral = true;
    if (x.unilateral) this.setSides(x, true);
    return true;
  },
  /** Einseitig (einarmig/einbeinig, #399): jeder offene Satz wird zu zwei Zeilen (links, rechts); aus = nur noch ein Satz je Paar. */
  setSides(x, on) {
    x.unilateral = on;
    if (on) { if (!x.sets.some((s) => s.side)) x.sets = x.sets.flatMap((s) => (s.done ? [s] : [{ ...s, side: "L" }, { ...s, side: "R", done: false }])); return; }
    x.sets = x.sets.filter((s) => s.side !== "R" || s.done).map((s) => { if (s.side !== "L" || s.done) return s; const { side, ...rest } = s; return rest; });
  },
  newEx(name) { const e = { name, rest: this.restFor(name), sets: [{ reps: 8, kg: 0, done: false }] }; this.fillLast(e); return e; },

  loadState() { try { const v = JSON.parse(localStorage.getItem(this.KEY) ?? "null"); return v?.exercises ? v : null; } catch { return null; } },
  persist() {
    try { if (this.st) localStorage.setItem(this.KEY, JSON.stringify(this.st)); else localStorage.removeItem(this.KEY); } catch {}
    this.pushDraft();
  },
  /** Zwischenstand kurz verzögert auf den Server sichern (leer = Entwurf löschen); Fehler sind nur ein Komfortverlust. */
  pushDraft() {
    clearTimeout(this.draftT);
    const send = () => FC.call("save_gym_draft", this.st ? { draft: JSON.stringify(this.st) } : {}).catch(() => {});
    if (this.st) this.draftT = setTimeout(send, 1500); else send();
  },
  /** Ist lokal nichts mehr da, den Entwurf vom Server holen (z. B. nach Neustart des Browsers auf dem Handy). */
  async restoreDraft() {
    if (this.st) return;
    try {
      const r = await FC.call("get_gym_draft", {});
      const v = r?.draft ? JSON.parse(r.draft) : null;
      if (!v?.exercises || this.st) return;
      this.st = v; this.persist();
      this.msg("Laufende Einheit vom Server wiederhergestellt.");
      if (this.drawn) this.draw();
    } catch { /* offline oder kein Entwurf */ }
  },
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
    const today = FC.state.data?.today;
    const sel = el("select", { id: "gySrc" },
      d.templates.length ? el("optgroup", { label: "Vorlage (mit Gewichtsvorschlag)" }, ...d.templates.map((t) => el("option", { value: `t:${t.name}`, text: t.name }))) : null,
      d.sessions.length ? el("optgroup", { label: "Wie eine letzte Einheit" }, ...d.sessions.slice(0, 6).map((s) => el("option", { value: `s:${s.id}`, text: `${fmtDayLong(s.day)}${s.name ? ` · ${s.name}` : ""}` }))) : null,
      el("option", { value: "", text: "Leer starten" }));
    // Express (#281): wenig Zeit → Einheit kürzen lassen statt ausfallen.
    const time = el("select", { id: "gyTime" }, ...[["", "Volle Einheit"], ["45", "Nur 45 min"], ["30", "Nur 30 min"], ["20", "Nur 20 min"]].map(([v, t]) => el("option", { value: v, text: t })));
    // Vorlage je Wochentag (#370): für heute vorausgewählt; gelöschte Vorlagen bleiben ohne Vorschlag.
    const wd = today ? (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7 : null;
    const sugg = wd == null ? null : FC.dayPlan(FC.state.data?.training?.prefs, wd).strength;
    const hasSugg = !!sugg && d.templates.some((t) => t.name === sugg);
    if (hasSugg) sel.value = `t:${sugg}`;
    const go = el("button", { type: "button", class: "primary", text: "Einheit starten" });
    go.onclick = () => this.start(sel.value, go, Number(time.value) || null);
    body.replaceChildren(this.updatePanel() ?? "", this.savedPanel() ?? "", el("div", { class: "panel" },
      el("div", { class: "gy-start" }, el("label", { for: "gySrc" }, "Vorlage für diese Einheit", sel), el("label", { for: "gyTime" }, "Zeit", time), go),
      hasSugg ? el("p", { class: "chart-cap", id: "gyTplHint", text: `Für heute vorgeschlagen: Vorlage „${sugg}“. Unten planst du deine Woche.` }) : null,
      el("p", { class: "chart-cap", text: "Nach jedem Satz läuft eine Pause (Grundübungen 3 min, sonst 90 s). Gewichte aus Vorlagen sind Vorschläge, nach Gefühl anpassen." })),
      this.weekPanel(d.templates, wd));
  },
  /** Meine Woche: je Wochentag eine eigene Vorlage (prefs.templateByDay, #370); speichert beim Ändern, der heutige Tag steht vorn im Start. */
  weekPanel(templates, wd) {
    const { el } = FC, names = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
    const have = new Set(templates.map((t) => t.name));
    const out = el("span", { class: "muted", role: "status", id: "gyWeekMsg" });
    const rows = names.map((n, i) => {
      // Kraft und Rad getrennt: ein Tag kann beides haben (Kraft-Vorlage UND Rad); „Ruhetag“ schließt beides aus.
      const cur = FC.dayPlan(FC.state.data?.training?.prefs, i);
      const sel = el("select", { "aria-label": `${n}: Kraft-Vorlage` }, el("option", { value: "", text: "keine Kraft" }), el("option", { value: "@ruhe", text: "Ruhetag" }), ...templates.map((t) => el("option", { value: t.name, text: `Kraft: ${t.name}` })));
      sel.value = cur.rest ? "@ruhe" : cur.strength && have.has(cur.strength) ? cur.strength : "";
      const rad = el("input", { type: "checkbox", "aria-label": `${n}: Rad` }); rad.checked = cur.ride; rad.disabled = cur.rest;
      const save = async () => {
        const rest = sel.value === "@ruhe";
        sel.disabled = rad.disabled = true; out.textContent = "Speichere …";
        try {
          await FC.call("set_training_prefs", FC.dayPlanPatch(FC.state.data?.training?.prefs, i, { strength: rest ? null : sel.value, ride: rad.checked, rest }));
          out.textContent = `${n}: ${rest ? "Ruhetag" : [sel.value ? `Kraft „${sel.value}“` : null, rad.checked ? "Rad" : null].filter(Boolean).join(" + ") || "nichts geplant"} gespeichert.`;
          await FC.reload();
        } catch (e) { out.textContent = FC.errText(e); }
        finally { sel.disabled = false; rad.disabled = sel.value === "@ruhe"; }
      };
      sel.onchange = save; rad.onchange = save;
      return el("div", { class: "gy-wk", style: `display:flex;flex-wrap:wrap;gap:8px;align-items:center${i === wd ? ";font-weight:600" : ""}` },
        el("span", { text: i === wd ? `${n} (heute)` : n, style: "flex:0 0 8em" }), sel, el("label", { style: "display:inline-flex;gap:6px;align-items:center;font-weight:400" }, rad, "Rad"));
    });
    return el("div", { class: "panel", id: "gyWeek", style: "margin-top:12px;display:grid;gap:8px" },
      el("h3", { text: "Meine Woche" }),
      el("p", { class: "chart-cap", style: "margin:0", text: templates.length ? "Plane Kraft und Rad getrennt: pro Tag eine Kraft-Vorlage und/oder Rad. Am Tag ist die Vorlage beim Start vorausgewählt." : "Noch keine Kraft-Vorlage gespeichert (nach einer Einheit „Als Vorlage speichern“); Rad und Ruhetage kannst du schon planen." }),
      el("div", { style: "display:grid;gap:6px" }, ...rows), out);
  },
  /** Vorlage direkt starten (z. B. von der Startseite); läuft schon eine Einheit, bleibt sie. */
  startTemplate(name) { if (!this.st) this.start(`t:${name}`); },
  /** Nach dem Speichern (#399): wurde eine Übung der Vorlage getauscht, fragen, ob die Vorlage mitzieht. */
  updatePanel() {
    const { el } = FC, u = this.tplUpdate;
    if (!u) return null;
    const out = el("span", { class: "muted", role: "status" });
    const yes = el("button", { type: "button", class: "primary", text: "Ja, Vorlage aktualisieren" });
    const no = el("button", { type: "button", text: "Nein, nur diese Einheit" });
    no.onclick = () => { this.tplUpdate = null; this.draw(); };
    yes.onclick = async () => {
      yes.disabled = true; out.textContent = "Speichere …";
      try {
        await FC.call("save_strength_template", { name: u.name, exercises: u.exercises });
        if (this.data) this.data.templates = this.data.templates.map((t) => (t.name === u.name ? { ...t, exercises: u.exercises } : t));
        await FC.state.mcp?.invalidate(FC.SERVER, "get_strength").catch(() => {});
        this.tplUpdate = null; this.draw(); this.msg(`Vorlage „${u.name}“ aktualisiert.`);
      } catch (err) { out.textContent = FC.errText(err); yes.disabled = false; }
    };
    return el("div", { class: "panel", id: "gyTplUpdate", style: "margin-bottom:12px;display:grid;gap:8px" },
      el("h3", { text: "Vorlage mit den geänderten Übungen aktualisieren?" }),
      el("p", { class: "muted", style: "margin:0", text: `„${u.name}“: ${u.swaps.join(", ")}` }),
      el("div", { class: "gy-row" }, yes, no), out);
  },
  /** Nach dem Speichern (#319): die Einheit mit Namen als Vorlage übernehmen. */
  savedPanel() {
    const { el } = FC, sv = this.saved;
    if (!sv) return null;
    const name = el("input", { type: "text", id: "gyTplName", maxlength: 80, placeholder: "z. B. Beine A", "aria-label": "Name der Vorlage" });
    name.value = sv.name ?? "";
    const out = el("span", { class: "muted", role: "status" });
    const ok = el("button", { type: "button", class: "primary", text: "Als Vorlage speichern" });
    const no = el("button", { type: "button", class: "linkish", text: "Nein danke" });
    no.onclick = () => { this.saved = null; this.draw(); };
    ok.onclick = async () => {
      const n = name.value.trim();
      if (!n) { out.textContent = "Bitte einen Namen eingeben."; name.focus(); return; }
      ok.disabled = true; out.textContent = "Speichere …";
      try {
        await FC.call("save_strength_template", { name: n, exercises: sv.exercises });
        this.saved = null;
        if (this.data) this.data.templates = [...this.data.templates.filter((t) => t.name !== n), { name: n, exercises: sv.exercises }];
        await FC.state.mcp?.invalidate(FC.SERVER, "get_strength").catch(() => {});
        this.draw(); this.msg(`Vorlage „${n}“ gespeichert. Du findest sie unter „Vorlage“.`);
      } catch (err) { out.textContent = FC.errText(err); ok.disabled = false; }
    };
    return el("div", { class: "panel", style: "margin-bottom:12px;display:grid;gap:8px" },
      el("h3", { text: "Diese Einheit als Vorlage speichern?" }),
      el("div", { class: "gy-row" }, name, ok, no), out);
  },
  /** Geplante Krafteinheit eines Tages starten (läuft schon eine Einheit, bleibt sie). */
  startPlan(day) { if (!this.st) this.start(`p:${day}`); },
  async start(src, btn, minutes = null) {
    if (btn) btn.disabled = true;
    this.msg("");
    try {
      let list = [], name = null, tpl = null;
      if (src.startsWith("p:")) {
        const w = FC.state.data.training.strengthWorkouts.days.find((x) => x.day === src.slice(2));
        name = w?.focus ?? null;
        list = (w?.exercises ?? []).map((x) => ({ name: x.name, unit: x.unit, sets: Array.from({ length: x.sets }, () => ({ reps: x.reps, kg: x.weightKg })) }));
        if (w?.exercises.some((x) => x.weightKg == null && x.unit !== "s")) this.msg("Wo kein Gewicht steht: eines wählen, bei dem noch 2 Wiederholungen Reserve bleiben.");
      } else if (src.startsWith("t:")) {
        name = src.slice(2);
        const s = await FC.call("suggest_strength_session", { template: name });
        tpl = name;
        // Sätze, Wdh. und Gewicht wie beim letzten Mal dieser Übung (#399); ohne Vorgeschichte die Werte der Vorlage.
        list = s.exercises.map((x) => ({ name: x.name, from: x.name, sets: x.lastSets?.length ? x.lastSets.slice(0, 20).map((y) => ({ reps: y.reps, kg: y.weightKg, ...(y.side ? { side: y.side } : {}) })) : Array.from({ length: x.sets }, () => ({ reps: x.reps, kg: x.weightKg ?? 0 })) }));
        const down = s.coachNotes?.find((n) => n.effect === "down");
        if (down) this.msg(down.text);
      } else if (src.startsWith("s:")) {
        const s = this.data.sessions.find((x) => x.id === src.slice(2));
        name = s?.name ?? null;
        const by = new Map();
        for (const x of s?.sets ?? []) { if (!by.has(x.exercise)) by.set(x.exercise, { name: x.exerciseName, sets: [] }); by.get(x.exercise).sets.push({ reps: x.reps, kg: x.weightKg, ...(x.side ? { side: x.side } : {}) }); }
        list = [...by.values()];
      }
      list = list.filter((x) => x.name || !minutes);
      for (const x of list) x.unilateral = x.sets.some((y) => y.side) || !!this.exByName(x.name)?.unilateral;
      if (minutes && list.length) {
        const uni = new Set(list.filter((x) => x.unilateral).map((x) => x.name));
        const r = await FC.call("get_express_session", { minutes, exercises: list.map((x) => ({ name: x.name, sets: x.unilateral ? Math.ceil(x.sets.length / 2) : x.sets.length, reps: x.sets[0]?.reps || 8, weightKg: x.sets[0]?.kg ?? null, unit: x.unit === "s" ? "s" : "Wdh" })) });
        list = r.exercises.map((e) => ({ name: e.name, unilateral: uni.has(e.name), unit: e.unit, restS: e.restS, superset: e.superset, sets: Array.from({ length: e.sets }, () => ({ reps: e.reps, kg: e.weightKg })) }));
        this.msg(r.text);
      }
      this.st = { startedAt: new Date().toISOString(), name, tpl, cur: 0, restEnd: null, rpe: null, finishing: false,
        exercises: list.map((x) => ({ name: x.name, from: x.from, unit: x.unit === "s" ? "s" : undefined, rest: x.restS ?? this.restFor(x.name), superset: x.superset ?? undefined, ...(x.unilateral ? { unilateral: true } : {}), sets: x.sets.map((y) => ({ ...y, done: false })) })) };
      for (const e of this.st.exercises) if (e.unilateral) this.setSides(e, true);
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
    // Dauer seit dem letzten abgehakten Satz (#107): zählt hoch bis zum nächsten Haken.
    const since = el("div", { class: "gy-since", id: "gySince" }, el("span", { class: "muted", text: "seit letztem Satz" }), el("b", { id: "gySinceT" }));
    const note = el("div", { class: "gy-note", role: "status", text: this.note ?? "" }); note.hidden = !this.note;
    const bar = el("div", { class: "gy-bar" }, clock, since, rest, note);

    const list = el("div", { class: "gy-list" }, ...st.exercises.map((x, i) => this.exCard(x, i)));
    const addName = el("input", { type: "text", list: "gyEx", maxlength: 80, placeholder: "Übung hinzufügen", "aria-label": "Übung hinzufügen", style: "flex:1 1 12em;min-width:0" });
    const add = el("button", { type: "button", text: "+ Übung" });
    add.onclick = () => { const n = addName.value.trim(); if (!n) { addName.focus(); return; } st.exercises.push(this.newEx(this.exByName(n)?.name ?? n)); st.cur = st.exercises.length - 1; this.persist(); this.draw(); };
    const finish = el("button", { type: "button", class: "primary", text: "Einheit beenden" });
    finish.onclick = () => { st.finishing = true; this.persist(); this.draw(); FC.$("gyFinish")?.scrollIntoView({ block: "nearest" }); };

    // Übung beschreiben (#327), Vorschläge aus dem Krafttraining-Abschnitt.
    const descB = FC.state.describePanel ? el("button", { type: "button", class: "linkish", text: "Übung beschreiben", "aria-expanded": String(!!this.descOpen) }) : null;
    if (descB) descB.onclick = () => { this.descOpen = !this.descOpen; this.draw(); };
    const desc = this.descOpen && descB ? FC.state.describePanel((n) => { this.descOpen = false; st.exercises.push(this.newEx(this.exByName(n)?.name ?? n)); st.cur = st.exercises.length - 1; this.persist(); this.draw(); }) : "";
    body.replaceChildren(bar, list, el("div", { class: "gy-row", style: "margin-top:12px" }, addName, add, descB ?? ""), desc, st.finishing ? this.finishPanel() : el("div", { class: "gy-row", style: "margin-top:12px" }, finish));
    this.tickNow();
    this.tick = setInterval(() => this.tickNow(), 500);
  },
  exCard(x, i) {
    const { el } = FC, st = this.st;
    const doneSets = x.sets.filter((s) => s.done).length;
    const restBtn = el("button", { type: "button", class: "linkish", text: `Pause ${this.mmss(x.rest)}`, "aria-label": `Pausenlänge für ${x.name || "diese Übung"} ändern` });
    restBtn.onclick = () => { const r = this.RESTS; x.rest = r[(r.indexOf(x.rest) + 1) % r.length] ?? 90; this.persist(); restBtn.textContent = `Pause ${this.mmss(x.rest)}`; };
    const title = x.name ? el("h3", { text: x.name }) : (() => { const inp = el("input", { type: "text", list: "gyEx", maxlength: 80, placeholder: "Übung", "aria-label": "Name der Übung" }); inp.onchange = () => { x.name = this.exByName(inp.value)?.name ?? inp.value.trim(); x.rest = this.restFor(x.name); if (this.fillLast(x)) this.draw(); this.persist(); }; return inp; })();
    const card = el("div", { class: `gy-ex${i === st.cur ? " cur" : ""}${doneSets === x.sets.length ? " done" : ""}` },
      el("div", { class: "gy-exh" }, title, el("span", { class: "muted" }, x.superset ? `Supersatz ${x.superset} · ` : "", `${doneSets}/${x.sets.length} Sätze · `, restBtn)),
      (() => {
        const last = x.name ? this.prog(x.name)?.history?.at(-1) : null;
        if (!last) return null;
        const kg = last.topSet.weightKg ? ` mit ${FC.de(last.topSet.weightKg, last.topSet.weightKg % 1 ? 1 : 0)} kg` : "";
        // Verlauf und Prognose (#328) aus dem Krafttraining-Abschnitt.
        const hist = FC.state.exerciseDetail ? el("button", { type: "button", class: "linkish", text: this.histAt === i ? "Verlauf schließen" : "Verlauf", "aria-expanded": String(this.histAt === i) }) : null;
        if (hist) hist.onclick = () => { this.histAt = this.histAt === i ? null : i; this.draw(); };
        const tg = x.unit === "s" ? null : this.target(last, this.isBar(x.name));
        return el("div", {}, tg ? el("div", { class: "gy-target", style: "font-weight:600;font-size:.9rem" }, this.targetText(tg)) : "", el("div", { class: "muted gy-last" }, `Letztes Mal (${FC.fmtDayLong(last.day)}): ${last.sets} ${last.sets === 1 ? "Satz" : "Sätze"}, bester Satz ${last.topSet.reps}${x.unit === "s" ? " s" : ""}${kg} `, hist ?? ""),
          this.histAt === i && hist ? FC.state.exerciseDetail(this.prog(x.name)) : "");
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
      card.append(el("div", { class: `gy-set${s.done ? " on" : ""}` }, el("span", { class: "n", text: this.setLabel(x, j) }), reps, kg, ok));
      if (s.done && x.unit !== "s" && j === x.sets.map((t) => t.done).lastIndexOf(true)) card.append(this.rirRow(x, s, j));
    });
    const more = el("button", { type: "button", text: "+ Satz" });
    more.onclick = () => {
      if (x.unilateral) { const l = [...x.sets].reverse().find((t) => t.side === "L") ?? { reps: 8, kg: 0 }, r = [...x.sets].reverse().find((t) => t.side === "R") ?? l; x.sets.push({ reps: l.reps, kg: l.kg, side: "L", done: false }, { reps: r.reps, kg: r.kg, side: "R", done: false }); }
      else { const l = x.sets.at(-1) ?? { reps: 8, kg: 0 }; x.sets.push({ reps: l.reps, kg: l.kg, done: false }); }
      this.persist(); this.draw();
    };
    const less = el("button", { type: "button", text: "− Satz" }); const step = x.unilateral ? 2 : 1;
    less.disabled = x.sets.length <= step || x.sets.slice(-step).some((t) => t.done);
    less.onclick = () => { x.sets.splice(-step, step); this.persist(); this.draw(); };
    const uni = el("button", { type: "button", class: "linkish", text: "Einseitig", "aria-pressed": String(!!x.unilateral), title: "Einarmig/einbeinig: links und rechts getrennt eintragen" });
    uni.onclick = () => { this.setSides(x, !x.unilateral); this.persist(); this.draw(); };
    const row = el("div", { class: "gy-row" }, more, less, uni);
    if (i !== st.cur) { const sel = el("button", { type: "button", class: "linkish", text: "Jetzt diese Übung" }); sel.onclick = () => { st.cur = i; this.persist(); this.draw(); }; row.append(sel); }
    // Übung tauschen (#204): gleichwertige Alternative, Satzzahl bleibt.
    if (x.name && !x.sets.every((t) => t.done)) {
      const sw = el("button", { type: "button", class: "linkish gy-swap", text: "Tauschen", "aria-expanded": String(this.swapAt === i) });
      sw.onclick = () => this.loadSwap(i, x);
      row.append(sw);
    }
    card.append(row);
    if (this.swapAt === i) card.append(this.swapPanel(x));
    return card;
  },
  /** Bezeichnung des Satzes: „1.“ oder bei einseitigen Übungen „1 L“ / „1 R“ (Paar-Nummer, Seite). */
  setLabel(x, j) {
    const s = x.sets[j];
    if (!s.side) return `${j + 1}.`;
    const pair = x.sets.slice(0, j + 1).filter((t) => t.side === "L").length || 1;
    return `${pair} ${s.side === "L" ? "L" : "R"}`;
  },
  async loadSwap(i, x) {
    if (this.swapAt === i) { this.swapAt = null; this.draw(); return; }
    this.swapAt = i; this.swapList = null; this.draw();
    try { this.swapList = await FC.call("get_exercise_alternatives", { exercise: x.name, exclude: this.st.exercises.map((e) => e.name).filter(Boolean) }); }
    catch { this.swapList = { alternatives: [], note: "Alternativen gerade nicht ladbar." }; }
    if (this.swapAt === i) this.draw();
  },
  swapPanel(x) {
    const { el, de } = FC, r = this.swapList;
    if (!r) return el("p", { class: "muted gy-swapbox", text: "Lädt Alternativen …" });
    const opts = r.alternatives.map((a) => {
      const b = el("button", { type: "button", text: `${a.name}${a.startKg != null ? ` · ${de(a.startKg, a.startKg % 1 ? 1 : 0)} kg` : ""}` });
      b.onclick = () => {
        x.name = a.name; x.rest = this.restFor(a.name);
        if (!this.fillLast(x)) for (const t of x.sets) if (!t.done) t.kg = a.startKg ?? null;
        this.swapAt = null; this.persist(); this.draw();
      };
      return b;
    });
    // Jede eigene Übung wählbar (#399), auch eine neue (wird mit dem Speichern der Einheit angelegt).
    const pick = el("input", { type: "text", list: "gyEx", maxlength: 80, placeholder: "Eigene Übung wählen oder neu eingeben", "aria-label": `${x.name} ersetzen durch`, style: "flex:1 1 14em;min-width:0" });
    const go = el("button", { type: "button", text: "Tauschen" });
    go.onclick = () => {
      const n = pick.value.trim();
      if (!n) { pick.focus(); return; }
      const known = this.exByName(n);
      x.name = known?.name ?? n; x.rest = this.restFor(x.name);
      this.fillLast(x);
      this.swapAt = null; this.persist(); this.draw();
      if (!known) this.msg(`Neue Übung „${x.name}“: wird mit dem Speichern der Einheit angelegt.`);
    };
    const own = el("div", { class: "gy-row" }, pick, go);
    return el("div", { class: "gy-swapbox", role: "group", "aria-label": `Alternativen zu ${x.name}` },
      opts.length ? el("div", { class: "gy-row" }, ...opts) : el("p", { class: "muted", text: "Keine passende Alternative bekannt." }),
      own,
      el("p", { class: "fine muted", text: r.note ?? "" }));
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
      st.lastSetAt = Date.now();
      if (!(x.unilateral && s.side === "L")) { st.restEnd = Date.now() + x.rest * 1000; this.beeped = false; } // nach links keine Pause, erst nach rechts
      if (x.sets.every((y) => y.done)) { const next = st.exercises.findIndex((y, k) => k > i && y.sets.some((z) => !z.done)); st.cur = next >= 0 ? next : i; }
      else st.cur = i;
      this.checkBest(x, s);
      if (!this.note) this.checkReps(x, s);
      this.audio(); // AudioContext nach einer Berührung anlegen, damit der Ton am Pausenende spielen darf
    }
    this.persist(); this.draw();
  },
  // Reserve je Satz (#280): wie viele Wiederholungen wären noch drin? Spiegelt core/autoregulation.ts.
  RIR: { "0": { rpe: 10, label: "0" }, "1-2": { rpe: 8.5, label: "1–2" }, "3+": { rpe: 7, label: "3+" } },
  nextKg(kg, rir, bar) {
    if (!(kg > 0)) return kg;
    const step = bar ? 2.5 : 1, raw = rir === "0" ? kg * 0.95 : rir === "3+" ? kg * 1.025 : kg;
    let n = Math.round(raw / step) * step;
    if (rir === "3+" && n <= kg) n = kg + step;
    if (rir === "0" && n >= kg) n = Math.max(0, kg - step);
    return Math.round(n * 10) / 10;
  },
  // Zielwert für heute (#375): Doppelprogression im Bereich 8–12 Wdh. nach dem besten Satz vom letzten Mal.
  // Oben im Bereich → mehr Gewicht, zurück auf 8 Wdh.; sonst gleiches Gewicht und eine Wiederholung mehr.
  TOP_REPS: 12, BASE_REPS: 8,
  target(last, bar) {
    const { reps, weightKg: kg } = last.topSet, sets = Math.max(1, last.sets);
    if (!(reps > 0)) return null;
    if (reps >= this.TOP_REPS) {
      if (!(kg > 0)) return { sets, reps, kg, up: false, hold: true }; // Körpergewicht: Bereich ausgereizt, Wdh. halten
      return { sets, reps: this.BASE_REPS, kg: this.nextKg(kg, "3+", bar), up: true };
    }
    return { sets, reps: reps + 1, kg, up: false };
  },
  targetText(t) {
    const kg = t.kg ? ` mit ${FC.de(t.kg, t.kg % 1 ? 1 : 0)} kg` : "";
    return `Ziel heute: ${t.sets}×${t.reps}${kg}${t.up ? " (Gewicht rauf, oberes Ende erreicht)" : t.hold ? " (oberes Ende, Wiederholungen halten)" : " (gleiches Gewicht, eine Wdh. mehr)"}`;
  },
  rirRow(x, s, j) {
    const { el } = FC;
    const btns = Object.entries(this.RIR).map(([k, v]) => {
      const b = el("button", { type: "button", text: v.label, "aria-pressed": String(s.rir === k) });
      b.onclick = () => this.setRir(x, s, j, k);
      return b;
    });
    return el("div", { class: "gy-rir", role: "group", "aria-label": `${x.name} Satz ${j + 1}: Wiederholungen noch drin` }, el("span", { class: "muted", text: "Noch drin:" }), ...btns);
  },
  setRir(x, s, j, rir) {
    s.rir = rir;
    const next = x.sets.find((t, k) => k > j && !t.done);
    if (next && s.kg > 0) {
      const kg = this.nextKg(s.kg, rir, this.isBar(x.name));
      if (kg !== s.kg) { for (const t of x.sets) if (!t.done) t.kg = kg; }
      const d = FC.de(kg, kg % 1 ? 1 : 0);
      const best = /^(Neuer Bestwert|Wiederholungsrekord)/.test(this.note ?? "") ? this.note : null;
      this.note = [best, rir === "1-2" ? `Reserve passt: nächster Satz wieder ${d} kg.` : `Nächster Satz: ${d} kg (${rir === "0" ? "am Limit, etwas leichter" : "noch viel drin, etwas schwerer"}).`].filter(Boolean).join(" ");
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
  /** Wiederholungsrekord je Gewicht (#299, spiegelt core/rep-records.ts): bei diesem oder höherem Gewicht noch nie so viele Wdh. */
  checkReps(x, s) {
    if (x.unit === "s" || !(s.kg > 0) || !(s.reps > 0)) return;
    const n = x.name.trim().toLowerCase();
    const marks = this.data?.repRecords?.find((r) => r.name.toLowerCase() === n || r.exercise === n)?.marks;
    if (!marks) return;
    let prev = null;
    for (const m of marks) if (m.kg >= s.kg) prev = Math.max(prev ?? 0, m.reps);
    for (const t of x.sets) if (t !== s && t.done && t.kg >= s.kg) prev = Math.max(prev ?? 0, t.reps); // schon heute geschafft
    if (prev == null || s.reps <= prev) return;
    this.note = `Wiederholungsrekord: erstmals ${s.reps} Wdh. mit ${FC.de(s.kg, s.kg % 1 ? 1 : 0)} kg (bisher höchstens ${prev}).`;
  },
  shiftRest(d) { const st = this.st; if (!st.restEnd) st.restEnd = Date.now(); st.restEnd = Math.max(Date.now(), st.restEnd + d * 1000); this.beeped = false; this.persist(); this.tickNow(); },
  tickNow() {
    const { $ } = FC, st = this.st;
    if (!st || !$("gyClock")) { clearInterval(this.tick); return; }
    const sets = st.exercises.flatMap((x) => x.sets), done = sets.filter((s) => s.done).length;
    $("gyClock").textContent = `${this.mmss((Date.now() - Date.parse(st.startedAt)) / 1000)} · ${done}/${sets.length} Sätze`;
    const sinceS = st.lastSetAt && done ? (Date.now() - st.lastSetAt) / 1000 : null;
    if ($("gySince")) { $("gySince").hidden = sinceS == null; if (sinceS != null) $("gySinceT").textContent = this.mmss(sinceS); }
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
    const exercises = st.exercises.filter((x) => x.name).map((x) => ({ exercise: x.name, sets: x.sets.filter((s) => s.done && s.reps).map((s) => ({ reps: Math.round(s.reps), weightKg: s.kg ?? 0, ...(s.side ? { side: s.side } : {}), ...(s.rir ? { rpe: this.RIR[s.rir].rpe } : {}) })) })).filter((x) => x.sets.length);
    if (!exercises.length) { this.msg("Noch kein Satz abgehakt."); return; }
    // Anstrengung vergessen (#320)? Einmal nachfragen, beim zweiten Tippen ohne speichern.
    if (!st.rpe && !btn.dataset.noRpe) { btn.dataset.noRpe = "1"; this.msg("Anstrengung noch nicht gewählt: bitte oben 1 bis 10 antippen. Nochmal auf Speichern tippen, um ohne Anstrengung zu speichern."); return; }
    const start = new Date(st.startedAt);
    const input = { day: start.toLocaleDateString("sv-SE"), startTime: start.toISOString(), durationMin: Math.max(1, Math.min(600, Math.round((Date.now() - start) / 60000))), exercises };
    if (st.rpe) input.rpe = st.rpe;
    if (st.name) input.name = st.name;
    btn.disabled = true; this.msg("Speichere …");
    try {
      const r = await FC.call("log_strength_session", input);
      const best = (r.exercises ?? []).filter((x) => x.newBest).map((x) => x.name);
      // Vorlage aus der Einheit (#319): je Übung Satzzahl und bester Satz.
      this.saved = { name: st.name ?? "", exercises: exercises.map((x) => { const top = x.sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a)); return { exercise: x.exercise, sets: Math.min(20, x.sets.length), reps: Math.min(100, top.reps), weightKg: top.weightKg }; }) };
      // Übung der Vorlage getauscht (#399)? Dann nachfragen, ob die Vorlage mitzieht.
      const tpl = st.tpl ? this.data?.templates.find((t) => t.name === st.tpl) : null;
      const swaps = tpl ? st.exercises.filter((x) => x.from && x.name && x.from.toLowerCase() !== x.name.toLowerCase() && this.saved.exercises.some((e) => e.exercise === x.name)) : [];
      this.tplUpdate = swaps.length ? {
        name: tpl.name, swaps: swaps.map((x) => `${x.from} → ${x.name}`),
        exercises: tpl.exercises.map((te) => {
          const sw = swaps.find((x) => x.from.toLowerCase() === (te.name ?? te.exercise).toLowerCase());
          const sv = sw && this.saved.exercises.find((e) => e.exercise === sw.name);
          return sv ? { exercise: sv.exercise, sets: sv.sets, reps: sv.reps, weightKg: sv.weightKg } : { exercise: te.exercise, sets: te.sets, reps: te.reps, weightKg: te.weightKg ?? 0 };
        }),
      } : null;
      this.st = null; this.persist();
      this.msg(["Gespeichert.", r.load?.value != null ? `Belastung ≈ ${FC.de(r.load.value)} (Schätzung).` : "", best.length ? `Neue Bestwerte: ${best.join(", ")}.` : ""].filter(Boolean).join(" "));
      this.draw();
      await FC.state.mcp?.invalidate(FC.SERVER, "get_strength").catch(() => {});
      await FC.state.mcp?.invalidate(FC.SERVER, "get_exercises").catch(() => {});
      this.loadEx(true);
      FC.reload();
    } catch (err) { this.msg(err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err)); btn.disabled = false; }
  },
});
