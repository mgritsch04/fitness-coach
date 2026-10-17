// „Neu im Dashboard“ (#152): neue Abschnitte seit dem letzten Besuch, Tippen springt hin.
// Neue Einträge oben anhängen und `n` hochzählen; „Alles gesehen“ merkt sich das höchste n im Browser.
// id "search" öffnet die Abschnittssuche (#269) statt zu einem Abschnitt zu springen.
FC.section({
  id: "whatsnew",
  tab: "heute",
  order: 4,
  NEWS: [
    { n: 45, id: "search", title: "Abschnitte suchen", text: "Oben „Suchen“ (am Rechner Taste /): Begriff tippen, z. B. Kadenz oder Schlaf, und direkt zum Abschnitt springen." },
    { n: 44, id: "consistency", title: "Konstanz und Serien", text: "Wie viele Wochen in Folge du dein Ziel aus Kraft und Rad erreicht hast." },
    { n: 43, id: "gym", title: "Übung tauschen", text: "Im Gym-Modus bei belegtem Gerät „Tauschen“: passende Alternativen für dieselbe Muskelgruppe." },
    { n: 42, id: "strength", title: "Kraft pro kg", text: "Deine Grundübungen im Verhältnis zum Körpergewicht, mit groben Stufen (Schätzung)." },
    { n: 41, id: "agenda", title: "Rückmeldung zur Empfehlung", text: "Unter „Heute dran“: sag, ob die Tagesempfehlung gepasst hat; der Coach passt sich vorsichtig an." },
    { n: 40, id: "weather", title: "Was anziehen?", text: "Im Radwetter steht je Tag eine Kleidungsempfehlung aus gefühlter Temperatur, Regen und Licht." },
    { n: 39, id: "riderprofile", title: "Leistungskurve im Vergleich", text: "Beim Fahrertyp zwei Zeiträume übereinander legen und die Differenz je Dauer sehen." },
    { n: 38, id: "bikewo", title: "Workout-Bibliothek", text: "Unter „Workout für MyWhoosh“: fertige Einheiten wie Sweet Spot oder VO2max, an deine FTP angepasst." },
    { n: 37, id: "mobility", title: "Mobility nach der Einheit", text: "Passende Dehn- und Mobility-Übungen nach Rad oder Kraft, mit Timer." },
    { n: 36, id: "review", title: "Wochenbilanz als Bild", text: "Im Wochenrückblick „Als Bild speichern“: Kennzahlen, Sportarten und Highlights der Woche als PNG." },
    { n: 35, id: "indooroutdoor", title: "Rolle gegen Straße", text: "Puls, Leistung und Belastung auf der Rolle im Vergleich zu Fahrten draußen." },
    { n: 34, id: "block", title: "Trainingsblock", text: "4-Wochen-Block mit Aufbau und Entlastungswoche; bei schlechten Werten wird die Entlastung vorgezogen." },
    { n: 33, id: "sources", title: "Datenstand je Quelle", text: "Unter dem Datum steht, wie aktuell WHOOP und MyWhoosh sind; alte Daten sind als „veraltet“ markiert." },
    { n: 32, id: "sleeptarget", title: "Schlafziel heute Nacht", text: "Wann du heute ins Bett solltest, aus Schlafbedarf, Schlafschuld und Belastung (Schätzung)." },
    { n: 31, id: "eftp", title: "FTP-Schätzung im Verlauf", text: "Wie sich deine geschätzte FTP aus normalen Fahrten entwickelt, ohne eigenen Test." },
    { n: 30, id: "readiness", title: "Training nach der Erholungsampel", text: "Wie gut deine Belastung zur Erholung passte: Strain je Erholungszone und Treffer-Quote." },
    { n: 29, id: "workouts", title: "Workouts filtern", text: "Workout-Liste nach Rad, Kraft und Quelle filtern und durchsuchen; der Filter bleibt gemerkt." },
    { n: 28, id: "recovery", title: "Diagramme antippen", text: "Am Handy zeigt ein Tippen ins Diagramm Datum und Werte; waagrecht wischen fährt die Tage ab." },
    { n: 27, id: "recoverycurve", title: "Erholung nach harten Tagen", text: "Wie viele Tage Erholung, HRV und Ruhepuls nach einem harten Tag brauchen." },
    { n: 26, id: "gym", title: "Training-Tab aufgeräumt", text: "Am Handy sind Abschnitte in Heute, Training und Verlauf einklappbar und laden erst beim Aufklappen." },
    { n: 25, id: "coach", title: "Coach-Chat kennt alle Analysen", text: "Frag z. B. „Was fällt in meinen Analysen auf?“ oder nach Muskelbalance, Trittfrequenz, Intervallen." },
    { n: 24, id: "highlights", title: "Auf einen Blick", text: "Die auffälligsten Befunde aller Analysen oben auf „Heute“, mit Sprung zu den Details." },
    { n: 23, id: "musclebalance", title: "Muskelbalance", text: "Sätze je Muskelgruppe gegen den Zielbereich, Ziehen gegen Drücken." },
    { n: 22, id: "riderprofile", title: "Fahrertyp", text: "Stärken und Schwächen deiner Leistungskurve im Verhältnis zur FTP." },
    { n: 20, id: "cadence", title: "Trittfrequenz", text: "Welche Kadenz du fährst, je Leistungszone und im Verlauf." },
    { n: 19, id: "intervals", title: "Intervall-Qualität", text: "Wie stark die Leistung innerhalb einer Intervall-Serie abfällt, je Intervallart im Verlauf." },
    { n: 18, id: "agenda", title: "Wochenplan in den Kalender", text: "Unter „Heute dran“: die restliche Woche als Kalenderdatei (.ics) speichern." },
    { n: 17, id: "aerobic", title: "Aerobe Basis", text: "Wie stabil dein Puls bei lockeren Fahrten zur Leistung bleibt (Entkopplung) im Verlauf." },
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
    const all = this.NEWS.filter((x) => x.n > seen && (live.has(x.id) || (x.id === "search" && FC.$("btnSearch")))), items = this.open ? all : all.slice(0, 3);
    this.root.hidden = !all.length;
    let more = null;
    if (all.length > items.length) {
      const b = el("button", { type: "button", class: "linkish wn-more", text: `${all.length - items.length} weitere zeigen` });
      b.onclick = () => { this.open = true; this.draw(); };
      more = el("li", {}, b);
    }
    FC.$("wnList").replaceChildren(...items.map((x) => {
      const b = el("button", { type: "button" }, el("strong", { text: x.title }), el("span", { text: x.text }));
      b.onclick = () => (x.id === "search" ? FC.$("btnSearch").click() : FC.goTo(x.id));
      return el("li", {}, b);
    }), ...(more ? [more] : []));
  },
});
