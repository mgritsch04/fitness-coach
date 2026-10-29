// Heute: Bereitschaft (regelbasierte Empfehlung), letzte 7 Tage, Kacheln mit Trends.
FC.section({
  id: "today",
  simple: true,
  tab: "heute",
  order: 10,
  mount(root) {
    root.innerHTML = `
      <h2 id="h-today" class="label">Heute</h2>
      <div class="today">
        <div class="display">
          <div class="ready">
            <div class="dial" aria-hidden="true"><svg viewBox="0 0 112 112" id="dial"></svg><div class="v num" id="dialV">–</div></div>
            <div>
              <span class="pill" id="readyPill">Bereitschaft</span>
              <h2 id="readyHead">Daten werden geladen</h2>
              <p id="readySug">Sobald der Connector antwortet, steht hier die Empfehlung für heute.</p>
              <p id="readyRide" hidden></p>
            </div>
          </div>
          <div class="target" id="readyTarget"></div>
          <ul class="reasons" id="readyReasons"></ul>
          <p class="warnings" id="readyWarn" hidden></p>
          <div class="week7" id="week7" aria-label="Letzte 7 Tage"></div>
          <p class="fine" id="readyFine">Trainingsempfehlung aus deinen Daten, keine medizinische Diagnose.</p>
        </div>
        <div class="tiles" id="tiles">
          ${["Erholung", "HRV", "Ruhepuls", "Schlaf", "Tagesbelastung", "Form"].map((l) => `<div class="tile"><span class="label">${l}</span><span class="big num">–</span></div>`).join("")}
        </div>
      </div>`;
  },
  render(d) {
    const { $, el, sv, de, fmtDayLong, fmtWeekday, fmtH, cssVar, recStatus, spark, dayDate, chart, fmtDay } = FC;
    const READY = { rest: "Ruhe", easy: "Locker", moderate: "Normal", hard: "Hart" };
    const c = d.coach;
    $("date").textContent = dayDate(d.today).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    const dial = $("dial"); dial.replaceChildren();
    const R = 48, C = 2 * Math.PI * R;
    const ringColor = { rest: "#e66767", easy: "#fab219", moderate: "#4fb3cf", hard: "#2fbf2f" }[c.readiness];
    dial.append(sv("circle", { cx: 56, cy: 56, r: R, fill: "none", stroke: "currentColor", "stroke-opacity": 0.15, "stroke-width": 10 }));
    dial.append(sv("circle", { cx: 56, cy: 56, r: R, fill: "none", stroke: ringColor, "stroke-width": 10, "stroke-linecap": "round", "stroke-dasharray": `${(C * c.score) / 100} ${C}`, transform: "rotate(-90 56 56)" }));
    $("dialV").textContent = c.score;
    const pill = $("readyPill"); pill.className = `pill ${c.readiness}`; pill.textContent = `Bereitschaft ${c.score}/100 · ${READY[c.readiness]}`;
    $("readyHead").textContent = c.headline;
    $("readySug").textContent = c.suggestion;
    // Ruhetag (#324): locker ausfahren ja oder nein.
    const rr = $("readyRide"); rr.hidden = !c.restRide;
    if (c.restRide) rr.replaceChildren(el("b", { text: c.restRide.verdict === "spin" ? "Locker ausfahren: ja. " : "Locker ausfahren: heute nicht. " }), document.createTextNode(c.restRide.text), c.restRide.workout ? el("span", {}, ` Passendes Workout für MyWhoosh: ${c.restRide.workout.name}, ~${de(c.restRide.workout.load)} Belastung (Datei im Abschnitt „Workout für MyWhoosh“).`) : null, el("span", { class: "muted", text: ` ${c.restRide.disclaimer}` }));
    const tp = d.days.at(-1);
    const t = $("readyTarget"); t.replaceChildren();
    if (c.targetLoad) t.append(el("span", {}, "Ziel heute ", el("b", { text: c.targetLoad.max ? `${c.targetLoad.min}–${c.targetLoad.max}` : "0" }), " Belastungspunkte (Schätzung)"));
    if (tp) t.append(el("span", {}, "bisher ", el("b", { text: de(tp.load) })));
    const ul = $("readyReasons"); ul.replaceChildren();
    for (const r of c.reasons) ul.append(el("li", {}, el("span", { class: `m ${r.effect}`, text: r.effect === "up" ? "+" : r.effect === "down" ? "−" : "·", "aria-label": r.effect === "up" ? "spricht dafür" : r.effect === "down" ? "spricht dagegen" : "neutral" }), el("span", { text: r.text })));
    const w = $("readyWarn"); w.hidden = !c.warnings.length; w.textContent = c.warnings.join(" ");
    $("readyFine").textContent = c.disclaimer;
    const w7 = $("week7"); w7.replaceChildren(el("div", { class: "label", text: "Erholung und Belastung, letzte 7 Tage", style: "grid-column: 1 / -1" }));
    for (const p of d.days.slice(-7)) {
      const st = recStatus(p.recovery);
      w7.append(el("div", { class: "d", title: `${fmtDayLong(p.day)}: Erholung ${p.recovery == null ? "–" : de(p.recovery) + " %"}, Belastung ${de(p.load)}` },
        el("span", { class: "l", text: fmtWeekday(p.day) }),
        el("span", { class: `sq ${st}`, text: p.recovery == null ? "–" : de(p.recovery) }),
        el("span", { class: "l", text: p.load ? `${de(p.load)} TSS` : "Ruhe" })));
    }

    const last = (k) => { for (let i = d.days.length - 1; i >= 0; i--) if (d.days[i][k] != null) return d.days[i]; return null; };
    const recent = d.days.slice(-14);
    const tr = d.trends;
    const cmpTxt = (t, digits = 0) => {
      if (t.avg7 == null) return "noch zu wenig Daten";
      const base = t.baseline != null ? ` · Basis ${de(t.baseline, digits)}` : "";
      return `7 Tage Ø ${de(t.avg7, digits)}${base}${t.deltaPct != null ? ` (${t.deltaPct > 0 ? "+" : ""}${de(t.deltaPct, 0)} %)` : ""}`;
    };
    const stTxt = (t, invert) => {
      if (t.status === "unknown") return el("span", { class: "st none", text: "Basis fehlt noch" });
      const bad = invert ? t.status === "above" : t.status === "below", good = invert ? t.status === "below" : t.status === "above";
      return el("span", { class: `st ${bad ? "bad" : good ? "good" : "none"}`, text: bad ? (invert ? "über Basis" : "unter Basis") : good ? (invert ? "unter Basis" : "über Basis") : "im Normalbereich" });
    };
    // Antippen einer Kachel zeigt ihren Verlauf (30/90/180 Tage); die Kachel läuft dann über die ganze Breite.
    const tile = (label, value, unit, sub, extra, sparkVals, color, trend) => {
      const t = el("div", { class: "tile" }, el("span", { class: "label", text: label }), el("span", { class: "big" }, value, unit ? el("small", { text: unit }) : null),
        sub ? el("span", { class: "cmp", text: sub }) : null, extra, sparkVals ? spark(sparkVals, color) : null);
      if (!trend) return t;
      const key = `${label}`;
      // Bis 180 Tage kommen die Daten aus dem geladenen Dashboard; „1 Jahr“ und „Alles“ laden bei Bedarf mehr und
      // werden zu Wochen- (bis ~13 Monate) oder Monatsmitteln verdichtet, damit es lesbar und schnell bleibt.
      const RANGES = [[30, "30 Tage"], [90, "90 Tage"], [180, "180 Tage"], [365, "1 Jahr"], [3650, "Alles"]];
      const bucketKey = (day, monthly) => (monthly ? day.slice(0, 7) + "-01" : FC.addDays(day, -((FC.dayDate(day).getUTCDay() + 6) % 7)));
      const condense = (rows) => {
        const first = rows.findIndex((p) => trend.value(p) != null);
        if (first < 0) return { rows: [], note: "" };
        rows = rows.slice(first);
        const monthly = rows.length > 400, groups = new Map();
        for (const p of rows) { const k = bucketKey(p.day, monthly), v = trend.value(p); if (!groups.has(k)) groups.set(k, []); if (v != null) groups.get(k).push(v); }
        const out = [...groups].map(([day, vs]) => ({ day, v: vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : null }));
        return { rows: out, monthly, note: monthly ? "Monatsmittel" : "Wochenmittel" };
      };
      const longCache = FC.longDays ?? (FC.longDays = {});
      const draw = async (box, n) => {
        const label2 = n >= 365 ? (n === 3650 ? "alle Daten" : "letztes Jahr") : `letzte ${n} Tage`;
        if (n <= 180) {
          chart(box, { days: d.days.slice(-n), aria: `${label}, ${label2}`, xFmt: (p) => fmtDay(p.day), height: 200, peaks: true,
            series: [{ label, kind: trend.bar ? "bar" : "line", color, width: 2, value: trend.value, fmt: (v) => `${de(v, trend.digits ?? 0)} ${trend.unit}` }] });
          return;
        }
        box.dataset.n = n;
        if (!longCache[n]) {
          box.replaceChildren(el("div", { class: "empty", text: "Lade Verlauf …" }));
          try {
            const r = await FC.call("get_dashboard", { days: n, compact: true });
            const x = (c) => (c && Array.isArray(c.keys) ? c.rows.map((v) => Object.fromEntries(c.keys.map((k, i) => [k, v[i]]))) : c);
            longCache[n] = x(r.days);
          } catch { if (box.dataset.n === String(n)) box.replaceChildren(el("div", { class: "empty", text: "Verlauf konnte nicht geladen werden." })); return; }
        }
        if (box.dataset.n !== String(n)) return;
        const c = condense(longCache[n]);
        if (!c.rows.length) { box.replaceChildren(el("div", { class: "empty", text: "Keine Werte im Zeitraum." })); return; }
        const xf = c.monthly ? (p) => FC.dayDate(p.day).toLocaleDateString("de-DE", { month: "short", year: "2-digit", timeZone: "UTC" }) : (p) => fmtDay(p.day);
        chart(box, { days: c.rows, aria: `${label}, ${label2}, ${c.note}`, xFmt: xf, height: 200, peaks: true,
          series: [{ label: `${label} (${c.note})`, kind: "line", color, width: 2, value: (p) => p.v, fmt: (v) => `${de(v, trend.digits ?? 0)} ${trend.unit}` }] });
      };
      const open = (on) => {
        t.classList.toggle("open", on); t.setAttribute("aria-expanded", String(on));
        t.querySelector(".tl-more")?.remove();
        if (FC.tileOpen === key && !on) FC.tileOpen = null;
        if (!on) return;
        FC.tileOpen = key;
        const box = el("div", { class: "chart tl-chart" });
        const bar = el("div", { class: "seg tl-range", role: "group", "aria-label": "Zeitraum" });
        const pick = (n) => { draw(box, n); for (const b of bar.children) b.setAttribute("aria-pressed", String(b.dataset.n === String(n))); };
        for (const [n, text] of RANGES) {
          const b = el("button", { type: "button", "data-n": n, "aria-pressed": "false", text });
          b.addEventListener("click", (e) => { e.stopPropagation(); pick(n); });
          bar.append(b);
        }
        const more = el("div", { class: "tl-more" }, bar, box);
        more.addEventListener("click", (e) => e.stopPropagation());
        t.append(more); pick(90);
      };
      t.tabIndex = 0; t.setAttribute("role", "button"); t.setAttribute("aria-expanded", "false"); t.title = "Antippen: Verlauf anzeigen";
      t.classList.add("tl");
      t.addEventListener("click", () => open(!t.classList.contains("open")));
      t.addEventListener("keydown", (e) => { if (e.target === t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(!t.classList.contains("open")); } });
      if (FC.tileOpen === key) open(true);
      return t;
    };
    const tiles = $("tiles"); tiles.replaceChildren();
    const trendOf = (k, unit, digits, bar) => ({ value: (p) => p[k], unit, digits, bar });
    const rp = last("recovery"), rs = recStatus(rp?.recovery);
    tiles.append(tile("Erholung", de(rp?.recovery), "%", rp && rp.day !== d.today ? `Stand ${fmtDayLong(rp.day)}` : cmpTxt(tr.recovery), el("span", { class: `st ${rs}`, text: { good: "grün", warn: "gelb", bad: "rot", none: "keine Daten" }[rs] }), recent.map((p) => p.recovery), cssVar("--accent"), trendOf("recovery", "%")));
    const hp = last("hrv");
    tiles.append(tile("HRV", de(hp?.hrv), "ms", cmpTxt(tr.hrv), stTxt(tr.hrv), recent.map((p) => p.hrv), cssVar("--s1"), trendOf("hrv", "ms")));
    const rh = last("rhr");
    tiles.append(tile("Ruhepuls", de(rh?.rhr), "bpm", cmpTxt(tr.rhr), stTxt(tr.rhr, true), recent.map((p) => p.rhr), cssVar("--s2"), trendOf("rhr", "bpm")));
    const sp = last("sleepH"), need = d.settings.sleepNeedH;
    const sleepSt = sp?.sleepH == null ? "none" : sp.sleepH >= need - 0.25 ? "good" : sp.sleepH >= need - 1.5 ? "warn" : "bad";
    tiles.append(tile("Schlaf", fmtH(sp?.sleepH), "h", sp ? `Bedarf ${de(need, 1)} h${sp.sleepPerf != null ? ` · Leistung ${de(sp.sleepPerf)} %` : ""}` : null,
      el("span", { class: `st ${sleepSt}`, text: sp?.sleepH == null ? "keine Daten" : sleepSt === "good" ? "Bedarf gedeckt" : `${fmtH(need - sp.sleepH)} h zu wenig` }), recent.map((p) => p.sleepH), cssVar("--s7"), trendOf("sleepH", "h", 1)));
    tiles.append(tile("Tagesbelastung", de(tp?.strain, 1), "Strain", `Belastung heute ${de(tp?.load)} · ${tp?.workouts ?? 0} Workouts`, null, recent.map((p) => p.strain), cssVar("--ink-3"), trendOf("strain", "Strain", 1, true)));
    const tsb = tp?.tsb;
    tiles.append(tile("Form", tsb == null ? "–" : `${tsb > 0 ? "+" : ""}${de(tsb)}`, null, `Fitness ${de(tp?.ctl)} · Ermüdung ${de(tp?.atl)}`,
      el("span", { class: `st ${tsb == null ? "none" : tsb < -30 ? "bad" : tsb < -10 ? "warn" : "good"}`, text: tsb == null ? "–" : tsb < -30 ? "sehr müde" : tsb < -10 ? "im Training" : tsb > 5 ? "ausgeruht" : "ausgeglichen" }), recent.map((p) => p.tsb), cssVar("--s3"), trendOf("tsb", "", 0)));
  },
  rerender() {},
});
