// „Neu im Dashboard“ (#152): neue Abschnitte seit dem letzten Besuch, Tippen springt hin.
// Neue Einträge oben anhängen und `n` hochzählen; „Alles gesehen“ merkt sich das höchste n im Browser.
FC.section({
  id: "whatsnew",
  tab: "heute",
  order: 4,
  NEWS: [
    { n: 16, id: "gym", title: "Gym-Modus: Scheiben und Aufwärmen", text: "Scheiben je Seite für Langhantel-Übungen und eine Aufwärm-Treppe zum Arbeitsgewicht." },
    { n: 15, id: "durability", title: "Ermüdungsresistenz", text: "Wie viel Leistung nach 500, 1000 und 1500 kJ noch da ist." },
    { n: 14, id: "timing", title: "Beste Trainingszeit", text: "Tageszeit des Trainings gegen Schlaf, Erholung und Leistung." },
    { n: 13, id: "workouts", title: "Anstrengung je Workout", text: "RPE 1–10 eintragen, verbessert die Belastung beim Krafttraining." },
    { n: 12, id: "hrvtrend", title: "HRV-Trend", text: "7-Tage-Schnitt gegen deinen Normalbereich, fließt in die Tagesempfehlung ein." },
    { n: 11, id: "interference", title: "Kraft und Rad im Wechselspiel", text: "Wie Krafttage deine Radleistung am Folgetag beeinflussen." },
    { n: 10, id: "agenda", title: "Heute dran", text: "Geplante Einheit mit Wochenstreifen, Start direkt in Gym-Modus oder MyWhoosh." },
    { n: 9, id: "coach", title: "Coach-Chat", text: "Fragen zum Antippen, der Verlauf bleibt erhalten." },
    { n: 8, id: "gym", title: "Gym-Modus", text: "Sätze im Gym abhaken, Pausen-Timer, letztes Mal und neue Bestwerte." },
    { n: 7, id: "forecast", title: "Erholung morgen", text: "Prognose der Erholung für morgen mit den wichtigsten Einflüssen." },
    { n: 6, id: "endurance", title: "Ausdauer-Profil", text: "Leistungskurve, Typ und Stärken auf dem Rad." },
    { n: 5, id: "plan", title: "Wochenplan mit Krafteinheiten", text: "Konkrete Übungen und Gewichte, FTP-Test-Vorschlag, fester Ruhetag." },
    { n: 4, id: "weather", title: "Radwetter", text: "Draußen fahren oder Rolle?" },
    { n: 3, id: "ftp", title: "FTP-Test-Assistent", text: "Test planen, auswerten und speichern." },
    { n: 2, id: "bikewo", title: "Workout für MyWhoosh", text: "Radeinheit als .zwo-Datei für MyWhoosh." },
    { n: 1, id: "records", title: "Bestleistungen", text: "Neue Rekorde und der Vergleich zur Vorwoche." },
  ],
  css: `
    .wn { border-left: 4px solid var(--accent); }
    .wn-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .wn-head h2 { margin: 0; font-size: 1.05rem; }
    .wn ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 2px; }
    .wn li button:not(.wn-more) { display: grid; gap: 1px; width: 100%; text-align: left; padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .wn-more { margin: 4px 8px 0; }
    .wn li button:not(.wn-more):hover, .wn li button:not(.wn-more):focus-visible { background: var(--accent-wash); }
    .wn li strong { color: var(--accent); }
    .wn li span { font-size: .85rem; color: var(--ink-2); }`,
  mount(root) {
    this.root = root;
    root.hidden = true;
    root.innerHTML = `<div class="panel wn" role="region" aria-labelledby="h-whatsnew"><div class="wn-head"><h2 id="h-whatsnew">Neu im Dashboard</h2><button type="button" class="linkish" id="wnSeen">Alles gesehen</button></div><ul id="wnList"></ul></div>`;
    FC.$("wnSeen").onclick = () => {
      try { localStorage.setItem("fc-news-seen", String(this.NEWS[0].n)); } catch { /* nur Komfort */ }
      root.hidden = true;
    };
  },
  ready() { this.draw(); },
  seen() { try { return Number(localStorage.getItem("fc-news-seen")) || 0; } catch { return 0; } },
  draw() {
    const { el } = FC, seen = this.seen();
    const live = new Map(FC.layout.list().filter((s) => !s.hidden).map((s) => [s.id, s]));
    const all = this.NEWS.filter((x) => x.n > seen && live.has(x.id)), items = this.open ? all : all.slice(0, 3);
    this.root.hidden = !all.length;
    let more = null;
    if (all.length > items.length) {
      const b = el("button", { type: "button", class: "linkish wn-more", text: `${all.length - items.length} weitere zeigen` });
      b.onclick = () => { this.open = true; this.draw(); };
      more = el("li", {}, b);
    }
    FC.$("wnList").replaceChildren(...items.map((x) => {
      const b = el("button", { type: "button" }, el("strong", { text: x.title }), el("span", { text: x.text }));
      b.onclick = () => {
        FC.showTab(live.get(x.id).tab);
        requestAnimationFrame(() => FC.$(`sec-${x.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
      };
      return el("li", {}, b);
    }), ...(more ? [more] : []));
  },
});
