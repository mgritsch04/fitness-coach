// Workout für MyWhoosh (#63): geplante Radeinheit als Intervallprofil in % FTP, Download als ZWO-Datei (get_bike_workout, Capability downloads).
FC.section({
  id: "bikewo",
  tab: "training",
  order: 47,
  css: `
    .bw-ctl { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: end; margin-bottom: 12px; }
    .bw-ctl label { display: grid; gap: 4px; font-size: .88rem; color: var(--ink-2); }
    .bw-ctl input { width: 6em; }
    .bw-sum { display: flex; flex-wrap: wrap; gap: 6px 20px; align-items: baseline; margin-bottom: 8px; }
    .bw-sum b { font-family: var(--font-display); font-size: 1.3rem; }
    .bw-prof svg { display: block; }
    .bw-prof text { font-size: 10px; fill: var(--ink-3); }
    .bw-steps { margin: 10px 0 0; padding-left: 1.2em; display: grid; gap: 4px; font-size: .92rem; }
    .bw-how a { color: var(--accent); }
    .bw-how { margin: 6px 0 0; padding-left: 1.2em; display: grid; gap: 4px; font-size: .9rem; color: var(--ink-2); }
    .bw-act { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 12px; }`,
  TYPES: [["", "Aus dem Wochenplan"], ["recovery", "Locker"], ["endurance", "Grundlage"], ["long", "Lange Grundlage"], ["tempo", "Tempo"], ["threshold", "Schwelle"], ["vo2max", "VO2max"], ["opener", "Vorbelastung"]],
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-bikewo">Workout für MyWhoosh</h2><span class="muted">Intervalle als Datei für die Rolle</span></div>
      <div class="panel">
        <form class="bw-ctl" id="bwForm" autocomplete="off">
          <label for="bwDay">Tag<select id="bwDay"></select></label>
          <label for="bwType">Einheit<select id="bwType">${this.TYPES.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>
          <label for="bwMin" id="bwMinL" hidden>Dauer (min)<input id="bwMin" type="number" min="20" max="360" step="5" value="60" inputmode="numeric"></label>
        </form>
        <div id="bwOut" aria-live="polite"></div>
        <div class="bw-act"><button type="button" class="primary" id="bwGet" disabled>Als .zwo herunterladen</button><span class="muted" id="bwMsg" role="status"></span></div>
        <ol class="bw-how"><li>Datei herunterladen.</li>
          <li>Auf <a href="https://workout.mywhoosh.com" target="_blank" rel="noopener">workout.mywhoosh.com</a> anmelden und die Datei hochladen.</li>
          <li>„Export to MyWhoosh“ wählen. Die Einheit steht dann in der App unter „MyWorkouts“ (läuft die App schon, einmal neu starten).</li></ol>
        <p class="chart-cap">Intervalle nach gängigen Faustregeln in % deiner FTP, Belastung geschätzt. MyWhoosh rechnet mit der FTP aus deinem MyWhoosh-Profil.</p>
      </div>`;
    const { $ } = FC;
    $("bwType").onchange = () => { $("bwMinL").hidden = !$("bwType").value; this.load(); };
    $("bwDay").onchange = () => this.load();
    $("bwMin").onchange = () => this.load();
    $("bwForm").onsubmit = (e) => { e.preventDefault(); this.load(); };
    $("bwGet").onclick = () => this.download();
  },
  async ready() {
    this.dl = await window.claude?.use?.("downloads").catch(() => null);
    this.fillDays();
    this.load();
  },
  fillDays() {
    const { $, el, addDays, fmtWeekday, fmtDay } = FC, today = FC.state.data?.today, sel = $("bwDay");
    if (!today || sel.options.length) return;
    sel.replaceChildren(...Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i); return el("option", { value: d, text: i === 0 ? "Heute" : i === 1 ? "Morgen" : `${fmtWeekday(d)} ${fmtDay(d)}` }); }));
  },
  render() { if (!this.rep && FC.state.data) { this.fillDays(); if (!this.busy) this.load(); } },
  rerender() { if (this.rep?.workout) this.show(); },
  async load() {
    const { $ } = FC, day = $("bwDay").value || FC.state.data?.today;
    if (!day || !FC.state.mcp) return;
    const type = $("bwType").value, input = { day, ...(type ? { type, durationMin: Number($("bwMin").value) || 60 } : {}) };
    const seq = (this.seq = (this.seq ?? 0) + 1);
    this.busy = true; $("bwGet").disabled = true; $("bwMsg").textContent = "";
    try { this.rep = await FC.call("get_bike_workout", input); }
    catch (err) { this.rep = { error: err?.code === "tool_error" ? this.toolMsg(err) : FC.errText(err) }; }
    finally { this.busy = false; }
    if (seq === this.seq) this.show();
  },
  toolMsg(err) { try { return JSON.parse(err.message).message; } catch { return String(err.message ?? "").slice(0, 200); } },
  show() {
    const { $, el, de } = FC, r = this.rep, out = $("bwOut");
    if (!r) { out.replaceChildren(el("div", { class: "empty", text: "Lädt …" })); return; }
    if (r.error) { out.replaceChildren(el("div", { class: "empty", text: r.error })); $("bwGet").disabled = true; return; }
    const w = r.workout, min = (s) => (s % 60 ? `${de(s / 60, 1)} min` : `${s / 60} min`);
    const w2 = (lo, hi) => (lo == null ? "" : hi == null || lo === hi ? ` · ${lo} W` : ` · ${lo}–${hi} W`);
    out.replaceChildren(
      el("div", { class: "bw-sum" }, el("b", { text: w.name }),
        el("span", { class: "muted", text: `Belastung ~${de(w.load)} · IF ${de(w.intensityFactor, 2)}${r.ftpW ? ` · FTP ${r.ftpW} W${r.ftpEstimated ? " (geschätzt)" : ""}` : ""}` }),
        r.planned ? el("span", { class: "muted", text: `Plan: ${r.planned.title}` }) : null),
      el("div", { class: "bw-prof" }, this.profile(w, out.clientWidth)),
      el("ol", { class: "bw-steps" }, ...w.steps.map((s) => el("li", { text: s.kind === "intervals"
        ? `${s.label}${w2(s.onWatts)}${s.offWatts != null ? ` / ${s.offWatts} W` : ""}`
        : `${min(s.durationS)} ${s.label} (${s.power != null ? `${Math.round(s.power * 100)} %` : `${Math.round(s.powerLow * 100)}→${Math.round(s.powerHigh * 100)} %`}${s.power != null ? w2(s.watts) : w2(s.wattsLow, s.wattsHigh)})` }))));
    $("bwGet").disabled = !this.dl;
    if (!this.dl) $("bwMsg").textContent = "Herunterladen ist in dieser Ansicht nicht verfügbar.";
  },
  /** Profil: Zeit nach rechts, Leistung nach oben; gestrichelte Linie = FTP. */
  profile(w, width) {
    const { sv, cssVar } = FC, W = Math.max(280, Math.round(width || 600)), H = 130, top = 8, base = H - 16, maxP = 1.25;
    const total = w.steps.reduce((a, s) => a + s.durationS, 0), x = (t) => (t / total) * W, y = (p) => base - (Math.min(p, maxP) / maxP) * (base - top);
    const svg = sv("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Intervallprofil ${w.name}` });
    const accent = cssVar("--accent"), seg = [];
    let t = 0;
    const push = (d, p0, p1 = p0) => { seg.push([t, d, p0, p1]); t += d; };
    for (const s of w.steps) {
      if (s.kind === "intervals") for (let i = 0; i < s.repeat; i++) { push(s.onS, s.onPower); push(s.offS, s.offPower); }
      else if (s.kind === "steady") push(s.durationS, s.power);
      else push(s.durationS, s.powerLow, s.powerHigh);
    }
    for (const [t0, d, p0, p1] of seg) {
      const op = Math.max(0.25, Math.min(1, ((p0 + p1) / 2 - 0.4) / 0.75));
      svg.append(sv("polygon", { points: `${x(t0)},${base} ${x(t0)},${y(p0)} ${x(t0 + d) - 0.6},${y(p1)} ${x(t0 + d) - 0.6},${base}`, fill: accent, "fill-opacity": op.toFixed(2) }));
    }
    svg.append(sv("line", { x1: 0, x2: W, y1: y(1), y2: y(1), stroke: cssVar("--ink-3"), "stroke-dasharray": "4 4", "stroke-width": 1 }));
    const lbl = sv("text", { x: W - 2, y: y(1) - 3, "text-anchor": "end" }); lbl.textContent = "FTP"; svg.append(lbl);
    for (let m = 0; m <= total / 60; m += total > 5400 ? 30 : 15) { const tx = sv("text", { x: Math.min(x(m * 60), W - 14), y: H - 3 }); tx.textContent = `${m}′`; svg.append(tx); }
    return svg;
  },
  async download() {
    const { $ } = FC, r = this.rep;
    if (!r?.zwo || !this.dl) return;
    $("bwGet").disabled = true; $("bwMsg").textContent = "";
    try { await this.dl.save({ filename: r.fileName, data: new Blob([r.zwo], { type: "application/xml" }) }); $("bwMsg").textContent = `${r.fileName} gespeichert.`; }
    catch (err) { $("bwMsg").textContent = err?.code === "declined" ? "Abgebrochen." : FC.errText(err); }
    finally { $("bwGet").disabled = false; }
  },
});
