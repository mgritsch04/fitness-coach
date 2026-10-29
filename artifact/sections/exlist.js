// Meine Übungen (#399): alle Übungen mit Verlauf (Datum, Sätze, Gewicht, Wiederholungen), umbenennen, zusammenführen
// (Verlauf und Bestwerte bleiben, lassen sich wieder trennen), ausblenden, Muskelgruppen (automatisch erkannt, manuell änderbar)
// und Dubletten-Vorschläge. Daten von get_exercises, Änderungen über manage_exercise.
// Fortschritt je Übung (geschätztes 1RM, Prognose, Status) kommt aus get_strength und steht in der jeweiligen Übung.
FC.section({
  id: "exlist",
  simple: true,
  tab: "uebungen",
  order: 1,
  MUSCLES: [["chest", "Brust"], ["back", "Rücken"], ["shoulders", "Schultern"], ["biceps", "Bizeps"], ["triceps", "Trizeps"], ["quads", "Oberschenkel vorne"], ["hamstrings", "Oberschenkel hinten"], ["glutes", "Gesäß"], ["calves", "Waden"], ["core", "Rumpf"]],
  SOURCE: { manual: "manuell gesetzt", catalog: "aus dem Katalog", auto: "automatisch aus dem Namen erkannt", unknown: "nicht erkannt" },
  css: `
    .ex-tools { display: grid; gap: 10px; margin-bottom: 10px; }
    .ex-tools input[type=search] { width: 100%; min-height: 44px; box-sizing: border-box; }
    .ex-note { margin: 0; padding: 8px 10px; border-radius: 8px; background: var(--warn-wash); color: var(--warn-ink); font-size: .9rem; }
    .ex-group { margin: 14px 0 2px; font-size: .8rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-2); }
    .ex-item { border-bottom: 1px solid var(--line); }
    .ex-item > summary { list-style: none; cursor: pointer; padding: 10px 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; align-items: center; min-height: 44px; }
    .ex-item > summary::-webkit-details-marker { display: none; }
    .ex-item > summary b { font-size: 1rem; overflow-wrap: anywhere; }
    .ex-item > summary .ex-meta { grid-column: 1; font-size: .85rem; color: var(--ink-2); }
    .ex-item > summary .ex-side { grid-column: 2; grid-row: 1 / span 2; display: grid; gap: 4px; justify-items: end; }
    .ex-item > summary::after { content: ""; }
    .ex-item[open] > summary { border-bottom: 1px dashed var(--line); }
    .ex-spark { width: 64px; height: 20px; }
    .ex-body { padding: 10px 0 12px; display: grid; gap: 14px; }
    .ex-body h4 { margin: 0 0 6px; }
    .ex-hist { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; font-variant-numeric: tabular-nums; }
    .ex-hist li { display: grid; grid-template-columns: 7.5em minmax(0, 1fr); gap: 8px; }
    .ex-hist .d { color: var(--ink-2); }
    .ex-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .ex-row input[type=text], .ex-row select { flex: 1 1 12em; min-width: 0; min-height: 40px; }
    .ex-row button { padding: 8px 12px; min-height: 40px; }
    .ex-mus { display: flex; flex-wrap: wrap; gap: 6px 14px; }
    .ex-mus label { display: flex; align-items: center; gap: 6px; font-size: .9rem; min-height: 32px; }
    .ex-sub { margin: 0; font-size: .82rem; color: var(--ink-3); }
    .ex-more { border: 1px solid var(--line); border-radius: 8px; padding: 0 10px; }
    .ex-more > summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 600; }
    .ex-more > div { display: grid; gap: 12px; padding: 0 0 12px; }
    .ex-dup { display: grid; gap: 6px; padding: 8px 0; border-bottom: 1px solid var(--line); }
    #exDupBox { margin-bottom: 10px; }
    #sec-exlist .linkish { border: 0; background: none; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-exlist">Meine Übungen</h2><span class="muted" id="exCount"></span></div>
      <div class="panel">
        <div class="ex-tools">
          <input type="search" id="exSearch" placeholder="Übung suchen" aria-label="Übung suchen" autocomplete="off">
          <p class="ex-note" id="exDeload" hidden></p>
          <details id="exDupBox" class="ex-more" hidden><summary id="exDupSum"></summary><div id="exDup"></div></details>
        </div>
        <div id="exList"><div class="empty">Lade Übungen …</div></div>
        <details id="exHidden" style="margin-top:12px" hidden><summary class="muted" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Ausgeblendete Übungen</summary><div id="exHiddenList"></div></details>
        <p class="muted" id="exMsg" role="status" style="margin:8px 0 0"></p></div>`;
    this.open = new Set();
    this.query = "";
    FC.$("exSearch").addEventListener("input", (ev) => { this.query = ev.target.value; this.draw(); });
  },
  ready() { this.load(false); },
  render() { this.draw(); },
  async load(fresh) {
    try {
      const cache = fresh ? { cache: false } : { cache: { staleTime: 60_000, gcTime: 86_400_000 } };
      // Fortschritt ist Beiwerk: fällt get_strength aus, bleibt die Liste benutzbar.
      const [ex, st] = await Promise.all([FC.call("get_exercises", {}, cache), FC.call("get_strength", { weeks: 12 }, cache).catch(() => null)]);
      this.data = ex; this.strength = st;
      this.prog = new Map((st?.progress ?? []).map((p) => [p.exercise, p]));
      this.draw();
    } catch (err) { const m = FC.$("exMsg"); if (m) m.textContent = FC.errText(err); }
  },
  msg(t) { const m = FC.$("exMsg"); if (m) m.textContent = t ?? ""; },
  /** Änderung am Server, danach Liste, Gym-Auswahl und Krafttraining neu laden. */
  async act(input, done) {
    this.msg("Speichere …");
    try {
      await FC.call("manage_exercise", input);
      for (const t of ["get_exercises", "get_strength"]) await FC.state.mcp?.invalidate(FC.SERVER, t).catch(() => {});
      await this.load(true);
      FC.state.gym?.loadEx?.(true);
      this.msg(done);
      FC.reload?.();
    } catch (err) { this.msg(err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err)); }
  },
  /** Sätze: bei einseitigen Übungen zählen links + rechts als ein Satz. */
  setCount(sets) { return sets.some((s) => s.side) ? Math.ceil(sets.length / 2) : sets.length; },
  kg(v) { return v ? `${FC.de(v, v % 1 ? 1 : 0)} kg` : "Körpergewicht"; },
  label(m) { return this.MUSCLES.find((x) => x[0] === m)?.[1] ?? "Sonstige"; },
  musclesText(e) {
    const p = e.muscles.primary.map((m) => this.label(m)).join(", "), s = e.muscles.secondary.map((m) => this.label(m)).join(", ");
    return e.muscles.source === "unknown" ? "Muskelgruppe nicht erkannt" : `${p}${s ? ` (Hilfsmuskeln: ${s})` : ""}`;
  },
  STATUS: { progress: "Fortschritt", plateau: "Plateau", decline: "Rückgang", new: "neu" },
  /** Hauptmuskel der Gruppe: erste Hauptmuskelgruppe, sonst „Sonstige“. */
  groupOf(e) { const m = e.muscles.primary[0]; return this.MUSCLES.some((x) => x[0] === m) ? m : "other"; },
  draw() {
    const { $, el } = FC, d = this.data; if (!d || !$("exList")) return;
    const shown = d.exercises.filter((e) => !e.hidden), hidden = d.exercises.filter((e) => e.hidden);
    const q = this.query.trim().toLowerCase();
    const vis = q ? shown.filter((e) => e.name.toLowerCase().includes(q)) : shown;
    $("exCount").textContent = shown.length ? `${shown.length} Übung${shown.length > 1 ? "en" : ""}` : "";
    const focused = $("exList").contains(document.activeElement) ? document.activeElement : null;
    // Plateau/Entlastung (#202): Hinweis nur bei deload/watch.
    const dl = this.strength?.deload, dn = $("exDeload");
    dn.hidden = !dl || !["deload", "watch"].includes(dl.verdict);
    if (!dn.hidden) dn.replaceChildren(el("strong", { text: dl.verdict === "deload" ? "Entlastungswoche empfohlen. " : "Plateau beobachten. " }), `${dl.text}${dl.suggestion ? ` ${dl.suggestion.text}` : ""}`);
    const dups = this.dupGroups(d, shown);
    $("exDupBox").hidden = !dups.length;
    $("exDupSum").textContent = `${dups.length} mögliche Dublette${dups.length === 1 ? "" : "n"} prüfen`;
    $("exDup").replaceChildren(...dups);
    const nodes = [];
    for (const [k, t] of [...this.MUSCLES, ["other", "Sonstige"]]) {
      const g = vis.filter((e) => this.groupOf(e) === k);
      if (g.length) nodes.push(el("h3", { class: "ex-group", text: `${t} (${g.length})` }), ...g.map((e) => this.item(e, shown)));
    }
    $("exList").replaceChildren(...(nodes.length ? nodes : [el("div", { class: "empty", text: q ? `Keine Übung mit „${this.query.trim()}“.` : "Noch keine Übungen. Sie entstehen mit der ersten gespeicherten Einheit." })]));
    $("exHidden").hidden = !hidden.length;
    $("exHiddenList").replaceChildren(...hidden.map((e) => {
      const b = el("button", { type: "button", text: "Einblenden" });
      b.onclick = () => this.act({ action: "unhide", exercise: e.exercise }, `„${e.name}“ wieder eingeblendet.`);
      return el("div", { class: "ex-row", style: "padding:6px 0" }, el("span", { text: e.name, style: "flex:1 1 10em" }), b);
    }));
    if (focused?.id && document.getElementById(focused.id)) document.getElementById(focused.id).focus();
  },
  /** Dubletten-Vorschläge: pro Gruppe die Übung wählen, die bleibt; die anderen gehen in sie auf. */
  dupGroups(d, shown) {
    const { el } = FC, vis = new Set(shown.map((e) => e.exercise));
    return d.duplicates.map((g) => ({ ...g, exercises: g.exercises.filter((x) => vis.has(x.exercise)) })).filter((g) => g.exercises.length > 1).map((g, gi) => {
      const sel = el("select", { "aria-label": "Übung, die bleibt", id: `exDupSel${gi}` }, ...g.exercises.map((x) => el("option", { value: x.exercise, text: x.name })));
      const go = el("button", { type: "button", text: "Alle in diese zusammenführen" });
      go.onclick = async () => {
        const names = g.exercises.map((x) => x.name).join(", ");
        if (!FC.ask(go, `Alle in „${sel.selectedOptions[0].text}“ zusammenführen? (${names}) Verlauf und Bestwerte bleiben erhalten. Zum Bestätigen nochmal tippen.`)) return;
        go.disabled = true;
        for (const x of g.exercises) if (x.exercise !== sel.value) await this.act({ action: "merge", exercise: x.exercise, into: sel.value }, `Zusammengeführt in „${sel.selectedOptions[0]?.text ?? ""}“.`);
      };
      return el("div", { class: "ex-dup" }, el("b", { text: "Mögliche Dubletten" }), el("span", { class: "muted", text: `${g.exercises.map((x) => x.name).join(" · ")}` }),
        el("span", { class: "ex-sub", text: `${g.reason}. Nur ein Vorschlag, du entscheidest.` }), el("div", { class: "ex-row" }, el("label", { class: "muted", for: `exDupSel${gi}`, text: "Behalten:" }), sel, go));
    });
  },
  item(e, all) {
    const { el, de, fmtDayLong } = FC, p = this.prog?.get(e.exercise);
    const meta = [`${e.sessions} Einheit${e.sessions === 1 ? "" : "en"}`, e.lastDay ? `zuletzt ${fmtDayLong(e.lastDay)}` : "noch nie trainiert", e.unilateral ? "einseitig" : null, e.muscles.source === "unknown" ? "Muskelgruppe nicht erkannt" : null].filter(Boolean).join(" · ");
    const side = el("span", { class: "ex-side" });
    if (p && this.STATUS[p.status]) side.append(el("span", { class: `pill ${p.status}`, text: this.STATUS[p.status] }));
    if (p && p.history.length > 1) { const sp = FC.spark(p.history.slice(-12).map((h) => h.e1rmKg), FC.cssVar("--accent")); sp.classList.add("ex-spark"); side.append(sp); }
    const det = el("details", { class: "ex-item", id: `ex-${e.exercise.replace(/[^a-z0-9]+/gi, "-")}` },
      el("summary", {}, el("b", { text: e.name }), side, el("span", { class: "ex-meta", text: meta })));
    const body = el("div", { class: "ex-body" });
    const fill = () => { if (!body.childElementCount) body.append(...this.body(e, all, p)); };
    det.append(body);
    det.open = this.open.has(e.exercise);
    if (det.open) fill();
    det.addEventListener("toggle", () => { if (det.open) { this.open.add(e.exercise); fill(); } else this.open.delete(e.exercise); });
    return det;
  },
  /** Inhalt einer geöffneten Übung: Fortschritt, Verlauf, Einstellungen, seltene Aktionen. */
  body(e, all, p) {
    const { el, de, fmtDayLong } = FC, out = [];
    // 1. Fortschritt: Diagramm mit Prognose (wie im Gym-Modus), Kennzahlen
    if (p && FC.state.exerciseDetail) {
      const facts = [p.bestE1rmKg != null ? `Bestwert ≈ ${de(p.bestE1rmKg, 1)} kg (1RM)` : null, p.change4wPct != null ? `4 Wochen ${p.change4wPct > 0 ? "+" : ""}${de(p.change4wPct, 1)} %` : null].filter(Boolean).join(" · ");
      out.push(el("div", {}, el("h4", { text: "Fortschritt" }), facts ? el("p", { class: "ex-sub", text: facts }) : "", FC.state.exerciseDetail(p)));
    } else if (e.bestE1rmKg) out.push(el("p", { class: "ex-sub", text: `Bestwert ≈ ${de(e.bestE1rmKg, 1)} kg (1RM, Schätzung)` }));
    // 2. Verlauf: letzte 5 Einheiten, der Rest auf Wunsch
    if (e.history.length) {
      const row = (h) => el("li", {}, el("span", { class: "d", text: fmtDayLong(h.day) }), el("span", { text: `${this.setCount(h.sets)} ${this.setCount(h.sets) === 1 ? "Satz" : "Sätze"}: ${h.sets.map((s) => `${s.side ? `${s.side === "L" ? "links" : "rechts"} ` : ""}${this.kg(s.weightKg)} × ${s.reps}`).join(" · ")}` }));
      const ol = el("ol", { class: "ex-hist", "aria-label": `Verlauf ${e.name}` }, ...e.history.slice(0, 5).map(row));
      const wrap = el("div", {}, el("h4", { text: "Verlauf" }), ol);
      if (e.history.length > 5) {
        const more = el("button", { type: "button", class: "linkish", text: `Alle ${e.history.length} Einheiten zeigen`, style: "margin-top:8px" });
        more.onclick = () => { ol.replaceChildren(...e.history.map(row)); more.remove(); };
        wrap.append(more);
      }
      out.push(wrap);
    } else out.push(el("p", { class: "muted", style: "margin:0", text: "Noch keine Einheit mit dieser Übung." }));
    out.push(this.settings(e), this.rare(e, all));
    return out;
  },
  /** Einstellungen: Name, Muskelgruppen, einseitig. */
  settings(e) {
    const { el } = FC;
    const nm = el("input", { type: "text", maxlength: 80, value: e.name, "aria-label": `Neuer Name für ${e.name}` });
    const rn = el("button", { type: "button", text: "Umbenennen" });
    rn.onclick = () => { const n = nm.value.trim(); if (!n || n === e.name) { nm.focus(); return; } this.act({ action: "rename", exercise: e.exercise, name: n }, `Umbenannt in „${n}“.`); };
    // Muskelgruppen: Haupt- und Hilfsmuskel, automatisch oder manuell
    const checks = (cls, selected) => el("div", { class: "ex-mus", role: "group" }, ...this.MUSCLES.map(([k, t]) => {
      const c = el("input", { type: "checkbox", value: k, class: cls }); c.checked = selected.includes(k);
      return el("label", {}, c, el("span", { text: t }));
    }));
    const prim = checks("p", e.muscles.primary), sec = checks("s", e.muscles.secondary);
    const sv = el("button", { type: "button", text: "Muskelgruppen speichern" }), auto = el("button", { type: "button", class: "linkish", text: "wieder automatisch" });
    sv.onclick = () => {
      const p = [...prim.querySelectorAll("input:checked")].map((c) => c.value).slice(0, 4), s = [...sec.querySelectorAll("input:checked")].map((c) => c.value).filter((m) => !p.includes(m)).slice(0, 4);
      if (!p.length) { this.msg("Bitte mindestens einen Hauptmuskel wählen."); return; }
      this.act({ action: "muscles", exercise: e.exercise, primary: p, secondary: s }, `Muskelgruppen für „${e.name}“ gespeichert.`);
    };
    auto.onclick = () => this.act({ action: "muscles", exercise: e.exercise }, `„${e.name}“: Muskelgruppen wieder automatisch.`);
    const uni = el("button", { type: "button", text: e.unilateral ? "Nicht einseitig" : "Einseitig (links/rechts)", "aria-pressed": String(!!e.unilateral) });
    uni.onclick = () => this.act({ action: e.unilateral ? "bilateral" : "unilateral", exercise: e.exercise }, e.unilateral ? `„${e.name}“ wird wieder beidseitig erfasst.` : `„${e.name}“ ist einseitig: im Gym-Modus links und rechts getrennt.`);
    return el("details", { class: "ex-more" }, el("summary", { text: "Einstellungen" }), el("div", {},
      el("div", { class: "ex-row" }, nm, rn),
      el("div", { style: "display:grid;gap:8px" }, el("h4", { text: "Muskelgruppen", style: "margin:0" }), el("p", { class: "ex-sub", text: `Jetzt: ${this.SOURCE[e.muscles.source]}. Hauptmuskel zählt einen Satz, Hilfsmuskel einen halben (max. 4 je Art).` }),
        el("span", { class: "muted", text: "Hauptmuskel" }), prim, el("span", { class: "muted", text: "Hilfsmuskel" }), sec, el("div", { class: "ex-row" }, sv, e.muscles.source === "manual" ? auto : "")),
      el("div", { class: "ex-row" }, uni)));
  },
  /** Selten gebraucht: Zusammenführen (mit Bestätigung), Getrenntes wieder trennen, Ausblenden. */
  rare(e, all) {
    const { el } = FC, kids = [];
    if (e.mergedFrom.length) {
      kids.push(el("div", {}, el("p", { class: "ex-sub", text: "Hier zusammengeführt (der Verlauf enthält sie):" }),
        ...e.mergedFrom.map((m) => {
          const b = el("button", { type: "button", class: "linkish", text: "wieder trennen", "aria-label": `${m.name} wieder trennen` });
          b.onclick = () => this.act({ action: "unmerge", exercise: m.exercise }, `„${m.name}“ ist wieder eigenständig.`);
          return el("div", { class: "ex-row" }, el("span", { text: m.name }), b);
        })));
    }
    const others = all.filter((x) => x.exercise !== e.exercise);
    if (others.length) {
      const sel = el("select", { "aria-label": `${e.name} zusammenführen mit` }, el("option", { value: "", text: "Zusammenführen mit …" }), ...others.map((x) => el("option", { value: x.exercise, text: x.name })));
      const mg = el("button", { type: "button", text: "Zusammenführen" });
      mg.onclick = () => {
        if (!sel.value) { sel.focus(); return; }
        const t = sel.selectedOptions[0].text;
        if (!FC.ask(mg, `„${e.name}“ in „${t}“ zusammenführen? Verlauf und Bestwerte beider bleiben erhalten. Zum Bestätigen nochmal tippen.`)) return;
        this.act({ action: "merge", exercise: e.exercise, into: sel.value }, `„${e.name}“ ist jetzt in „${t}“ enthalten.`);
      };
      kids.push(el("div", { class: "ex-row" }, sel, mg));
    }
    const hide = el("button", { type: "button", text: "Ausblenden" });
    hide.onclick = () => this.act({ action: "hide", exercise: e.exercise }, `„${e.name}“ ausgeblendet. Der Verlauf bleibt; unten wieder einblendbar.`);
    kids.push(el("div", { class: "ex-row" }, hide));
    return el("details", { class: "ex-more" }, el("summary", { text: "Weitere Aktionen" }), el("div", {}, ...kids));
  },
});
