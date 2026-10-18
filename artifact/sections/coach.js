// Coach über Claude (sample): Empfehlung erklären, Wochenplan, Wochenrückblick, Fragen-Chat.
// Claude bekommt nur die Daten, die hier zusammengestellt werden; keine API-Schlüssel.
FC.section({
  id: "coach",
  tab: "coach",
  order: 20,
  mount(root) {
    FC.state.coach = this; // Regeln und Datenauszug auch für andere Abschnitte (Morgen-Briefing)
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-coach">Coach</h2><span class="muted">Antworten schreibt Claude aus deinen Daten. Das zählt zu deinem Claude-Kontingent.</span></div>
      <div class="panel" style="display:grid; gap:14px;">
        <div class="coach-actions">
          <button type="button" class="primary" data-coach="explain" disabled>Empfehlung erklären</button>
          <button type="button" data-coach="plan" disabled>Wochenplan vorschlagen</button>
          <button type="button" id="coachStop" hidden>Stopp</button>
        </div>
        <div id="coachOut" class="coach-out muted">Wähle oben, was der Coach tun soll, oder stell unten eine Frage zu deinen Daten.</div>
        <div class="chat" id="chat"></div>
        <div class="ask-chips" id="askChips" aria-label="Fragen-Vorschläge"></div>
        <form class="ask" id="askForm" autocomplete="off">
          <input id="askInput" type="text" placeholder="z. B. Warum ist meine HRV diese Woche niedriger?" aria-label="Frage an den Coach">
          <button type="submit" id="askBtn" disabled>Fragen</button>
        </form>
        <button type="button" class="linkish" id="chatClear" hidden>Neuer Chat</button>
      </div>`;
    const { $, el } = FC;
    this.root = root;
    this.chat = this.loadChat();
    for (let i = 0; i + 1 < this.chat.length; i += 2) this.showPair(this.chat[i].content, this.chat[i + 1].content);
    $("chatClear").hidden = !this.chat.length;
    $("chatClear").onclick = () => { this.chat = []; this.saveChat(); $("chat").replaceChildren(); $("chatClear").hidden = true; };
    root.querySelectorAll("[data-coach]").forEach((b) => b.addEventListener("click", () => this.run(b.dataset.coach)));
    $("coachStop").onclick = () => this.ctl?.abort();
    $("askForm").addEventListener("submit", (e) => { e.preventDefault(); this.ask(); });
    void el;
  },
  ready() { if (!FC.state.sample) this.root.hidden = true; },
  render() { this.busy(false); this.chips(); },
  CHAT_KEY: "fc-coach-chat",
  /** Verlauf aus diesem Browser: nur vollständige Frage-Antwort-Paare, höchstens 3 Tage alt. */
  loadChat() {
    try {
      const v = JSON.parse(localStorage.getItem(this.CHAT_KEY) ?? "null");
      if (!v || Date.now() - Date.parse(v.at) > 3 * 86_400_000 || !Array.isArray(v.msgs)) return [];
      const m = v.msgs.filter((x) => (x.role === "user" || x.role === "assistant") && typeof x.content === "string");
      return m.length % 2 ? m.slice(0, -1) : m;
    } catch { return []; }
  },
  saveChat() {
    try { if (this.chat.length) localStorage.setItem(this.CHAT_KEY, JSON.stringify({ at: new Date().toISOString(), msgs: this.chat.slice(-20) })); else localStorage.removeItem(this.CHAT_KEY); } catch {}
  },
  showPair(q, text) {
    const { $, el, richText } = FC, a = el("div", { class: "a coach-out" });
    $("chat").append(el("div", { class: "q", text: q }), a); richText(a, text);
  },
  /** Fragen zum Antippen, passend zum Tag. */
  chips() {
    const { $, el, state } = FC, d = state.data, box = $("askChips");
    if (!d || !box) return;
    const rec = d.days.at(-1)?.recovery, gym = d.training?.strengthWorkouts?.days?.some((w) => w.day === d.today);
    const qs = [
      gym ? "Was mache ich heute im Gym?" : "Was soll ich heute trainieren?",
      rec != null && rec < 34 ? "Warum ist meine Erholung heute niedrig?" : "Wie entwickelt sich meine Fitness?",
      "Wie lief meine letzte Woche?",
      "Was fällt in meinen Analysen auf?",
      "Lohnt sich eine Ausfahrt draußen?",
    ];
    box.replaceChildren(...qs.map((q) => { const b = el("button", { type: "button", class: "chip", text: q }); b.onclick = () => { if (b.disabled) return; $("askInput").value = q; this.ask(); }; return b; }));
    box.hidden = !state.sample;
  },
  rerender() {},
  busy(on) {
    const ok = !!FC.state.data && !!FC.state.sample;
    this.root.querySelectorAll("[data-coach], #askBtn, #askChips button").forEach((b) => (b.disabled = on || !ok));
    FC.$("coachStop").hidden = !on;
  },
  rules: `Du bist ein erfahrener Rad- und Krafttrainer und coachst eine Person, die Krafttraining im Gym und Rennrad (aktuell indoor mit MyWhoosh) macht. Deutsch, per du, freundlich und konkret.
Regeln: Nur Trainingsempfehlungen, keine medizinischen Diagnosen; bei Hinweisen auf Krankheit rate zu Ruhe und ggf. ärztlicher Abklärung.
Kennzeichne Schätzungen (Belastung, Fitness/CTL, Ermüdung/ATL, Form/TSB sind geschätzt; Belastung von Krafttraining aus dem Puls ist eher zu niedrig). Erfinde keine Werte, nutze nur die Daten unten.
Format: kurze Absätze, Aufzählungen mit "- ", **fett** für Kernaussagen, keine Überschriften, keine Tabellen. Höchstens 180 Wörter, wenn nicht anders verlangt.
Begriffe: Erholung (WHOOP Recovery %), HRV in ms (rMSSD), Ruhepuls, Strain (WHOOP 0–21), Belastung im TSS-Maßstab (1 h an der Schwelle ≈ 100).`,
  data() {
    const d = FC.state.data;
    const pick = (p) => ({ tag: p.day, erholung: p.recovery, hrv: p.hrv, ruhepuls: p.rhr, schlafH: p.sleepH, schlafLeistung: p.sleepPerf, strain: p.strain, belastung: p.load, fitness: p.ctl, ermuedung: p.atl, form: p.tsb, trainingMin: p.trainingMin });
    const from = d.days.at(-15)?.day ?? d.range.from;
    return JSON.stringify({
      heute: d.today,
      empfehlungRegelbasiert: { bereitschaft: d.coach.readiness, score: d.coach.score, ueberschrift: d.coach.headline, vorschlag: d.coach.suggestion, ruhetagAusfahren: d.coach.restRide ?? null, zielBelastung: d.coach.targetLoad, gruende: d.coach.reasons.map((r) => r.text), warnungen: d.coach.warnings },
      trends: d.trends,
      einstellungen: { ftpW: d.settings.ftpW, maxPuls: d.settings.maxHr, ruhepuls: d.settings.restingHr, schwellenpuls: d.settings.thresholdHr, schlafbedarfH: d.settings.sleepNeedH },
      letzte21Tage: d.days.slice(-21).map(pick),
      wochen: d.weeks.slice(-6),
      workoutsLetzte14Tage: d.workouts.filter((w) => w.day > from).map((w) => ({ tag: w.day, sport: FC.sport(w.sport), min: w.durationMin, pulsAvg: w.avgHr, pulsMax: w.maxHr, np: w.normalizedPowerW, strain: w.strain, belastung: w.load })),
      ...(FC.state.coachExtras ? FC.state.coachExtras() : {}),
    });
  },
  async run(kind) {
    const { $, el, de, fmtDayLong, richText, sampleErrText, state } = FC;
    if (!state.sample || !state.data) return;
    const out = $("coachOut"); out.classList.remove("muted"); out.textContent = "Denke nach …";
    this.ctl = new AbortController(); this.busy(true);
    const data = this.data();
    try {
      if (kind === "plan") {
        const plan = await state.sample.json(`${this.rules}

Aufgabe: Schlage einen Trainingsplan für die nächsten 7 Tage ab ${state.data.today} vor. Berücksichtige Erholung, HRV-Trend, Form und die bisherigen Sportarten (Rad/Spinning, Krafttraining). Keine harte Beinkraft direkt vor harten Radintervallen. Plane mindestens einen Ruhetag oder sehr lockeren Tag. Die ersten Tage richten sich nach der heutigen Bereitschaft, spätere sind vorläufig.
Antworte nur mit JSON: {"hinweis": string (1–2 Sätze), "tage": [{"tag": "YYYY-MM-DD", "einheit": string, "dauerMin": number, "intensitaet": "Ruhe"|"locker"|"mittel"|"hart", "belastung": number (geschätzt, TSS-Maßstab), "ziel": string (kurz)}]}

Daten:
${data}`, { signal: this.ctl.signal, cache: { gcTime: 3_600_000 } });
        out.replaceChildren();
        if (plan?.hinweis) out.append(el("p", { text: String(plan.hinweis) }));
        const t = el("table", { class: "plan" }, el("thead", {}, el("tr", {}, ...["Tag", "Einheit", "Dauer", "Intensität", "Belastung", "Ziel"].map((h, i) => el("th", { class: [1, 3, 5].includes(i) ? "l" : "", text: h })))));
        const tb = el("tbody"); t.append(tb);
        for (const r of Array.isArray(plan?.tage) ? plan.tage : []) tb.append(el("tr", {},
          el("td", { class: "l", text: /^\d{4}-\d{2}-\d{2}$/.test(String(r.tag)) ? fmtDayLong(String(r.tag)) : String(r.tag ?? "") }), el("td", { class: "l", text: String(r.einheit ?? "") }),
          el("td", { text: r.dauerMin ? `${de(Number(r.dauerMin))} min` : "–" }), el("td", { class: "l", text: String(r.intensitaet ?? "") }),
          el("td", { text: r.belastung != null ? `~${de(Number(r.belastung))}` : "–" }), el("td", { class: "l", text: String(r.ziel ?? "") })));
        out.append(el("div", { class: "tablewrap" }, t), el("p", { class: "muted", text: "Vorschlag von Claude auf Basis deiner Daten; Belastung geschätzt. Trainingsempfehlung, keine Diagnose." }));
        FC.state.lastPlan = plan;
      } else {
        // Der Wochenrückblick hat einen eigenen Abschnitt (review.js).
        const task = "Aufgabe: Erkläre die heutige regelbasierte Empfehlung in eigenen Worten: Was bedeutet sie konkret für das Training heute (Art, Dauer, Intensität, Pulsbereich wenn möglich; Rad oder Kraft), und welche 2–3 Daten sind ausschlaggebend? Wenn etwas auffällt (Schlafschuld, HRV-Trend, schneller Lastanstieg), gib einen Tipp.";
        const { truncated } = await state.sample(`${this.rules}\n\n${task}\n\nDaten:\n${data}`, { signal: this.ctl.signal, cache: { gcTime: 3_600_000 }, onText: ({ text }) => richText(out, text) });
        if (truncated) out.append(el("p", { class: "muted", text: "Antwort wurde gekürzt." }));
      }
    } catch (e) {
      if (e?.code === "cancelled") { if (!e.text) out.textContent = "Abgebrochen."; }
      else { if (e?.text) richText(out, e.text); else out.textContent = ""; out.append(el("p", { class: "muted", text: sampleErrText(e) })); if (["not_granted", "sampling_disabled"].includes(e?.code)) this.root.hidden = true; }
    } finally { this.busy(false); }
  },
  async canUseTools() {
    if (this.toolsOk === undefined) { try { this.toolsOk = !!(await FC.state.sample.limits?.())?.tools; } catch { this.toolsOk = false; } }
    return this.toolsOk;
  },
  /** Lesende Werkzeuge für den Chat: rufen Connector-Werkzeuge auf, Ergebnis gekürzt (max. 32 KB je Aufruf). */
  tools(out) {
    const { el } = FC;
    const clamp = (n, lo, hi, d) => { const x = Math.round(Number(n)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
    const cut = (v) => { const t = JSON.stringify(v); return t.length > 24_000 ? `${t.slice(0, 24_000)} … (gekürzt)` : t; };
    const note = (label) => { const p = el("p", { class: "muted coach-tool", text: `Hole ${label} …` }); out.before(p); return p; };
    const via = (name, label, description, inputSchema, tool, args) => ({ name, description, inputSchema,
      async execute(input, ctx) {
        const p = note(label);
        try { const r = await FC.state.mcp.callTool(FC.SERVER, tool, args(input), { cache: { staleTime: 300_000, gcTime: 3_600_000 }, signal: ctx.signal }); p.textContent = `${label} geholt.`; return cut(r.payload); }
        catch (e) { p.textContent = `${label} nicht verfügbar.`; throw new Error(FC.errText(e)); }
      } });
    const days = (def, max) => ({ type: "object", properties: { tage: { type: "integer", description: `Zeitraum in Tagen (Standard ${def}, höchstens ${max})` } } });
    const week = { type: "object", properties: { woche: { type: "string", description: "current, previous, next oder ein Datum JJJJ-MM-TT in der Woche" } } };
    const wk = (i) => (/^(current|previous|next|\d{4}-\d{2}-\d{2})$/.test(String(i.woche ?? "")) ? { week: String(i.woche) } : {});
    return [
      via("schlafbericht", "Schlafbericht", "Schlaf je Nacht (Dauer, Phasen, Leistung, Zeiten), Schlafschuld, Rhythmus und Nickerchen.", days(30, 365), "get_sleep_report", (i) => ({ days: clamp(i.tage, 7, 365, 30) })),
      via("krafttraining", "Krafttraining", "Krafteinheiten mit Sätzen, Volumen je Muskel und Woche, geschätztes 1RM und Fortschritt je Übung.", { type: "object", properties: { wochen: { type: "integer", description: "Zeitraum in Wochen (Standard 8, höchstens 52)" } } }, "get_strength", (i) => ({ weeks: clamp(i.wochen, 1, 52, 8) })),
      via("erholungsfaktoren", "Einflussfaktoren", "Was mit besserer oder schlechterer Erholung/HRV zusammenhängt (Schlaf, Vortagsbelastung, späte Workouts, Wochentag, Tagebuch).", days(90, 365), "get_recovery_factors", (i) => ({ days: clamp(i.tage, 30, 365, 90) })),
      via("bestleistungen", "Bestleistungen", "Neue Bestwerte (Watt-Dauern, 1RM, Strecke) und Woche gegen Vorwoche.", days(30, 365), "get_records", (i) => ({ days: clamp(i.tage, 7, 365, 30) })),
      via("wochenplan", "Wochenplan", "Geplante Einheiten einer Woche mit Phase und Soll/Ist-Abgleich.", week, "get_plan", wk),
      via("wochenrueckblick", "Wochenrückblick", "Kennzahlen einer Woche: Umfang, Belastung, Erholung, Schlaf, Highlights, Soll/Ist.", week, "get_week_review", wk),
      via("zeitraeume", "Monate/Jahre", "Summen je Woche, Monat oder Jahr: Trainingsstunden nach Sport, Belastung, Fitness, Erholung, Schlaf.", { type: "object", properties: { zeitraum: { type: "string", enum: ["week", "month", "year"] }, tage: { type: "integer", description: "Rückblick in Tagen (höchstens 730)" } } }, "get_period_summaries", (i) => ({ period: ["week", "month", "year"].includes(i.zeitraum) ? i.zeitraum : "month", days: clamp(i.tage, 28, 730, 365) })),
      via("leistungsprofil", "Leistungsprofil", "Leistungskurve (Bestwerte je Dauer), FTP-Schätzung, Leistungs- und Pulszonen.", days(42, 730), "get_fitness_profile", (i) => ({ days: clamp(i.tage, 7, 730, 42) })),
      via("koerperwerte", "Körperwerte", "Gewichtsverlauf mit 7-Tage-Mittel, Trend, BMI, W/kg und Gewichtsziel.", days(180, 730), "get_body_history", (i) => ({ days: clamp(i.tage, 7, 730, 180) })),
      // Analysen (#185): erst „befunde“ für den Überblick, dann gezielt das passende Werkzeug.
      via("befunde", "Wichtigste Befunde", "Die auffälligsten Befunde aller Analysen in wenigen Sätzen (Auffälliges zuerst), je mit dem Werkzeug für Details. Guter Einstieg.", undefined, "get_analysis_highlights", () => ({ limit: 8 })),
      via("hrv_trend", "HRV-Trend", "HRV im 7-Tage-Schnitt gegen den Normalbereich, Muster (z. B. Ermüdung) und Rat.", days(90, 365), "get_hrv_trend", (i) => ({ days: clamp(i.tage, 28, 365, 90) })),
      via("erholung_morgen", "Erholungs-Prognose", "Geschätzte Erholung für morgen mit Spanne, Szenarien (mehr Schlaf, Extra-Training) und Treffsicherheit.", undefined, "get_recovery_forecast", () => ({})),
      via("trainingslast", "Trainingslast", "Fitness, Ermüdung und Form (CTL/ATL/TSB) im Verlauf, Lastanstieg je Woche.", days(90, 365), "get_training_load", (i) => ({ days: clamp(i.tage, 28, 365, 90) })),
      via("muskelbalance", "Muskelbalance", "Sätze je Muskelgruppe gegen den Zielbereich, Ziehen/Drücken, Beinbeuger/Beinstrecker, Übungsvorschläge.", { type: "object", properties: { wochen: { type: "integer", description: "Zeitraum in Wochen (Standard 4, höchstens 12)" } } }, "get_muscle_balance", (i) => ({ weeks: clamp(i.wochen, 1, 12, 4) })),
      via("aerobe_basis", "Aerobe Basis", "Puls-Leistungs-Entkopplung lockerer Fahrten im Verlauf.", days(120, 365), "get_aerobic_decoupling", (i) => ({ days: clamp(i.tage, 28, 365, 120) })),
      via("intervalle", "Intervall-Qualität", "Leistungsabfall innerhalb von Intervall-Serien je Einheit und Intervallart.", days(90, 365), "get_interval_quality", (i) => ({ days: clamp(i.tage, 14, 365, 90) })),
      via("ermuedungsresistenz", "Ermüdungsresistenz", "Leistung nach 500, 1000 und 1500 kJ Arbeit im Vergleich zu frisch.", days(90, 365), "get_durability", (i) => ({ days: clamp(i.tage, 14, 365, 90) })),
      via("trittfrequenz", "Trittfrequenz", "Kadenz je Leistungszone und im Verlauf.", days(90, 365), "get_cadence_profile", (i) => ({ days: clamp(i.tage, 14, 365, 90) })),
      via("fahrertyp", "Fahrertyp", "Stärken und Schwächen der Leistungskurve relativ zur FTP, Trainingsschwerpunkt.", days(90, 365), "get_rider_profile", (i) => ({ days: clamp(i.tage, 28, 365, 90) })),
      via("ausdauerprofil", "Ausdauer-Profil", "Critical Power, W′, haltbare Wattzahlen und Effizienz-Faktor lockerer Fahrten.", undefined, "get_endurance_profile", () => ({})),
      via("trainingszeit", "Trainingszeit", "Tageszeit des Trainings gegen Schlaf, Erholung und Leistung.", days(120, 365), "get_training_timing", (i) => ({ days: clamp(i.tage, 28, 365, 120) })),
      via("erholungskurve", "Erholungskurve", "Erholung, HRV und Ruhepuls an harten Tagen und den 4 Tagen danach, Tag der Rückkehr zum Normalwert.", days(180, 365), "get_recovery_curve", (i) => ({ days: clamp(i.tage, 60, 365, 180) })),
      via("kraft_und_rad", "Kraft und Rad", "Wie Beineinheiten Erholung und Radleistung der Folgetage beeinflussen, empfohlener Abstand.", days(180, 365), "get_strength_cycling_interference", (i) => ({ days: clamp(i.tage, 28, 365, 180) })),
      via("radwetter", "Radwetter", "Wetter für heute und morgen am eingestellten Ort mit bestem Zeitfenster und Empfehlung draußen oder Rolle.", undefined, "get_ride_weather", () => ({})),
      { name: "workouts", description: "Workouts eines Zeitraums aus den geladenen Daten (Sport, Dauer, Puls, Leistung, Belastung, Strain, RPE).",
        inputSchema: { type: "object", properties: { von: { type: "string", description: "JJJJ-MM-TT" }, bis: { type: "string", description: "JJJJ-MM-TT" } } },
        execute(i) {
          const d = FC.state.data, from = /^\d{4}-\d{2}-\d{2}$/.test(String(i.von)) ? String(i.von) : d.range.from, to = /^\d{4}-\d{2}-\d{2}$/.test(String(i.bis)) ? String(i.bis) : d.today;
          const list = d.workouts.filter((w) => w.day >= from && w.day <= to).slice(0, 120);
          return cut({ von: from, bis: to, geladenAb: d.range.from, workouts: list.map((w) => ({ tag: w.day, sport: FC.sport(w.sport), min: w.durationMin, km: w.distanceKm, pulsAvg: w.avgHr, wattAvg: w.avgPowerW, np: w.normalizedPowerW, belastung: w.load, strain: w.strain, rpe: w.rpe, zonenMin: w.hrZoneMin })) });
        } },
    ].map((t) => (t.inputSchema ? t : (({ inputSchema, ...rest }) => rest)(t)));
  },
  async ask() {
    const { $, el, richText, sampleErrText, state } = FC;
    const q = $("askInput").value.trim(); if (!q || !state.sample || !state.data) return;
    $("askInput").value = "";
    const chat = $("chat");
    chat.append(el("div", { class: "q", text: q }));
    const a = el("div", { class: "a coach-out", text: "Denke nach …" }); chat.append(a);
    this.chat.push({ role: "user", content: q });
    this.ctl = new AbortController(); this.busy(true);
    try {
      // Mit Werkzeugen holt sich Claude zur Frage passende Daten selbst (#100); ohne bleibt es bei der Übersicht.
      const tools = (await this.canUseTools()) ? this.tools(a) : null;
      const hint = tools ? "\nWenn die Übersicht für die Frage nicht reicht, hol dir mit den Werkzeugen gezielt mehr Daten (sparsam, höchstens drei Abrufe; für Analysen zuerst „befunde“). Nenne kurz, worauf sich die Antwort stützt." : "";
      // Verlauf beginnt immer mit einer Frage; Regeln und Daten stehen in dieser ersten Nachricht (nie zwei Nutzer-Nachrichten hintereinander).
      const msgs = this.chat.slice(-9).map((m) => ({ ...m }));
      msgs[0].content = `${this.rules}\n\nBeantworte die Fragen der Person zu ihren Daten.${hint}\n\nDaten (Übersicht):\n${this.data()}\n\nFrage: ${msgs[0].content}`;
      const { text } = await state.sample(msgs,
        { cache: false, signal: this.ctl.signal, onText: ({ text }) => richText(a, text), ...(tools ? { tools } : {}) });
      this.chat.push({ role: "assistant", content: text });
      this.saveChat(); $("chatClear").hidden = false;
    } catch (err) {
      this.chat.pop();
      if (err?.text) richText(a, err.text); else a.textContent = "";
      if (err?.code !== "cancelled") a.append(el("p", { class: "muted", text: sampleErrText(err) }));
    } finally { this.busy(false); }
  },
});
