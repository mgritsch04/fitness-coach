// Wochenplan und Ziele (Coach mit Gedächtnis, #22): Plan Mo–So mit Soll/Ist-Häkchen, Abgleich
// heutige Einheit ↔ Tagesform, Vorschlag übernehmen, von Claude an die Tagesform anpassen lassen,
// Ziele mit Countdown. Daten: get_dashboard → training; Aktionen: save_plan, set_goals (docs/COACH.md).
FC.section({
  id: "plan",
  tab: "coach",
  order: 15,
  css: `
    .fz-t { border-collapse: collapse; width: 100%; max-width: 420px; margin: 4px 0; }
    .fz-t th, .fz-t td { text-align: left; padding: 3px 8px 3px 0; border-bottom: 1px solid var(--line, rgba(127,127,127,.25)); font-weight: 400; }
    .fz-t thead th, .fz-t tbody th { font-weight: 600; }
    .wplan { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
    .wplan .pd { border: 1px solid var(--line, rgba(127,127,127,.25)); border-radius: 10px; padding: 8px 6px; min-width: 0; display: grid; gap: 3px; align-content: start; }
    .wplan .pd.today { outline: 2px solid var(--accent, #4fb3cf); outline-offset: -1px; }
    .wplan .pd .wd { font-size: 12px; opacity: .7; display: flex; justify-content: space-between; gap: 4px; }
    .wplan .pd .t { font-weight: 600; font-size: 13px; line-height: 1.2; overflow-wrap: anywhere; }
    .wplan .pd .m { font-size: 12px; opacity: .75; }
    .wplan .pd .k { font-size: 11px; opacity: .8; }
    .wplan .pd.rest { color: var(--ink-2); }
    .wplan .ck { font-weight: 700; }
    .wplan .ck.done { color: #2fbf2f; } .wplan .ck.missed { color: #e66767; } .wplan .ck.partial { color: #fab219; } .wplan .ck.extra { color: #4fb3cf; }
    .pdetail { margin-top: 10px; }
    .goals { display: grid; gap: 8px; }
    .goal { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; flex-wrap: wrap; }
    .goal b { font-weight: 600; }
    .goalform { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .goalform input, .goalform select { min-width: 0; }
    .goalform input[type=text] { flex: 1 1 160px; }
    .fixdays { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px 10px; margin-bottom: 8px; }
    .fixdays label { display: grid; gap: 2px; font-size: 13px; }
    .daytimes { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 6px 10px; margin-bottom: 8px; }
    .daytimes .dt { display: grid; grid-template-columns: 1fr auto; gap: 2px 6px; align-items: center; font-size: 13px; }
    .daytimes .dt input[type=number] { width: 5em; min-width: 0; }
    .daytimes .dt label.easy { grid-column: 1 / -1; display: flex; gap: 6px; align-items: center; font-size: 12px; opacity: .85; }
    .quicktime { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .quicktime input { width: 5em; min-width: 0; }
    .verdict { padding: 8px 10px; border-radius: 10px; background: var(--band, rgba(127,127,127,.12)); }
    @media (max-width: 640px) { .wplan { grid-template-columns: 1fr; } .wplan .pd { grid-template-columns: 3.4em 1fr; column-gap: 8px; } .wplan .pd .wd { grid-row: 1 / span 3; flex-direction: column; justify-content: flex-start; } }
  `,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-plan">Wochenplan</h2><span class="muted" id="planPhase"></span></div>
      <div class="panel" style="display:grid; gap:12px;">
        <p class="verdict" id="planToday">–</p>
        <div class="wplan" id="wplan"></div>
        <p class="muted" id="planSummary"></p>
        <div class="pdetail coach-out muted" id="planDetail">Tippe auf einen Tag für Details.</div>
        <div class="coach-actions">
          <button type="button" class="primary" id="planAccept" disabled>Vorschlag übernehmen</button>
          <button type="button" id="planAdapt" disabled>An Tagesform anpassen (Claude)</button>
          <button type="button" id="planReset" hidden>Zurück zum Vorschlag</button>
        </div>
        <p class="muted" id="planMsg" hidden></p>
        <ul class="fine" id="planNotes"></ul>
        <div class="quicktime" id="quickBox">
          <label for="quickMin"><strong>Heute nur</strong></label>
          <input type="number" id="quickMin" min="0" max="600" step="5" inputmode="numeric" placeholder="45" aria-label="Minuten fürs Rad heute">
          <span>min Rad</span>
          <button type="button" id="quickSet" disabled>Umplanen</button>
          <button type="button" id="quickClear" hidden>Zurück zum Plan</button>
          <span class="muted" id="quickMsg" role="status"></span>
        </div>
        <details id="timeBox">
          <summary>Zeit fürs Rad je Wochentag</summary>
          <p class="fine muted" style="margin:6px 0">Trag ein, wie viele Minuten du an welchem Tag fürs Rad hast. Leer = egal, 0 = keine Zeit (Ruhetag). „Locker statt frei“ gibt dem Tag eine kurze Erholungsfahrt statt Ruhetag. Der Plan richtet harte und lange Einheiten nach diesen Zeiten und kürzt oder lässt aus, was nicht passt (Schätzung). Sind alle sieben Tage gesetzt, ist die Summe dein Wochenbudget.</p>
          <div class="daytimes" id="dayTimes"></div>
          <div class="coach-actions"><button type="button" id="timeSave">Zeiten speichern</button><span class="muted" id="timeMsg" role="status"></span></div>
        </details>
        <details id="tplBox">
          <summary>Kraft-Vorlage je Wochentag</summary>
          <p class="fine muted" style="margin:6px 0">Wähle, welche gespeicherte Vorlage das Gym an welchem Tag vorschlägt. Beim Start ist sie vorausgewählt, du kannst sie dort mit einem Tipp ändern. „keine“ = kein Vorschlag. Der Wochenplan bleibt davon unberührt.</p>
          <div class="fixdays" id="tplDays"></div>
          <div class="coach-actions"><button type="button" id="tplSave">Vorlagen speichern</button><span class="muted" id="tplMsg" role="status"></span></div>
        </details>
        <details id="fixBox">
          <summary>Feste Krafttage (eigener Wochenplan)</summary>
          <p class="fine muted" style="margin:6px 0">Trag ein, an welchen Tagen du fix Kraft machst. Der Plan übernimmt sie unverändert, der Coach plant nur Rad und Ruhe drumherum und legt keine harten Radeinheiten direkt neben Beintage.</p>
          <div class="fixdays" id="fixDays"></div>
          <div class="coach-actions"><button type="button" id="fixSave">Feste Tage speichern</button><span class="muted" id="fixMsg" role="status"></span></div>
        </details>
      </div>
      <div class="sec-head"><h2>Ziele</h2><span class="muted">Ein A-Ziel mit Datum steuert die Phasen des Plans.</span></div>
      <div class="panel" style="display:grid; gap:12px;">
        <div class="goals" id="goalList"><span class="muted">Noch keine Ziele.</span></div>
        <div id="projBox" hidden>
          <p id="projText"></p>
          <div class="chart" id="projChart"></div>
          <p class="fine" id="projFine"></p>
        </div>
        <form class="goalform" id="goalForm" autocomplete="off">
          <input type="text" id="goalTitle" placeholder="z. B. Radmarathon 200 km" aria-label="Ziel" required maxlength="120">
          <input type="date" id="goalDate" aria-label="Datum">
          <select id="goalPrio" aria-label="Priorität"><option value="A">A – Hauptziel</option><option value="B" selected>B – wichtig</option><option value="C">C – nebenbei</option></select>
          <button type="submit" id="goalAdd" disabled>Ziel speichern</button>
        </form>
      </div>`;
    const { $ } = FC;
    this.root = root;
    $("planAccept").onclick = () => this.save({ accept: true }, "Plan gespeichert.");
    $("planReset").onclick = () => this.save({ reset: true }, "Gespeicherten Plan verworfen, es gilt wieder der Vorschlag.");
    $("planAdapt").onclick = () => this.adapt();
    $("fixSave").onclick = () => this.saveFixed();
    $("tplSave").onclick = () => this.saveTemplates();
    $("timeSave").onclick = () => this.saveTimes();
    $("quickSet").onclick = () => this.quickTime(Number($("quickMin").value));
    $("quickClear").onclick = () => this.quickTime(null);
    $("goalForm").addEventListener("submit", (e) => { e.preventDefault(); this.addGoal(); });
    // Coach-Bereich bekommt Plan, Ziele und Tagebuch als zusätzliche Daten für Claude.
    const prevExtras = FC.state.coachExtras;
    FC.state.coachExtras = () => {
      const t = FC.state.data?.training, j = FC.state.data?.journal;
      return {
        ...(prevExtras ? prevExtras() : {}),
        ...(t ? {
          wochenplan: { phase: t.thisWeek.phaseLabel, grund: t.thisWeek.plan.phaseReason, stand: t.thisWeek.comparison.summary, heute: t.today.text, intensitaet: t.intensity?.text ?? null, ftpTest: t.ftpTest?.text ?? null, nachholen: t.makeUp?.text ?? null, kraftVorschlag: (t.strengthWorkouts?.days ?? []).slice(0, 2).map((k) => ({ tag: k.day, fokus: k.focus, uebungen: k.text })),
            tage: t.thisWeek.comparison.days.map((x) => ({ tag: x.day, einheit: x.title, typ: x.type, min: x.durationMin, belastung: x.targetLoad, kraft: x.strength?.focus ?? null, status: x.status })) },
          ziele: t.goals.map((g) => ({ ziel: g.goal.title, datum: g.goal.targetDate, prio: g.goal.priority, stand: g.text })),
          vorlieben: t.prefs,
        } : {}),
        ...(j ? { tagebuchHeute: j.today, tagebuch7Tage: j.recent?.slice(0, 7) } : {}),
      };
    };
  },
  ready() { this.unwatchWx?.(); this.unwatchWx = FC.watch("get_ride_weather", {}, (p) => { this.wx = p && !p.error ? p : null; }, { cache: { staleTime: 300_000, gcTime: 86_400_000 } }); },
  /** Verpflegung im Tagesdetail: ab 75 min der Zettel (#374), sonst die kurze Fassung aus #87. */
  fuelBlock(x, f, t, d) {
    const { el } = FC, FS = FuelSheet;
    if (!f) return [];
    const z = FS.compute({ session: x, fuel: f, sweat: t.sweat, weatherDay: this.wx?.days?.find((w) => w.day === x.day) ?? null, weightKg: d.body?.weightKg ?? null });
    if (z) return [FS.render(z)];
    const short = FS.shortNote(x);
    return [el("p", {}, el("strong", { text: "Verpflegung: " }), [f.before, f.during, f.after].filter(Boolean).join(" ")), short ? el("p", { class: "fine", text: short }) : null, el("p", { class: "fine", text: t.fueling.note })].filter(Boolean);
  },
  render(d) {
    const { $, el, de, fmtWeekday, fmtDayLong } = FC;
    const t = d.training;
    this.root.hidden = !t;
    if (!t) return;
    const w = t.thisWeek, cmp = w.comparison;
    this.renderFixed(t.prefs);
    this.renderTemplates(t.prefs);
    this.renderTimes(t.prefs);
    $("planPhase").textContent = `${w.phaseLabel}${w.stored ? (w.plan.source === "coach" ? " · von Claude angepasst" : " · gespeichert") : " · Vorschlag"}`;
    const fToday = (t.fueling?.days ?? []).find((f) => f.day === d.today);
    $("planToday").textContent = t.today.text + (fToday && fToday.short !== "nur Wasser" ? ` Verpflegung: ${fToday.short}.` : "");
    $("planSummary").textContent = `${cmp.summary} Geplant: ${de(w.plan.targetHours, 1)} h, ~${de(w.plan.days.reduce((a, x) => a + x.targetLoad, 0))} Belastungspunkte (geschätzt).`;
    if (t.intensity && t.intensity.verdict !== "ok") $("planSummary").textContent += ` ${t.intensity.text}`;
    if (t.ftpTest) $("planSummary").textContent += ` ${t.ftpTest.text}`;
    if (d.returnToTraining?.status === "return") $("planSummary").textContent += ` ${d.returnToTraining.text}`;
    if (t.makeUp) $("planSummary").textContent += ` ${t.makeUp.text}`;
    if (t.strengthDeload?.verdict === "deload") $("planSummary").textContent += ` Kraft: ${t.strengthDeload.text} ${t.strengthDeload.suggestion.text}`;
    const ftpDay = t.ftpTest?.day ?? null;
    const makeUpDay = t.makeUp?.day ?? null;
    const MARK = { done: "✓", missed: "✗", partial: "◐", extra: "+", today: "•", upcoming: "", rest: "" };
    const grid = $("wplan"); grid.replaceChildren();
    const fuel = new Map((t.fueling?.days ?? []).map((f) => [f.day, f]));
    const kraft = new Map((t.strengthWorkouts?.days ?? []).map((k) => [k.day, k]));
    const rideWo = new Map((t.rideWorkouts?.days ?? []).map((r) => [r.day, r]));
    for (const x of cmp.days) {
      const box = el("button", { type: "button", class: `pd${x.type === "rest" ? " rest" : ""}${x.day === d.today ? " today" : ""}`, "aria-label": `${fmtDayLong(x.day)}: ${x.title}` });
      box.style.textAlign = "left"; box.style.font = "inherit"; box.style.color = "inherit"; box.style.background = "transparent"; box.style.cursor = "pointer";
      box.append(...[
        el("span", { class: "wd" }, el("span", { text: fmtWeekday(x.day) }), el("span", { class: `ck ${x.status}`, text: MARK[x.status] ?? "" })),
        el("span", { class: "t", text: x.title }),
        el("span", { class: "m", text: x.type === "rest" ? "" : `${x.durationMin ? `${x.durationMin} min · ` : ""}~${de(x.targetLoad)}` }),
        x.strength && x.type !== "strength" ? el("span", { class: "k", text: `+ Kraft ${x.strength.durationMin} min${x.strengthDone ? " ✓" : ""}` }) : null,
        x.day === ftpDay ? el("span", { class: "k", text: "oder FTP-Test" }) : null,
        x.day === makeUpDay ? el("span", { class: "k", text: t.makeUp.kind === "postpone" ? "Verschoben" : "Nachholen" }) : null,
      ].filter(Boolean));
      box.onclick = () => {
        const out = $("planDetail"); out.classList.remove("muted"); out.replaceChildren(...[
          el("p", {}, el("strong", { text: `${fmtDayLong(x.day)}: ${x.title}` })),
          x.intensity ? el("p", { text: x.intensity }) : null,
          el("p", { text: x.description }),
          ...(rideWo.get(x.day) ? this.workoutBlock(rideWo.get(x.day), x.day) : []),
          x.day === makeUpDay ? el("p", {}, el("strong", { text: `Vorschlag: „${t.makeUp.missed.title}“ statt dieser Einheit ${t.makeUp.kind === "postpone" ? "fahren (von heute verschoben)" : "nachholen"}.` })) : null,
          ...(x.day === ftpDay ? [el("p", {}, el("strong", { text: "Vorschlag: FTP-Test statt dieser Einheit. " }), t.ftpTest.reason), el("ul", {}, ...t.ftpTest.howTo.map((h) => el("li", { text: h })))] : []),
          ...(kraft.get(x.day) ? [
            el("p", {}, el("strong", { text: `Kraft, ${kraft.get(x.day).durationMin} min: ${kraft.get(x.day).focus}` })),
            el("ul", {}, ...kraft.get(x.day).exercises.map((e) => el("li", { text: `${e.name}: ${e.sets} × ${e.reps}${e.unit === "s" ? " s" : ""}${e.weightKg != null ? ` mit ${de(e.weightKg, e.weightKg % 1 ? 1 : 0)} kg${e.basis === "increase" ? " (etwas mehr als zuletzt)" : e.basis === "light" ? " (leicht)" : ""}` : e.unit === "s" ? "" : ", Gewicht mit 2 Wdh. Reserve"}` }))),
            el("p", { class: "fine", text: t.strengthWorkouts.note }),
          ] : []),
          ...this.fuelBlock(x, fuel.get(x.day), t, d),
          x.actualMin || x.actualLoad ? el("p", { class: "muted", text: `Tatsächlich: ${x.actualMin} min, Belastung ~${de(x.actualLoad)}${x.actualSports.length ? ` (${x.actualSports.map(FC.sport).join(", ")})` : ""}.` }) : null,
        ].filter(Boolean));
      };
      grid.append(box);
    }
    const notes = $("planNotes"); notes.replaceChildren(...[w.plan.phaseReason, ...w.plan.notes, t.disclaimer].filter(Boolean).map((n) => el("li", { text: n })));
    $("planReset").hidden = !w.stored;
    // Ziele
    const gl = $("goalList"); gl.replaceChildren();
    if (!t.goals.length) gl.append(el("span", { class: "muted", text: "Noch keine Ziele. Trag z. B. ein Rennen mit Datum ein." }));
    for (const g of t.goals) {
      const del = el("button", { type: "button", text: "erledigt" });
      del.onclick = () => this.goal({ goals: [{ id: g.goal.id, status: "done" }] });
      gl.append(el("div", { class: "goal" },
        el("span", {}, el("b", { text: `${g.goal.priority} · ${g.goal.title}` }), g.goal.targetDate ? el("span", { class: "muted", text: ` · ${fmtDayLong(g.goal.targetDate)}` }) : null),
        el("span", { class: "muted" }, g.text || "", " ", del)));
    }
    this.renderProjection(t.projection);
    this.busy(false);
  },
  // Passendes MyWhoosh-Workout zur Radeinheit (#337): Kurzprofil und Sprung in den Abschnitt „Workout für MyWhoosh“ (dort der .zwo-Download).
  workoutBlock(w, day) {
    const { el, de } = FC;
    const open = el("button", { type: "button", text: "Workout für MyWhoosh öffnen" });
    open.onclick = () => {
      FC.goTo("bikewo");
      // Der Abschnitt füllt seine Tage erst beim ersten Öffnen; dann kurz warten. Bibliotheks-Empfehlung: Vorlage (#364) mitgeben.
      const pick = (n) => {
        const sel = FC.$("bwDay"), bw = FC.state.bikewo;
        if (bw && sel && [...sel.options].some((o) => o.value === day)) bw.openFor(day, w.source === "library" ? w.templateId : null);
        else if (n) setTimeout(() => pick(n - 1), 250);
      };
      pick(8);
    };
    return [
      el("p", {}, el("strong", { text: `Workout für MyWhoosh: ${w.name}` }), ` · ~${de(w.load)} Belastung · ${w.source === "library" ? "aus der Bibliothek" : "aus Art und Dauer gebaut"}. ${w.summary}`),
      el("ul", {}, ...w.profile.map((l) => el("li", { text: l }))),
      el("p", {}, open, " ", el("span", { class: "fine", text: "Die Datei (.zwo) lädst du im Abschnitt herunter und importierst sie über workout.mywhoosh.com. Nur sinnvoll bei Fahrten auf der Rolle; Zonen und Belastung sind Schätzungen." })),
    ];
  },
  // Fester Wochenplan Kraft (#323): je Wochentag frei oder eine Kraft-Art.
  FIX_OPTIONS: ["", "Beine", "Oberkörper", "Oberkörper (Zug)", "Oberkörper (Druck)", "Ganzkörper", "Rumpf + Mobility"],
  renderFixed(prefs) {
    const { $, el } = FC, box = $("fixDays");
    if (box.contains(document.activeElement)) return;
    const cur = new Map((prefs?.fixedStrength ?? []).map((f) => [f.day, f.focus]));
    const names = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
    box.replaceChildren(...names.map((n, i) => {
      const sel = el("select", { "data-day": String(i), "aria-label": `${n}: feste Krafteinheit` },
        ...this.FIX_OPTIONS.map((o) => el("option", { value: o, text: o ? `Kraft: ${o}` : "nicht fix" })));
      const v = cur.get(i) ?? "";
      if (v && !this.FIX_OPTIONS.includes(v)) sel.append(el("option", { value: v, text: `Kraft: ${v}` }));
      sel.value = v;
      return el("label", {}, el("span", { text: n }), sel);
    }));
  },
  async saveFixed() {
    const { $ } = FC, msg = $("fixMsg");
    const fixedStrength = [...$("fixDays").querySelectorAll("select")].filter((s) => s.value).map((s) => ({ day: Number(s.dataset.day), focus: s.value }));
    $("fixSave").disabled = true; msg.textContent = "Speichere …";
    try {
      await FC.call("set_training_prefs", { fixedStrength: fixedStrength.length ? fixedStrength : null });
      const stored = FC.state.data?.training?.thisWeek?.stored;
      msg.textContent = `Gespeichert${fixedStrength.length ? `: ${fixedStrength.length} feste Krafttage` : ", der Coach verteilt die Kraft wieder selbst"}.${stored ? " Diese Woche gilt noch dein gespeicherter Plan; „Zurück zum Vorschlag“ übernimmt die festen Tage." : ""}`;
      await FC.reload();
    } catch (e) { msg.textContent = FC.errText(e); }
    finally { $("fixSave").disabled = false; }
  },
  // Kraft-Vorlage je Wochentag (#370): Auswahl aus den gespeicherten Vorlagen; unbekannte (gelöschte) Namen zählen als „keine“.
  tplNames: null,
  async renderTemplates(prefs) {
    const { $, el } = FC, box = $("tplDays");
    if (this.tplDirty || box.contains(document.activeElement)) return;
    try {
      const d = await FC.call("get_strength", { weeks: 12 }, { cache: { staleTime: 60_000, gcTime: 86_400_000 } });
      this.tplNames = (d.templates ?? []).map((t) => t.name);
    } catch { this.tplNames ??= []; }
    // Ungespeicherte Auswahl nicht durch ein Neuzeichnen (Datenstand, Größenänderung) überschreiben.
    if (this.tplDirty || box.contains(document.activeElement)) return;
    const names = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
    box.replaceChildren(...names.map((n, i) => {
      // Kraft-Vorlage und Rad getrennt je Tag (beides möglich), „Ruhetag“ schließt beides aus.
      const cur = FC.dayPlan(prefs, i);
      const sel = el("select", { "data-day": String(i), "aria-label": `${n}: Kraft-Vorlage` },
        el("option", { value: "", text: "keine" }), el("option", { value: "@ruhe", text: "Ruhetag" }), ...this.tplNames.map((t) => el("option", { value: t, text: t })));
      sel.value = cur.rest ? "@ruhe" : cur.strength && this.tplNames.includes(cur.strength) ? cur.strength : "";
      const rad = el("input", { type: "checkbox", "data-ride": String(i), "aria-label": `${n}: Rad` }); rad.checked = cur.ride; rad.disabled = cur.rest;
      sel.onchange = () => { this.tplDirty = true; rad.disabled = sel.value === "@ruhe"; if (rad.disabled) rad.checked = false; };
      rad.onchange = () => { this.tplDirty = true; };
      return el("label", {}, el("span", { text: n }), sel, el("span", { class: "row", style: "gap:6px" }, rad, "Rad"));
    }));
    if (!this.tplNames.length) box.append(el("p", { class: "fine muted", text: "Noch keine Vorlage gespeichert: Im Gym nach einer Einheit „Als Vorlage speichern“." }));
  },
  async saveTemplates() {
    const { $ } = FC, msg = $("tplMsg");
    const sels = [...$("tplDays").querySelectorAll("select")], rides = [...$("tplDays").querySelectorAll("input[data-ride]")];
    const vals = sels.map((s) => s.value || null), ride = rides.map((c) => (c.checked && !c.disabled ? true : null));
    $("tplSave").disabled = true; msg.textContent = "Speichere …";
    try {
      await FC.call("set_training_prefs", { templateByDay: vals.some((v) => v) ? vals : null, rideByDay: ride.some((v) => v) ? ride : null });
      this.tplDirty = false;
      const days = vals.map((v, i) => v || ride[i]).filter(Boolean).length;
      msg.textContent = days ? `Gespeichert: ${days} Tage geplant.` : "Gespeichert: keine Planung je Wochentag.";
      await FC.reload();
    } catch (e) { msg.textContent = FC.errText(e); }
    finally { $("tplSave").disabled = false; }
  },
  // Zeit fürs Rad je Wochentag (#336): Minuten, 0 = keine Zeit, „locker statt frei“; dazu „Heute nur … min“.
  renderTimes(prefs) {
    const { $, el } = FC, box = $("dayTimes");
    const today = FC.state.data?.today, over = today ? prefs?.dayOverrides?.[today] : undefined;
    $("quickClear").hidden = over == null;
    $("quickSet").disabled = !FC.state.mcp;
    $("quickMsg").textContent = over == null ? "" : `Für heute stehen ${over} min.`;
    if (box.contains(document.activeElement)) return;
    const names = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
    const easy = new Set(prefs?.easyDays ?? []);
    box.replaceChildren(...names.map((n, i) => {
      const v = prefs?.dayMinutes?.[i];
      const inp = el("input", { type: "number", min: "0", max: "600", step: "5", inputmode: "numeric", placeholder: "egal", "data-day": String(i), "aria-label": `${n}: verfügbare Minuten fürs Rad` });
      inp.value = v == null ? "" : String(v);
      const cb = el("input", { type: "checkbox", "data-easy": String(i) });
      cb.checked = easy.has(i);
      return el("div", { class: "dt" }, el("span", { text: n }), inp, el("label", { class: "easy" }, cb, el("span", { text: "locker statt frei" })));
    }));
  },
  async saveTimes() {
    const { $ } = FC, msg = $("timeMsg");
    const vals = [...$("dayTimes").querySelectorAll("input[type=number]")].map((i) => (i.value === "" ? null : Math.max(0, Math.min(600, Math.round(Number(i.value))))));
    const easy = [...$("dayTimes").querySelectorAll("input[type=checkbox]")].flatMap((c, i) => (c.checked ? [i] : []));
    $("timeSave").disabled = true; msg.textContent = "Speichere …";
    try {
      await FC.call("set_training_prefs", { dayMinutes: vals.some((v) => v != null) ? vals : null, easyDays: easy.length ? easy : null });
      const stored = FC.state.data?.training?.thisWeek?.stored;
      msg.textContent = `Gespeichert.${stored ? " Diese Woche gilt noch dein gespeicherter Plan; „Zurück zum Vorschlag“ übernimmt die Zeiten." : ""}`;
      await FC.reload();
    } catch (e) { msg.textContent = FC.errText(e); }
    finally { $("timeSave").disabled = false; }
  },
  async quickTime(minutes) {
    const { $ } = FC, msg = $("quickMsg");
    if (minutes != null && !Number.isFinite(minutes)) { msg.textContent = "Bitte Minuten eintragen (0 = keine Zeit)."; return; }
    $("quickSet").disabled = true; msg.textContent = "Plane um …";
    try {
      await FC.call("set_day_time", { minutes: minutes == null ? null : Math.max(0, Math.min(600, Math.round(minutes))) });
      await FC.reload();
      msg.textContent = minutes == null ? "Ausnahme zurückgenommen." : `Heute ${minutes} min: Plan angepasst, siehe Hinweise unter dem Wochenplan.`;
    } catch (e) { msg.textContent = FC.errText(e); }
    finally { $("quickSet").disabled = !FC.state.mcp; }
  },
  rerender(d) { if (d?.training) this.renderProjection(d.training.projection); },
  renderProjection(p) {
    const { $, de, fmtDayLong, cssVar } = FC;
    $("projBox").hidden = !p;
    if (!p) return;
    const sign = (v) => `${v >= 0 ? "+" : ""}${de(v, 0)}`;
    $("projText").textContent = `Prognose für „${p.goal.title}“ (${fmtDayLong(p.goal.targetDate)}, noch ${p.daysLeft} Tage): Fitness ${de(p.atEvent.ctl, 0)}, Form ${sign(p.atEvent.tsb)}. ${p.advice.join(" ")}`;
    FC.chart($("projChart"), {
      days: p.days,
      series: [
        { label: "Fitness (CTL)", color: cssVar("--accent") || "#4fb3cf", kind: "line", value: (x) => x.ctl },
        { label: "Form (TSB)", color: "#fab219", kind: "line", value: (x) => x.tsb },
      ],
      band: { lo: p.targetTsb.min, hi: p.targetTsb.max },
      zero: true,
      height: 170,
      aria: "Prognose von Fitness und Form bis zum Termin",
    });
    $("projFine").textContent = `Phasen: ${p.weeks.map((w) => w.phaseLabel).join(" → ")}. Band = Wunschbereich der Form am Termin. ${p.disclaimer}`;
  },
  busy(on) {
    const ok = !!FC.state.mcp && !!FC.state.data?.training;
    FC.$("planAccept").disabled = on || !ok || FC.state.data?.training?.thisWeek.stored;
    FC.$("planAdapt").disabled = on || !ok || !FC.state.sample;
    FC.$("planReset").disabled = on;
    FC.$("goalAdd").disabled = on || !ok;
  },
  msg(text) { const m = FC.$("planMsg"); m.hidden = !text; m.textContent = text ?? ""; },
  async save(input, okText) {
    this.busy(true); this.msg("Speichere …");
    try { await FC.call("save_plan", input); this.msg(okText); await FC.reload(); }
    catch (e) { this.msg(FC.errText(e)); }
    finally { this.busy(false); }
  },
  async goal(input) {
    this.busy(true);
    try { await FC.call("set_goals", input); await FC.reload(); }
    catch (e) { this.msg(FC.errText(e)); }
    finally { this.busy(false); }
  },
  addGoal() {
    const { $ } = FC;
    const title = $("goalTitle").value.trim(); if (!title) return;
    const date = $("goalDate").value || null;
    this.goal({ goals: [{ kind: date ? "event" : "other", title, targetDate: date, priority: $("goalPrio").value }] });
    $("goalTitle").value = ""; $("goalDate").value = "";
  },
  async adapt() {
    const { state } = FC;
    const d = state.data, t = d?.training; if (!t || !state.sample) return;
    this.busy(true); this.msg("Claude passt den Plan an …");
    const coach = d.coach;
    const prompt = `Du bist Rad- und Krafttrainer (Rennrad, derzeit indoor mit MyWhoosh, plus Krafttraining im Gym). Passe den Wochenplan an die heutige Tagesform und das bisher Erledigte an.
Regeln: Nur Trainingsempfehlungen, keine Diagnosen. Vergangene Tage nicht ändern. Keine schweren Beine (Kraft Beine) am Tag vor Intervallen oder der langen Fahrt. Harte Tage hart, lockere locker. Ausgefallene Schlüsseleinheiten nur nachholen, wenn es die Erholung erlaubt. Wochenbelastung grob halten, außer die Erholung spricht dagegen.
Typen: rest, recovery, endurance, long, tempo, threshold, vo2max, strength, opener, race.
Antworte nur mit JSON: {"hinweis": string (1–2 Sätze, warum), "days": [{"day": "YYYY-MM-DD", "type": string, "title": string, "durationMin": number, "intensity": string, "description": string, "strength": {"durationMin": number, "focus": string} | null}]} mit allen 7 Tagen ab ${t.thisWeek.week}.

Heute: ${d.today}
Tagesform: ${JSON.stringify({ bereitschaft: coach.readiness, score: coach.score, gruende: coach.reasons.map((r) => r.text), warnungen: coach.warnings, abgleich: t.today.text, tagebuch: d.journal?.today ?? null })}
Aktueller Plan mit Status: ${JSON.stringify(t.thisWeek.comparison.days.map((x) => ({ day: x.day, type: x.type, title: x.title, durationMin: x.durationMin, intensity: x.intensity, description: x.description, strength: x.strength, status: x.status })))}`;
    try {
      const r = await state.sample.json(prompt, { cache: false });
      if (!Array.isArray(r?.days) || !r.days.length) throw { code: "bad_plan" };
      // Vergangene Tage bleiben wie sie waren.
      const past = new Map(t.thisWeek.plan.days.filter((x) => x.day < d.today).map((x) => [x.day, x]));
      const days = r.days.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(String(x.day))).map((x) => past.get(x.day) ?? x);
      for (const p of past.values()) if (!days.some((x) => x.day === p.day)) days.push(p);
      await FC.call("save_plan", { days, notes: r.hinweis ? [String(r.hinweis).slice(0, 300)] : undefined });
      this.msg(r.hinweis ? `Angepasst: ${r.hinweis}` : "Plan angepasst und gespeichert.");
      await FC.reload();
    } catch (e) {
      const toolErr = ["tool_error", "server_unavailable", "needs_reauth", "server_not_connected", "not_in_manifest", "approval_required", "selection_required"].includes(e?.code);
      this.msg(e?.code === "bad_plan" ? "Claude hat keinen gültigen Plan geliefert. Bitte noch einmal versuchen." : toolErr ? FC.errText(e) : FC.sampleErrText(e));
    } finally { this.busy(false); }
  },
});
