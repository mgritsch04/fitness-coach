// Krafttraining: schnelle Eingabe (log_strength_session, Vorlagen), Volumen je Muskelgruppe, 1RM-Verlauf je Übung.
// Daten von get_strength (Worker core/strength.ts). 1RM und Belastung sind Schätzungen.
FC.section({
  id: "strength",
  tab: "training",
  order: 45,
  css: `
    .st-rows { display: grid; gap: 8px; }
    .st-row { display: grid; grid-template-columns: minmax(0, 2.4fr) repeat(3, minmax(0, 1fr)) auto; gap: 6px; align-items: end; }
    .st-row label { display: grid; gap: 2px; font-size: 0.78rem; color: var(--ink-3); }
    .st-row button { padding: 7px 10px; }
    @media (max-width: 560px) { .st-row { grid-template-columns: repeat(3, minmax(0, 1fr)) auto; padding-bottom: 8px; border-bottom: 1px solid var(--line); } .st-row > label:first-child { grid-column: 1 / -1; } }
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
          <div class="form">
            <label for="stDay">Datum<input id="stDay" type="date"></label>
            <label for="stTpl">Vorlage<select id="stTpl"><option value="">– keine –</option></select></label>
            <label for="stRpe">Anstrengung 1–10<input id="stRpe" type="number" min="1" max="10" step="0.5" inputmode="decimal" placeholder="z. B. 8"><span class="hint">für die Trainingslast</span></label>
            <label for="stDur">Dauer (min)<input id="stDur" type="number" min="1" max="600" step="1" inputmode="numeric" placeholder="aus WHOOP"><span class="hint">leer = vom WHOOP-Training</span></label>
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
        <div class="panel span2"><h3>Kraft pro kg Körpergewicht</h3><p id="stStdText" class="muted" style="margin:0 0 8px"></p><div class="tablewrap"><table id="stStd" class="cards"><thead><tr>
          <th class="l">Übung</th><th>Geschätztes 1RM</th><th>Pro kg</th><th>Stufe</th><th>Nächste Stufe</th>
        </tr></thead><tbody></tbody></table></div><p class="chart-cap" id="stStdNote"></p></div>
        <div class="panel span2"><h3>Letzte Einheiten</h3><div id="stSessions"><div class="empty">Noch keine Krafteinheiten.</div></div><p class="chart-cap" id="stNotes"></p></div>
      </div>`;

    const NAMES = ["Kniebeuge", "Frontkniebeuge", "Beinpresse", "Ausfallschritt", "Beinstrecker", "Beinbeuger", "Kreuzheben", "Rumänisches Kreuzheben", "Hip Thrust", "Wadenheben", "Bankdrücken", "Schrägbankdrücken", "Kurzhantel-Bankdrücken", "Fliegende", "Dips", "Liegestütz", "Schulterdrücken", "Seitheben", "Face Pull", "Klimmzug", "Latziehen", "Langhantelrudern", "Kurzhantelrudern", "Rudern am Kabel", "Bizepscurl", "Trizepsdrücken", "Unterarmstütz", "Crunch", "Beinheben hängend", "Kettlebell Swing"];
    for (const n of NAMES) $("stEx").append(el("option", { value: n }));

    const addRow = (v = {}) => {
      const num = (cls, label, attrs) => el("label", {}, el("span", { text: label }), el("input", { class: cls, type: "number", inputmode: "decimal", ...attrs }));
      const row = el("div", { class: "st-row" },
        el("label", {}, el("span", { text: "Übung" }), el("input", { class: "ex", type: "text", list: "stEx", maxlength: 80, placeholder: "Übung", "aria-label": "Übung" })),
        num("sets", "Sätze", { min: 1, max: 20, step: 1, placeholder: "Sätze", "aria-label": "Sätze" }),
        num("reps", "Wdh", { min: 1, max: 100, step: 1, placeholder: "Wdh", "aria-label": "Wiederholungen" }),
        num("kg", "kg", { min: 0, max: 500, step: 0.5, placeholder: "kg", "aria-label": "Gewicht in kg" }));
      const del = el("button", { type: "button", text: "×", "aria-label": "Übung entfernen" });
      del.onclick = () => { row.remove(); if (!$("stRows").children.length) addRow(); };
      row.append(del);
      row.querySelector(".ex").value = v.name ?? "";
      if (v.sets) row.querySelector(".sets").value = v.sets;
      if (v.reps) row.querySelector(".reps").value = v.reps;
      if (v.weightKg != null) row.querySelector(".kg").value = v.weightKg;
      $("stRows").append(row);
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
        resetRows(s.exercises);
        const up = s.exercises.filter((x) => x.basis === "increase").length;
        msg.textContent = up ? `Vorschlag: bei ${up} Übung${up > 1 ? "en" : ""} etwas mehr Gewicht als letztes Mal.` : "Vorschlag aus der Vorlage übernommen.";
        if (s.coachNotes?.some((n) => n.effect === "down")) msg.textContent += " " + s.coachNotes.find((n) => n.effect === "down").text;
      } catch (err) { msg.textContent = FC.errText(err); }
    };

    $("stForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("stMsg");
      const n = (v) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
      const exercises = [];
      for (const r of $("stRows").children) {
        const name = r.querySelector(".ex").value.trim();
        if (!name) continue;
        const sets = n(r.querySelector(".sets").value), reps = n(r.querySelector(".reps").value), kg = n(r.querySelector(".kg").value);
        if (!sets || !reps) { msg.textContent = `Bei „${name}“ fehlen Sätze oder Wiederholungen.`; return; }
        exercises.push({ exercise: name, setCount: Math.round(sets), reps: Math.round(reps), weightKg: kg ?? 0 });
      }
      if (!exercises.length) { msg.textContent = "Bitte mindestens eine Übung eintragen."; return; }
      const input = { exercises };
      if ($("stDay").value) input.day = $("stDay").value;
      const rpe = n($("stRpe").value), dur = n($("stDur").value);
      if (rpe != null) input.rpe = rpe;
      if (dur != null) input.durationMin = Math.round(dur);
      if ($("stTpl").value) input.name = $("stTpl").value;
      const tplName = $("stSaveTpl").checked ? $("stTplName").value.trim() : "";
      if ($("stSaveTpl").checked && !tplName) { msg.textContent = "Bitte einen Namen für die Vorlage eingeben."; return; }
      $("stSave").disabled = true; msg.textContent = "Speichere …";
      try {
        const r = await FC.call("log_strength_session", input);
        if (tplName) await FC.call("save_strength_template", { name: tplName, exercises: exercises.map((x) => ({ exercise: x.exercise, sets: x.setCount, reps: x.reps, weightKg: x.weightKg })) });
        const best = r.exercises.filter((x) => x.newBest).map((x) => x.name);
        const parts = ["Gespeichert."];
        if (r.linkedWorkout) parts.push(`Zugeordnet zum WHOOP-Training (${r.linkedWorkout.durationMin} min).`);
        if (r.load?.value != null) parts.push(`Belastung ≈ ${FC.de(r.load.value)} (Schätzung).`); else parts.push(r.load?.note ?? "");
        if (best.length) parts.push(`Neue Bestwerte: ${best.join(", ")}.`);
        msg.textContent = parts.filter(Boolean).join(" ");
        resetRows(); $("stRpe").value = ""; $("stDur").value = ""; $("stTpl").value = ""; $("stSaveTpl").checked = false; $("stTplName").hidden = true; $("stTplName").value = "";
        await Promise.all([load(true), FC.reload()]);
      } catch (err) { msg.textContent = err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err); }
      finally { $("stSave").disabled = false; }
    });

    let data = null;
    const openEx = new Set();
    const show = () => {
      if (!data) return;
      const { de, fmtDay, fmtDayLong, spark, cssVar } = FC;
      $("stSave").disabled = false;
      if (!$("stDay").value) $("stDay").value = data.today;
      const sel = $("stTpl"), cur = sel.value;
      sel.replaceChildren(el("option", { value: "", text: "– keine –" }), ...data.templates.map((t) => el("option", { value: t.name, text: t.name })));
      sel.value = data.templates.some((t) => t.name === cur) ? cur : "";

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

      // Kraft pro kg (#203): grobe Stufen als Orientierung.
      const std = data.standards, stb = $("stStd").tBodies[0];
      $("stStd").hidden = !std?.available;
      $("stStdText").textContent = std?.available ? "" : std?.text ?? "";
      $("stStdNote").textContent = std?.note ?? "";
      stb.replaceChildren(...(std?.exercises ?? []).map((e) => el("tr", {},
        el("td", { text: e.name }),
        el("td", { "data-k": "Geschätztes 1RM", text: `${de(e.e1rmKg, e.e1rmKg % 1 ? 1 : 0)} kg` }),
        el("td", { "data-k": "Pro kg", text: `${de(e.perKg, 2)} ×` }),
        el("td", { "data-k": "Stufe", text: e.level }),
        el("td", { "data-k": "Nächste Stufe", text: e.next ? `${e.next.level} ab ${de(e.next.e1rmKg)} kg` : "–" }))));

      const list = $("stSessions"); list.replaceChildren();
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
        const row = el("div", { class: "row", style: "justify-content:space-between; flex-wrap:wrap; padding:6px 0; border-bottom:1px solid var(--line)" },
          el("div", {}, el("b", { text: `${fmtDayLong(s.day)}${s.name ? ` · ${s.name}` : ""}` }), el("div", { class: "muted", text: ex.join(", ") })),
          el("span", { class: "muted" }, meta, meta ? " · " : "", tplBtn));
        tplBtn.onclick = () => {
          if (row.nextElementSibling?.classList.contains("st-tplrow")) { row.nextElementSibling.remove(); tplBtn.setAttribute("aria-expanded", "false"); return; }
          row.after(this.tplForm(s, () => tplBtn.setAttribute("aria-expanded", "false"))); tplBtn.setAttribute("aria-expanded", "true");
        };
        list.append(row);
      }
      $("stNotes").textContent = (data.coachNotes ?? []).map((n) => n.text).join(" ");
    };

    const load = async (fresh) => {
      try { data = await FC.call("get_strength", { weeks: 12 }, fresh ? { cache: false } : { cache: { staleTime: 60_000, gcTime: 86_400_000 } }); show(); }
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
});
