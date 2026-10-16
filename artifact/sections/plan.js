// Wochenplan und Ziele (Coach mit Gedächtnis, #22): Plan Mo–So mit Soll/Ist-Häkchen, Abgleich
// heutige Einheit ↔ Tagesform, Vorschlag übernehmen, von Claude an die Tagesform anpassen lassen,
// Ziele mit Countdown. Daten: get_dashboard → training; Aktionen: save_plan, set_goals (docs/COACH.md).
FC.section({
  id: "plan",
  tab: "coach",
  order: 15,
  css: `
    .wplan { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
    .wplan .pd { border: 1px solid var(--line, rgba(127,127,127,.25)); border-radius: 10px; padding: 8px 6px; min-width: 0; display: grid; gap: 3px; align-content: start; }
    .wplan .pd.today { outline: 2px solid var(--accent, #4fb3cf); outline-offset: -1px; }
    .wplan .pd .wd { font-size: 12px; opacity: .7; display: flex; justify-content: space-between; gap: 4px; }
    .wplan .pd .t { font-weight: 600; font-size: 13px; line-height: 1.2; overflow-wrap: anywhere; }
    .wplan .pd .m { font-size: 12px; opacity: .75; }
    .wplan .pd .k { font-size: 11px; opacity: .8; }
    .wplan .pd.rest { opacity: .7; }
    .wplan .ck { font-weight: 700; }
    .wplan .ck.done { color: #2fbf2f; } .wplan .ck.missed { color: #e66767; } .wplan .ck.partial { color: #fab219; } .wplan .ck.extra { color: #4fb3cf; }
    .pdetail { margin-top: 10px; }
    .goals { display: grid; gap: 8px; }
    .goal { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; flex-wrap: wrap; }
    .goal b { font-weight: 600; }
    .goalform { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .goalform input, .goalform select { min-width: 0; }
    .goalform input[type=text] { flex: 1 1 160px; }
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
    $("goalForm").addEventListener("submit", (e) => { e.preventDefault(); this.addGoal(); });
    // Coach-Bereich bekommt Plan, Ziele und Tagebuch als zusätzliche Daten für Claude.
    const prevExtras = FC.state.coachExtras;
    FC.state.coachExtras = () => {
      const t = FC.state.data?.training, j = FC.state.data?.journal;
      return {
        ...(prevExtras ? prevExtras() : {}),
        ...(t ? {
          wochenplan: { phase: t.thisWeek.phaseLabel, grund: t.thisWeek.plan.phaseReason, stand: t.thisWeek.comparison.summary, heute: t.today.text, intensitaet: t.intensity?.text ?? null, ftpTest: t.ftpTest?.text ?? null,
            tage: t.thisWeek.comparison.days.map((x) => ({ tag: x.day, einheit: x.title, typ: x.type, min: x.durationMin, belastung: x.targetLoad, kraft: x.strength?.focus ?? null, status: x.status })) },
          ziele: t.goals.map((g) => ({ ziel: g.goal.title, datum: g.goal.targetDate, prio: g.goal.priority, stand: g.text })),
          vorlieben: t.prefs,
        } : {}),
        ...(j ? { tagebuchHeute: j.today, tagebuch7Tage: j.recent?.slice(0, 7) } : {}),
      };
    };
  },
  render(d) {
    const { $, el, de, fmtWeekday, fmtDayLong } = FC;
    const t = d.training;
    this.root.hidden = !t;
    if (!t) return;
    const w = t.thisWeek, cmp = w.comparison;
    $("planPhase").textContent = `${w.phaseLabel}${w.stored ? (w.plan.source === "coach" ? " · von Claude angepasst" : " · gespeichert") : " · Vorschlag"}`;
    const fToday = (t.fueling?.days ?? []).find((f) => f.day === d.today);
    $("planToday").textContent = t.today.text + (fToday && fToday.short !== "nur Wasser" ? ` Verpflegung: ${fToday.short}.` : "");
    $("planSummary").textContent = `${cmp.summary} Geplant: ${de(w.plan.targetHours, 1)} h, ~${de(w.plan.days.reduce((a, x) => a + x.targetLoad, 0))} Belastungspunkte (geschätzt).`;
    if (t.intensity && t.intensity.verdict !== "ok") $("planSummary").textContent += ` ${t.intensity.text}`;
    if (t.ftpTest) $("planSummary").textContent += ` ${t.ftpTest.text}`;
    const ftpDay = t.ftpTest?.day ?? null;
    const MARK = { done: "✓", missed: "✗", partial: "◐", extra: "+", today: "•", upcoming: "", rest: "" };
    const grid = $("wplan"); grid.replaceChildren();
    const fuel = new Map((t.fueling?.days ?? []).map((f) => [f.day, f]));
    for (const x of cmp.days) {
      const box = el("button", { type: "button", class: `pd${x.type === "rest" ? " rest" : ""}${x.day === d.today ? " today" : ""}`, "aria-label": `${fmtDayLong(x.day)}: ${x.title}` });
      box.style.textAlign = "left"; box.style.font = "inherit"; box.style.color = "inherit"; box.style.background = "transparent"; box.style.cursor = "pointer";
      box.append(...[
        el("span", { class: "wd" }, el("span", { text: fmtWeekday(x.day) }), el("span", { class: `ck ${x.status}`, text: MARK[x.status] ?? "" })),
        el("span", { class: "t", text: x.title }),
        el("span", { class: "m", text: x.type === "rest" ? "" : `${x.durationMin ? `${x.durationMin} min · ` : ""}~${de(x.targetLoad)}` }),
        x.strength && x.type !== "strength" ? el("span", { class: "k", text: `+ Kraft ${x.strength.durationMin} min${x.strengthDone ? " ✓" : ""}` }) : null,
        x.day === ftpDay ? el("span", { class: "k", text: "oder FTP-Test" }) : null,
      ].filter(Boolean));
      box.onclick = () => {
        const out = $("planDetail"); out.classList.remove("muted"); out.replaceChildren(...[
          el("p", {}, el("strong", { text: `${fmtDayLong(x.day)}: ${x.title}` })),
          x.intensity ? el("p", { text: x.intensity }) : null,
          el("p", { text: x.description }),
          ...(x.day === ftpDay ? [el("p", {}, el("strong", { text: "Vorschlag: FTP-Test statt dieser Einheit. " }), t.ftpTest.reason), el("ul", {}, ...t.ftpTest.howTo.map((h) => el("li", { text: h })))] : []),
          ...(fuel.get(x.day) ? [el("p", {}, el("strong", { text: "Verpflegung: " }), [fuel.get(x.day).before, fuel.get(x.day).during, fuel.get(x.day).after].filter(Boolean).join(" ")), el("p", { class: "fine", text: t.fueling.note })] : []),
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
