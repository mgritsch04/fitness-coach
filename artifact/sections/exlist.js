// Meine Übungen (#399): alle Übungen mit Verlauf (Datum, Sätze, Gewicht, Wiederholungen), umbenennen, zusammenführen
// (Verlauf und Bestwerte bleiben, lassen sich wieder trennen), ausblenden, Muskelgruppen (automatisch erkannt, manuell änderbar)
// und Dubletten-Vorschläge. Daten von get_exercises, Änderungen über manage_exercise.
FC.section({
  id: "exlist",
  simple: true,
  tab: "uebungen",
  order: 1,
  MUSCLES: [["chest", "Brust"], ["back", "Rücken"], ["shoulders", "Schultern"], ["biceps", "Bizeps"], ["triceps", "Trizeps"], ["quads", "Oberschenkel vorne"], ["hamstrings", "Oberschenkel hinten"], ["glutes", "Gesäß"], ["calves", "Waden"], ["core", "Rumpf"]],
  SOURCE: { manual: "manuell gesetzt", catalog: "aus dem Katalog", auto: "automatisch aus dem Namen erkannt", unknown: "nicht erkannt" },
  css: `
    .ex-item { border-bottom: 1px solid var(--line); }
    .ex-item > summary { list-style: none; cursor: pointer; padding: 10px 0; display: grid; gap: 2px; min-height: 44px; }
    .ex-item > summary::-webkit-details-marker { display: none; }
    .ex-item > summary b { font-size: 1rem; }
    .ex-body { padding: 0 0 12px; display: grid; gap: 12px; }
    .ex-hist { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; font-variant-numeric: tabular-nums; }
    .ex-hist li { display: grid; grid-template-columns: 9.5em minmax(0, 1fr); gap: 8px; }
    .ex-hist .d { color: var(--ink-2); }
    .ex-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .ex-row input[type=text], .ex-row select { flex: 1 1 12em; min-width: 0; min-height: 40px; }
    .ex-row button { padding: 8px 12px; min-height: 40px; }
    .ex-mus { display: flex; flex-wrap: wrap; gap: 6px 14px; }
    .ex-mus label { display: flex; align-items: center; gap: 6px; font-size: .9rem; min-height: 32px; }
    .ex-sub { margin: 0; font-size: .82rem; color: var(--ink-3); }
    .ex-dup { display: grid; gap: 6px; padding: 8px 0; border-bottom: 1px solid var(--line); }
    #sec-exlist .linkish { border: 0; background: none; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-exlist">Meine Übungen</h2><span class="muted" id="exCount"></span></div>
      <div class="panel"><div id="exDup"></div><div id="exSides"></div><div id="exList"><div class="empty">Lade Übungen …</div></div>
        <details id="exHidden" style="margin-top:12px" hidden><summary class="muted" style="cursor:pointer">Ausgeblendete Übungen</summary><div id="exHiddenList"></div></details>
        <p class="muted" id="exMsg" role="status" style="margin:8px 0 0"></p></div>`;
    this.open = new Set();
  },
  ready() { this.load(false); },
  render() { this.draw(); },
  async load(fresh) {
    try {
      this.data = await FC.call("get_exercises", {}, fresh ? { cache: false } : { cache: { staleTime: 60_000, gcTime: 86_400_000 } });
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
  draw() {
    const { $, el } = FC, d = this.data; if (!d || !$("exList")) return;
    const shown = d.exercises.filter((e) => !e.hidden), hidden = d.exercises.filter((e) => e.hidden);
    $("exCount").textContent = shown.length ? `${shown.length} Übung${shown.length > 1 ? "en" : ""}` : "";
    const focused = $("exList").contains(document.activeElement) ? document.activeElement : null;
    $("exDup").replaceChildren(...this.dupGroups(d, shown));
    $("exSides").replaceChildren(...this.sidesMerge(shown));
    $("exList").replaceChildren(...(shown.length ? shown.map((e) => this.item(e, shown)) : [el("div", { class: "empty", text: "Noch keine Übungen. Sie entstehen mit der ersten gespeicherten Einheit." })]));
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
  /** Zwei Übungen (z. B. „Rudern links“ und „Rudern rechts“) zu einer einseitigen zusammenführen: Sätze der ersten gelten als links, der zweiten als rechts. */
  sidesMerge(shown) {
    const { el } = FC;
    if (shown.length < 2) return [];
    const opts = () => shown.map((x) => el("option", { value: x.exercise, text: x.name }));
    const a = el("select", { "aria-label": "Übung für links", id: "exSideL" }, ...opts()), b = el("select", { "aria-label": "Übung für rechts", id: "exSideR" }, ...opts());
    if (shown.length > 1) b.selectedIndex = 1;
    const nm = el("input", { type: "text", maxlength: 80, placeholder: "Name der neuen Übung, z. B. Rudern einarmig", "aria-label": "Name der einseitigen Übung", id: "exSideName" });
    const go = el("button", { type: "button", text: "Zu einer einseitigen Übung zusammenführen" });
    go.onclick = async () => {
      const name = nm.value.trim();
      if (!name) { nm.focus(); return; }
      if (a.value === b.value) { this.msg("Bitte zwei verschiedene Übungen wählen."); return; }
      const ta = a.selectedOptions[0].text, tb = b.selectedOptions[0].text;
      if (!FC.ask(go, `„${ta}“ (links) und „${tb}“ (rechts) zu „${name}“ zusammenführen? Verlauf und Bestwerte bleiben erhalten. Zum Bestätigen nochmal tippen.`)) return;
      go.disabled = true;
      try {
        await FC.call("manage_exercise", { action: "merge", exercise: a.value, into: name, side: "L" });
        await FC.call("manage_exercise", { action: "merge", exercise: b.value, into: name, side: "R" });
        await FC.call("manage_exercise", { action: "rename", exercise: name, name });
      } catch (err) { go.disabled = false; this.msg(err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err)); return; }
      await this.act({ action: "unilateral", exercise: name }, `„${ta}“ ist jetzt links und „${tb}“ rechts in „${name}“.`);
    };
    return [el("details", { class: "ex-dup" }, el("summary", { class: "muted", style: "cursor:pointer;min-height:40px", text: "Links- und Rechts-Übung zusammenführen" }),
      el("span", { class: "ex-sub", text: "Die bisherigen Sätze der ersten Übung zählen danach als links, die der zweiten als rechts." }),
      el("div", { class: "ex-row" }, el("label", { class: "muted", for: "exSideL", text: "Links:" }), a), el("div", { class: "ex-row" }, el("label", { class: "muted", for: "exSideR", text: "Rechts:" }), b),
      el("div", { class: "ex-row" }, nm, go))];
  },
  item(e, all) {
    const { el, de, fmtDayLong } = FC;
    const meta = [`${e.sessions} Einheit${e.sessions === 1 ? "" : "en"}`, e.lastDay ? `zuletzt ${fmtDayLong(e.lastDay)}` : "noch nie trainiert", e.bestE1rmKg ? `Bestwert ≈ ${de(e.bestE1rmKg, 1)} kg (1RM)` : null].filter(Boolean).join(" · ");
    const det = el("details", { class: "ex-item", id: `ex-${e.exercise.replace(/[^a-z0-9]+/gi, "-")}` },
      el("summary", {}, el("b", { text: e.name }), el("span", { class: "muted", text: meta }), el("span", { class: "muted", text: this.musclesText(e) })));
    det.open = this.open.has(e.exercise);
    det.addEventListener("toggle", () => { if (det.open) this.open.add(e.exercise); else this.open.delete(e.exercise); });
    const body = el("div", { class: "ex-body" });
    // Verlauf: jede Einheit mit Datum und allen Sätzen
    body.append(e.history.length
      ? el("div", {}, el("h4", { text: "Verlauf", style: "margin:0 0 6px" }), el("ol", { class: "ex-hist", "aria-label": `Verlauf ${e.name}` },
        ...e.history.map((h) => el("li", {}, el("span", { class: "d", text: fmtDayLong(h.day) }), el("span", { text: `${this.setCount(h.sets)} ${this.setCount(h.sets) === 1 ? "Satz" : "Sätze"}: ${h.sets.map((s) => `${s.side ? `${s.side === "L" ? "links" : "rechts"} ` : ""}${this.kg(s.weightKg)} × ${s.reps}`).join(" · ")}` })))))
      : el("p", { class: "muted", style: "margin:0", text: "Noch keine Einheit mit dieser Übung." }));
    if (e.mergedFrom.length) {
      body.append(el("div", {}, el("p", { class: "ex-sub", text: "Hier zusammengeführt (der Verlauf oben enthält sie):" }),
        ...e.mergedFrom.map((m) => {
          const b = el("button", { type: "button", class: "linkish", text: "wieder trennen", "aria-label": `${m.name} wieder trennen` });
          b.onclick = () => this.act({ action: "unmerge", exercise: m.exercise }, `„${m.name}“ ist wieder eigenständig.`);
          return el("div", { class: "ex-row" }, el("span", { text: m.name }), b);
        })));
    }
    // Umbenennen
    const nm = el("input", { type: "text", maxlength: 80, value: e.name, "aria-label": `Neuer Name für ${e.name}` });
    const rn = el("button", { type: "button", text: "Umbenennen" });
    rn.onclick = () => { const n = nm.value.trim(); if (!n || n === e.name) { nm.focus(); return; } this.act({ action: "rename", exercise: e.exercise, name: n }, `Umbenannt in „${n}“.`); };
    body.append(el("div", { class: "ex-row" }, nm, rn));
    // Zusammenführen
    const others = all.filter((x) => x.exercise !== e.exercise);
    if (others.length) {
      const sel = el("select", { "aria-label": `${e.name} zusammenführen mit` }, el("option", { value: "", text: "Zusammenführen mit …" }), ...others.map((x) => el("option", { value: x.exercise, text: x.name })));
      const side = el("select", { "aria-label": `Seite von ${e.name} in der Zielübung` }, el("option", { value: "", text: "Seite: keine" }), el("option", { value: "L", text: "als links" }), el("option", { value: "R", text: "als rechts" }));
      const mg = el("button", { type: "button", text: "Zusammenführen" });
      mg.onclick = () => {
        if (!sel.value) { sel.focus(); return; }
        const t = sel.selectedOptions[0].text;
        if (!FC.ask(mg, `„${e.name}“ in „${t}“ zusammenführen? Verlauf und Bestwerte beider bleiben erhalten. Zum Bestätigen nochmal tippen.`)) return;
        this.act({ action: "merge", exercise: e.exercise, into: sel.value, ...(side.value ? { side: side.value } : {}) }, `„${e.name}“ ist jetzt in „${t}“ enthalten${side.value ? ` (${side.value === "L" ? "links" : "rechts"})` : ""}.`);
      };
      body.append(el("div", { class: "ex-row" }, sel, side, mg));
    }
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
    body.append(el("div", { style: "display:grid;gap:8px" }, el("h4", { text: "Muskelgruppen", style: "margin:0" }), el("p", { class: "ex-sub", text: `Jetzt: ${this.SOURCE[e.muscles.source]}. Hauptmuskel zählt einen Satz, Hilfsmuskel einen halben (max. 4 je Art).` }),
      el("span", { class: "muted", text: "Hauptmuskel" }), prim, el("span", { class: "muted", text: "Hilfsmuskel" }), sec, el("div", { class: "ex-row" }, sv, e.muscles.source === "manual" ? auto : "")));
    // Ausblenden
    const hide = el("button", { type: "button", text: "Ausblenden" });
    hide.onclick = () => this.act({ action: "hide", exercise: e.exercise }, `„${e.name}“ ausgeblendet. Der Verlauf bleibt; unten wieder einblendbar.`);
    const uni = el("button", { type: "button", text: e.unilateral ? "Nicht einseitig" : "Einseitig (links/rechts)", "aria-pressed": String(!!e.unilateral) });
    uni.onclick = () => this.act({ action: e.unilateral ? "bilateral" : "unilateral", exercise: e.exercise }, e.unilateral ? `„${e.name}“ wird wieder beidseitig erfasst.` : `„${e.name}“ ist einseitig: im Gym-Modus links und rechts getrennt.`);
    body.append(el("div", { class: "ex-row" }, uni, hide));
    det.append(body);
    return det;
  },
});
