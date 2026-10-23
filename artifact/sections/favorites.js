// Lieblingsabschnitte anheften (#291): Stern in jeder Abschnittsüberschrift, angeheftete Abschnitte als Leiste
// oben auf „Heute“; Tippen springt hin. Gemerkt im Browser wie Layout und Filter.
FC.section({
  id: "favorites",
  tab: "heute",
  order: 3,
  KEY: "fc-fav",
  TABS: { heute: "Heute", coach: "Coach", verlauf: "Verlauf", training: "Training", mehr: "Mehr" },
  css: `
    .fav-btn { border: 0; background: none; padding: 2px 4px; margin-left: 6px; vertical-align: middle; color: var(--ink-3); border-radius: 6px; line-height: 0; }
    .fav-btn svg { width: 18px; height: 18px; }
    .fav-btn[aria-pressed=true] { color: var(--accent); }
    .fav-btn[aria-pressed=true] svg { fill: currentColor; }
    .fav-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .fav ul { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .fav li button { display: inline-flex; gap: 8px; align-items: baseline; border-radius: 999px; padding: 6px 12px; }
    .fav li .fav-tab { color: var(--ink-3); font-weight: 400; font-size: 0.82rem; }`,
  mount(root) {
    this.root = root;
    root.innerHTML = `<div class="panel fav"><div class="sec-head"><h2 id="h-favorites">Deine Favoriten</h2></div><ul id="favList" aria-label="Angeheftete Abschnitte"></ul></div>`;
    this.draw();
    document.addEventListener("fc-folds", () => this.stars());
  },
  ready() { this.stars(); },
  render() { this.stars(); this.draw(); },
  list() { try { const v = JSON.parse(localStorage.getItem(this.KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } },
  save(v) { try { localStorage.setItem(this.KEY, JSON.stringify(v)); } catch {} },
  toggle(id) {
    const v = this.list(), i = v.indexOf(id);
    if (i >= 0) v.splice(i, 1); else v.push(id);
    this.save(v); this.stars(); this.draw();
  },
  btn(id, extra = "") {
    const { sv, el } = FC;
    const b = el("button", { type: "button", class: `fav-btn ${extra}`.trim() });
    const ic = sv("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linejoin": "round", "aria-hidden": "true" });
    ic.append(sv("path", { d: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" }));
    b.append(ic);
    b.onclick = (e) => { e.stopPropagation(); this.toggle(id); };
    return b;
  },
  /** Stern in jede Abschnittsüberschrift (einmal je Überschrift; Abschnitte bauen ihre Überschrift selbst). */
  stars() {
    const { $ } = FC, fav = new Set(this.list());
    for (const s of FC.layout.list()) {
      if (s.id === "favorites" || s.id === "layout") continue;
      const h = $(`h-${s.id}`); if (!h) continue;
      const on = fav.has(s.id), name = h.textContent.trim() || s.id;
      const mark = (b) => {
        b.setAttribute("aria-pressed", String(on));
        b.setAttribute("aria-label", on ? `${name} von „Heute“ lösen` : `${name} oben auf „Heute“ anheften`);
        b.title = on ? "Angeheftet" : "Anheften";
      };
      let b = h.querySelector(":scope > .fav-btn");
      if (!b) { b = this.btn(s.id); h.append(b); }
      mark(b);
      // Einklappbare Reiter (Handy): die Überschrift ist ausgeblendet, der Stern sitzt dann in der Einklapp-Leiste.
      const host = $(`sec-${s.id}`), cur = host?.querySelector(":scope > .fav-bar");
      if (host?.querySelector(":scope > .fold-bar")) { const fb = cur ?? this.btn(s.id, "fav-bar"); if (!cur) host.append(fb); mark(fb); }
      else cur?.remove();
    }
  },
  draw() {
    const { $, el } = FC;
    const all = new Map(FC.layout.list().filter((s) => !s.hidden).map((s) => [s.id, s]));
    const items = this.list().filter((id) => all.has(id) && $(`sec-${id}`));
    this.root.hidden = !items.length;
    $("favList").replaceChildren(...items.map((id) => {
      const s = all.get(id), b = el("button", { type: "button" }, el("span", { text: s.title }), el("span", { class: "fav-tab", text: this.TABS[s.tab] ?? s.tab }));
      b.onclick = () => FC.goTo(id);
      return el("li", {}, b);
    }));
  },
});
