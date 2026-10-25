// „Heute dran“ (#122): geplante Einheit von heute mit Wochenstreifen und Direkt-Start in Gym-Modus oder MyWhoosh-Workout.
// Nur Daten aus get_dashboard (training.thisWeek, today, strengthWorkouts, fueling, ftpTest).
FC.section({
  id: "agenda",
  simple: true,
  tab: "heute",
  order: 10.5,
  RIDES: ["recovery", "endurance", "long", "tempo", "threshold", "vo2max", "opener", "race"],
  MARK: { done: "✓", missed: "✗", partial: "◐", extra: "+" },
  css: `
    .ag-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; margin: 10px 0 12px; }
    .ag-day { display: grid; justify-items: center; gap: 2px; padding: 6px 0; border: 1px solid var(--line); border-radius: 10px; background: transparent; color: inherit; font: inherit; cursor: pointer; min-width: 0; }
    .ag-day .w { font-size: .75rem; color: var(--ink-3); }
    .ag-day .k { font-size: .72rem; font-weight: 600; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .ag-day .p { font-size: .65rem; color: var(--ink-3); min-height: 1em; line-height: 1; }
    .ag-day .s { font-weight: 700; font-size: .85rem; min-height: 1.1em; }
    .ag-day .s.done { color: var(--good-ink); } .ag-day .s.missed { color: var(--bad-ink); } .ag-day .s.partial { color: var(--warn-ink); } .ag-day .s.extra { color: var(--accent); }
    .ag-day.today { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
    .ag-day[aria-pressed="true"] { background: var(--accent-wash); }
    .ag-day[aria-pressed="true"] .w, .ag-day[aria-pressed="true"] .p { color: var(--ink-2); }
    .ag-day.rest .k { color: var(--ink-3); font-weight: 400; }
    .ag-head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; flex-wrap: wrap; }
    .ag-head h3 { margin: 0; }
    .ag-meta { color: var(--ink-2); font-size: .9rem; }
    .ag-det p { margin: 6px 0; }
    .ag-sw { margin: 10px 0; border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; }
    .ag-sw summary { cursor: pointer; font-weight: 600; }
    .ag-swa { margin-top: 4px; }
    .ag-swf { display: grid; grid-template-columns: repeat(auto-fit, minmax(9em, 1fr)); gap: 8px; margin: 8px 0; }
    .ag-swf label { display: grid; gap: 4px; font-size: .88rem; color: var(--ink-2); min-width: 0; }
    .ag-swf input[type="number"] { width: 100%; min-width: 0; }
    .ag-swf .ag-swc { display: flex; align-items: center; gap: 6px; }
    .ag-fb { display: flex; flex-wrap: wrap; gap: 8px; }
    .ag-fb button[aria-pressed="true"] { background: var(--accent); color: var(--accent-ink); border-color: transparent; }
    .ag-rpe { border-top: 1px solid var(--line); padding-top: 8px; margin-top: 8px; }
    .ag-rpe p { margin: 0 0 6px; }
    .ag-act { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }`,
  async ready() {
    this.dl = await window.claude?.use?.("downloads").catch(() => null);
    // Knopf nachreichen statt neu zu zeichnen, sonst ginge ein gerade laufender Tipp verloren.
    const act = FC.$("agBody")?.querySelector(".ag-act");
    if (act && !act.querySelector(".ag-cal")) { const b = this.calButton(); if (b) act.append(b); }
  },
  /** Restliche Woche als Kalenderdatei (#157), nur wenn der Download-Dialog verfügbar ist. */
  calButton() {
    const d = FC.state.data, t = d?.training, days = t?.thisWeek?.comparison?.days ?? [];
    if (!this.dl || !days.some((y) => y.day >= d.today && y.type !== "rest")) return null;
    const cal = FC.el("button", { type: "button", class: "ag-cal", text: "In den Kalender (.ics)" });
    cal.onclick = async () => {
      try { await this.dl.save({ filename: `trainingsplan-${t.thisWeek.week ?? d.today}.ics`, data: new Blob([this.ics(days, d.today, t)], { type: "text/calendar;charset=utf-8" }) }); FC.$("agMsg").textContent = "Kalenderdatei gespeichert. Öffnen und in den Kalender übernehmen."; }
      catch { FC.$("agMsg").textContent = "Nicht gespeichert."; }
    };
    return cal;
  },
  /** Kalenderdatei (RFC 5545) mit ganztägigen Terminen ab heute, ohne Ruhetage. */
  ics(days, today, t) {
    const esc = (v) => String(v ?? "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\r?\n/g, "\\n");
    // Zeilen auf höchstens 74 Byte falten (Umlaute zählen doppelt), Folgezeilen beginnen mit Leerzeichen.
    const enc = new TextEncoder();
    const fold = (line) => {
      const out = []; let cur = "", n = 0;
      for (const c of line) { const b = enc.encode(c).length; if (n + b > 73) { out.push(cur); cur = ""; n = 0; } cur += c; n += b; }
      return [...out, cur].join("\r\n ");
    };
    const ymd = (day) => day.replaceAll("-", "");
    const next = (day) => { const x = new Date(day + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const ev = days.filter((x) => x.day >= today && x.type !== "rest").map((x) => {
      const kraft = (t.strengthWorkouts?.days ?? []).find((k) => k.day === x.day);
      const head = x.type === "strength" ? "Kraft" : this.RIDES.includes(x.type) ? "Rad" : this.short(x);
      const extra = x.strength && x.type !== "strength" ? ` + Kraft ${x.strength.durationMin} min` : "";
      const desc = [x.intensity, x.description, kraft ? `Kraft: ${kraft.exercises.map((e) => `${e.name} ${e.sets}×${e.reps}${e.unit === "s" ? " s" : ""}${e.weightKg != null ? ` ${String(e.weightKg).replace(".", ",")} kg` : ""}`).join(", ")}` : null, "Aus deinem Fitness-Coach-Wochenplan (Trainingsempfehlung, keine medizinische Diagnose)."].filter(Boolean).join("\n");
      return ["BEGIN:VEVENT", `UID:fc-plan-${x.day}@fitness-coach`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(x.day)}`, `DTEND;VALUE=DATE:${ymd(next(x.day))}`,
        `SUMMARY:${esc(`${head}: ${x.title}${x.durationMin ? `, ${x.durationMin} min` : ""}${extra}`)}`, `DESCRIPTION:${esc(desc)}`, "TRANSP:TRANSPARENT", "END:VEVENT"];
    });
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fitness Coach//Wochenplan//DE", "CALSCALE:GREGORIAN", ...ev.flat(), "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
  },
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-agenda">Heute dran</h2><span class="muted" id="agPhase"></span></div>
      <div class="panel"><div id="agBody"><div class="empty">Lädt …</div></div></div>`;
  },
  render() {
    const t = FC.state.data?.training;
    if (!t?.thisWeek) { FC.$("agBody").replaceChildren(FC.el("div", { class: "empty", text: "Noch kein Wochenplan. Im Tab „Coach“ kannst du Ziele und Vorlieben eintragen." })); return; }
    FC.$("agPhase").textContent = t.thisWeek.phaseLabel ?? "";
    if (!this.sel || !t.thisWeek.comparison.days.some((x) => x.day === this.sel)) this.sel = FC.state.data.today;
    this.draw();
  },
  rerender() { if (FC.state.data?.training?.thisWeek) this.draw(); },
  short(x) {
    if (x.type === "rest") return "Ruhe";
    const ride = this.RIDES.includes(x.type);
    return ride ? "Rad" : x.type === "strength" ? "Kraft" : x.title.split(/[ -]/)[0];
  },
  draw() {
    const { $, el, de, fmtWeekday, fmtDayLong } = FC, d = FC.state.data, t = d.training, days = t.thisWeek.comparison.days;
    const week = el("div", { class: "ag-week", role: "group", "aria-label": "Diese Woche" }, ...days.map((x) => {
      const b = el("button", { type: "button", class: `ag-day${x.day === d.today ? " today" : ""}${x.type === "rest" ? " rest" : ""}`, "aria-pressed": String(x.day === this.sel),
        "aria-label": `${fmtDayLong(x.day)}: ${x.title}${x.status && this.MARK[x.status] ? `, ${{ done: "erledigt", missed: "ausgefallen", partial: "teilweise", extra: "extra" }[x.status]}` : ""}` },
        el("span", { class: "w", text: fmtWeekday(x.day) }), el("span", { class: "k", text: this.short(x) }), el("span", { class: "p", text: x.strength && x.type !== "strength" ? "+ Kraft" : "" }), el("span", { class: `s ${x.status ?? ""}`, text: this.MARK[x.status] ?? "" }));
      b.onclick = () => { this.sel = x.day; this.draw(); };
      return b;
    }));
    const x = days.find((y) => y.day === this.sel) ?? days[0];
    const isToday = x.day === d.today;
    const kraft = (t.strengthWorkouts?.days ?? []).find((k) => k.day === x.day);
    const fuel = (t.fueling?.days ?? []).find((f) => f.day === x.day);
    const nut = (t.nutrition?.days ?? []).find((n) => n.day === x.day);
    const ftp = t.ftpTest?.day === x.day ? t.ftpTest : null;
    const both = (t.sameDay?.days ?? []).find((s) => s.day === x.day);
    const det = el("div", { class: "ag-det" },
      el("div", { class: "ag-head" }, el("h3", { text: `${isToday ? "Heute" : fmtDayLong(x.day)}: ${x.title}` }),
        el("span", { class: "ag-meta", text: x.type === "rest" ? "" : `${x.durationMin ? `${x.durationMin} min · ` : ""}~${de(x.targetLoad)} Belastung` })),
      isToday && t.today?.text ? el("p", {}, el("strong", { text: t.today.text })) : null,
      x.intensity && x.type !== "rest" ? el("p", { class: "ag-meta", text: x.intensity }) : null,
      el("p", { text: x.description }),
      kraft ? el("p", { text: `Kraft, ${kraft.durationMin} min: ${kraft.exercises.map((e) => `${e.name} ${e.sets}×${e.reps}${e.unit === "s" ? " s" : ""}${e.weightKg != null ? ` ${de(e.weightKg, e.weightKg % 1 ? 1 : 0)} kg` : ""}`).join(", ")}` }) : null,
      ftp ? el("p", {}, el("strong", { text: "Oder FTP-Test: " }), ftp.reason ?? "") : null,
      both ? el("p", { class: "ag-both" }, el("strong", { text: both.conflict ? "Doppeltag, besser trennen: " : "Doppeltag: " }), both.text) : null,
      fuel && fuel.short !== "nur Wasser" ? el("p", { class: "ag-meta", text: `Verpflegung: ${fuel.short}` }) : null,
      nut ? el("p", { class: "ag-meta", title: nut.text, text: `Essen ${isToday ? "heute" : "am Tag"}: ${nut.short}` }) : null,
      x.actualMin || x.actualLoad ? el("p", { class: "muted", text: `Erledigt: ${de(x.actualMin)} min, Belastung ~${de(x.actualLoad)}${x.actualSports?.length ? ` (${x.actualSports.map(FC.sport).join(", ")})` : ""}.` }) : null);
    const act = el("div", { class: "ag-act" });
    if (kraft && x.day >= d.today) {
      const b = el("button", { type: "button", class: "primary", text: FC.state.gym?.st ? "Zum Gym-Modus" : "Im Gym-Modus starten" });
      b.onclick = () => { this.go("training", "gym"); FC.state.gym?.startPlan(x.day); };
      act.append(b);
    }
    if (this.RIDES.includes(x.type) && x.day >= d.today) {
      const b = el("button", { type: "button", class: kraft ? "" : "primary", text: "Workout für MyWhoosh" });
      b.onclick = () => {
        this.go("training", "bikewo");
        // Am Handy füllt der Abschnitt seine Tage erst beim ersten Öffnen; dann kurz warten.
        const pick = (n) => { const sel = $("bwDay"); if (sel && [...sel.options].some((o) => o.value === x.day)) { if (sel.value !== x.day) { sel.value = x.day; $("bwType").value = ""; sel.dispatchEvent(new Event("change")); } } else if (n) setTimeout(() => pick(n - 1), 250); };
        pick(8);
      };
      act.append(b);
    }
    if (isToday && (x.status === "done" || x.status === "partial" || x.type === "rest") && t.mobilityToday) {
      const b = el("button", { type: "button", text: "Mobility starten" });
      b.onclick = () => { (FC.goTo ?? ((id) => this.go("heute", id)))("mobility"); if (!FC.state.mobilityRunning) FC.$("moStart")?.click(); };
      act.append(b);
    }
    const all = el("button", { type: "button", text: "Ganzer Wochenplan" });
    all.onclick = () => this.go("coach", "plan");
    act.append(all);
    const cal = this.calButton();
    if (cal) act.append(cal);
    // Heutige Workouts ohne Anstrengung: kurz nachfragen (#134), verbessert die Belastungsschätzung beim Krafttraining.
    const open = isToday && FC.state.rpePicker ? d.workouts.filter((w) => w.day === d.today && !w.rpe && w.durationMin >= 10).slice(0, 2) : [];
    const ask = open.map((w) => el("div", { class: "ag-rpe" }, el("p", { text: `Wie anstrengend war dein ${FC.sport(w.sport)} (${de(w.durationMin)} min)? 1 sehr leicht, 10 maximal.` }), FC.state.rpePicker(w)));
    $("agBody").replaceChildren(week, det, ...ask, isToday && (x.status === "done" || x.status === "partial") ? this.feedback(d) : "", isToday && x.actualMin > 0 && (this.RIDES.includes(x.type) || (x.actualSports ?? []).some((sp) => /cycl|bike|ride|rad/i.test(sp))) ? this.sweat(d, x) : "", act, el("p", { class: "muted", id: "agMsg", role: "status" }));
  },
  /** Rückmeldung zur Tagesempfehlung (#216): passt / zu hart / zu leicht. */
  feedback(d) {
    const { el } = FC, cur = d.recommendationFeedback?.today ?? null;
    const opts = [["ok", "Passte"], ["too_hard", "War zu hart"], ["too_easy", "War zu leicht"]];
    const row = el("div", { class: "ag-fb", role: "group", "aria-label": "Rückmeldung zur Empfehlung" }, ...opts.map(([v, label]) => {
      const b = el("button", { type: "button", text: label, "aria-pressed": String(cur === v) });
      b.onclick = async () => {
        try {
          const r = await FC.call("save_recommendation_feedback", { verdict: v, readiness: d.coach?.readiness });
          d.recommendationFeedback = { ...(d.recommendationFeedback ?? {}), ...r };
          this.draw();
          FC.$("agMsg").textContent = "Danke, gespeichert.";
        } catch { FC.$("agMsg").textContent = "Speichern fehlgeschlagen."; }
      };
      return b;
    }));
    return el("div", { class: "ag-rpe" }, el("p", { text: "Wie passte die Empfehlung heute?" }), row);
  },
  /** Schweißrate messen (#282): Gewicht vor/nach der Fahrt plus Getrunkenes → persönliche Trinkmenge. */
  sweat(d, x) {
    const { el } = FC, sw = d.training?.sweat;
    const num = (id, label, attrs) => el("label", {}, label, el("input", { id, type: "number", inputmode: "decimal", ...attrs }));
    const dur = num("swDur", "Dauer (min)", { min: 30, max: 600, step: 1 }); dur.querySelector("input").value = x.actualMin ?? "";
    const indoor = el("input", { id: "swIn", type: "checkbox" }); indoor.checked = true;
    const save = el("button", { type: "button", class: "primary", text: "Speichern" });
    // Nach dem Speichern zeichnet das Dashboard neu; das Ergebnis bleibt stehen und die Messung offen.
    const last = this.swLast?.day === d.today ? this.swLast : null;
    const out = el("p", { class: "muted", id: "swOut", role: "status", text: last?.text ?? (sw?.indoor || sw?.outdoor ? sw.text : "") });
    save.onclick = async () => {
      const v = (id) => { const n = Number(String(FC.$(id).value).replace(",", ".")); return FC.$(id).value === "" || !Number.isFinite(n) ? null : n; };
      const input = { durationMin: v("swDur"), weightBeforeKg: v("swBefore"), weightAfterKg: v("swAfter"), drankL: v("swDrank") ?? 0, indoor: indoor.checked };
      if (!input.durationMin || !input.weightBeforeKg || !input.weightAfterKg) { out.textContent = "Bitte Dauer und beide Gewichte eintragen."; return; }
      save.disabled = true;
      try {
        const r = await FC.call("log_sweat_test", input);
        if (d.training) d.training.sweat = r;
        this.swLast = { day: d.today, text: `Gespeichert: ${FC.de(r.saved.rateLph, 2)} l/h. ${r.text}` };
        out.textContent = this.swLast.text;
      } catch (err) { out.textContent = err?.code === "tool_error" ? String(err.message).slice(0, 200) : "Speichern fehlgeschlagen."; }
      save.disabled = false;
    };
    const box = el("details", { class: "ag-sw" }, el("summary", { text: "Schweißrate messen" }),
      el("p", { class: "fine muted", text: "Vor und nach der Fahrt ohne Kleidung wiegen (nach dem Abtrocknen), getrunkene Menge notieren. Daraus wird deine Trinkmenge pro Stunde." }),
      el("div", { class: "ag-swf" }, num("swBefore", "Gewicht vorher (kg)", { min: 30, max: 250, step: 0.1 }), num("swAfter", "Gewicht nachher (kg)", { min: 30, max: 250, step: 0.1 }), num("swDrank", "Getrunken (l)", { min: 0, max: 10, step: 0.1 }), dur,
        el("label", { class: "ag-swc" }, indoor, " Auf der Rolle")),
      el("div", { class: "ag-swa" }, save), out);
    // Das Dashboard zeichnet bei Größenänderungen neu (auch durchs Aufklappen); Offen-Zustand, Eingaben und Fokus bleiben erhalten.
    const keep = this.swKeep?.day === d.today ? this.swKeep : (this.swKeep = { day: d.today, open: false, vals: {} });
    for (const i of box.querySelectorAll("input[id]")) {
      if (i.id in keep.vals) { if (i.type === "checkbox") i.checked = keep.vals[i.id]; else i.value = keep.vals[i.id]; }
      i.addEventListener("input", () => { keep.vals[i.id] = i.type === "checkbox" ? i.checked : i.value; });
      i.addEventListener("focus", () => { keep.focus = i.id; });
      i.addEventListener("blur", () => { if (keep.focus === i.id) keep.focus = null; });
    }
    box.open = keep.open || Boolean(last);
    box.addEventListener("toggle", () => { keep.open = box.open; });
    if (keep.focus) queueMicrotask(() => { const f = box.isConnected && FC.$(keep.focus); if (f && document.activeElement !== f) f.focus(); });
    return box;
  },
  /** Zum Abschnitt springen (am Handy erst den Tab wechseln). */
  go(tab, id) {
    FC.showTab(tab);
    requestAnimationFrame(() => FC.$(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  },
});
