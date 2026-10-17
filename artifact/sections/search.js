// Abschnitte suchen (#269): Lupe in der Kopfzeile (am Rechner auch Taste „/“), Treffer mit Tab, Antippen springt hin
// und klappt den Abschnitt auf. Kein eigener Abschnitt; sucht über die Überschriften plus Stichwörter.
(() => {
  const { $, el, sv } = FC;
  const TABS = { heute: "Heute", coach: "Coach", verlauf: "Verlauf", training: "Training", mehr: "Mehr" };
  // Wörter, unter denen man einen Abschnitt auch sucht, wenn sie nicht in der Überschrift stehen.
  const WORDS = {
    briefing: "morgen zusammenfassung", highlights: "befunde überblick", today: "erholung recovery strain heute",
    journal: "tagebuch check-in krank stimmung", coach: "chat frage claude", plan: "ziele wochenplan",
    recovery: "hrv ruhepuls schlaf erholung", sleep: "schlafphasen tiefschlaf rem schlafschuld", sleeptarget: "zubettgehen bett schlafbedarf",
    insights: "einflussfaktoren zusammenhang", health: "atmung hauttemperatur spo2 körpersignale", strain: "belastung",
    load: "ctl atl tsb fitness ermüdung form", fit: "fit upload mywhoosh leistungskurve zonen", hrzones: "puls zonen 80/20 intensität",
    strength: "kraft e1rm übungen", gym: "kraft sätze scheiben aufwärmen", weeks: "woche wochen", periods: "monat jahr",
    year: "jahr kalender", workouts: "workouts liste filter suche", settings: "ftp gewicht maximalpuls einstellungen",
    sources: "whoop wahoo mywhoosh verbinden datenquellen", body: "gewicht körpergewicht", export: "csv download",
    bikewo: "mywhoosh zwo intervalle bibliothek sweet spot vo2max", records: "rekorde bestwerte", review: "wochenrückblick bild",
    weather: "wetter regen wind temperatur", ftp: "ftp test ramp", endurance: "ausdauer", forecast: "prognose morgen",
    agenda: "geplant kalender ics", interference: "kraft rad wechselspiel", hrvtrend: "hrv plews", timing: "uhrzeit tageszeit",
    durability: "ermüdungsresistenz kj", aerobic: "entkopplung grundlage zone 2", intervals: "intervalle", cadence: "kadenz rpm trittfrequenz",
    riderprofile: "leistungskurve fahrertyp sprinter vergleich", musclebalance: "muskelgruppen ziehen drücken", readiness: "erholungsampel",
    comeback: "krank pause wiedereinstieg", eftp: "ftp schätzung", block: "4 wochen entlastung deload", indooroutdoor: "rolle straße indoor outdoor",
    mobility: "dehnen stretching beweglichkeit", warning: "warnung krank übertraining", recoverycurve: "harte tage", layout: "anpassen ausblenden reihenfolge",
  };
  const norm = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");

  function entries() {
    return FC.layout.list().filter((x) => !x.hidden && $(`sec-${x.id}`)).map((x) => ({ ...x, title: x.title === x.id ? x.id : x.title, hay: norm(`${x.title} ${WORDS[x.id] ?? ""} ${x.id}`), head: norm(x.title) }));
  }
  /** Jedes Suchwort muss vorkommen; Treffer am Anfang der Überschrift zuerst. */
  function find(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const all = entries();
    return all
      .filter((x) => words.every((w) => x.hay.includes(w)))
      .map((x) => ({ x, score: (x.head.startsWith(words[0]) ? 0 : x.head.includes(words[0]) ? 1 : 2) }))
      .sort((a, b) => a.score - b.score || a.x.title.localeCompare(b.x.title, "de"))
      .map((r) => r.x).slice(0, 12);
  }

  const btn = el("button", { type: "button", id: "btnSearch", class: "search-btn", "aria-label": "Abschnitt suchen", title: "Abschnitt suchen (/)" });
  const ic = sv("svg", { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "aria-hidden": "true" });
  ic.append(sv("circle", { cx: 11, cy: 11, r: 7 }), sv("path", { d: "M20 20l-4-4" }));
  btn.append(ic, el("span", { text: "Suchen" }));
  $("btnSync")?.before(btn);

  const dlg = el("dialog", { id: "searchDlg", class: "search-dlg", "aria-label": "Abschnitt suchen" });
  const input = el("input", { type: "search", id: "searchInput", placeholder: "z. B. Kadenz, Schlaf, FTP …", "aria-label": "Abschnitt suchen", autocomplete: "off", enterkeyhint: "go" });
  const close = el("button", { type: "button", class: "search-close", text: "Schließen" });
  const list = el("ul", { id: "searchList", class: "search-list", "aria-label": "Treffer" });
  const hint = el("p", { class: "fine", id: "searchHint", text: "Tippe einen Begriff; Treffer zeigen, in welchem Tab der Abschnitt liegt." });
  dlg.append(el("div", { class: "search-row" }, input, close), hint, list);
  document.body.append(dlg);

  function show() {
    const q = input.value.trim(), hits = find(q);
    hint.textContent = !q ? "Tippe einen Begriff; Treffer zeigen, in welchem Tab der Abschnitt liegt." : hits.length ? `${hits.length} Treffer` : "Kein Abschnitt gefunden.";
    list.replaceChildren(...hits.map((x) => {
      const b = el("button", { type: "button", "data-id": x.id }, el("span", { text: x.title }), el("span", { class: "search-tab", text: TABS[x.tab] ?? x.tab }));
      b.onclick = () => pick(x.id);
      return el("li", {}, b);
    }));
  }
  // Erst nach dem Tastendruck springen: goTo bricht das Nachführen bei der nächsten Taste ab, auch bei diesem Enter.
  function pick(id) { dlg.close(); setTimeout(() => FC.goTo(id), 0); }
  function open() { input.value = ""; show(); dlg.showModal(); input.focus(); }

  btn.onclick = open;
  close.onclick = () => dlg.close();
  input.addEventListener("input", show);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { const first = list.querySelector("button"); if (first) { e.preventDefault(); pick(first.dataset.id); } }
    if (e.key === "ArrowDown") { e.preventDefault(); list.querySelector("button")?.focus(); }
  });
  list.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const bs = [...list.querySelectorAll("button")], i = bs.indexOf(document.activeElement);
    e.preventDefault();
    if (e.key === "ArrowUp" && i <= 0) return input.focus();
    bs[Math.min(bs.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))]?.focus();
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || dlg.open) return;
    const t = e.target; if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault(); open();
  });
})();
