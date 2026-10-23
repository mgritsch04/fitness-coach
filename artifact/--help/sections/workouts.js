// Workout-Liste. Andere Abschnitte können eine Detailansicht über FC.state.openWorkout(w) anbieten.
// Anstrengung (RPE 1–10) je Workout eintragen (#134); FC.state.rpePicker(w) nutzt auch „Heute dran“.
const WO_KEY = "fc-wo-filter", PAGE = 25;
const kindOf = (sp) => {
  const s = (sp ?? "").toLowerCase();
  if (/cycl|spin|bike|ride|rad/.test(s)) return "bike";
  if (/weight|strength|bodybuild|powerlift|functional|crossfit|kraft|gym/.test(s)) return "strength";
  return "other";
};
FC.section({
  id: "workouts",
  tab: "training",
  order: 60,
  mount(root) {
    root.innerHTML = `
      <h2 id="h-workouts">Workouts</h2>
      <div class="panel tablewrap">
        <div class="wo-filter" role="search">
          <div class="seg" id="woKind" role="group" aria-label="Sportart">
            <button type="button" data-k="all">Alle</button><button type="button" data-k="bike">Rad</button><button type="button" data-k="strength">Kraft</button><button type="button" data-k="other">Andere</button>
          </div>
          <select id="woSource" aria-label="Quelle"><option value="">Alle Quellen</option></select>
          <input type="search" id="woSearch" placeholder="Suchen, z. B. Spinning oder Mai" aria-label="Workouts durchsuchen" autocomplete="off">
        </div>
        <p class="muted fine" id="woCount" role="status"></p>
        <table id="tWorkouts" class="cards"><thead><tr>
        <th class="l">Tag</th><th class="l">Sport</th><th>Dauer</th><th>Ø Puls</th><th>Max</th><th>Leistung</th><th>Strain</th><th>Belastung</th><th>Anstrengung</th><th class="l">Quelle</th>
      </tr></thead><tbody><tr><td colspan="10" class="empty">Noch keine Daten.</td></tr></tbody></table>
      <div class="row" style="margin-top:10px"><button type="button" id="btnMoreWorkouts" hidden>Mehr laden</button><button type="button" id="btnResetWorkouts" class="link" hidden>Filter zurücksetzen</button></div></div>`;
    // Filter (#220) bleiben im Browser gemerkt; die Liste zeigt 25 und lädt in 25er-Schritten nach.
    this.f = { kind: "all", source: "", q: "" };
    try { Object.assign(this.f, JSON.parse(localStorage.getItem(WO_KEY) ?? "{}")); } catch {}
    this.shown = PAGE;
    const changed = () => { this.shown = PAGE; try { localStorage.setItem(WO_KEY, JSON.stringify(this.f)); } catch {} if (FC.state.data) this.render(FC.state.data); };
    for (const b of root.querySelectorAll("#woKind button")) b.onclick = () => { this.f.kind = b.dataset.k; changed(); };
    FC.$("woSource").onchange = (e) => { this.f.source = e.target.value; changed(); };
    FC.$("woSearch").value = this.f.q;
    FC.$("woSearch").oninput = (e) => { this.f.q = e.target.value; changed(); };
    FC.$("btnMoreWorkouts").onclick = () => { this.shown += PAGE; this.render(FC.state.data); };
    FC.$("btnResetWorkouts").onclick = () => { this.f = { kind: "all", source: "", q: "" }; FC.$("woSearch").value = ""; changed(); };
    FC.state.rpePicker = (w, done) => this.picker(w, done);
  },
  /** Knöpfe 1–10; speichert sofort (save_workout_rpe) und lädt das Dashboard neu. */
  picker(w, done) {
    const { el } = FC;
    const msg = el("span", { class: "muted", role: "status" });
    const box = el("div", { class: "rpe-pick", role: "group", "aria-label": "Anstrengung 1 bis 10" }, ...Array.from({ length: 10 }, (_, k) => {
      const b = el("button", { type: "button", text: String(k + 1), "aria-pressed": String(w.rpe === k + 1), title: ["sehr leicht", "leicht", "moderat", "etwas schwer", "schwer", "schwer", "sehr schwer", "sehr schwer", "extrem", "maximal"][k] });
      b.onclick = async () => {
        for (const c of box.querySelectorAll("button")) c.disabled = true;
        msg.textContent = "Speichere …";
        try {
          await FC.call("save_workout_rpe", { source: w.source ?? w.sources[0], sourceId: w.sourceId, rpe: k + 1 });
          msg.textContent = `Gespeichert: ${k + 1}.`; done?.(k + 1);
          FC.reload();
        } catch (err) { msg.textContent = FC.errText(err); for (const c of box.querySelectorAll("button")) c.disabled = false; }
      };
      return b;
    }), msg);
    return box;
  },
  /** Übungen der Krafteinheit holen (get_strength reicht bis 52 Wochen zurück) und das Vorlagen-Formular zeigen. */
  async openTpl(w, id, tr, cell) {
    const { el } = FC;
    const today = FC.state.data?.today ?? w.day;
    const weeks = Math.min(52, Math.max(1, Math.ceil((Date.parse(today) - Date.parse(w.day)) / 604_800_000) + 1));
    const close = () => { tr.remove(); if (this.tplRow === tr) this.tplId = this.tplRow = null; if (FC.state.data) this.render(FC.state.data); };
    try {
      const st = await FC.call("get_strength", { weeks }, { cache: { staleTime: 60_000, gcTime: 86_400_000 } });
      if (this.tplRow !== tr) return;
      const session = st.sessions.find((s) => s.id === id);
      cell.replaceChildren(session?.sets?.length ? FC.state.tplForm(session, close) : el("span", { class: "muted", text: "Zu diesem Training sind keine Übungen gespeichert (oder es ist älter als ein Jahr)." }));
      cell.querySelector("input")?.focus();
    } catch (err) { if (this.tplRow === tr) cell.replaceChildren(el("span", { class: "muted", text: FC.errText(err) })); }
  },
  render(d) {
    const { $, el, de, fmtDayLong, sport, SOURCES, state } = FC;
    const from = d.days.at(-state.range)?.day ?? d.range.from;
    const tb = $("tWorkouts").tBodies[0]; tb.replaceChildren();
    const inRange = d.workouts.filter((w) => w.day >= from), f = this.f;
    // Quellen-Auswahl aus den vorhandenen Daten; eine gemerkte Quelle bleibt wählbar.
    const srcs = [...new Set(inRange.flatMap((w) => w.sources).concat(f.source ? [f.source] : []))].sort();
    const sel = $("woSource");
    sel.replaceChildren(el("option", { value: "", text: "Alle Quellen" }), ...srcs.map((s) => el("option", { value: s, text: SOURCES[s] ?? s })));
    sel.value = f.source; sel.hidden = srcs.length < 2 && !f.source;
    for (const b of $("woKind").querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.k === f.kind));
    const words = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const ws = inRange.filter((w) => (f.kind === "all" || kindOf(w.sport) === f.kind) && (!f.source || w.sources.includes(f.source)) &&
      (!words.length || words.every((q) => [sport(w.sport), w.sport ?? "", fmtDayLong(w.day), w.day, ...w.sources.map((s) => SOURCES[s] ?? s)].join(" ").toLowerCase().includes(q))));
    const filtered = f.kind !== "all" || !!f.source || words.length > 0;
    $("woCount").textContent = filtered ? `${ws.length} von ${inRange.length} Workouts im Zeitraum` : `${inRange.length} Workouts im Zeitraum`;
    $("btnResetWorkouts").hidden = !filtered;
    const more = $("btnMoreWorkouts"), rest = ws.length - this.shown;
    more.hidden = rest <= 0; more.textContent = `${Math.min(PAGE, rest)} weitere laden`;
    if (!ws.length) tb.append(el("tr", {}, el("td", { colspan: 10, class: "empty", text: filtered ? "Keine Workouts passen zum Filter." : "Keine Workouts im Zeitraum." })));
    for (const w of ws.slice(0, this.shown)) {
      const name = state.openWorkout ? el("button", { type: "button", class: "link", text: sport(w.sport) }) : document.createTextNode(sport(w.sport));
      if (state.openWorkout) name.onclick = () => state.openWorkout(w);
      // Vorlage aus jedem Krafttraining mit eingetragenen Übungen (#331).
      const tplBtn = w.strengthSessionId && state.tplForm ? el("button", { type: "button", class: "link wo-tpl", text: "Als Vorlage speichern", "aria-expanded": String(this.tplId === w.strengthSessionId), "aria-label": `${sport(w.sport)} am ${fmtDayLong(w.day)} als Vorlage speichern` }) : null;
      const rpe = el("button", { type: "button", class: "link", text: w.rpe ? `${w.rpe}${w.sessionRpe ? ` (${de(w.sessionRpe)})` : ""}` : "eintragen", "aria-label": `Anstrengung für ${sport(w.sport)} am ${fmtDayLong(w.day)}${w.rpe ? `: ${w.rpe}` : " eintragen"}` });
      const row = el("tr", {},
        el("td", { class: "l", text: fmtDayLong(w.day) }), el("td", { class: "l" }, name, tplBtn ? el("br") : "", tplBtn ?? ""), el("td", { "data-k": "Dauer", text: `${de(w.durationMin)} min` }), el("td", { "data-k": "Ø Puls", text: de(w.avgHr) }), el("td", { "data-k": "Max", text: de(w.maxHr) }),
        el("td", { "data-k": "Leistung", text: w.normalizedPowerW ? `${de(w.normalizedPowerW)} W NP` : w.avgPowerW ? `${de(w.avgPowerW)} W` : "–" }), el("td", { "data-k": "Strain", text: de(w.strain, 1) }),
        el("td", { "data-k": "Belastung" }, w.load == null ? "–" : de(w.load), " ", el("span", { class: `badge ${w.loadMethod === "power" ? "pw" : ""}`, text: w.loadMethod === "power" ? "Leistung" : w.loadMethod === "hr" ? "Puls" : "–" })),
        el("td", { "data-k": "Anstrengung" }, rpe),
        el("td", { class: "l", "data-k": "Quelle", text: w.sources.map((s) => SOURCES[s] ?? s).join(" + ") }));
      tb.append(row);
      // Offene Auswahl überlebt ein Neuzeichnen (z. B. wenn neue Daten kommen).
      const key = `${w.source ?? w.sources[0]}:${w.sourceId}`;
      const openPick = () => row.after(el("tr", { class: "rpe-row" }, el("td", { colspan: 10, class: "l" }, el("span", { class: "muted", text: "Wie anstrengend war es? 1 sehr leicht, 10 maximal. " }), this.picker(w, () => { this.openKey = null; }))));
      if (this.openKey === key) openPick();
      if (tplBtn) {
        const id = w.strengthSessionId;
        if (this.tplId === id && this.tplRow) row.after(this.tplRow);
        tplBtn.onclick = () => {
          if (this.tplId === id) { this.tplRow?.remove(); this.tplId = this.tplRow = null; tplBtn.setAttribute("aria-expanded", "false"); return; }
          this.tplRow?.remove();
          this.tplId = id; tplBtn.setAttribute("aria-expanded", "true");
          const cell = el("td", { colspan: 10, class: "l" }, el("span", { class: "muted", role: "status", text: "Lädt die Übungen …" }));
          const tr = this.tplRow = el("tr", { class: "wo-tplrow" }, cell);
          row.after(tr);
          this.openTpl(w, id, tr, cell);
        };
      }
      rpe.onclick = () => {
        if (row.nextElementSibling?.classList.contains("rpe-row")) { row.nextElementSibling.remove(); this.openKey = null; return; }
        this.openKey = key; openPick();
      };
    }
  },
});
