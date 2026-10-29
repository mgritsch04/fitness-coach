// Körperwerte (#30) aus get_body_history: Gewichtsverlauf mit 7-Tage-Mittel, W/kg, Ziel und eigener Eintrag (log_weight).
// Frühere Werte nachtragen: Zeilen „Datum Gewicht“ einfügen oder eine CSV-Datei wählen (z. B. Export der Waage); gelesen wird nur im Browser.
FC.section({
  id: "body",
  simple: true,
  tab: "verlauf",
  order: 38,
  css: `
    .bd-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px 20px; margin-bottom: 12px; }
    .bd-stats div { display: grid; gap: 2px; } .bd-stats b { font-family: var(--font-display); font-size: 1.3rem; }
    .bd-log { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; margin-top: 10px; }
    .bd-log label { display: grid; gap: 4px; font-size: 0.88rem; color: var(--ink-2); }
    .bd-log input { width: 8em; }
    .bd-past { margin-top: 12px; }
    .bd-past summary { cursor: pointer; color: var(--accent); font-weight: 600; }
    .bd-past textarea { width: 100%; min-height: 7em; font: inherit; margin-top: 8px; }
    .bd-past .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-body">Gewicht</h2><span class="muted" id="bdRange"></span></div>
      <div class="panel"><div class="bd-stats" id="bdStats"><span class="muted">Lädt …</span></div><div class="chart" id="cWeight"></div>
        <p class="chart-cap" id="bdCap">Punkte: einzelne Werte (WHOOP-Profil oder eigener Eintrag), Linie: 7-Tage-Mittel.</p>
        <form class="bd-log" id="bdForm" autocomplete="off">
          <label for="bdKg">Gewicht heute (kg)<input id="bdKg" type="number" min="30" max="250" step="0.1" inputmode="decimal" required></label>
          <button type="submit" class="primary" id="bdSave">Eintragen</button><span class="muted" id="bdMsg" role="status"></span>
        </form>
        <details class="bd-past" id="bdPast"><summary>Frühere Werte nachtragen</summary>
          <label for="bdLines" class="muted">Je Zeile ein Tag mit Gewicht, z. B. „2026-09-01 82,4“ oder „01.09.2026;82,4“. Eine CSV-Datei (z. B. Export deiner Waage) geht auch; sie wird nur hier im Browser gelesen.</label>
          <textarea id="bdLines" spellcheck="false" placeholder="2026-09-01 82,4&#10;02.09.2026;82,1"></textarea>
          <div class="row"><input type="file" id="bdFile" accept=".csv,.txt,text/csv,text/plain" aria-label="CSV-Datei mit Gewichten wählen">
            <button type="button" class="primary" id="bdPastSave">Nachtragen</button><span class="muted" id="bdPastMsg" role="status"></span></div>
        </details></div>`;
    FC.$("bdForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const { $ } = FC, kg = Number($("bdKg").value.replace(",", "."));
      if (!(kg >= 30 && kg <= 250)) return;
      $("bdSave").disabled = true; $("bdMsg").textContent = "Speichere …";
      try {
        this.rep = await FC.call("log_weight", { weightKg: kg });
        $("bdMsg").textContent = "Gespeichert."; $("bdKg").value = "";
        this.show(); this.load(); FC.invalidate();
      } catch (err) { $("bdMsg").textContent = err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err); }
      finally { $("bdSave").disabled = false; }
    });
  },
  ready() {
    this.load(); FC.onRange(() => this.load());
    const { $ } = FC;
    const count = () => { const r = this.parse($("bdLines").value); $("bdPastMsg").textContent = $("bdLines").value.trim() ? `${r.entries.length} Werte erkannt${r.skipped ? `, ${r.skipped} Zeilen übersprungen` : ""}.` : ""; return r; };
    $("bdLines").oninput = count;
    $("bdFile").onchange = async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 2_000_000) { $("bdPastMsg").textContent = "Datei zu groß (höchstens 2 MB)."; return; } $("bdLines").value = await f.text(); count(); };
    $("bdPastSave").onclick = async () => {
      const r = count();
      if (!r.entries.length) { $("bdPastMsg").textContent = "Keine Werte erkannt. Format: Datum und Gewicht je Zeile."; return; }
      if (r.entries.length > 730) { $("bdPastMsg").textContent = "Höchstens 730 Tage auf einmal."; return; }
      $("bdPastSave").disabled = true; $("bdPastMsg").textContent = "Speichere …";
      try {
        this.rep = await FC.call("log_weight", { entries: r.entries });
        const s = this.rep.saved;
        $("bdPastMsg").textContent = `${s.count} Tage nachgetragen (${FC.fmtDay(s.from)} bis ${FC.fmtDay(s.to)}). Für ältere Tage den Zeitraum oben größer stellen.`;
        $("bdLines").value = ""; $("bdFile").value = "";
        this.show(); this.load(); FC.invalidate();
      } catch (err) { $("bdPastMsg").textContent = err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err); }
      finally { $("bdPastSave").disabled = false; }
    };
  },
  /** Zeilen „Datum Gewicht“ lesen: Datum als JJJJ-MM-TT oder TT.MM.JJJJ, Gewicht 30–250 kg mit Komma oder Punkt; Kopfzeilen werden übersprungen. */
  parse(text) {
    const entries = [], today = FC.state.data?.today ?? new Date().toISOString().slice(0, 10);
    let skipped = 0;
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      let day = null, rest = line;
      const iso = line.match(/(\d{4})-(\d{1,2})-(\d{1,2})/), de = line.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
      if (iso) { day = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`; rest = line.replace(iso[0], " "); }
      else if (de) { const y = de[3].length === 2 ? `20${de[3]}` : de[3]; day = `${y}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`; rest = line.replace(de[0], " "); }
      // Uhrzeit nach dem Datum nicht als Gewicht lesen.
      rest = rest.replace(/\d{1,2}:\d{2}(:\d{2})?/g, " ");
      const m = rest.match(/(?:^|[^\d])(\d{2,3}(?:[.,]\d{1,2})?)(?![\d])/);
      const kg = m ? Number(m[1].replace(",", ".")) : NaN;
      const ok = day && !isNaN(Date.parse(day + "T00:00:00Z")) && new Date(day + "T00:00:00Z").toISOString().slice(0, 10) === day && day <= today && kg >= 30 && kg <= 250;
      if (ok) entries.push({ day, weightKg: Math.round(kg * 100) / 100 }); else skipped++;
    }
    return { entries, skipped };
  },
  load() {
    this.stop?.();
    this.stop = FC.watch("get_body_history", { days: Math.max(30, FC.state.range) }, (data, err) => { this.rep = err ? { error: FC.errText(err) } : data; this.show(); });
  },
  render() { this.show(); },
  show() {
    const { $, el, chart, cssVar, de, fmtDay } = FC, r = this.rep;
    const stats = $("bdStats");
    if (!stats || !r) return;
    if (r.error) { stats.replaceChildren(el("div", { class: "muted", text: r.error })); return; }
    const s = r.summary, kg = (v, d = 1) => (v == null ? "–" : `${de(v, d)} kg`);
    const signed = (v) => (v == null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : "±"}${de(Math.abs(v), 1)} kg`);
    $("bdRange").textContent = s.latest ? `zuletzt ${fmtDay(s.latest.day)}${s.latest.source === "manual" ? " (eigener Eintrag)" : ""}` : "";
    const stat = (label, value, sub) => el("div", {}, el("span", { class: "label", text: label }), el("b", { text: value }), sub ? el("span", { class: "muted", text: sub }) : null);
    stats.replaceChildren(...[
      stat("Aktuell", kg(s.latest?.weightKg), s.bmi != null ? `BMI ${de(s.bmi, 1)}` : null),
      stat("30 Tage", signed(s.change30dKg), s.change7dKg != null ? `7 Tage ${signed(s.change7dKg)}` : null),
      stat("Trend", s.trendKgPerWeek == null ? "–" : `${signed(s.trendKgPerWeek)}/Woche`, "Schätzung aus 4 Wochen"),
      stat("W/kg", r.wattsPerKg.value == null ? "–" : de(r.wattsPerKg.value, 2), r.wattsPerKg.ftpW ? `FTP ${de(r.wattsPerKg.ftpW)} W${r.wattsPerKg.ftpOrigin === "user" ? "" : " (geschätzt)"}` : "FTP unbekannt"),
      r.goal ? stat(r.goal.title, kg(r.goal.targetValue), r.goal.remainingKg == null ? null : `noch ${signed(r.goal.remainingKg)}${r.goal.neededKgPerWeek != null ? `, nötig ${signed(r.goal.neededKgPerWeek)}/Woche` : ""}${r.goal.onTrack === true ? " · auf Kurs" : r.goal.onTrack === false ? " · nicht auf Kurs" : ""}`) : null,
    ].filter(Boolean));
    const box = $("cWeight");
    if (!r.points.length) { box.replaceChildren(el("div", { class: "empty", text: "Noch kein Gewicht. Trag oben einen Wert ein oder pflege es im WHOOP-Profil." })); return; }
    chart(box, { days: r.points, aria: "Gewichtsverlauf", ref: r.goal?.targetValue != null ? { value: r.goal.targetValue } : undefined, series: [
      { label: "Gewicht", kind: "line", color: cssVar("--ink-3"), width: 1, dots: true, value: (p) => p.weightKg, fmt: (v) => `${de(v, 1)} kg` },
      { label: "7-Tage-Mittel", kind: "line", color: cssVar("--accent"), width: 2.5, value: (p) => p.avg7dKg, fmt: (v) => `${de(v, 1)} kg` },
    ] });
    $("bdCap").textContent = `Punkte: einzelne Werte (WHOOP-Profil oder eigener Eintrag), Linie: 7-Tage-Mittel${r.goal?.targetValue != null ? ", gestrichelt: Ziel" : ""}.`;
  },
});
