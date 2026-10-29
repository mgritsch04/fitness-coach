// Krafttraining: schnelle Eingabe (log_strength_session, Vorlagen), Volumen je Muskelgruppe, 1RM-Verlauf je Übung.
// Daten von get_strength (Worker core/strength.ts). 1RM und Belastung sind Schätzungen.
const STRENGTH = {
  id: "strength",
  simple: true,
  tab: "training",
  order: 45,
  css: `
    .st-rows { display: grid; gap: 8px; }
    .st-ex { display: grid; gap: 6px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
    .st-exh { display: grid; grid-template-columns: minmax(0, 2.4fr) minmax(0, 1.6fr) auto auto; gap: 6px; align-items: end; }
    .st-ex label { display: grid; gap: 2px; font-size: 0.78rem; color: var(--ink-3); }
    .st-ex button { padding: 7px 10px; }
    .st-sets { display: grid; gap: 4px; }
    .st-set { display: grid; grid-template-columns: 3.2em repeat(3, minmax(0, 1fr)) auto; gap: 6px; align-items: end; }
    .st-set .st-n { align-self: center; font-size: 0.85rem; color: var(--ink-2); }
    @media (max-width: 560px) { .st-exh { grid-template-columns: repeat(2, minmax(0, 1fr)) auto auto; } .st-exh > label:first-child { grid-column: 1 / -1; } }
    .st-vol { display: grid; gap: 6px; }
    .st-vol .r { display: grid; grid-template-columns: 9.5em minmax(0, 1fr) 3.5em; gap: 8px; align-items: center; font-size: 0.88rem; }
    .st-vol .b { height: 10px; border-radius: 5px; background: var(--accent); min-width: 2px; }
    .st-vol .n { text-align: right; font-variant-numeric: tabular-nums; }
    .pill.progress { background: var(--good-wash); color: var(--good-ink); }
    .pill.plateau { background: var(--warn-wash); color: var(--warn-ink); }
    .pill.decline { background: var(--bad-wash); color: var(--bad-ink); }
    .pill.new, .pill.unknown { background: var(--accent-wash); color: var(--accent); }
    .st-spark { width: 90px; height: 24px; }
    .st-detailbox { padding: 6px 0 10px; display: grid; gap: 6px; }
    .st-detailbox p { margin: 0; }
    .st-tm { display: grid; gap: 10px; }
    .st-tm details { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; }
    .st-tm summary { cursor: pointer; font-weight: 600; }
    .st-tmx { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 6px; align-items: end; padding: 6px 0; border-bottom: 1px solid var(--line); }
    .st-tmx label { display: grid; gap: 2px; font-size: 0.78rem; color: var(--ink-3); }
    .st-tmx button, .st-tm details > .row button { padding: 7px 10px; }
        .st-desc { display: grid; gap: 8px; padding: 8px 0; }
    .st-desc-in { flex: 1 1 14em; min-width: 0; }
    .st-desc-out { display: grid; gap: 6px; }
    .st-desc-out p { margin: 0; }
    .st-desc-pick { text-align: left; }
  `,
  mount(root) {
    const { $, el } = FC;
    FC.state.exerciseDetail = (p) => this.exerciseDetail(p);
    FC.state.describePanel = (onPick) => this.describePanel(onPick);
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-strength">Krafttraining</h2><span class="muted">1RM nach Epley und Belastung aus Dauer × Anstrengung sind Schätzungen</span></div>
      <div class="grid2">
        <form class="panel" id="stForm" style="display:grid; gap:12px;" autocomplete="off">
          <h3>Einheit eintragen</h3>
          <div id="stEditBar" hidden><div class="row" style="gap:8px"><span id="stEditText" class="muted" role="status"></span><button type="button" class="linkish" id="stEditCancel">Abbrechen</button></div></div>
          <div class="form">
            <label for="stDay">Datum<input id="stDay" type="date"></label>
            <label for="stTpl">Vorlage<select id="stTpl"><option value="">– keine –</option></select></label>
            <label for="stRpe">Anstrengung 1–10<input id="stRpe" type="number" min="1" max="10" step="0.5" inputmode="decimal" placeholder="z. B. 8"><span class="hint">für die Trainingslast</span></label>
            <label for="stDurMin">Dauer (min)<input id="stDurMin" type="number" min="1" max="600" step="1" inputmode="numeric" placeholder="aus WHOOP"><span class="hint">leer = vom WHOOP-Training</span></label>
          </div>
          <div class="st-rows" id="stRows"></div>
          <datalist id="stEx"></datalist>
          <div class="row"><button type="button" id="stAdd">+ Übung</button><button type="button" id="stDescBtn" class="linkish" aria-expanded="false">Übung beschreiben</button>
            <label class="row" style="gap:6px; font-size:0.88rem;"><input type="checkbox" id="stSaveTpl"> als Vorlage speichern</label>
            <input id="stTplName" type="text" placeholder="Name der Vorlage" maxlength="80" hidden style="max-width:14em"></div>
          <div id="stDesc" hidden></div>
          <div class="row"><button type="submit" class="primary" id="stSave" disabled>Speichern</button><span id="stMsg" class="muted" role="status"></span></div>
        </form>
        <div class="panel"><h3>Volumen je Muskelgruppe</h3><p class="muted" id="stVolWeek" style="margin:0 0 8px"></p><div class="st-vol" id="stVol"><div class="empty">Noch keine Krafteinheiten.</div></div>
          <p class="chart-cap">Arbeitssätze diese Woche: Hauptmuskel zählt einen Satz, Hilfsmuskel einen halben.</p></div>
        <div class="panel span2"><h3>Fortschritt je Übung</h3><p id="stDeload" hidden style="margin:0 0 8px"></p><div class="tablewrap"><table id="stProg" class="cards"><thead><tr>
          <th class="l">Übung</th><th>Einheiten</th><th>Letzter Top-Satz</th><th>Geschätztes 1RM</th><th>4 Wochen</th><th>Verlauf</th><th>Status</th>
        </tr></thead><tbody><tr><td colspan="7" class="empty">Noch keine Daten.</td></tr></tbody></table></div></div>
        <div class="panel span2"><h3>Vorlagen verwalten</h3><p class="muted" style="margin:0 0 8px">Name und Übungen ändern oder eine Vorlage löschen. Sätze, Wiederholungen und Gewicht kommen im Gym-Modus automatisch vom letzten Mal, als du die Übung gemacht hast. Änderungen gelten sofort.</p><div id="stTplMgr"><div class="empty">Noch keine Vorlagen.</div></div></div>
        <div class="panel span2"><h3>Letzte Einheiten</h3><div id="stSessions"><div class="empty">Noch keine Krafteinheiten.</div></div><p class="chart-cap" id="stNotes"></p></div>
      </div>`;

    const NAMES = ["Kniebeuge", "Frontkniebeuge", "Beinpresse", "Ausfallschritt", "Beinstrecker", "Beinbeuger", "Kreuzheben", "Rumänisches Kreuzheben", "Hip Thrust", "Wadenheben", "Bankdrücken", "Schrägbankdrücken", "Kurzhantel-Bankdrücken", "Fliegende", "Dips", "Liegestütz", "Schulterdrücken", "Seitheben", "Face Pull", "Klimmzug", "Latziehen", "Langhantelrudern", "Kurzhantelrudern", "Rudern am Kabel", "Bizepscurl", "Trizepsdrücken", "Unterarmstütz", "Crunch", "Beinheben hängend", "Kettlebell Swing"];
    for (const n of NAMES) $("stEx").append(el("option", { value: n }));

    // Je Übung beliebig viele Sätze mit eigenem Gewicht, Wiederholungen und optionaler Anstrengung (#344).
    const numIn = (cls, label, attrs) => el("label", {}, el("span", { text: label }), el("input", { class: cls, type: "number", inputmode: "decimal", ...attrs }));
    const renumber = (box) => { let c = 0; box.querySelectorAll(".st-set").forEach((r) => { const sd = r.dataset.side; if (sd !== "R") c++; r.querySelector(".st-n").textContent = sd ? `Satz ${c || 1} ${sd}` : `Satz ${c}`; }); };
    const addSet = (box, v = {}) => {
      const list = box.querySelector(".st-sets"), prev = list.lastElementChild;
      const row = el("div", { class: "st-set", "data-side": v.side ?? "" }, el("span", { class: "st-n" }),
        numIn("kg", "kg", { min: 0, max: 500, step: 0.5, placeholder: "kg", "aria-label": "Gewicht in kg" }),
        numIn("reps", "Wdh", { min: 1, max: 100, step: 1, placeholder: "Wdh", "aria-label": "Wiederholungen" }),
        numIn("rpe", "Anstr.", { min: 1, max: 10, step: 0.5, placeholder: "optional", "aria-label": "Anstrengung 1 bis 10 (optional)" }));
      const del = el("button", { type: "button", text: "×", "aria-label": "Satz entfernen" });
      del.onclick = () => { if (list.children.length > 1) { row.remove(); renumber(box); } else { row.querySelectorAll("input").forEach((i) => { i.value = ""; }); } };
      row.append(del);
      // Vorbelegung: Werte aus v, sonst vom vorherigen Satz.
      const src = v.reps != null || v.weightKg != null ? v : prev ? { weightKg: prev.querySelector(".kg").value, reps: prev.querySelector(".reps").value } : {};
      if (src.weightKg != null && src.weightKg !== "") row.querySelector(".kg").value = src.weightKg;
      if (src.reps != null && src.reps !== "") row.querySelector(".reps").value = src.reps;
      if (v.rpe != null) row.querySelector(".rpe").value = v.rpe;
      list.append(row); renumber(box);
      return row;
    };
    // Schnelleingabe „3 × 60 kg × 10“ (Sätze × kg × Wdh) füllt gleiche Sätze vor; danach je Satz änderbar.
    const quickFill = (box, text) => {
      const nums = (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(",", ".")));
      if (nums.length < 2) return "Bitte so eingeben: 3 × 60 kg × 10 (Sätze × Gewicht × Wiederholungen).";
      const [count, kg, reps] = nums.length === 2 ? [nums[0], 0, nums[1]] : nums;
      if (!Number.isInteger(count) || count < 1 || count > 20 || !Number.isInteger(reps) || reps < 1 || reps > 100) return "Sätze (1–20) und Wiederholungen (1–100) müssen ganze Zahlen sein.";
      const list = box.querySelector(".st-sets"); list.replaceChildren();
      for (let i = 0; i < count; i++) addSet(box, { weightKg: kg, reps });
      return "";
    };
    const addRow = (v = {}) => {
      const sets = Array.isArray(v.sets) ? v.sets : v.sets ? Array.from({ length: v.sets }, () => ({ reps: v.reps, weightKg: v.weightKg })) : [{ reps: v.reps, weightKg: v.weightKg }];
      const quick = el("input", { class: "quick", type: "text", maxlength: 30, placeholder: "z. B. 3 × 60 kg × 10", "aria-label": "Schnelleingabe Sätze mal Gewicht mal Wiederholungen" });
      const fill = el("button", { type: "button", text: "Füllen", "aria-label": "Sätze aus Schnelleingabe vorbelegen" });
      const del = el("button", { type: "button", text: "×", "aria-label": "Übung entfernen" });
      const box = el("div", { class: "st-ex" },
        el("div", { class: "st-exh" },
          el("label", {}, el("span", { text: "Übung" }), el("input", { class: "ex", type: "text", list: "stEx", maxlength: 80, placeholder: "Übung", "aria-label": "Übung" })),
          el("label", {}, el("span", { text: "Schnelleingabe" }), quick), fill, del),
        el("div", { class: "st-sets" }),
        el("div", { class: "row" }, el("button", { type: "button", class: "st-addset", text: "+ Satz" })));
      del.onclick = () => { box.remove(); if (!$("stRows").children.length) addRow(); };
      fill.onclick = () => { const err = quickFill(box, quick.value); $("stMsg").textContent = err; if (!err) quick.value = ""; };
      quick.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); fill.click(); } };
      box.querySelector(".st-addset").onclick = () => addSet(box).querySelector(".kg").focus();
      box.querySelector(".ex").value = v.name ?? "";
      if (v.muscles) box.dataset.muscles = JSON.stringify(v.muscles);
      for (const x of sets) addSet(box, x);
      $("stRows").append(box);
    };
    const resetRows = (list) => { $("stRows").replaceChildren(); (list?.length ? list : [{}, {}, {}]).forEach(addRow); };
    resetRows();
    $("stAdd").onclick = () => addRow();
    // Übung beschreiben (#327): Vorschlag füllt die erste leere Zeile.
    $("stDescBtn").onclick = () => {
      const box = $("stDesc"), open = box.hidden;
      box.hidden = !open; $("stDescBtn").setAttribute("aria-expanded", String(open));
      if (!open) return;
      box.replaceChildren(this.describePanel((name) => {
        const empty = [...$("stRows").querySelectorAll(".ex")].find((i) => !i.value.trim());
        if (empty) empty.value = name; else addRow({ name });
        box.hidden = true; $("stDescBtn").setAttribute("aria-expanded", "false");
        $("stMsg").textContent = `„${name}“ übernommen.`;
      }));
      box.querySelector("input")?.focus();
    };
    $("stSaveTpl").onchange = (e) => { $("stTplName").hidden = !e.target.checked; if (e.target.checked) $("stTplName").focus(); };

    $("stTpl").onchange = async (e) => {
      const name = e.target.value; if (!name) return;
      const msg = $("stMsg"); msg.textContent = "Hole Vorschlag …";
      try {
        const s = await FC.call("suggest_strength_session", { template: name });
        // Sätze, Wdh. und Gewicht wie beim letzten Mal dieser Übung (#399); ohne Vorgeschichte die Werte der Vorlage.
        resetRows(s.exercises.map((x) => (x.lastSets?.length ? { ...x, sets: x.lastSets } : x)));
        msg.textContent = "Sätze, Wiederholungen und Gewicht wie beim letzten Mal übernommen.";
        if (s.coachNotes?.some((n) => n.effect === "down")) msg.textContent += " " + s.coachNotes.find((n) => n.effect === "down").text;
      } catch (err) { msg.textContent = FC.errText(err); }
    };

    // Bestehende Einheit bearbeiten (#344): Formular mit den Sätzen füllen, Speichern ersetzt die Einheit (id).
    let editing = null;
    const stopEdit = () => { editing = null; $("stEditBar").hidden = true; };
    const startEdit = (s) => {
      editing = s;
      const by = new Map();
      for (const x of s.sets) { if (!by.has(x.exercise)) by.set(x.exercise, { name: x.exerciseName, muscles: x.muscles, sets: [] }); by.get(x.exercise).sets.push({ reps: x.reps, weightKg: x.weightKg, rpe: x.rpe, side: x.side }); }
      resetRows([...by.values()]);
      $("stDay").value = s.day; $("stRpe").value = s.rpe ?? ""; $("stDurMin").value = s.durationMin ?? ""; $("stTpl").value = "";
      $("stEditText").textContent = `Du bearbeitest die Einheit vom ${FC.fmtDayLong(s.day)}${s.name ? ` · ${s.name}` : ""}. Speichern ersetzt sie.`;
      $("stEditBar").hidden = false; $("stMsg").textContent = "";
      $("stForm").scrollIntoView({ block: "start" }); $("stRows").querySelector(".ex")?.focus();
    };
    $("stEditCancel").onclick = () => { stopEdit(); resetRows(); $("stRpe").value = ""; $("stDurMin").value = ""; $("stDay").value = data?.today ?? ""; $("stMsg").textContent = "Bearbeiten abgebrochen."; };
    $("stForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("stMsg");
      const n = (v) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
      const exercises = [];
      for (const r of $("stRows").children) {
        const name = r.querySelector(".ex").value.trim();
        if (!name) continue;
        const sets = [];
        for (const sr of r.querySelectorAll(".st-set")) {
          const reps = n(sr.querySelector(".reps").value), kg = n(sr.querySelector(".kg").value), rpe = n(sr.querySelector(".rpe").value);
          if (reps == null && kg == null && rpe == null) continue;
          if (!reps || reps < 1) { msg.textContent = `Bei „${name}“ fehlen Wiederholungen in einem Satz.`; return; }
          sets.push({ reps: Math.round(reps), weightKg: kg ?? 0, ...(rpe != null ? { rpe } : {}), ...(sr.dataset.side ? { side: sr.dataset.side } : {}) });
        }
        if (!sets.length) { msg.textContent = `Bei „${name}“ fehlt mindestens ein Satz.`; return; }
        const ex = { exercise: name, sets };
        if (r.dataset.muscles) ex.muscles = JSON.parse(r.dataset.muscles);
        exercises.push(ex);
      }
      if (!exercises.length) { msg.textContent = "Bitte mindestens eine Übung eintragen."; return; }
      const input = { exercises };
      if (editing) { input.id = editing.id; if (editing.startTime) input.startTime = editing.startTime; if (editing.notes) input.notes = editing.notes; if (editing.name) input.name = editing.name; }
      if ($("stDay").value) input.day = $("stDay").value;
      const rpe = n($("stRpe").value), dur = n($("stDurMin").value);
      if (rpe != null) input.rpe = rpe;
      if (dur != null) input.durationMin = Math.round(dur);
      if ($("stTpl").value && !editing) input.name = $("stTpl").value;
      const tplName = $("stSaveTpl").checked ? $("stTplName").value.trim() : "";
      if ($("stSaveTpl").checked && !tplName) { msg.textContent = "Bitte einen Namen für die Vorlage eingeben."; return; }
      $("stSave").disabled = true; msg.textContent = "Speichere …";
      try {
        const r = await FC.call("log_strength_session", input);
        if (tplName) await FC.call("save_strength_template", { name: tplName, exercises: exercises.map((x) => { const top = x.sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a)); return { exercise: x.exercise, sets: Math.min(20, x.sets.length), reps: top.reps, weightKg: top.weightKg }; }) });
        const best = r.exercises.filter((x) => x.newBest).map((x) => x.name);
        const parts = ["Gespeichert."];
        if (r.linkedWorkout) parts.push(`Zugeordnet zum WHOOP-Training (${r.linkedWorkout.durationMin} min).`);
        if (r.load?.value != null) parts.push(`Belastung ≈ ${FC.de(r.load.value)} (Schätzung).`); else parts.push(r.load?.note ?? "");
        if (best.length) parts.push(`Neue Bestwerte: ${best.join(", ")}.`);
        msg.textContent = parts.filter(Boolean).join(" ");
        stopEdit(); resetRows(); $("stRpe").value = ""; $("stDurMin").value = ""; $("stTpl").value = ""; $("stSaveTpl").checked = false; $("stTplName").hidden = true; $("stTplName").value = "";
        await Promise.all([load(true), FC.reload()]);
      } catch (err) { msg.textContent = err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err); }
      finally { $("stSave").disabled = false; }
    });

    let data = null;
    const openEx = new Set();
    // Offene Vorlagen-Formulare je Einheit (#332): überleben das Neuzeichnen samt eingetipptem Namen und Fokus.
    const openTpl = new Map();
    const show = () => {
      if (!data) return;
      const { de, fmtDay, fmtDayLong, spark, cssVar } = FC;
      $("stSave").disabled = false;
      if (!$("stDay").value) $("stDay").value = data.today;
      const sel = $("stTpl"), cur = sel.value;
      sel.replaceChildren(el("option", { value: "", text: "– keine –" }), ...data.templates.map((t) => el("option", { value: t.name, text: t.name })));
      sel.value = data.templates.some((t) => t.name === cur) ? cur : "";

      this.tplData = data.templates;
      this.drawTemplates(data.templates);

      const week = data.weeks[0];
      const vol = $("stVol"); vol.replaceChildren();
      const thisWeek = week && FC.addDays(week.week, 6) >= data.today ? week : null;
      $("stVolWeek").textContent = thisWeek ? `Woche ab ${fmtDay(thisWeek.week)}: ${thisWeek.sessions} Einheit${thisWeek.sessions > 1 ? "en" : ""}, ${de(thisWeek.tonnageKg)} kg bewegt` : "Diese Woche noch keine Krafteinheit.";
      const muscles = thisWeek?.muscles ?? [];
      const max = Math.max(1, ...muscles.map((m) => m.sets));
      if (!muscles.length) vol.append(el("div", { class: "empty", text: "Noch keine Sätze diese Woche." }));
      for (const m of muscles) {
        const bar = el("div", { class: "b" }); bar.style.width = `${(m.sets / max) * 100}%`;
        vol.append(el("div", { class: "r" }, el("span", { text: m.label }), el("div", {}, bar), el("span", { class: "n", text: de(m.sets, m.sets % 1 ? 1 : 0) })));
      }

      // Plateau und Entlastungswoche (#202): Hinweis nur bei deload/watch.
      const dl = data.deload, dlBox = $("stDeload");
      dlBox.hidden = !dl || !["deload", "watch"].includes(dl.verdict);
      if (!dlBox.hidden) dlBox.replaceChildren(el("strong", { text: dl.verdict === "deload" ? "Entlastungswoche empfohlen. " : "Plateau beobachten. " }), `${dl.text}${dl.suggestion ? ` ${dl.suggestion.text}` : ""}`);
      const STATUS = { progress: "Fortschritt", plateau: "Plateau", decline: "Rückgang", new: "neu", unknown: "–" };
      const tb = $("stProg").tBodies[0]; tb.replaceChildren();
      if (!data.progress.length) tb.append(el("tr", {}, el("td", { colspan: 7, class: "empty", text: "Noch keine Daten." })));
      for (const p of data.progress) {
        const last = p.history.at(-1);
        const sp = spark(p.history.slice(-12).map((h) => h.e1rmKg), cssVar("--accent")); sp.classList.add("st-spark");
        // Verlauf und Prognose je Übung (#328): Antippen öffnet das Diagramm unter der Zeile.
        const nameBtn = el("button", { type: "button", class: "linkish", text: p.name, "aria-expanded": "false", "aria-label": `Verlauf und Prognose für ${p.name}` });
        // Offene Übungen bleiben beim Neuzeichnen offen.
        const openDetail = (tr) => {
          tr.after(el("tr", { class: "st-detail" }, el("td", { colspan: 7, class: "l" }, FC.state.exerciseDetail(p))));
          nameBtn.setAttribute("aria-expanded", "true");
        };
        nameBtn.onclick = () => {
          const tr = nameBtn.closest("tr");
          if (tr.nextElementSibling?.classList.contains("st-detail")) { tr.nextElementSibling.remove(); nameBtn.setAttribute("aria-expanded", "false"); openEx.delete(p.exercise); return; }
          openEx.add(p.exercise); openDetail(tr);
        };
        const row = el("tr", {},
          el("td", {}, nameBtn),
          el("td", { "data-k": "Einheiten", text: de(p.sessions) }),
          el("td", { "data-k": "Letzter Top-Satz", text: last ? `${last.topSet.reps} × ${de(last.topSet.weightKg, last.topSet.weightKg % 1 ? 1 : 0)} kg (${fmtDay(last.day)})` : "–" }),
          el("td", { "data-k": "Geschätztes 1RM", text: p.bestE1rmKg == null ? "–" : `${de(p.bestE1rmKg, 1)} kg` }),
          el("td", { "data-k": "4 Wochen", text: p.change4wPct == null ? "–" : `${p.change4wPct > 0 ? "+" : ""}${de(p.change4wPct, 1)} %` }),
          el("td", { "data-k": "Verlauf" }, sp),
          el("td", { "data-k": "Status" }, el("span", { class: `pill ${p.status}`, text: STATUS[p.status] })));
        tb.append(row);
        if (openEx.has(p.exercise)) openDetail(row);
      }

      const list = $("stSessions"), focused = list.contains(document.activeElement) ? document.activeElement : null;
      list.replaceChildren();
      const sessions = data.sessions.slice(0, 8);
      if (!sessions.length) list.append(el("div", { class: "empty", text: "Noch keine Krafteinheiten." }));
      for (const s of sessions) {
        const ex = [...new Map(s.sets.map((x) => [x.exercise, x])).values()].map((x) => {
          const sets = s.sets.filter((y) => y.exercise === x.exercise);
          const top = sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a));
          return `${x.exerciseName} ${sets.length}×${top.reps}${top.weightKg ? ` @ ${de(top.weightKg, top.weightKg % 1 ? 1 : 0)} kg` : ""}`;
        });
        const meta = [s.durationMin ? `${de(s.durationMin)} min` : null, s.rpe ? `Anstrengung ${de(s.rpe, s.rpe % 1 ? 1 : 0)}` : null, s.load != null ? `Belastung ${de(s.load)}` : null].filter(Boolean).join(" · ");
        const tplBtn = el("button", { type: "button", class: "linkish", text: "Als Vorlage speichern", "aria-expanded": "false" });
        const editBtn = el("button", { type: "button", class: "linkish", text: "Bearbeiten" });
        editBtn.onclick = () => startEdit(s);
        const row = el("div", { class: "row", style: "justify-content:space-between; flex-wrap:wrap; padding:6px 0; border-bottom:1px solid var(--line)" },
          el("div", {}, el("b", { text: `${fmtDayLong(s.day)}${s.name ? ` · ${s.name}` : ""}` }), el("div", { class: "muted", text: ex.join(", ") })),
          el("span", { class: "muted" }, meta, meta ? " · " : "", editBtn, " · ", tplBtn));
        const openForm = (box) => { row.after(box); tplBtn.setAttribute("aria-expanded", "true"); };
        tplBtn.onclick = () => {
          if (openTpl.has(s.id)) { openTpl.get(s.id).remove(); openTpl.delete(s.id); tplBtn.setAttribute("aria-expanded", "false"); return; }
          const box = this.tplForm(s, () => { openTpl.delete(s.id); tplBtn.setAttribute("aria-expanded", "false"); });
          openTpl.set(s.id, box); openForm(box); box.querySelector("input")?.focus();
        };
        list.append(row);
        if (openTpl.has(s.id)) openForm(openTpl.get(s.id));
      }
      for (const id of openTpl.keys()) if (!sessions.some((x) => x.id === id)) openTpl.delete(id);
      if (focused && list.contains(focused)) focused.focus();
      $("stNotes").textContent = (data.coachNotes ?? []).map((n) => n.text).join(" ");
    };

    const load = async (fresh) => {
      try { data = await FC.call("get_strength", { weeks: 12 }, fresh ? { cache: false } : { cache: { staleTime: 60_000, gcTime: 86_400_000 } });
        // Eigene Übungen in die Auswahl (#399)
        const have = new Set([...$("stEx").children].map((o) => o.value.toLowerCase()));
        for (const p of data.progress ?? []) if (!have.has(p.name.toLowerCase())) $("stEx").append(el("option", { value: p.name }));
        show(); }
      catch (err) { $("stMsg").textContent = FC.errText(err); }
    };
    this.load = load;
    this.show = show;
  },
  /** Übung in eigenen Worten beschreiben (#327): bis zu 3 Vorschläge aus dem Katalog oder eine eigene Übung. */
  describePanel(onPick) {
    const { el } = FC;
    const txt = el("input", { type: "text", maxlength: 300, class: "st-desc-in", placeholder: "z. B. am Kabel sitzend von oben zur Brust ziehen", "aria-label": "Übung beschreiben: Gerät, Bewegung, Muskel" });
    const go = el("button", { type: "button", text: "Vorschlagen" });
    const out = el("div", { class: "st-desc-out", role: "status" });
    const run = async () => {
      const text = txt.value.trim();
      if (text.length < 3) { out.replaceChildren(el("span", { class: "muted", text: "Bitte kurz beschreiben: Gerät, Bewegung, Muskel." })); return; }
      go.disabled = true; out.replaceChildren(el("span", { class: "muted", text: "Suche …" }));
      try {
        const r = await FC.call("describe_exercise", { text });
        const picks = r.suggestions.map((s) => {
          const b = el("button", { type: "button", class: "st-desc-pick" }, el("b", { text: s.name }), el("span", { class: "muted", text: ` · ${s.muscles.join(", ")}` }));
          b.onclick = () => onPick(s.name);
          return b;
        });
        const own = el("input", { type: "text", maxlength: 80, "aria-label": "Name der eigenen Übung" }); own.value = r.custom?.name ?? "";
        const ownB = el("button", { type: "button", class: "linkish", text: "Als eigene Übung anlegen" });
        ownB.onclick = () => { const n = own.value.trim(); if (n) onPick(n); else own.focus(); };
        out.replaceChildren(...picks, el("p", { class: "fine muted", text: r.note }), el("div", { class: "row", style: "gap:6px" }, own, ownB));
      } catch (err) { out.replaceChildren(el("span", { class: "muted", text: FC.errText(err) })); }
      finally { go.disabled = false; }
    };
    go.onclick = run;
    txt.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); run(); } };
    return el("div", { class: "st-desc" }, el("div", { class: "row", style: "gap:6px" }, txt, go), out);
  },
  /** Diagramm geschätztes 1RM je Einheit plus gestrichelte Prognose und Text (#328); nutzt auch der Gym-Modus. */
  exerciseDetail(p) {
    const { el, de, cssVar, fmtDayLong } = FC, f = p.forecast;
    const box = el("div", { class: "chart st-chart" });
    const fc = f?.available ? f.points : [];
    const last = p.history.at(-1);
    const days = [...p.history.map((h) => ({ day: h.day, e1: h.e1rmKg, top: h.topSet, fc: h === last && fc.length ? h.e1rmKg : null })), ...fc.map((x) => ({ day: x.day, e1: null, top: null, fc: x.e1rmKg }))];
    const kg = (v) => `${de(v, v % 1 ? 1 : 0)} kg`;
    const wrap = el("div", { class: "st-detailbox" }, box,
      el("p", { class: "chart-cap", text: f ? f.text : "Noch keine Prognose verfügbar." }),
      el("p", { class: "fine muted", text: `${p.sessions} ${p.sessions === 1 ? "Einheit" : "Einheiten"}. Linie: bestes geschätztes Maximum (1RM nach Epley) je Einheit${fc.length ? ", gestrichelt: Prognose (Schätzung)" : ""}.` }));
    requestAnimationFrame(() => FC.chart(box, {
      days,
      series: [
        { label: "Geschätztes 1RM", color: cssVar("--accent"), kind: "line", dots: true, value: (x) => x.e1, fmt: kg },
        ...(fc.length ? [{ label: "Prognose (Schätzung)", color: cssVar("--ink-3"), kind: "line", dash: "5 4", value: (x) => x.fc, fmt: kg }] : []),
      ],
      tipTitle: (x) => `${fmtDayLong(x.day)}${x.top ? ` · ${x.top.reps} × ${kg(x.top.weightKg)}` : x.e1 == null ? " · Prognose" : ""}`,
      height: 170,
      aria: `Verlauf des geschätzten Maximums für ${p.name}${fc.length ? " mit Prognose" : ""}`,
    }));
    return wrap;
  },
  /** Vorlagen verwalten (#333): umbenennen, Übungen ändern/umsortieren, löschen (nur Übungsliste, #399). */
  drawTemplates(templates) {
    const { $, el } = FC, host = $("stTplMgr");
    if (!host) return;
    const openNames = new Set([...host.querySelectorAll("details[open]")].map((d) => d.dataset.name).concat([...(this.tplKeep ?? [])]));
    this.tplKeep = new Set();
    if (!templates.length) { host.replaceChildren(el("div", { class: "empty", text: "Noch keine Vorlagen." })); return; }
    const exRow = (list, e) => {
      const name = el("input", { class: "ex", type: "text", list: "stEx", maxlength: 80, "aria-label": "Übung" });
      name.value = e.name ?? e.exercise ?? "";
      // Vorlage = nur Übungsliste (#399): Sätze, Wdh. und kg kommen im Gym-Modus vom letzten Mal; hier bleiben sie unsichtbar erhalten (Rückfallwerte).
      const row = el("div", { class: "st-tmx", "data-key": e.exercise ?? "", "data-name": e.name ?? "", "data-sets": e.sets ?? 3, "data-reps": e.reps ?? 8, "data-kg": e.weightKg ?? 0 },
        el("label", {}, el("span", { text: "Übung" }), name));
      const up = el("button", { type: "button", text: "↑", "aria-label": "Übung nach oben" }), down = el("button", { type: "button", text: "↓", "aria-label": "Übung nach unten" }), del = el("button", { type: "button", text: "×", "aria-label": "Übung entfernen" });
      up.onclick = () => { if (row.previousElementSibling) row.previousElementSibling.before(row); };
      down.onclick = () => { if (row.nextElementSibling) row.nextElementSibling.after(row); };
      del.onclick = () => row.remove();
      row.append(up, down, del); list.append(row);
    };
    const card = (t) => {
      const det = el("details", { "data-name": t.name }), list = el("div", { class: "st-tmlist" });
      det.open = openNames.has(t.name);
      det.append(el("summary", { text: `${t.name} · ${t.exercises.length} Übung${t.exercises.length === 1 ? "" : "en"}` }));
      const nm = el("input", { type: "text", maxlength: 80, "aria-label": "Name der Vorlage" }); nm.value = t.name;
      det.append(el("label", { class: "st-tmname", style: "display:grid;gap:2px;font-size:0.78rem;color:var(--ink-3);margin-top:8px" }, el("span", { text: "Name" }), nm), list);
      t.exercises.forEach((e) => exRow(list, e));
      const add = el("button", { type: "button", text: "+ Übung" }), save = el("button", { type: "button", class: "primary", text: "Speichern" }), rm = el("button", { type: "button", text: "Vorlage löschen" });
      const out = el("span", { class: "muted", role: "status" });
      add.onclick = () => exRow(list, {});
      save.onclick = async () => {
        const n = nm.value.trim(), exercises = [];
        if (!n) { out.textContent = "Bitte einen Namen eingeben."; nm.focus(); return; }
        if (n !== t.name && (this.tplData ?? templates).some((x) => x.name.toLowerCase() === n.toLowerCase())) { out.textContent = `Es gibt schon eine Vorlage „${n}“.`; return; }
        for (const r of list.children) {
          const name = r.querySelector(".ex").value.trim(), sets = Number(r.dataset.sets) || 3, reps = Number(r.dataset.reps) || 8, kg = Number(r.dataset.kg || 0);
          if (!name) continue;
          // Unveränderter Name behält den gespeicherten Schlüssel.
          exercises.push({ exercise: r.dataset.key && name === r.dataset.name ? r.dataset.key : name, sets, reps, weightKg: kg });
        }
        if (!exercises.length) { out.textContent = "Mindestens eine Übung nötig (sonst die Vorlage löschen)."; return; }
        save.disabled = true; out.textContent = "Speichere …";
        try {
          await FC.call("save_strength_template", { name: n, exercises });
          if (n !== t.name) await FC.call("save_strength_template", { name: t.name, delete: true });
          await FC.state.mcp?.invalidate(FC.SERVER, "get_strength").catch(() => {});
          out.textContent = `Vorlage „${n}“ gespeichert.`;
          this.tplKeep = new Set([n]); await this.load?.(true);
        } catch (err) { out.textContent = FC.errText(err); save.disabled = false; }
      };
      rm.onclick = async () => {
        if (!window.confirm(`Vorlage „${t.name}“ wirklich löschen?`)) return;
        rm.disabled = true; out.textContent = "Lösche …";
        try {
          await FC.call("save_strength_template", { name: t.name, delete: true });
          await FC.state.mcp?.invalidate(FC.SERVER, "get_strength").catch(() => {});
          await this.load?.(true);
        } catch (err) { out.textContent = FC.errText(err); rm.disabled = false; }
      };
      det.append(el("div", { class: "row", style: "margin-top:8px" }, add, save, rm, out));
      return det;
    };
    host.replaceChildren(el("div", { class: "st-tm" }, ...templates.map(card)));
  },
  /** Vorlage aus einer gespeicherten Einheit (#319): je Übung Satzzahl und bester Satz (schwerster). */
  templateFrom(session) {
    const by = new Map();
    for (const x of session.sets) { if (!by.has(x.exercise)) by.set(x.exercise, []); by.get(x.exercise).push(x); }
    return [...by.entries()].map(([exercise, sets]) => {
      const top = sets.reduce((a, b) => (b.weightKg > a.weightKg ? b : a));
      return { exercise, sets: Math.min(20, sets.length), reps: Math.min(100, Math.max(1, Math.round(top.reps))), weightKg: top.weightKg ?? 0 };
    });
  },
  tplForm(session, closed) {
    const { el } = FC;
    const name = el("input", { type: "text", maxlength: 80, placeholder: "Name der Vorlage", "aria-label": "Name der Vorlage" });
    name.value = session.name ?? "";
    const out = el("span", { class: "muted", role: "status" });
    const ok = el("button", { type: "button", class: "primary", text: "Speichern" });
    const box = el("div", { class: "row st-tplrow", style: "gap:8px; padding:6px 0; border-bottom:1px solid var(--line)" }, name, ok, out);
    ok.onclick = async () => {
      const n = name.value.trim();
      if (!n) { out.textContent = "Bitte einen Namen eingeben."; name.focus(); return; }
      ok.disabled = true; out.textContent = "Speichere …";
      try {
        await FC.call("save_strength_template", { name: n, exercises: this.templateFrom(session) });
        out.textContent = `Vorlage „${n}“ gespeichert.`;
        await FC.state.mcp?.invalidate(FC.SERVER, "get_strength").catch(() => {});
        setTimeout(() => { box.remove(); closed?.(); this.load?.(true); }, 1500);
      } catch (err) { out.textContent = FC.errText(err); ok.disabled = false; }
    };
    return box;
  },
  ready() { this.load?.(false); },
  render() { this.show?.(); },
};
FC.section(STRENGTH);
// Vorlage aus einer Einheit (#331) auch für andere Abschnitte (Workout-Übersicht), unabhängig davon, ob Krafttraining sichtbar ist.
FC.state.tplForm = (session, closed) => STRENGTH.tplForm(session, closed);
