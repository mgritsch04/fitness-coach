// Kern des Dashboards: Formatierung, Diagramme, Connector-Zugriff und Abschnitts-Registry.
// Jeder Abschnitt liegt in artifact/sections/<name>.js und meldet sich mit FC.section({...}) an.
// Abschnitte bekommen die Daten von get_dashboard über render(data) und rufen Werkzeuge über FC.call().
(() => {
  const SERVER = "Fitness Coach";
  const FETCH_DAYS = 180;
  const $ = (id) => document.getElementById(id);
  const state = { data: null, range: 90, mcp: null, sample: null, storedAt: null };
  try { const r = Number(localStorage.getItem("fc-range")); if ([30, 90, 180].includes(r)) state.range = r; } catch {}

  // ---------- Formatierung ----------
  const de = (n, d = 0) => (n == null || !Number.isFinite(n) ? "–" : n.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const dayDate = (s) => new Date(s + "T12:00:00Z");
  const fmtDay = (s) => dayDate(s).toLocaleDateString("de-DE", { day: "numeric", month: "numeric", timeZone: "UTC" });
  const fmtDayLong = (s) => dayDate(s).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const fmtWeekday = (s) => dayDate(s).toLocaleDateString("de-DE", { weekday: "short", timeZone: "UTC" });
  const fmtH = (h) => { if (h == null) return "–"; const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
  const ago = (iso) => { if (!iso) return null; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); if (m < 1) return "gerade eben"; if (m < 60) return `vor ${m} min`; const h = Math.round(m / 60); return h < 48 ? `vor ${h} h` : `vor ${Math.round(h / 24)} Tagen`; };
  const addDays = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  const SPORTS = { spin: "Spinning", cycling: "Radfahren", bodybuilding: "Krafttraining", weightlifting: "Gewichtheben", "functional-fitness": "Funktionelles Training", running: "Laufen", walking: "Gehen", hiking: "Wandern", rowing: "Rudern", swimming: "Schwimmen", yoga: "Yoga", activity: "Aktivität", "mountain-biking": "Mountainbike", "strength-trainer": "Krafttraining", hiit: "HIIT", stretching: "Dehnen", "assault-bike": "Assault Bike" };
  const sport = (s) => (s ? SPORTS[s] ?? s.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Workout");
  const SOURCES = { whoop: "WHOOP", wahoo: "Wahoo", mywhoosh: "MyWhoosh" };
  const recStatus = (r) => (r == null ? "none" : r >= 67 ? "good" : r >= 34 ? "warn" : "bad");
  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null) continue; if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v); } for (const k of kids) if (k != null && k !== false) e.append(k); return e; };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // ---------- Diagramme (SVG, ein Maßstab je Achse, Tooltip mit Fadenkreuz) ----------
  const SVGNS = "http://www.w3.org/2000/svg";
  const sv = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  function niceTicks(min, max, count = 4) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const out = []; for (let v = lo; v <= hi + step / 2; v += step) out.push(Number(v.toFixed(6)));
    return out;
  }
  /**
   * Zeitreihen-Diagramm über Tage.
   * opts: { days: [{day, ...}], series: [{label, color, kind: "line"|"bar"|"stack", value(p), barColor?(p), fmt?, width?, dots?, dash?}],
   *         yMin?, yMax?, band?: {lo, hi}, ref?: {value}, zones?: [{from, to, color}], zero?, height?, extraTip?: [series-like], aria? }
   * kind "stack": gestapelte Balken; alle stack-Serien werden in Reihenfolge übereinander gelegt.
   */
  function chart(container, opts) {
    container.replaceChildren();
    const { days, series } = opts;
    if (!days.length || series.every((s) => days.every((p) => s.value(p) == null))) { container.append(el("div", { class: "empty", text: "Keine Werte im Zeitraum." })); return; }
    if (series.length > 1) {
      const lg = el("div", { class: "legend" });
      for (const s of series) { const i = el("i", { class: s.kind === "line" ? "" : "box" }); i.style.background = s.color; lg.append(el("span", {}, i, s.label)); }
      container.append(lg);
    }
    const W = Math.max(280, container.clientWidth || 600), H = opts.height ?? 190, m = { l: 38, r: 10, t: 8, b: 22 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b, n = days.length, step = iw / n;
    const stacks = series.filter((s) => s.kind === "stack");
    const stackTop = (p) => stacks.reduce((a, s) => a + (s.value(p) ?? 0), 0);
    const vals = series.filter((s) => s.kind !== "stack").flatMap((s) => days.map((p) => s.value(p)).filter((v) => v != null));
    if (stacks.length) vals.push(...days.map(stackTop));
    if (opts.band) vals.push(opts.band.lo, opts.band.hi);
    if (opts.ref) vals.push(opts.ref.value);
    if (opts.zero) vals.push(0);
    const ticks = niceTicks(opts.yMin ?? Math.min(...vals), opts.yMax ?? Math.max(...vals));
    const y0 = ticks[0], y1 = ticks.at(-1);
    const x = (i) => m.l + step * (i + 0.5), y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": opts.aria ?? "" });
    for (const z of opts.zones ?? []) svg.append(sv("rect", { x: m.l, width: iw, y: y(Math.min(z.to, y1)), height: Math.max(0, y(Math.max(z.from, y0)) - y(Math.min(z.to, y1))), fill: z.color }));
    for (const t of ticks) {
      svg.append(sv("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 && opts.zero ? "zero" : "gridl" }));
      const tx = sv("text", { x: m.l - 6, y: y(t) + 4, "text-anchor": "end" }); tx.textContent = opts.yFmt ? opts.yFmt(t) : de(t, Math.abs(t) < 10 && t % 1 ? 1 : 0); svg.append(tx);
    }
    const labelEvery = Math.ceil(n / Math.max(2, Math.floor(iw / 70)));
    days.forEach((p, i) => { if ((n - 1 - i) % labelEvery === 0) { const tx = sv("text", { x: x(i), y: H - 6, "text-anchor": "middle" }); tx.textContent = opts.xFmt ? opts.xFmt(p) : fmtDay(p.day); svg.append(tx); } });
    if (opts.band) svg.append(sv("rect", { x: m.l, width: iw, y: y(opts.band.hi), height: Math.max(0, y(opts.band.lo) - y(opts.band.hi)), fill: cssVar("--band") }));
    if (opts.ref) svg.append(sv("line", { x1: m.l, x2: W - m.r, y1: y(opts.ref.value), y2: y(opts.ref.value), stroke: cssVar("--ink-3"), "stroke-dasharray": "5 4", "stroke-width": 1.5 }));
    const bw = Math.max(1, Math.min(opts.maxBar ?? 18, step - 2));
    if (stacks.length) {
      days.forEach((p, i) => {
        let acc = 0;
        stacks.forEach((s, k) => {
          const v = s.value(p); if (!v) return;
          const top = y(acc + v), bottom = y(acc); acc += v;
          svg.append(sv("rect", { x: x(i) - bw / 2, y: top, width: bw, height: Math.max(0.5, bottom - top - (k ? 1 : 0)), fill: s.color, rx: k === stacks.length - 1 ? Math.min(2, bw / 2) : 0 }));
        });
      });
    }
    for (const s of series) {
      if (s.kind === "stack") continue;
      if (s.kind === "bar") {
        const base = y(Math.max(y0, Math.min(0, y1)));
        days.forEach((p, i) => {
          const v = s.value(p); if (v == null) return;
          const top = Math.min(y(v), base), h = Math.max(1, Math.abs(base - y(v)));
          svg.append(sv("rect", { x: x(i) - bw / 2, y: top, width: bw, height: h, rx: Math.min(3, bw / 2), fill: s.barColor ? s.barColor(p) : s.color, opacity: s.opacity ?? 1 }));
        });
      } else {
        let d = "", last = null;
        days.forEach((p, i) => { const v = s.value(p); if (v == null) { last = null; return; } d += `${last == null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; last = i; });
        svg.append(sv("path", { d, fill: "none", stroke: s.color, "stroke-width": s.width ?? 2, "stroke-linejoin": "round", "stroke-linecap": "round", "stroke-dasharray": s.dash ?? "" }));
        if (s.dots) days.forEach((p, i) => { const v = s.value(p); if (v != null) svg.append(sv("circle", { cx: x(i), cy: y(v), r: 2, fill: s.color, opacity: 0.45 })); });
        for (let i = n - 1; i >= 0; i--) { const v = s.value(days[i]); if (v != null) { svg.append(sv("circle", { cx: x(i), cy: y(v), r: 4, fill: s.color, stroke: cssVar("--panel"), "stroke-width": 2 })); break; } }
      }
    }
    const xh = sv("line", { y1: m.t, y2: m.t + ih, class: "xh", visibility: "hidden" });
    svg.append(xh);
    svg.append(sv("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }));
    container.append(svg);
    const tip = el("div", { class: "tip", hidden: "" });
    container.append(tip);
    container.tabIndex = 0;
    let cur = null;
    const show = (i) => {
      cur = Math.max(0, Math.min(n - 1, i));
      const p = days[cur];
      xh.setAttribute("x1", x(cur)); xh.setAttribute("x2", x(cur)); xh.setAttribute("visibility", "visible");
      tip.replaceChildren(el("div", { class: "d", text: opts.tipTitle ? opts.tipTitle(p) : fmtDayLong(p.day) }));
      for (const s of [...series, ...(opts.extraTip ?? [])]) {
        const v = s.value(p); const k = el("i"); k.style.background = s.barColor ? s.barColor(p) : s.color;
        tip.append(el("div", { class: "row" }, el("span", { class: "k" }, k, s.label), el("b", { text: v == null ? "–" : s.fmt ? s.fmt(v) : de(v, 1) })));
      }
      tip.hidden = false;
      const px = (x(cur) / W) * container.clientWidth, tw = tip.offsetWidth;
      tip.style.left = `${Math.max(0, Math.min(container.clientWidth - tw, px + 12 > container.clientWidth - tw ? px - tw - 12 : px + 12))}px`;
      tip.style.top = `${series.length > 1 ? 28 : 4}px`;
    };
    const hide = () => { tip.hidden = true; xh.setAttribute("visibility", "hidden"); };
    svg.addEventListener("pointermove", (e) => { const r = svg.getBoundingClientRect(); show(Math.floor((((e.clientX - r.left) / r.width) * W - m.l) / step)); });
    svg.addEventListener("pointerleave", hide);
    container.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") { show((cur ?? n) - 1); e.preventDefault(); } if (e.key === "ArrowRight") { show((cur ?? -1) + 1); e.preventDefault(); } if (e.key === "Escape") hide(); });
    container.addEventListener("blur", hide);
  }
  function spark(values, color) {
    const s = sv("svg", { class: "spark", viewBox: "0 0 100 30", preserveAspectRatio: "none", "aria-hidden": "true" });
    const v = values.map((x, i) => [i, x]).filter(([, x]) => x != null);
    if (v.length < 2) return s;
    const lo = Math.min(...v.map((a) => a[1])), hi = Math.max(...v.map((a) => a[1])), span = hi - lo || 1;
    const px = (i) => (i / (values.length - 1)) * 98 + 1, py = (x) => 27 - ((x - lo) / span) * 24;
    s.append(sv("path", { d: v.map(([i, x], k) => `${k ? "L" : "M"}${px(i).toFixed(1)},${py(x).toFixed(1)}`).join(""), fill: "none", stroke: color, "stroke-width": 1.6, "vector-effect": "non-scaling-stroke" }));
    const [li, lx] = v.at(-1);
    s.append(sv("circle", { cx: px(li), cy: py(lx), r: 2.2, fill: color }));
    return s;
  }
  const rolling = (days, key, w = 7) => days.map((p, i) => { const xs = days.slice(Math.max(0, i - w + 1), i + 1).map((d) => d[key]).filter((v) => v != null); return xs.length >= Math.min(3, w) ? xs.reduce((a, b) => a + b, 0) / xs.length : null; });

  // Kleiner, sicherer Markdown-Ersatz für Coach-Texte: Absätze, "- "-Listen, **fett**.
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function richText(target, text) {
    target.replaceChildren();
    let list = null;
    for (const raw of String(text).split("\n")) {
      const line = raw.trim();
      if (!line) { list = null; continue; }
      const html = escapeHtml(line.replace(/^[-–•*]\s+/, "").replace(/^#+\s*/, "")).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (/^[-–•*]\s+/.test(line)) { if (!list) { list = el("ul"); target.append(list); } const li = el("li"); li.innerHTML = html; list.append(li); }
      else { list = null; const p = el("p"); p.innerHTML = html; target.append(p); }
    }
  }

  // ---------- Connector ----------
  const ERR = {
    server_not_connected: "Der Connector „Fitness Coach“ ist nicht verbunden. In claude.ai unter Einstellungen → Connectors hinzufügen.",
    needs_reauth: "Die Anmeldung beim Connector „Fitness Coach“ ist abgelaufen. In claude.ai unter Einstellungen → Connectors neu verbinden.",
    selection_required: "Es gibt mehrere Connectors namens „Fitness Coach“. Bitte im Hinweis von claude.ai einen auswählen.",
    not_in_manifest: "Der Zugriff auf „Fitness Coach“ ist für diese Seite nicht erlaubt. Im Menü der Seite unter Berechtigungen freigeben.",
    approval_required: "Diese Seite braucht deine Freigabe für „Fitness Coach“.",
    blocked_by_policy: "Der Connector ist für dein Konto gesperrt.",
    server_unavailable: "Der Fitness-Coach-Server antwortet gerade nicht. Gleich noch einmal versuchen.",
    tool_error: "Der Server hat einen Fehler gemeldet.",
  };
  const errText = (e) => (ERR[e?.code] ?? "Die Anfrage ist fehlgeschlagen.") + (e?.code === "tool_error" && e.message ? ` (${String(e.message).slice(0, 200)})` : "");
  const SAMPLE_ERR = { not_granted: "Der Coach ist für diese Seite nicht freigegeben.", sampling_disabled: "Claude ist für dein Konto hier nicht verfügbar.", rate_limited: "Gerade zu viele Anfragen oder dein Limit ist erreicht. Bitte später noch einmal.", session_expired: "Bitte melde dich in claude.ai neu an.", refused: "Dazu kann der Coach nichts sagen. Formuliere die Frage anders.", invalid_json: "Die Antwort kam nicht im erwarteten Format. Bitte noch einmal versuchen.", prompt_too_large: "Zu viele Daten für eine Anfrage." };
  const sampleErrText = (e) => SAMPLE_ERR[e?.code] ?? "Der Coach ist gerade nicht erreichbar. Bitte später noch einmal.";

  /** Ein Werkzeug des Connectors aufrufen (Aktionen). Liefert die JSON-Antwort, wirft McpError. */
  async function call(tool, input = {}, opts = { cache: false }) {
    if (!state.mcp) throw { code: "capability_disabled", message: "Kein Connector-Zugriff in dieser Ansicht." };
    return (await state.mcp.callTool(SERVER, tool, input, opts)).payload;
  }
  /** Lesendes Werkzeug beobachten (Anzeige). handler(payload | null, error | null). */
  function watch(tool, input, handler, opts = { cache: { staleTime: 60_000, gcTime: 86_400_000 } }) {
    if (!state.mcp) { handler(null, { code: "capability_disabled" }); return () => {}; }
    return state.mcp.watchTool(SERVER, tool, input, (ev) => (ev.type === "data" ? handler(ev.result.payload, null, ev.result) : handler(null, ev.error)), opts);
  }

  function banner(msg, kind, action) {
    const b = $("banner"); b.hidden = !msg; b.className = `banner${kind === "bad" ? " bad" : ""}`; b.replaceChildren();
    if (!msg) return;
    b.append(el("span", { text: msg }));
    if (action) { const btn = el("button", { type: "button", text: action.label, class: action.primary ? "primary" : "", style: "margin-left:12px" }); btn.onclick = action.run; b.append(btn); }
  }

  // ---------- Abschnitte ----------
  const sections = [];
  /**
   * Abschnitt anmelden. def: { id, order, mount(root) → einmalig DOM bauen, render(data) → bei neuen Daten,
   * rerender?(data) → bei Größen-/Zeitraumwechsel (Standard: render), ready?() → nach dem Start (Connector verfügbar) }
   */
  function section(def) { sections.push(def); }
  function renderAll() {
    const d = state.data; if (!d) return;
    for (const s of sections) { try { s.render?.(d); } catch (e) { console.error(`Abschnitt ${s.id}:`, e); } }
  }
  function rerender() {
    const d = state.data; if (!d) return;
    for (const s of sections) { try { s.rerender ? s.rerender(d) : s.render?.(d); } catch (e) { console.error(`Abschnitt ${s.id}:`, e); } }
  }
  const listeners = new Set();
  function setRange(days) { state.range = days; try { localStorage.setItem("fc-range", String(days)); } catch {} rerender(); for (const f of listeners) f(days); }

  // ---------- Dashboard-Daten ----------
  let unwatch = null;
  function setData(p, storedAt) {
    if (!p || typeof p !== "object" || !Array.isArray(p.days)) { banner("Unerwartete Antwort vom Server.", "bad", { label: "Erneut laden", run: () => reload() }); return; }
    state.data = p; state.storedAt = storedAt ?? null; banner(null); document.body.classList.add("has-data"); renderAll();
  }
  function startWatch() {
    unwatch?.();
    unwatch = state.mcp.watchTool(SERVER, "get_dashboard", { days: FETCH_DAYS }, (ev) => {
      $("app").classList.remove("loading");
      if (ev.type === "data") return setData(ev.result.payload, ev.result.cache?.storedAt);
      const c = ev.error?.code;
      if (["needs_reauth", "server_not_connected", "blocked_by_policy", "not_in_manifest", "selection_required"].includes(c)) { state.data = null; document.body.classList.remove("has-data"); }
      if (c === "approval_required") return banner(ERR.approval_required, null, { label: "Freigeben und laden", primary: true, run: () => reload() });
      banner(errText(ev.error), "bad", { label: "Erneut laden", run: () => reload() });
    }, { cache: { staleTime: 60_000, gcTime: 86_400_000 }, refetchInterval: 15 * 60_000 });
  }
  async function reload() {
    if (!state.mcp) return;
    $("app").classList.add("loading");
    try {
      const r = await state.mcp.callTool(SERVER, "get_dashboard", { days: FETCH_DAYS }, { cache: { staleTime: 0, gcTime: 86_400_000, refresh: true } });
      setData(r.payload, null);
    } catch (e) { banner(errText(e), "bad", { label: "Erneut laden", run: () => reload() }); }
    finally { $("app").classList.remove("loading"); }
  }

  // Reiter für die Handy-Ansicht. Ein Abschnitt nennt seinen Reiter mit `tab` (Standard "mehr").
  const TABS = [
    { id: "heute", label: "Heute", icon: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
    { id: "coach", label: "Coach", icon: "M4 5h16v10H9l-5 4V5Z" },
    { id: "verlauf", label: "Verlauf", icon: "M3 17l5-6 4 4 6-8 3 3M3 21h18" },
    { id: "training", label: "Training", icon: "M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" },
    { id: "mehr", label: "Mehr", icon: "M5 12h.01M12 12h.01M19 12h.01" },
  ];
  let tab = "heute";
  try { const t = localStorage.getItem("fc-tab"); if (TABS.some((x) => x.id === t)) tab = t; } catch {}
  function showTab(id, scroll) {
    tab = id;
    try { localStorage.setItem("fc-tab", id); } catch {}
    for (const s of sections) $(`sec-${s.id}`)?.classList.toggle("on", (s.tab ?? "mehr") === id);
    for (const b of $("tabbar").children) b.setAttribute("aria-current", b.dataset.tab === id ? "page" : "false");
    if (scroll) window.scrollTo({ top: 0 });
    rerender();
  }

  async function boot() {
    const root = $("sections");
    const css = sections.map((s) => s.css).filter(Boolean).join("\n");
    if (css) document.head.append(el("style", { text: css }));
    for (const s of sections.sort((a, b) => a.order - b.order)) {
      const host = el("section", { id: `sec-${s.id}`, "aria-labelledby": `h-${s.id}` });
      root.append(host);
      try { s.mount?.(host); } catch (e) { console.error(`Abschnitt ${s.id}:`, e); }
    }
    const bar = $("tabbar");
    for (const t of TABS) {
      const b = el("button", { type: "button", "data-tab": t.id });
      const ic = sv("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
      ic.append(sv("path", { d: t.icon }));
      b.append(ic, t.label);
      b.onclick = () => showTab(t.id, true);
      bar.append(b);
    }
    document.body.classList.add("tabs");
    showTab(tab);
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(rerender, 120); }).observe(root);
    const claude = window.claude;
    if (!claude?.use) { banner("Diese Seite funktioniert nur in claude.ai mit dem Connector „Fitness Coach“."); document.body.classList.add("no-connector"); return; }
    const [mcp, sample] = await Promise.all([claude.use("mcp"), claude.use("sample")]);
    state.sample = sample;
    if (!sample) document.body.classList.add("no-sample");
    if (!mcp) { banner("Der Zugriff auf Connectors ist in dieser Ansicht nicht verfügbar. Öffne die Seite in claude.ai."); document.body.classList.add("no-connector"); return; }
    state.mcp = mcp;
    $("app").classList.add("loading");
    startWatch();
    for (const s of sections) { try { s.ready?.(); } catch (e) { console.error(`Abschnitt ${s.id}:`, e); } }
  }

  window.FC = Object.freeze({
    SERVER, state, $, el, sv, de, dayDate, fmtDay, fmtDayLong, fmtWeekday, fmtH, ago, addDays, sport, SOURCES, recStatus, cssVar,
    chart, spark, rolling, richText, errText, sampleErrText, banner, call, watch, reload, section, rerender, setRange,
    onRange: (f) => listeners.add(f), boot, showTab,
    invalidate: () => state.mcp?.invalidate(SERVER, "get_dashboard").catch(() => {}),
  });
})();
