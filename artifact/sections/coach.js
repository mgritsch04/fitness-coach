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
        <form class="ask" id="askForm" autocomplete="off">
          <input id="askInput" type="text" placeholder="z. B. Warum ist meine HRV diese Woche niedriger?" aria-label="Frage an den Coach">
          <button type="submit" id="askBtn" disabled>Fragen</button>
        </form>
      </div>`;
    const { $, el } = FC;
    this.root = root;
    this.chat = [];
    root.querySelectorAll("[data-coach]").forEach((b) => b.addEventListener("click", () => this.run(b.dataset.coach)));
    $("coachStop").onclick = () => this.ctl?.abort();
    $("askForm").addEventListener("submit", (e) => { e.preventDefault(); this.ask(); });
    void el;
  },
  ready() { if (!FC.state.sample) this.root.hidden = true; },
  render() { this.busy(false); },
  rerender() {},
  busy(on) {
    const ok = !!FC.state.data && !!FC.state.sample;
    this.root.querySelectorAll("[data-coach], #askBtn").forEach((b) => (b.disabled = on || !ok));
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
      empfehlungRegelbasiert: { bereitschaft: d.coach.readiness, score: d.coach.score, ueberschrift: d.coach.headline, vorschlag: d.coach.suggestion, zielBelastung: d.coach.targetLoad, gruende: d.coach.reasons.map((r) => r.text), warnungen: d.coach.warnings },
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
      const { text } = await state.sample([{ role: "user", content: `${this.rules}\n\nBeantworte die folgenden Fragen der Person zu ihren Daten.\n\nDaten:\n${this.data()}` }, ...this.chat.slice(-10)], { cache: false, signal: this.ctl.signal, onText: ({ text }) => richText(a, text) });
      this.chat.push({ role: "assistant", content: text });
    } catch (err) {
      this.chat.pop();
      if (err?.text) richText(a, err.text); else a.textContent = "";
      if (err?.code !== "cancelled") a.append(el("p", { class: "muted", text: sampleErrText(err) }));
    } finally { this.busy(false); }
  },
});
