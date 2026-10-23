// Dashboard anpassen (#67): Bereiche je Tab ein-/ausblenden und sortieren, für alle Geräte oder nur dieses Gerät;
// dazu „Reiter am PC“ (#322).
FC.section({
  id: "layout",
  tab: "mehr",
  order: 95,
  locked: true,
  title: "Dashboard anpassen",
  css: `
    .lo-tab { margin-top: 12px; }
    .lo-tab h4 { margin: 0 0 4px; font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
    .lo-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--grid); }
    .lo-row.off span { color: var(--ink-3); text-decoration: line-through; }
    .lo-row button { padding: 4px 10px; min-width: 36px; }
    .lo-sug { border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; margin: 8px 0; }
    .lo-sug p { margin: 4px 0; }
    .lo-opts { display: grid; gap: 8px; margin-bottom: 8px; }
    .lo-opts fieldset { border: 0; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; }
    .lo-opts legend { font-weight: 600; margin-bottom: 4px; padding: 0; }
    .lo-opts label { display: inline-flex; gap: 6px; align-items: center; }`,
  // Namen für Bereiche, die ausgeblendet und darum nicht aufgebaut sind (sonst zählt die Überschrift).
  NAMES: { focus: "Heute in 10 Sekunden", warning: "Frühwarnung", briefing: "Morgen-Briefing", highlights: "Auf einen Blick", recoverycurve: "Erholung nach harten Tagen", today: "Heute", journal: "Check-in", coach: "Coach", plan: "Wochenplan und Ziele", recovery: "Erholung und Schlaf", sleep: "Schlaf im Detail",
    insights: "Was beeinflusst deine Erholung?", health: "Körpersignale", strain: "Belastung und Erholung", load: "Trainingslast", fit: "Rolle und Leistung",
    hrzones: "Pulszonen", strength: "Krafttraining", weeks: "Wochen", periods: "Monate und Jahre", year: "Jahr im Überblick", workouts: "Workouts",
    settings: "Einstellungen", sources: "Datenquellen", body: "Gewicht", export: "Daten exportieren", bikewo: "Workout für MyWhoosh", records: "Bestleistungen", review: "Wochenrückblick", weather: "Radwetter", ftp: "FTP-Test", endurance: "Ausdauer-Profil", gym: "Gym-Modus", forecast: "Erholung morgen (Prognose)", agenda: "Heute dran", interference: "Kraft und Rad im Wechselspiel", hrvtrend: "HRV-Trend", timing: "Beste Trainingszeit", durability: "Ermüdungsresistenz", whatsnew: "Neu im Dashboard", aerobic: "Aerobe Basis", intervals: "Intervall-Qualität", cadence: "Trittfrequenz", riderprofile: "Fahrertyp", musclebalance: "Muskelbalance", readiness: "Training nach der Erholungsampel", comeback: "Wiedereinstieg", eftp: "FTP-Schätzung im Verlauf", sleeptarget: "Schlafziel heute Nacht", block: "Trainingsblock", indooroutdoor: "Rolle gegen Straße", mobility: "Mobility nach der Einheit", consistency: "Konstanz und Serien", favorites: "Deine Favoriten" },
  TABS: [["heute", "Heute"], ["coach", "Coach"], ["verlauf", "Verlauf"], ["training", "Training"], ["mehr", "Mehr"]],
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-layout">Dashboard anpassen</h2><span class="muted" id="loScope"></span></div>
      <div class="panel">
        <div class="lo-opts">
          <fieldset><legend>Anordnung gilt</legend>
            <label><input type="radio" name="loMode" value="all" id="loAll"> für alle Geräte</label>
            <label><input type="radio" name="loMode" value="device" id="loDevice"> nur für dieses Gerät</label>
            <button type="button" id="loUpload" hidden>Diese Anordnung für alle Geräte speichern</button>
          </fieldset>
          <label for="loDesk"><input type="checkbox" id="loDesk"> Am PC Reiter statt einer langen Seite</label>
          <span class="muted" id="loState" role="status"></span>
        </div>
        <div class="lo-sug" id="loSug"></div>
        <div id="loList"></div>
        <div class="row" style="margin-top:12px"><button type="button" id="loReset">Standard wiederherstellen</button><span class="muted" id="loNote"></span></div></div>`;
    FC.$("loReset").onclick = () => { FC.layout.reset(); FC.$("loNote").textContent = "Standard gespeichert. Seite neu laden, um alles wie anfangs zu sehen."; this.draw(); };
    for (const id of ["loAll", "loDevice"]) FC.$(id).onchange = (e) => { FC.layout.setMode(e.target.value); this.draw(); };
    FC.$("loUpload").onclick = () => { FC.layout.setMode("all", true); this.draw(); };
    FC.$("loDesk").onchange = (e) => FC.layout.setDeskTabs(e.target.checked);
  },
  ready() { this.draw(); FC.layout.onChange(() => this.draw()); FC.usage.onChange(() => this.sug()); },
  /** Vorschlag (#372): Abschnitte, die seit Beginn der lokalen Zählung nie geöffnet wurden, ausblenden. */
  sug() {
    const { $, el } = FC, u = FC.usage, s = u.suggest(), box = $("loSug"); if (!box) return;
    const title = (id) => { const t = FC.layout.list().find((x) => x.id === id)?.title; return !t || t === id ? this.NAMES[id] ?? id : t; };
    const hidden = FC.layout.list().filter((x) => x.hidden).length;
    const kids = [el("p", {}, el("strong", { text: "Ungenutztes ausblenden" }))];
    if (!s.ready) kids.push(el("p", { class: "muted", id: "loSugState", text: `Ich zähle noch, welche Abschnitte du öffnest (nur in diesem Browser). Vorschlag nach ${s.needDays} Tagen und ${s.needViews} Aufrufen; bisher ${s.days} Tage, ${s.total} Aufrufe.` }));
    else if (!s.ids.length) kids.push(el("p", { class: "muted", id: "loSugState", text: `Seit ${new Date(u.since()).toLocaleDateString("de-DE")} hast du alle sichtbaren Abschnitte geöffnet. Nichts vorzuschlagen.` }));
    else {
      const ok = el("button", { type: "button", class: "primary", id: "loSugApply", text: `${s.ids.length} Abschnitte ausblenden` });
      ok.onclick = () => { FC.layout.hideMany(s.ids); this.draw(); };
      kids.push(el("p", { id: "loSugState", text: `Seit ${new Date(u.since()).toLocaleDateString("de-DE")} nie geöffnet (${s.days} Tage, ${s.total} Aufrufe): ${s.ids.map(title).join(", ")}.` }), ok);
    }
    if (hidden) {
      const back = el("button", { type: "button", id: "loShowAll", text: `Alle ${hidden} ausgeblendeten wieder einblenden` });
      back.onclick = () => { FC.layout.showAll(); this.draw(); };
      kids.push(el("p", {}, back));
    }
    box.replaceChildren(...kids);
  },
  opts() {
    const { $ } = FC, mode = FC.layout.mode(), st = FC.layout.status();
    $("loAll").checked = mode === "all"; $("loDevice").checked = mode === "device";
    $("loUpload").hidden = mode !== "device";
    $("loDesk").checked = FC.layout.deskTabs();
    $("loScope").textContent = mode === "all" ? "gilt auf allen Geräten" : "gilt nur auf diesem Gerät";
    $("loState").textContent = mode !== "all" ? "Änderungen bleiben in diesem Browser." : st === "saving" ? "Speichere für alle Geräte …" : st === "saved" ? "Für alle Geräte gespeichert." : st === "error" ? "Nicht gespeichert, gilt vorerst nur hier." : "";
  },
  draw() {
    this.opts(); this.sug();
    const { $, el } = FC, list = FC.layout.list().filter((x) => x.id !== "layout").map((x) => ({ ...x, title: x.title === x.id ? this.NAMES[x.id] ?? x.id : x.title }));
    $("loList").replaceChildren(...this.TABS.map(([id, label]) => {
      const items = list.filter((x) => x.tab === id);
      if (!items.length) return null;
      return el("div", { class: "lo-tab" }, el("h4", { text: label }), ...items.map((x, i) => {
        const cb = el("input", { type: "checkbox", "aria-label": `${x.title} anzeigen` }); cb.checked = !x.hidden; cb.disabled = x.locked;
        cb.onchange = () => { FC.layout.setHidden(x.id, !cb.checked); this.draw(); };
        const up = el("button", { type: "button", text: "↑", "aria-label": `${x.title} nach oben` }); up.disabled = i === 0;
        const down = el("button", { type: "button", text: "↓", "aria-label": `${x.title} nach unten` }); down.disabled = i === items.length - 1;
        up.onclick = () => { FC.layout.move(x.id, -1); this.draw(); };
        down.onclick = () => { FC.layout.move(x.id, 1); this.draw(); };
        return el("div", { class: `lo-row${x.hidden ? " off" : ""}` }, cb, el("span", { text: x.title }), up, down);
      }));
    }).filter(Boolean));
  },
  render() {},
});
