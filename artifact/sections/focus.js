// „Heute in 10 Sekunden“ (#372): Tagesform, was heute dran ist (Gym-Vorlage oder MyWhoosh-Workout mit einem Tipp),
// höchstens eine Warnung. Dazu der Schalter für die schlanke Startansicht und der Hinweis, wenn „Dashboard anpassen“
// Ungenutztes zum Ausblenden vorschlägt. Nur Daten aus get_dashboard; die Nutzung wird lokal im Browser gezählt.
FC.section({
  id: "focus",
  simple: true,
  tab: "heute",
  order: 1,
  keepLean: true,
  RIDES: ["recovery", "endurance", "long", "tempo", "threshold", "vo2max", "opener", "race"],
  READY: { rest: "Ruhe", easy: "Locker", moderate: "Normal", hard: "Hart" },
  css: `
    .fo { display: grid; gap: 12px; }
    .fo-row { display: grid; gap: 4px; }
    .fo-row .label { margin: 0; }
    .fo-big { font-size: 1.15rem; font-weight: 650; margin: 0; }
    .fo-tip { margin: 0; color: var(--ink-2); }
    .fo-warn { border-left: 4px solid var(--warn); padding: 4px 0 4px 12px; margin: 0; }
    .fo-warn.alert, .fo-warn.caution { border-color: var(--bad); }
    .fo-act { display: flex; flex-wrap: wrap; gap: 8px; }
    .fo-foot { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; border-top: 1px solid var(--line); padding-top: 8px; }
    .fo-foot label { display: inline-flex; gap: 6px; align-items: center; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-focus">Heute in 10 Sekunden</h2><span class="muted" id="foDate"></span></div>
      <div class="panel fo" id="foBody"><div class="empty">Lädt …</div></div>`;
    FC.lean.onChange(() => { if (FC.state.data) this.render(FC.state.data); });
    FC.usage.onChange(() => this.hint());
  },
  render(d) {
    const { el, de } = FC, c = d.coach, t = d.training;
    if (!c) return;
    const body = FC.$("foBody");
    FC.$("foDate").textContent = FC.dayDate(d.today).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    // Tagesform
    const form = el("div", { class: "fo-row" }, el("span", { class: "label", text: "Tagesform" }),
      el("p", { class: "fo-big", text: `${c.score}/100 · ${this.READY[c.readiness] ?? c.readiness}` }),
      el("p", { class: "fo-tip", text: c.headline }));
    // Heute dran
    const x = t?.thisWeek?.comparison?.days?.find((y) => y.day === d.today);
    const wd = (new Date(`${d.today}T12:00:00Z`).getUTCDay() + 6) % 7;
    const kraft = t?.prefs?.templateByDay?.[wd] ?? null;
    const plan = el("div", { class: "fo-row" }, el("span", { class: "label", text: "Heute dran" }));
    const act = el("div", { class: "fo-act" });
    // Eigener Plan (prefs.templateByDay): Kraft-Vorlage, „@rad“ oder „@ruhe“ ersetzt den App-Vorschlag.
    const own = kraft && kraft !== "@rad" && kraft !== "@ruhe" ? kraft : null;
    const ride = this.RIDES.includes(x?.type);
    if (kraft) {
      plan.append(el("p", { class: "fo-big", text: kraft === "@rad" ? "Radeinheit" : kraft === "@ruhe" ? "Ruhetag" : `Kraft: ${kraft}` }), el("p", { class: "fo-tip", text: "Von dir geplant." }));
      if (own) {
        const b = el("button", { type: "button", class: "primary", text: FC.state.gym?.st ? "Zum Gym-Modus" : `Vorlage „${own}“ starten` });
        b.onclick = () => { FC.goTo("gym"); FC.state.gym?.startTemplate(own); };
        act.append(b);
      }
      if (kraft === "@rad") {
        const b = el("button", { type: "button", class: "primary", text: "Workout für MyWhoosh" });
        b.onclick = () => FC.goTo("bikewo");
        act.append(b);
      }
    } else if (!x) plan.append(el("p", { class: "fo-big", text: "Noch kein Wochenplan" }), el("p", { class: "fo-tip", text: "Du kannst unten selbst festlegen, was heute dran ist." }));
    else {
      plan.append(el("p", { class: "fo-big", text: x.type === "rest" ? "Ruhetag" : `${x.title}${x.durationMin ? `, ${x.durationMin} min` : ""}` }));
      const tip = (t.today?.text || x.intensity || (x.description ?? "").split(/(?<=[.!?])\s/)[0] || "").trim();
      plan.append(el("p", { class: "fo-tip", text: `Vorschlag der App${tip ? `: ${tip}` : ""}` }));
      if (ride) {
        const b = el("button", { type: "button", class: "primary", text: "Workout für MyWhoosh" });
        b.onclick = () => FC.goTo("bikewo");
        act.append(b);
      }
    }
    plan.append(this.dayPicker(wd, kraft));
    // Höchstens eine Warnung: Frühwarnung vor den Hinweisen der Tagesform.
    const w = d.earlyWarning && d.earlyWarning.level !== "none" ? { level: d.earlyWarning.level, text: d.earlyWarning.headline } : c.warnings?.length ? { level: "", text: c.warnings[0] } : null;
    const warn = w ? el("p", { class: `fo-warn ${w.level}`, role: "status", text: w.text }) : null;
    const lean = el("input", { type: "checkbox", id: "foLean" }); lean.checked = FC.lean.on();
    lean.onchange = () => FC.lean.set(lean.checked);
    const foot = el("div", { class: "fo-foot" }, el("label", { for: "foLean" }, lean, "Heute schlank halten (Rest ausblenden)"), el("span", { class: "muted", id: "foHint" }));
    body.replaceChildren(form, plan, act.children.length ? act : "", warn ?? "", foot);
    this.hint();
  },
  /** Heutigen Plan selbst festlegen, auch spontan: Kraft-Vorlage, Rad, Ruhetag oder zurück zum App-Vorschlag. */
  names: null,
  dayPicker(wd, cur) {
    const { el } = FC;
    const sel = el("select", { "aria-label": "Heute stattdessen" }, el("option", { value: "", text: "App-Vorschlag" }), el("option", { value: "@rad", text: "Rad" }), el("option", { value: "@ruhe", text: "Ruhetag" }));
    const fill = () => { for (const n of this.names ?? []) sel.append(el("option", { value: n, text: `Kraft: ${n}` })); if (cur && ![...sel.options].some((o) => o.value === cur)) sel.append(el("option", { value: cur, text: `Kraft: ${cur}` })); sel.value = cur ?? ""; };
    if (this.names) fill(); else FC.call("get_strength", { weeks: 12 }, { cache: { staleTime: 60_000, gcTime: 86_400_000 } }).then((r) => { this.names = (r.templates ?? []).map((x) => x.name); fill(); }).catch(() => { this.names = []; fill(); });
    const msg = el("span", { class: "muted", role: "status" });
    sel.onchange = async () => {
      const vals = [...(FC.state.data?.training?.prefs?.templateByDay ?? [])]; while (vals.length < 7) vals.push(null);
      vals[wd] = sel.value || null; sel.disabled = true; msg.textContent = "Speichere …";
      try { await FC.call("set_training_prefs", { templateByDay: vals.some((v) => v) ? vals : null }); await FC.reload(); }
      catch (e) { msg.textContent = FC.errText(e); sel.disabled = false; }
    };
    return el("label", { class: "fo-pick", style: "display:grid;gap:2px;font-size:.85rem;color:var(--ink-3)" }, el("span", { text: "Heute stattdessen" }), sel, msg);
  },
  /** Hinweis auf den Vorschlag „Ungenutztes ausblenden“, sobald genug Nutzung gezählt ist. */
  hint() {
    const h = FC.$("foHint"); if (!h) return;
    const s = FC.usage.suggest();
    h.replaceChildren();
    if (!s.ids.length) return;
    const b = FC.el("button", { type: "button", text: `Vorschlag: ${s.ids.length} ungenutzte Abschnitte ausblenden` });
    b.onclick = () => FC.goTo("layout");
    h.append(b);
  },
});
