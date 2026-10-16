// Dashboard anpassen (#67): Bereiche je Tab ein-/ausblenden und sortieren. Gilt nur in diesem Browser.
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
    .lo-row button { padding: 4px 10px; min-width: 36px; }`,
  // Namen für Bereiche, die ausgeblendet und darum nicht aufgebaut sind (sonst zählt die Überschrift).
  NAMES: { warning: "Frühwarnung", briefing: "Morgen-Briefing", today: "Heute", journal: "Check-in", coach: "Coach", plan: "Wochenplan und Ziele", recovery: "Erholung und Schlaf", sleep: "Schlaf im Detail",
    insights: "Was beeinflusst deine Erholung?", health: "Körpersignale", strain: "Belastung und Erholung", load: "Trainingslast", fit: "Rolle und Leistung",
    hrzones: "Pulszonen", strength: "Krafttraining", weeks: "Wochen", periods: "Monate und Jahre", year: "Jahr im Überblick", workouts: "Workouts",
    settings: "Einstellungen", sources: "Datenquellen", body: "Gewicht", export: "Daten exportieren", bikewo: "Workout für MyWhoosh", records: "Bestleistungen", review: "Wochenrückblick", weather: "Radwetter", ftp: "FTP-Test", endurance: "Ausdauer-Profil", gym: "Gym-Modus", forecast: "Erholung morgen (Prognose)", agenda: "Heute dran", interference: "Kraft und Rad im Wechselspiel", hrvtrend: "HRV-Trend" },
  TABS: [["heute", "Heute"], ["coach", "Coach"], ["verlauf", "Verlauf"], ["training", "Training"], ["mehr", "Mehr"]],
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-layout">Dashboard anpassen</h2><span class="muted">gilt nur in diesem Browser</span></div>
      <div class="panel"><div id="loList"></div>
        <div class="row" style="margin-top:12px"><button type="button" id="loReset">Standard wiederherstellen</button><span class="muted" id="loNote"></span></div></div>`;
    FC.$("loReset").onclick = () => { FC.layout.reset(); FC.$("loNote").textContent = "Standard gespeichert. Seite neu laden, um alles wie anfangs zu sehen."; this.draw(); };
  },
  ready() { this.draw(); },
  draw() {
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
