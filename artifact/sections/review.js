// Wochenrückblick (#76): Kennzahlen gegen die Vorwoche, Highlights, Hinweise für die nächste Woche
// (get_week_review) und ein von Claude geschriebener Rückblick, der als Coach-Notiz gespeichert wird.
FC.section({
  id: "review",
  tab: "coach",
  order: 25,
  css: `
    .rv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; }
    .rv-stats > div { border: 1px solid var(--line, rgba(127,127,127,.25)); border-radius: 10px; padding: 8px 10px; min-width: 0; }
    .rv-stats b { font-size: 18px; display: block; }
    .rv-up { color: var(--good-ink); } .rv-down { color: var(--bad-ink); }
    .rv-list { margin: 0; padding-left: 1.2em; display: grid; gap: 4px; }
    .rv-week { display: flex; gap: 6px; flex-wrap: wrap; }
    .rv-week button[aria-pressed="true"] { background: var(--accent, #4fb3cf); color: var(--accent-ink, #fff); border-color: transparent; }
  `,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-review">Wochenrückblick</h2><span class="muted" id="rvState"></span></div>
      <div class="panel" style="display:grid; gap:12px;">
        <div class="rv-week"><button type="button" data-w="previous" aria-pressed="true">Letzte Woche</button><button type="button" data-w="current" aria-pressed="false">Diese Woche bisher</button></div>
        <div class="rv-stats" id="rvStats"><span class="muted">Lädt …</span></div>
        <div id="rvLists"></div>
        <div id="rvText" class="coach-out"></div>
        <div class="coach-actions"><button type="button" class="primary" id="rvWrite" disabled>Rückblick schreiben (Claude)</button><span class="muted" id="rvMsg"></span></div>
        <p class="fine" id="rvFine"></p>
      </div>`;
    this.root = root;
    this.week = "previous";
    root.querySelectorAll("[data-w]").forEach((b) => (b.onclick = () => {
      this.week = b.dataset.w;
      root.querySelectorAll("[data-w]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      this.load();
    }));
    FC.$("rvWrite").onclick = () => this.write();
  },
  async ready() { await this.load(); },
  render() { if (this.data) this.paint(); },
  rerender() {},
  async load(fresh) {
    if (!FC.state.mcp) { this.root.hidden = true; return; }
    try { this.data = await FC.call("get_week_review", { week: this.week }, fresh ? { cache: false } : { cache: { staleTime: 300_000, gcTime: 86_400_000 } }); }
    catch (e) { this.data = { error: FC.errText(e) }; }
    this.paint();
  },
  paint() {
    const { $, el, de, fmtDayLong, richText } = FC, r = this.data;
    const stats = $("rvStats"), lists = $("rvLists");
    if (!r || r.error) { stats.replaceChildren(el("span", { class: "muted", text: r?.error ?? "Lädt …" })); lists.replaceChildren(); return; }
    $("rvState").textContent = `Woche ab ${fmtDayLong(r.week)}${r.complete ? "" : " (läuft noch)"}`;
    // Pfeil grün, wenn die Änderung gut ist (Ruhepuls: weniger ist besser).
    const delta = (c, unit, digits = 1, lowerIsBetter = false) => {
      if (c?.delta == null || c.delta === 0) return null;
      const good = lowerIsBetter ? c.delta < 0 : c.delta > 0;
      return el("span", { class: good ? "rv-up" : "rv-down", text: ` ${c.delta > 0 ? "▲ +" : "▼ −"}${de(Math.abs(c.delta), digits)}${unit}` });
    };
    const tile = (label, value, d) => el("div", {}, el("span", { class: "muted", text: label }), el("b", { text: value }), ...(d ? [el("span", { style: "font-size:12px" }, "zur Vorwoche", d)] : []));
    const v = r.vsPrevious, f = r.fitness;
    stats.replaceChildren(
      tile("Training", `${de(r.totals.hours, 1)} h · ${r.totals.workouts}×`, delta(v.hours, " h")),
      tile("Belastung (geschätzt)", de(r.totals.load), delta(v.load, "", 0)),
      tile("Fitness (CTL)", f.ctlEnd != null ? de(f.ctlEnd, 1) : "–", delta({ delta: f.ctlChange }, "")),
      tile("Erholung Ø", v.recovery.value != null ? `${de(v.recovery.value, 0)} %` : "–", delta(v.recovery, " %", 0)),
      tile("HRV Ø", v.hrv.value != null ? `${de(v.hrv.value, 0)} ms` : "–", delta(v.hrv, " ms", 0)),
      tile("Ruhepuls Ø", v.rhr.value != null ? `${de(v.rhr.value, 0)}` : "–", delta(v.rhr, "", 0, true)),
      tile("Schlaf Ø", v.sleepH.value != null ? `${de(v.sleepH.value, 1)} h` : "–", delta(v.sleepH, " h")),
      tile("Kraft · Ruhetage", `${r.totals.strengthSessions}× · ${r.totals.restDays}`, null),
    );
    const list = (title, items) => (items.length ? [el("h4", { text: title }), el("ul", { class: "rv-list" }, ...items.map((t) => el("li", { text: t })))] : []);
    const extra = [];
    if (r.intensity) extra.push(`Intensität: locker ${de(r.intensity.easyPct)} %, mittel ${de(r.intensity.moderatePct)} %, hart ${de(r.intensity.hardPct)} % (WHOOP-Zonen).`);
    if (r.plan) extra.push(`Plan${r.planSource === "Vorschlag" ? " (nur Vorschlag, nicht gespeichert)" : ""}: ${r.plan.summary}`);
    if (r.journal.entries) extra.push(`Tagebuch: ${r.journal.entries} Einträge${r.journal.avgFeeling != null ? `, Befinden Ø ${de(r.journal.avgFeeling, 1)}/5` : ""}${r.journal.tags.length ? `, Tags: ${r.journal.tags.map((t) => `${t.tag} (${t.count}×)`).join(", ")}` : ""}.`);
    lists.replaceChildren(...list("Highlights", [...r.highlights, ...extra]), ...list("Für die nächste Woche", r.nextWeek));
    const saved = r.savedReview;
    if (saved) richText($("rvText"), saved.body); else $("rvText").replaceChildren();
    $("rvWrite").textContent = saved ? "Neu schreiben (Claude)" : "Rückblick schreiben (Claude)";
    $("rvWrite").disabled = !FC.state.sample;
    $("rvWrite").hidden = !FC.state.sample;
    $("rvFine").textContent = r.disclaimer;
  },
  async write() {
    const { $, richText, state } = FC, r = this.data;
    if (!r || r.error || !state.sample) return;
    const rules = state.coach?.rules ?? "Du bist Rad- und Krafttrainer. Deutsch, per du, konkret. Nur Trainingsempfehlungen, keine Diagnosen. Schätzungen kennzeichnen.";
    const task = `Aufgabe: Schreibe den Wochenrückblick für die Woche ab ${r.week}${r.complete ? "" : " (Woche läuft noch, bisheriger Stand)"}: was gut lief, was auffällt (im Vergleich zur Vorwoche), wie Rad und Kraft zusammenpassten, und die 2–3 wichtigsten Punkte für die nächste Woche. Nutze die Hinweise unter nextWeek, formuliere sie aber selbst. Höchstens 200 Wörter.`;
    const { savedReview, ...data } = r;
    const out = $("rvText");
    $("rvWrite").disabled = true; $("rvMsg").textContent = "Claude schreibt …";
    try {
      const { text } = await state.sample(`${rules}\n\n${task}\n\nDaten:\n${JSON.stringify(data)}`, { cache: false, onText: ({ text }) => richText(out, text) });
      if (!text?.trim()) throw { code: "empty" };
      await FC.call("save_coach_note", { kind: "weekly_review", day: r.week, title: `Wochenrückblick ab ${r.week}`, body: text.trim().slice(0, 6000), data: { totals: r.totals, fitness: r.fitness } });
      $("rvMsg").textContent = "Gespeichert.";
      await this.load(true);
    } catch (e) {
      $("rvMsg").textContent = e?.code === "empty" ? "Claude hat keinen Text geliefert. Bitte noch einmal versuchen." : e?.code && !["tool_error", "server_unavailable", "needs_reauth"].includes(e.code) ? FC.sampleErrText(e) : FC.errText(e);
    } finally { $("rvWrite").disabled = !state.sample; }
    void savedReview;
  },
});
