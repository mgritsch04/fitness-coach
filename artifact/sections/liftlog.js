// Meine Krafteinheiten: Liste aller erfassten Krafteinheiten (neueste zuerst) mit Übungen, Sätzen und Gewichten;
// antippen zeigt die Einheit, „Bearbeiten“ ändert Datum, Übungen, Sätze, Wiederholungen und Gewichte, „Löschen“ entfernt sie.
// Daten von get_strength (letzte 52 Wochen), Speichern über log_strength_session (mit id ersetzt die Einheit).
FC.section({
  id: "liftlog",
  simple: true,
  tab: "training",
  order: 40,
  css: `
    .ll-month { margin: 14px 0 4px; font-size: .8rem; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
    .ll-item { border-bottom: 1px solid var(--line); }
    .ll-item > summary { list-style: none; cursor: pointer; padding: 10px 0; display: grid; gap: 2px; min-height: 44px; }
    .ll-item > summary::-webkit-details-marker { display: none; }
    .ll-item > summary b { font-size: 1rem; }
    .ll-body { padding: 0 0 12px; display: grid; gap: 10px; }
    .ll-ex h4 { margin: 0 0 2px; font-size: .95rem; }
    .ll-ex ol { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 2px; font-variant-numeric: tabular-nums; }
    .ll-ex li { color: var(--ink-2); }
    .ll-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .ll-actions button { padding: 10px 14px; min-height: 44px; }
    .ll-edit { display: grid; gap: 12px; }
    .ll-edit label { display: grid; gap: 2px; font-size: .78rem; color: var(--ink-3); }
    .ll-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .ll-meta .wide { grid-column: 1 / -1; }
    .ll-exbox { display: grid; gap: 6px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
    .ll-exh { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: end; }
    .ll-set { display: grid; grid-template-columns: 3.4em repeat(3, minmax(0, 1fr)) auto; gap: 6px; align-items: end; }
    .ll-set .ll-n { align-self: center; font-size: .85rem; color: var(--ink-2); }
    .ll-edit button { padding: 8px 12px; min-height: 40px; }
    .ll-edit input { min-height: 40px; }
    .ll-danger { color: var(--bad-ink); }
  `,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-liftlog">Meine Krafteinheiten</h2><span class="muted" id="llCount"></span></div>
      <div class="panel"><div id="llList"><div class="empty">Lade Krafteinheiten …</div></div>
        <div class="row" style="margin-top:12px"><button type="button" id="llMore" hidden>Ältere anzeigen</button><span id="llMsg" class="muted" role="status"></span></div>
        <datalist id="llEx"></datalist></div>`;
    this.shown = 20; this.open = new Set(); this.editId = null;
    FC.$("llMore").onclick = () => { this.shown += 20; this.draw(); };
  },
  ready() { this.load(false); },
  render() { if (!this.editId) this.draw(); },
  async load(fresh) {
    try {
      this.data = await FC.call("get_strength", { weeks: 52 }, fresh ? { cache: false } : { cache: { staleTime: 60_000, gcTime: 86_400_000 } });
      this.draw();
    } catch (err) { const m = FC.$("llMsg"); if (m) m.textContent = FC.errText(err); }
  },
  /** Sätze einer Einheit je Übung gruppiert, in der Reihenfolge der Eingabe. */
  groups(s) {
    const by = new Map();
    for (const x of s.sets) { if (!by.has(x.exercise)) by.set(x.exercise, { name: x.exerciseName, muscles: x.muscles, sets: [] }); by.get(x.exercise).sets.push(x); }
    return [...by.values()];
  },
  kg(v) { return `${FC.de(v, v % 1 ? 1 : 0)} kg`; },
  draw() {
    const { $, el, de, fmtDayLong } = FC, d = this.data; if (!d || !$("llList")) return;
    const all = [...d.sessions].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : (b.startTime ?? "") < (a.startTime ?? "") ? -1 : 1));
    $("llCount").textContent = all.length ? `${all.length} Einheit${all.length > 1 ? "en" : ""} in den letzten 12 Monaten` : "";
    const names = new Set(); for (const s of all) for (const x of s.sets) names.add(x.exerciseName);
    $("llEx").replaceChildren(...[...names].sort().map((n) => el("option", { value: n })));
    const list = $("llList"), focused = list.contains(document.activeElement) ? document.activeElement : null;
    list.replaceChildren();
    if (!all.length) list.append(el("div", { class: "empty", text: "Noch keine Krafteinheiten gespeichert." }));
    let month = "";
    for (const s of all.slice(0, this.shown)) {
      const m = new Date(`${s.day}T12:00:00`).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
      if (m !== month) { month = m; list.append(el("div", { class: "ll-month", text: m })); }
      list.append(this.item(s));
    }
    $("llMore").hidden = all.length <= this.shown;
    if (focused?.id && list.contains(document.getElementById(focused.id))) document.getElementById(focused.id).focus();
  },
  item(s) {
    const { el, de, fmtDayLong } = FC, groups = this.groups(s);
    const meta = [`${groups.length} Übung${groups.length === 1 ? "" : "en"}`, `${s.sets.length} ${s.sets.length === 1 ? "Satz" : "Sätze"}`, s.durationMin ? `${de(s.durationMin)} min` : null, s.rpe ? `Anstrengung ${de(s.rpe, s.rpe % 1 ? 1 : 0)}` : null, s.repsUnreliable ? "Wiederholungen unsicher" : null].filter(Boolean).join(" · ");
    const det = el("details", { class: "ll-item", id: `ll-${s.id}` },
      el("summary", {}, el("b", { text: `${fmtDayLong(s.day)}${s.name ? ` · ${s.name}` : ""}` }), el("span", { class: "muted", text: meta }), el("span", { class: "muted", text: groups.map((g) => g.name).join(", ") })));
    det.open = this.open.has(s.id);
    det.addEventListener("toggle", () => { if (det.open) this.open.add(s.id); else this.open.delete(s.id); });
    det.append(this.editId === s.id ? this.editor(s) : this.view(s, groups));
    return det;
  },
  view(s, groups) {
    const { el } = FC;
    const body = el("div", { class: "ll-body" });
    for (const g of groups) {
      body.append(el("div", { class: "ll-ex" }, el("h4", { text: g.name }),
        el("ol", {}, ...g.sets.map((x, i) => el("li", { text: `Satz ${i + 1}${x.side ? (x.side === "L" ? " links" : " rechts") : ""}: ${x.weightKg ? this.kg(x.weightKg) : "Körpergewicht"} × ${x.reps}${x.rpe ? ` · Anstrengung ${FC.de(x.rpe, x.rpe % 1 ? 1 : 0)}` : ""}` })))));
    }
    if (s.notes) body.append(el("p", { class: "muted", text: s.notes }));
    const edit = el("button", { type: "button", class: "primary", text: "Bearbeiten" });
    edit.onclick = () => { this.editId = s.id; this.open.add(s.id); this.draw(); };
    const del = el("button", { type: "button", class: "ll-danger", text: "Löschen" });
    del.onclick = async () => {
      if (!FC.ask(del, `Einheit vom ${FC.fmtDayLong(s.day)} wirklich löschen? Zum Bestätigen nochmal tippen.`)) return;
      del.disabled = true; FC.$("llMsg").textContent = "Lösche …";
      try { await FC.call("delete_strength_session", { id: s.id }); FC.$("llMsg").textContent = "Gelöscht."; await this.refresh(); }
      catch (err) { FC.$("llMsg").textContent = FC.errText(err); del.disabled = false; }
    };
    body.append(el("div", { class: "ll-actions" }, edit, del));
    return body;
  },
  async refresh() { await Promise.all([this.load(true), FC.reload()]); },
  /** Bearbeiten direkt in der Liste: Datum, Name, Dauer, Anstrengung, je Übung Sätze mit kg, Wiederholungen, Anstrengung. */
  editor(s) {
    const { el } = FC;
    const field = (label, attrs, cls) => el("label", cls ? { class: cls } : {}, el("span", { text: label }), el("input", attrs));
    const day = field("Datum", { type: "date", value: s.day, "aria-label": "Datum" });
    const name = field("Name (z. B. Push)", { type: "text", maxlength: 80, value: s.name ?? "" }, "wide");
    const dur = field("Dauer (min)", { type: "number", inputmode: "numeric", min: 1, max: 600, value: s.durationMin ?? "" });
    const rpe = field("Anstrengung 1–10", { type: "number", inputmode: "decimal", min: 1, max: 10, step: 0.5, value: s.rpe ?? "" });
    const unsure = el("label", { class: "row", style: "gap:8px; font-size:.9rem; color:var(--ink-2)" }, el("input", { type: "checkbox" }), el("span", { text: "Wiederholungen nicht verlässlich (zählt nicht für Bestwerte und Belastung)" }));
    unsure.querySelector("input").checked = !!s.repsUnreliable;
    const rows = el("div", { class: "ll-edit" });
    const msg = el("span", { class: "muted", role: "status" });
    const num = (cls, label, attrs, v) => el("label", {}, el("span", { text: label }), el("input", { class: cls, type: "number", inputmode: "decimal", "aria-label": label, value: v ?? "", ...attrs }));
    const renumber = (box) => { let c = 0; box.querySelectorAll(".ll-set").forEach((r) => { const sd = r.dataset.side; if (sd !== "R") c++; r.querySelector(".ll-n").textContent = sd ? `Satz ${c || 1} ${sd}` : `Satz ${c}`; }); };
    const addSet = (box, v = {}) => {
      const sets = box.querySelector(".ll-sets");
      const row = el("div", { class: "ll-set", "data-side": v.side ?? "" }, el("span", { class: "ll-n" }),
        num("kg", "kg", { min: 0, max: 500, step: 0.5 }, v.weightKg),
        num("reps", "Wdh", { min: 1, max: 100, step: 1 }, v.reps),
        num("rpe", "Anstr.", { min: 1, max: 10, step: 0.5, placeholder: "optional" }, v.rpe));
      const x = el("button", { type: "button", text: "×", "aria-label": "Satz entfernen" });
      x.onclick = () => { row.remove(); renumber(box); };
      row.append(x); sets.append(row); renumber(box);
      return row;
    };
    const addEx = (g = { name: "", sets: [{}] }) => {
      const box = el("div", { class: "ll-exbox" });
      if (g.muscles) box.dataset.muscles = JSON.stringify(g.muscles);
      const ex = el("input", { class: "ex", type: "text", list: "llEx", maxlength: 80, placeholder: "Übung", "aria-label": "Übung", value: g.name });
      const rm = el("button", { type: "button", text: "Übung entfernen", class: "ll-danger" });
      rm.onclick = () => box.remove();
      const add = el("button", { type: "button", text: "+ Satz" });
      add.onclick = () => { const last = box.querySelector(".ll-set:last-child"); addSet(box, last ? { weightKg: last.querySelector(".kg").value, reps: last.querySelector(".reps").value } : {}).querySelector(".kg").focus(); };
      box.append(el("div", { class: "ll-exh" }, el("label", {}, el("span", { text: "Übung" }), ex), rm), el("div", { class: "ll-sets" }), add);
      for (const x of g.sets) addSet(box, x);
      rows.append(box);
    };
    for (const g of this.groups(s)) addEx({ name: g.name, muscles: g.muscles, sets: g.sets.map((x) => ({ weightKg: x.weightKg, reps: x.reps, rpe: x.rpe, side: x.side })) });
    const addExBtn = el("button", { type: "button", text: "+ Übung" });
    addExBtn.onclick = () => { addEx(); rows.lastElementChild.querySelector(".ex").focus(); };
    const save = el("button", { type: "button", class: "primary", text: "Speichern" });
    const cancel = el("button", { type: "button", text: "Abbrechen" });
    cancel.onclick = () => { this.editId = null; this.draw(); };
    const n = (v) => (String(v).trim() === "" ? null : Number(String(v).replace(",", ".")));
    save.onclick = async () => {
      const exercises = [];
      for (const box of rows.children) {
        const nm = box.querySelector(".ex").value.trim(); if (!nm) continue;
        const sets = [];
        for (const r of box.querySelectorAll(".ll-set")) {
          const reps = n(r.querySelector(".reps").value), kg = n(r.querySelector(".kg").value), r2 = n(r.querySelector(".rpe").value);
          if (reps == null && kg == null && r2 == null) continue;
          if (!reps || reps < 1 || reps > 100) { msg.textContent = `Bei „${nm}“ fehlen Wiederholungen (1–100) in einem Satz.`; return; }
          if (kg != null && (kg < 0 || kg > 500)) { msg.textContent = `Bei „${nm}“ muss das Gewicht zwischen 0 und 500 kg liegen.`; return; }
          sets.push({ reps: Math.round(reps), weightKg: kg ?? 0, ...(r2 != null ? { rpe: r2 } : {}), ...(r.dataset.side ? { side: r.dataset.side } : {}) });
        }
        if (!sets.length) { msg.textContent = `Bei „${nm}“ fehlt mindestens ein Satz.`; return; }
        const ex = { exercise: nm, sets };
        if (box.dataset.muscles) ex.muscles = JSON.parse(box.dataset.muscles);
        exercises.push(ex);
      }
      if (!exercises.length) { msg.textContent = "Bitte mindestens eine Übung mit einem Satz eintragen."; return; }
      const input = { id: s.id, exercises, day: day.querySelector("input").value || s.day };
      if (s.startTime) input.startTime = s.startTime;
      if (s.notes) input.notes = s.notes;
      const nameV = name.querySelector("input").value.trim(); if (nameV) input.name = nameV;
      const dV = n(dur.querySelector("input").value), rV = n(rpe.querySelector("input").value);
      if (dV != null) input.durationMin = Math.round(dV);
      if (rV != null) input.rpe = rV;
      if (unsure.querySelector("input").checked) input.repsUnreliable = true;
      save.disabled = true; msg.textContent = "Speichere …";
      try {
        await FC.call("log_strength_session", input);
        this.editId = null; FC.$("llMsg").textContent = "Gespeichert."; await this.refresh();
      } catch (err) { msg.textContent = err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err); save.disabled = false; }
    };
    // Abbrechen auch oben, damit man bei langen Einheiten nicht ans Ende scrollen muss.
    const cancelTop = el("button", { type: "button", text: "Abbrechen" });
    cancelTop.onclick = cancel.onclick;
    return el("div", { class: "ll-body" }, el("div", { class: "ll-edit" },
      el("div", { class: "ll-actions", style: "justify-content:space-between;align-items:center" }, el("h3", { text: "Einheit bearbeiten", style: "margin:0;font-size:1rem" }), cancelTop),
      el("div", { class: "ll-meta" }, day, dur, name, rpe), rows, el("div", { class: "ll-actions" }, addExBtn), unsure,
      el("div", { class: "ll-actions" }, save, cancel, msg)));
  },
});
