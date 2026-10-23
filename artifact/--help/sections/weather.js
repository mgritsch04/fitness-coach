// Radwetter (#66): bestes Zeitfenster heute und morgen, Empfehlung draußen oder Rolle (get_ride_weather, set_weather_location).
// Kleidungsempfehlung (#224) aus clothing: gefühlte Temperatur mit Fahrtwind, Liste und Hinweise.
// Ortssuche (#325): bei mehreren Treffern Auswahl mit Region und Land; nach dem Speichern frisch laden statt alter Antwort.
FC.section({
  id: "weather",
  tab: "heute",
  order: 11,
  css: `
    .wx-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 16px; }
    .wx-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .pill.wx-outside { background: var(--good-wash); color: var(--good-ink); }
    .pill.wx-indoor { background: var(--accent-wash); color: var(--accent); }
    .pill.wx-rest, .pill.wx-no_ride { background: var(--line); color: var(--ink-2); }
    .wx-win { font-variant-numeric: tabular-nums; color: var(--ink-2); font-size: .92rem; }
    .wx-hours { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(30px, 1fr); gap: 3px; overflow-x: auto; padding-bottom: 2px; margin-top: 10px; }
    .wx-h { display: grid; gap: 2px; justify-items: center; font-size: .72rem; color: var(--ink-3); font-variant-numeric: tabular-nums; }
    .wx-h i { width: 100%; height: 8px; border-radius: 3px; display: block; }
    .wx-h.in i { outline: 2px solid var(--ink); outline-offset: 1px; }
    .wx-h b { font-weight: 600; color: var(--ink-2); }
    #sec-weather .linkish { border: 0; background: none; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }
    .wx-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
    .wx-form label { display: grid; gap: 4px; font-size: .88rem; color: var(--ink-2); }
    .wx-picks { flex-basis: 100%; display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .wx-picks button { width: 100%; text-align: left; }
    .wx-cl { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--line); font-size: .92rem; }
    .wx-cl .wx-clh { color: var(--ink-2); }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-weather">Radwetter</h2><span class="muted" id="wxLoc"></span></div>
      <div id="wxBody"></div>
      <form class="wx-form panel" id="wxForm" autocomplete="off" hidden style="margin-top:12px">
        <label for="wxName">Ort für die Vorhersage<input id="wxName" type="text" maxlength="80" placeholder="z. B. Graz" required></label>
        <button type="submit" class="primary" id="wxSave">Speichern</button><button type="button" id="wxCancel">Abbrechen</button>
        <span class="muted" id="wxMsg" role="status"></span>
        <ul class="wx-picks" id="wxPicks" aria-label="Gefundene Orte" hidden></ul>
        <p class="chart-cap" style="flex-basis:100%;margin:0">Gespeichert wird nur der Ort, auf etwa 10 km gerundet. Die Vorhersage kommt von Open-Meteo.</p>
      </form>
      <p class="chart-cap" id="wxCap"></p>`;
    const { $ } = FC;
    $("wxForm").onsubmit = (e) => { e.preventDefault(); this.save(); };
    $("wxCancel").onclick = () => { $("wxForm").hidden = true; this.picks([]); };
  },
  ready() { this.subscribe(); },
  subscribe() {
    this.unwatch?.();
    this.unwatch = FC.watch("get_ride_weather", {}, (p, err) => {
      // Gerade gewechselt: ältere Antwort mit dem alten Ort aus dem Zwischenspeicher nicht mehr anzeigen.
      if (p && this.want) { if (p.location?.name !== this.want) return; this.want = null; }
      this.rep = p ?? { error: err }; if (FC.state.data) this.show();
    },
      { cache: { staleTime: 300_000, gcTime: 86_400_000 } });
  },
  render() { this.show(); },
  rerender() { if (this.rep) this.show(); },
  toolErr(err) { try { return JSON.parse(err.message); } catch { return { message: String(err?.message ?? "") }; } },
  async save(pick) {
    const { $ } = FC, name = $("wxName").value.trim();
    if (!pick && name.length < 2) return;
    $("wxSave").disabled = true; $("wxMsg").textContent = pick ? "Speichere …" : "Suche …";
    try {
      const r = await FC.call("set_weather_location", pick ?? { name });
      if (!r.location && r.candidates?.length) {
        $("wxMsg").textContent = r.message || "Mehrere Orte gefunden, bitte wählen:";
        this.picks(r.candidates);
        return;
      }
      this.picks([]);
      $("wxMsg").textContent = `Gespeichert: ${r.location.name}`; $("wxForm").hidden = true; $("wxName").value = "";
      $("wxLoc").textContent = r.location.name; this.want = r.location.name;
      await this.refresh();
    } catch (err) { $("wxMsg").textContent = err?.code === "tool_error" ? this.toolErr(err).message : FC.errText(err); }
    finally { $("wxSave").disabled = false; }
  },
  /** Trefferliste der Ortssuche; Antippen speichert genau diesen Treffer. */
  picks(list) {
    const { $, el } = FC, ul = $("wxPicks");
    ul.hidden = !list.length;
    ul.replaceChildren(...list.map((c) => {
      const b = el("button", { type: "button", text: c.name });
      b.onclick = () => this.save({ name: c.name, lat: c.lat, lon: c.lon });
      return el("li", {}, b);
    }));
    ul.querySelector("button")?.focus();
  },
  /** Nach Ortswechsel neu vom Worker holen (sonst zeigt der Zwischenspeicher kurz den alten Ort). */
  async refresh() {
    this.rep = null; this.show();
    await FC.state.mcp.invalidate(FC.SERVER, "get_ride_weather").catch(() => {});
    try {
      const fresh = await FC.state.mcp.callTool(FC.SERVER, "get_ride_weather", {}, { cache: { staleTime: 0, gcTime: 86_400_000, refresh: true } });
      if (fresh.payload?.location?.name === this.want) this.want = null;
      this.rep = fresh.payload; this.show();
    } catch (err) { this.rep = { error: err }; this.show(); }
    this.subscribe();
  },
  show() {
    const { $, el, cssVar } = FC, r = this.rep, body = $("wxBody");
    if (!body) return;
    $("wxCap").textContent = "";
    if (!r) { body.replaceChildren(el("div", { class: "empty", text: "Lädt …" })); return; }
    if (r.error) {
      const e = r.error.code === "tool_error" ? this.toolErr(r.error) : null;
      if (e?.error === "no_location") {
        $("wxLoc").textContent = "";
        $("wxForm").hidden = false;
        body.replaceChildren(el("div", { class: "empty", text: "Trag deinen Ort ein, dann sagt dir der Coach, ob sich heute oder morgen eine Ausfahrt draußen lohnt." }));
        return;
      }
      body.replaceChildren(el("div", { class: "empty", text: e?.message || FC.errText(r.error) }));
      return;
    }
    const edit = el("button", { type: "button", class: "linkish", text: "Ort ändern" });
    edit.onclick = () => { $("wxForm").hidden = false; $("wxName").focus(); };
    $("wxLoc").replaceChildren(document.createTextNode(`${r.location.name} · `), edit);
    const LABEL = { outside: "draußen", indoor: "Rolle", rest: "Pause", no_ride: "kein Rad" };
    if (r.indoor?.active) $("wxLoc").append(document.createTextNode(" · Winterbetrieb: nur Rolle"));
    const col = (s) => cssVar(s >= 70 ? "--good" : s >= 45 ? "--warn" : "--bad");
    body.replaceChildren(el("div", { class: "wx-grid" }, ...r.days.map((d, i) => {
      const inWin = (t) => d.best && t >= d.best.start && t < d.best.end;
      const hours = d.hours.filter((h) => h.isDay);
      return el("div", { class: "panel" },
        el("div", { class: "wx-head" }, el("h3", { text: i === 0 ? "Heute" : "Morgen" }), el("span", { class: `pill wx-${d.advice.verdict}`, text: LABEL[d.advice.verdict] })),
        el("p", { style: "margin:6px 0", text: d.advice.text }),
        d.planned ? el("div", { class: "wx-win", text: `Plan: ${d.planned.title}${d.planned.durationMin ? `, ${d.planned.durationMin} min` : ""}` }) : null,
        hours.length ? el("div", { class: "wx-hours", role: "img", tabindex: "0", "aria-label": `Radwetter je Stunde ${i === 0 ? "heute" : "morgen"}` }, ...hours.map((h) => {
          const bar = el("i"); bar.style.background = col(h.score);
          return el("div", { class: `wx-h${inWin(h.time) ? " in" : ""}`, title: `${h.time.slice(11, 16)} Uhr: ${h.tempC != null ? `${Math.round(h.tempC)} °C` : "–"}, Regen ${h.rainProb ?? "–"} %, Wind ${h.windKmh != null ? Math.round(h.windKmh) : "–"} km/h${h.issues.length ? ` (${h.issues.join(", ")})` : ""}` },
            el("span", { text: h.time.slice(11, 13) }), bar, el("b", { text: h.tempC != null ? `${Math.round(h.tempC)}°` : "–" }));
        })) : null,
        this.clothing(d));
    })));
    const t = new Date(r.fetchedAt);
    $("wxCap").textContent = `Balken: grün gut, gelb geht, rot eher Rolle; umrandet das beste Fenster. Wetterdaten Open-Meteo (CC BY 4.0), Stand ${isNaN(t) ? "–" : t.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}. Bewertung nach Faustregeln, keine Unwetterwarnung.${r.days.some((d) => d.clothing) ? " Kleidung: gefühlte Temperatur bei etwa 25 km/h Fahrtwind, Faustregel, jeder friert anders." : ""}`;
  },
  /** Kleidung fürs beste Fenster; bei Empfehlung Rolle als „Falls du rausfährst“. */
  clothing(d) {
    const { el } = FC, c = d.clothing;
    if (!c || d.advice.verdict === "rest" || d.advice.verdict === "no_ride") return null;
    const head = `${d.advice.verdict === "indoor" ? "Falls du rausfährst: " : "Anziehen: "}${c.label}, gefühlt ${c.feelsC} °C`;
    return el("div", { class: "wx-cl" }, el("b", { text: head }),
      el("p", { style: "margin:2px 0 0", text: c.items.join(", ") }),
      ...c.hints.map((h) => el("p", { class: "wx-clh", style: "margin:4px 0 0", text: h })));
  },
});
