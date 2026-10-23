// Workout-Detail (#334): Klick auf den Sportnamen in der Workout-Liste öffnet ein Fenster.
// Kraft: Übungen mit allen Sätzen (get_strength). Rad mit FIT-Import: Kennzahlen, Verlauf, Zonen, Intervalle (get_workout_detail).
// Alles andere: Basisdaten aus der Liste. Kein eigener Abschnitt; nutzt FC.state.openWorkout, das workouts.js ausliest.
(() => {
  const { el, sv, de, sport, fmtDayLong, cssVar, SOURCES } = FC;
  const STRENGTH_RE = /weight|strength|bodybuild|powerlift|functional|crossfit|kraft|gym/i;
  const BIKE_RE = /cycl|spin|bike|ride|rad/i;
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const kg = (v) => `${de(v, v % 1 ? 1 : 0)} kg`;

  const dlg = el("dialog", { id: "woDetail", class: "wd-dlg", "aria-labelledby": "wdTitle" });
  const title = el("h3", { id: "wdTitle" });
  const sub = el("p", { class: "muted fine", id: "wdSub" });
  const close = el("button", { type: "button", class: "wd-close", text: "Schließen" });
  const body = el("div", { class: "wd-body", id: "wdBody", "aria-live": "polite" });
  dlg.append(el("div", { class: "wd-head" }, el("div", {}, title, sub), close), body);
  document.body.append(dlg);
  close.onclick = () => dlg.close();
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  const style = el("style", { text: `
    .wd-dlg { width: min(680px, calc(100vw - 24px)); max-height: min(88vh, 900px); border: 1px solid var(--line); border-radius: 14px; background: var(--panel); color: var(--ink); padding: 14px; }
    .wd-dlg::backdrop { background: rgba(0, 0, 0, 0.35); }
    .wd-head { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; }
    .wd-head h3 { margin: 0; } .wd-head p { margin: 2px 0 0; }
    .wd-body { display: grid; gap: 14px; margin-top: 10px; }
    .wd-body h4 { margin: 0 0 6px; font-size: 0.95rem; }
    .wd-body p { margin: 0; }
    .wd-kpi { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
    .wd-kpi div { background: var(--bg); border-radius: 8px; padding: 6px 10px; display: grid; gap: 1px; }
    .wd-kpi b { font-family: var(--font-display); font-size: 1.15rem; }
    .wd-kpi span { font-size: 0.78rem; color: var(--ink-3); }
    .wd-chart svg { display: block; width: 100%; height: auto; }
    .wd-chart text { font-size: 10px; fill: var(--ink-3); }
    .wd-leg { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.83rem; color: var(--ink-2); margin-top: 4px; }
    .wd-leg i { display: inline-block; width: 10px; height: 3px; border-radius: 2px; margin-right: 5px; vertical-align: middle; }
    .wd-zone { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; font-size: 0.86rem; margin-bottom: 8px; }
    .wd-zone .b { grid-column: 1 / -1; height: 8px; border-radius: 4px; background: var(--accent); min-width: 2px; }
    .wd-zone .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .wd-ex { border-bottom: 1px solid var(--line); padding-bottom: 8px; }
    .wd-ex:last-child { border-bottom: 0; }
    .wd-ex ol { margin: 4px 0 0; padding-left: 1.6em; display: grid; gap: 2px; font-variant-numeric: tabular-nums; }
    .wd-tbl { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .wd-tbl th, .wd-tbl td { text-align: right; padding: 4px 6px; border-bottom: 1px solid var(--line); }
    .wd-tbl th:first-child, .wd-tbl td:first-child { text-align: left; }
` });
  document.head.append(style);

  const kpis = (rows) => el("div", { class: "wd-kpi" }, ...rows.filter((r) => r[1] != null && r[1] !== "–").map(([l, v]) => el("div", {}, el("b", { text: String(v) }), el("span", { text: l }))));
  const note = (t) => el("p", { class: "muted", text: t });
  const section = (h, ...kids) => el("div", {}, el("h4", { text: h }), ...kids);

  /** Basisdaten aus der Workout-Liste (alle Sportarten). */
  function basics(w, skip = []) {
    return kpis([
      ["Dauer", w.durationMin ? `${de(w.durationMin)} min` : null], ["Ø Puls", w.avgHr ? `${de(w.avgHr)} /min` : null], ["Max. Puls", w.maxHr ? `${de(w.maxHr)} /min` : null],
      ["Ø Leistung", w.avgPowerW ? `${de(w.avgPowerW)} W` : null], ["NP", w.normalizedPowerW ? `${de(w.normalizedPowerW)} W` : null],
      ["Strain", w.strain != null ? de(w.strain, 1) : null], ["Belastung", w.load != null ? de(w.load) : null],
      ["Anstrengung", w.rpe ? String(w.rpe) : null], ["Strecke", w.distanceKm ? `${de(w.distanceKm, 1)} km` : null], ["Energie", w.energyKj ? `${de(w.energyKj)} kJ` : null],
    ].filter((r) => !skip.includes(r[0])));
  }

  // --- Kraft ---------------------------------------------------------------------------------
  async function strength(w) {
    const today = FC.state.data?.today ?? w.day;
    const weeks = Math.min(52, Math.max(1, Math.ceil((Date.parse(today) - Date.parse(w.day)) / 604_800_000) + 1));
    const out = [];
    if (!w.strengthSessionId) {
      out.push(note("Zu diesem Training sind keine Übungen eingetragen. Im Abschnitt „Krafttraining“ oder im Gym-Modus kannst du Sätze nachtragen."));
      return out;
    }
    const st = await FC.call("get_strength", { weeks: Math.min(52, weeks + 12) }, { cache: { staleTime: 60_000, gcTime: 86_400_000 } });
    const s = st.sessions.find((x) => x.id === w.strengthSessionId);
    if (!s?.sets?.length) { out.push(note("Die Übungen dieser Einheit sind nicht mehr abrufbar (älter als ein Jahr).")); return out; }
    const byEx = new Map();
    for (const x of s.sets) { if (!byEx.has(x.exercise)) byEx.set(x.exercise, { name: x.exerciseName, sets: [] }); byEx.get(x.exercise).sets.push(x); }
    const tonnage = s.sets.reduce((a, x) => a + x.reps * x.weightKg, 0);
    out.push(kpis([["Übungen", byEx.size], ["Sätze", s.sets.length], ["Volumen", tonnage ? `${de(tonnage)} kg` : null], ["Anstrengung", s.rpe ? de(s.rpe, s.rpe % 1 ? 1 : 0) : w.rpe ? String(w.rpe) : null], ["Belastung", s.load != null ? de(s.load) : w.load != null ? de(w.load) : null]]));
    const prevSessions = st.sessions.filter((x) => x.day < s.day || (x.day === s.day && x.id !== s.id)).sort((a, b) => b.day.localeCompare(a.day));
    const e1rm = (x) => (x.weightKg > 0 && x.reps >= 1 && x.reps <= 12 ? (x.reps === 1 ? x.weightKg : x.weightKg * (1 + x.reps / 30)) : null);
    const topOf = (sets) => sets.reduce((a, b) => ((e1rm(b) ?? b.weightKg) > (e1rm(a) ?? a.weightKg) ? b : a));
    for (const [id, ex] of byEx) {
      const top = topOf(ex.sets), est = e1rm(top);
      const prev = prevSessions.find((p) => p.sets.some((x) => x.exercise === id));
      const prevTop = prev ? topOf(prev.sets.filter((x) => x.exercise === id)) : null;
      const cmp = prevTop ? ` · zuletzt ${fmtDayLong(prev.day)}: ${prevTop.reps} × ${kg(prevTop.weightKg)}` : "";
      out.push(el("div", { class: "wd-ex" },
        el("b", { text: ex.name }),
        el("span", { class: "muted", text: ` · bester Satz ${top.reps} × ${kg(top.weightKg)}${est ? ` (≈ ${kg(Math.round(est * 10) / 10)} 1RM, geschätzt)` : ""}${cmp}` }),
        el("ol", {}, ...ex.sets.map((x) => el("li", { text: `${x.reps} × ${x.weightKg ? kg(x.weightKg) : "Körpergewicht"}${x.rpe ? ` · Anstrengung ${de(x.rpe, x.rpe % 1 ? 1 : 0)}` : ""}` })))));
    }
    if (s.notes) out.push(note(s.notes));
    return out;
  }

  // --- Rad -----------------------------------------------------------------------------------
  function chart(d) {
    const pts = d.series.points, W = 600, H = 170, L = 30, R = 30, T = 8, B = 20, pw = W - L - R, ph = H - T - B;
    const totalS = pts.length ? pts.at(-1).t + d.series.stepS : 1;
    const maxP = Math.max(100, ...pts.map((p) => p.power ?? 0)), hrs = pts.map((p) => p.hr).filter((v) => v != null);
    const minH = hrs.length ? Math.min(...hrs) - 5 : 0, maxH = hrs.length ? Math.max(...hrs) + 5 : 1;
    const x = (t) => L + (t / totalS) * pw, yP = (v) => T + ph - (v / maxP) * ph, yH = (v) => T + ph - ((v - minH) / (maxH - minH)) * ph;
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Verlauf von Leistung und Puls" });
    const line = (key, y, color) => {
      let dpath = "", pen = false;
      for (const p of pts) { if (p[key] == null) { pen = false; continue; } dpath += `${pen ? "L" : "M"}${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`; pen = true; }
      if (dpath) svg.append(sv("path", { d: dpath, fill: "none", stroke: color, "stroke-width": 1.4, "stroke-linejoin": "round" }));
    };
    const label = (txt, ax, ay, anchor) => { const t = sv("text", { x: ax, y: ay, "text-anchor": anchor }); t.textContent = txt; svg.append(t); };
    for (let i = 0; i <= 3; i++) {
      const v = (maxP * i) / 3;
      svg.append(sv("line", { x1: L, x2: W - R, y1: yP(v), y2: yP(v), stroke: cssVar("--line"), "stroke-width": 1 }));
      label(String(Math.round(v)), L - 4, yP(v) + 3, "end");
    }
    if (hrs.length) { label(String(Math.round(maxH)), W - R + 4, T + 8, "start"); label(String(Math.round(minH)), W - R + 4, T + ph, "start"); }
    const stepMin = totalS > 7200 ? 30 : totalS > 2700 ? 15 : 5;
    for (let m = 0; m * 60 <= totalS; m += stepMin) label(`${m}′`, x(m * 60), H - 5, "middle");
    line("power", yP, cssVar("--accent"));
    line("hr", yH, cssVar("--bad"));
    return el("div", { class: "wd-chart" }, svg, el("div", { class: "wd-leg" },
      el("span", {}, el("i", { style: `background:${cssVar("--accent")}` }), "Leistung (W)"),
      hrs.length ? el("span", {}, el("i", { style: `background:${cssVar("--bad")}` }), "Puls (/min)") : null));
  }

  function zones(title, zs) {
    if (!zs?.length) return null;
    const max = Math.max(...zs.map((z) => z.seconds), 1);
    return section(title, ...zs.map((z) => el("div", { class: "wd-zone" },
      el("span", { text: `Z${z.zone} ${z.name}` }),
      el("span", { class: "n", text: `${mmss(z.seconds)} · ${de(z.sharePct)} %` }),
      el("span", { class: "b", style: `width:${Math.max(2, (z.seconds / max) * 100).toFixed(1)}%`, "aria-hidden": "true" }))));
  }

  function ride(d) {
    const s = d.stats, out = [];
    out.push(kpis([
      ["Dauer", s.durationS ? `${de(Math.round(s.durationS / 60))} min` : null], ["Ø Leistung", s.avgPowerW != null ? `${de(s.avgPowerW)} W` : null], ["NP", s.normalizedPowerW ? `${de(s.normalizedPowerW)} W` : null],
      ["Max. Leistung", s.maxPowerW ? `${de(s.maxPowerW)} W` : null], ["IF", s.intensityFactor != null ? de(s.intensityFactor, 2) : null], ["VI", s.variabilityIndex != null ? de(s.variabilityIndex, 2) : null],
      ["TSS (Schätzung)", s.tssEstimate != null ? de(s.tssEstimate) : null], ["Arbeit", s.workKj != null ? `${de(s.workKj)} kJ` : null],
      ["Ø Puls", s.avgHr ? `${de(s.avgHr)} /min` : null], ["Max. Puls", s.maxHr ? `${de(s.maxHr)} /min` : null], ["Ø Trittfrequenz", s.avgCadence ? `${de(s.avgCadence)} rpm` : null],
      ["Entkopplung", d.decoupling ? `${de(d.decoupling.pct, 1)} %` : null],
    ]));
    if (d.series?.points?.length) out.push(section("Verlauf", chart(d)));
    out.push(zones("Zeit in Leistungszonen", d.zones?.power), zones("Zeit in Pulszonen", d.zones?.hr));
    const iv = d.intervals?.intervals ?? [];
    if (iv.length) {
      out.push(section(`Erkannte Intervalle (${iv.length})`, el("table", { class: "wd-tbl" },
        el("thead", {}, el("tr", {}, ...["Start", "Dauer", "Ø W", "% FTP", "Ø Puls"].map((h) => el("th", { text: h })))),
        el("tbody", {}, ...iv.map((i) => el("tr", {}, el("td", { text: mmss(i.startS) }), el("td", { text: mmss(i.durationS) }), el("td", { text: de(i.avgPowerW) }),
          el("td", { text: d.intervals.basis === "ftp" && i.pctFtp != null ? de(i.pctFtp) : "–" }), el("td", { text: i.avgHr ? de(i.avgHr) : "–" })))))));
    }
    const ref = d.reference?.ftpW ? `FTP ${d.reference.ftpW} W${d.ftpOrigin && d.ftpOrigin !== "user" ? " (geschätzt)" : ""}` : "ohne FTP keine Zonen und kein IF";
    out.push(el("p", { class: "chart-cap", text: `Bezug: ${ref}. Zonen, IF und TSS beruhen darauf. Aus der FIT-Datei berechnet, Hinweise statt Diagnose.` }));
    return out.filter(Boolean);
  }

  async function bike(w) {
    let d = null;
    try { d = await FC.call("get_workout_detail", { source: w.source ?? w.sources[0], sourceId: String(w.sourceId), maxPoints: 400 }, { cache: { staleTime: 60_000, gcTime: 86_400_000 } }); }
    catch (err) { return [basics(w), note(FC.errText(err))]; }
    if (!d?.found) return [basics(w), note("Zu dieser Fahrt gibt es keine Sekundenwerte. Mit einer FIT-Datei (Abschnitt „FIT-Upload“, z. B. aus MyWhoosh oder Wahoo) siehst du hier zusätzlich Verlauf, Zonen und Intervalle.")];
    return ride(d);
  }

  let seq = 0;
  FC.state.openWorkout = async (w) => {
    const my = ++seq, kind = STRENGTH_RE.test(w.sport ?? "") || w.strengthSessionId ? "strength" : BIKE_RE.test(w.sport ?? "") ? "bike" : "other";
    title.textContent = sport(w.sport);
    sub.textContent = `${fmtDayLong(w.day)}${w.start ? `, ${new Date(w.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr` : ""} · ${(w.sources ?? []).map((s) => SOURCES[s] ?? s).join(" + ")}`;
    body.replaceChildren(note("Lädt …"));
    if (!dlg.open) dlg.showModal();
    close.focus();
    let parts;
    try { parts = kind === "strength" ? [basics(w, ["Belastung", "Anstrengung", "Strain"]), ...(await strength(w))] : kind === "bike" ? await bike(w) : [basics(w)]; }
    catch (err) { parts = [basics(w), note(FC.errText(err))]; }
    if (my === seq) body.replaceChildren(...parts);
  };
})();
