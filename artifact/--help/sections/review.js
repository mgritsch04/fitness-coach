// Wochenrückblick (#76): Kennzahlen gegen die Vorwoche, Highlights, Hinweise für die nächste Woche
// (get_week_review) und ein von Claude geschriebener Rückblick, der als Coach-Notiz gespeichert wird.
// „Als Bild speichern“ (#218): Wochenbilanz als PNG-Karte per Canvas, über die Capability downloads.
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
        <div class="coach-actions"><button type="button" class="primary" id="rvWrite" disabled>Rückblick schreiben (Claude)</button><button type="button" id="rvImg" disabled>Als Bild speichern</button><span class="muted" id="rvMsg" role="status"></span></div>
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
    FC.$("rvImg").onclick = () => this.saveImage();
  },
  async ready() {
    this.dl = await window.claude?.use?.("downloads").catch(() => null);
    FC.$("rvImg").hidden = !this.dl;
    await this.load();
  },
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
    $("rvImg").disabled = !this.dl;
  },
  /** Wochenbilanz als Karte (1080 × 1350) in den Farben des aktuellen Themas. */
  async card() {
    const { de, fmtDayLong, sport, cssVar } = FC, r = this.data, v = r.vsPrevious, f = r.fitness;
    await document.fonts?.ready;
    const W = 1080, H = 1350, P = 72, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    const col = (n, fb) => cssVar(n) || fb;
    const bg = col("--bg", "#eef1f3"), panel = col("--panel", "#ffffff"), ink = col("--ink", "#15212b"), ink2 = col("--ink-2", "#3c4a56"), ink3 = col("--ink-3", "#5a6671"), line = col("--line", "#d5dce2"), accent = col("--accent", "#0d6e8a");
    const display = (px, w = 600) => `${w} ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`, body = (px, w = 400) => `${w} ${px}px "Source Sans 3", "Segoe UI", sans-serif`;
    const rr = (x, y, w, h, rad) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, rad) : g.rect(x, y, w, h); };
    const wrap = (text, x, y, maxW, lh, maxLines) => {
      const words = String(text).split(/\s+/); let lineTxt = "", n = 0;
      for (const w of words) {
        const t = lineTxt ? `${lineTxt} ${w}` : w;
        if (g.measureText(t).width > maxW && lineTxt) { if (++n > maxLines) return y; g.fillText(n === maxLines ? `${lineTxt} …` : lineTxt, x, y); y += lh; lineTxt = w; if (n === maxLines) return y; }
        else lineTxt = t;
      }
      if (lineTxt && n < maxLines) { g.fillText(lineTxt, x, y); y += lh; }
      return y;
    };
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = accent; g.fillRect(0, 0, W, 14);
    g.textBaseline = "alphabetic";
    g.fillStyle = ink; g.font = display(88); g.fillText("Wochenbilanz", P, P + 80);
    g.fillStyle = ink2; g.font = body(34); g.fillText(`Woche ab ${fmtDayLong(r.week)}${r.complete ? "" : " · läuft noch"}`, P, P + 132);
    // Kennzahlen 2 × 4
    const arrow = (d, lowerIsBetter, unit, digits) => (d == null || d === 0 ? null : { good: lowerIsBetter ? d < 0 : d > 0, text: `${d > 0 ? "▲ +" : "▼ −"}${de(Math.abs(d), digits)}${unit}` });
    const tiles = [
      ["Training", `${de(r.totals.hours, 1)} h · ${r.totals.workouts}×`, arrow(v.hours?.delta, false, " h", 1)],
      ["Belastung (geschätzt)", de(r.totals.load), arrow(v.load?.delta, false, "", 0)],
      ["Fitness (CTL)", f.ctlEnd != null ? de(f.ctlEnd, 1) : "–", arrow(f.ctlChange, false, "", 1)],
      ["Erholung Ø", v.recovery.value != null ? `${de(v.recovery.value, 0)} %` : "–", arrow(v.recovery.delta, false, " %", 0)],
      ["HRV Ø", v.hrv.value != null ? `${de(v.hrv.value, 0)} ms` : "–", arrow(v.hrv.delta, false, " ms", 0)],
      ["Ruhepuls Ø", v.rhr.value != null ? de(v.rhr.value, 0) : "–", arrow(v.rhr.delta, true, "", 0)],
      ["Schlaf Ø", v.sleepH.value != null ? `${de(v.sleepH.value, 1)} h` : "–", arrow(v.sleepH.delta, false, " h", 1)],
      ["Kraft · Ruhetage", `${r.totals.strengthSessions}× · ${r.totals.restDays}`, null],
    ];
    const gx = 20, tw = (W - 2 * P - gx) / 2, th = 132, top = P + 170;
    tiles.forEach(([label, value, d], i) => {
      const x = P + (i % 2) * (tw + gx), y = top + Math.floor(i / 2) * (th + gx);
      g.fillStyle = panel; rr(x, y, tw, th, 18); g.fill(); g.strokeStyle = line; g.lineWidth = 2; g.stroke();
      g.fillStyle = ink3; g.font = body(26, 600); g.fillText(label.toUpperCase(), x + 26, y + 44);
      g.fillStyle = ink; g.font = display(60); g.fillText(value, x + 26, y + 104);
      if (d) { g.fillStyle = col(d.good ? "--good-ink" : "--bad-ink", d.good ? "#0b7a0b" : "#b42f2f"); g.font = body(26, 600); g.textAlign = "right"; g.fillText(d.text, x + tw - 22, y + 44); g.textAlign = "left"; }
    });
    // Sportarten als gestapelter Balken mit Legende
    let y = top + 4 * (th + gx) + 30;
    const sports = (r.bySport ?? []).filter((x) => x.minutes > 0), total = sports.reduce((a, x) => a + x.minutes, 0);
    if (total) {
      g.fillStyle = ink; g.font = display(40); g.fillText("Trainingszeit nach Sport", P, y); y += 26;
      const colors = ["--s1", "--s2", "--s3", "--s7"].map((n, i) => col(n, ["#2a78d6", "#eb6834", "#1baf7a", "#6250d6"][i]));
      let x = P; const bw = W - 2 * P;
      sports.slice(0, 4).forEach((sp, i) => { const w = (sp.minutes / total) * bw; g.fillStyle = colors[i]; rr(x, y, Math.max(2, w - 4), 34, 6); g.fill(); x += w; });
      y += 70; x = P; g.font = body(28);
      for (const [i, sp] of sports.slice(0, 4).entries()) {
        const t = `${sport(sp.sport)} ${de(sp.minutes / 60, 1)} h`;
        g.fillStyle = colors[i]; rr(x, y - 22, 22, 22, 4); g.fill(); g.fillStyle = ink2; g.fillText(t, x + 32, y); x += 32 + g.measureText(t).width + 36;
      }
      y += 56;
    }
    // Highlights
    if (r.highlights?.length) {
      g.fillStyle = ink; g.font = display(40); g.fillText("Highlights", P, y); y += 50;
      g.font = body(30); g.fillStyle = ink2;
      for (const h of r.highlights.slice(0, 3)) { if (y > H - 110) break; g.fillText("•", P, y); y = wrap(h, P + 28, y, W - 2 * P - 28, 40, 2) + 8; }
    }
    g.fillStyle = ink3; g.font = body(24);
    g.fillText("Fitness Coach · Belastung und Fitness sind Schätzungen, keine medizinische Diagnose.", P, H - 44);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Bild konnte nicht erzeugt werden."))), "image/png"));
  },
  async saveImage() {
    const { $ } = FC, r = this.data;
    if (!r || r.error || !this.dl) return;
    $("rvImg").disabled = true; $("rvMsg").textContent = "Erstelle Bild …";
    try {
      const filename = `wochenbilanz-${r.week}.png`;
      await this.dl.save({ filename, data: await this.card() });
      $("rvMsg").textContent = `${filename} gespeichert.`;
    } catch (err) { $("rvMsg").textContent = err?.code === "declined" ? "Abgebrochen." : FC.errText(err); }
    finally { $("rvImg").disabled = false; }
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
