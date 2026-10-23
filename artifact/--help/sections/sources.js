// Datenquellen: Abgleich (auch der Knopf in der Kopfzeile), Verlauf nachladen, Wahoo verbinden, Fußzeile.
FC.section({
  id: "sources",
  tab: "mehr",
  order: 90,
  mount(root) {
    root.innerHTML = `
      <h2 id="h-sources">Datenquellen</h2>
      <div class="panel sources">
        <div class="src"><div><b>WHOOP</b> <span class="muted">Erholung, Schlaf, Strain, Workouts</span><div id="srcWhoop" class="muted"></div></div>
          <button type="button" id="btnBackfill" disabled title="Lädt WHOOP-Daten der letzten 120 Tage, damit Fitness und Trends eine längere Basis haben.">Verlauf nachladen (120 Tage)</button></div>
        <div class="src"><div><b>Wahoo</b> <span class="muted">Radfahrten mit Leistung</span><div id="srcWahoo" class="muted"></div></div>
          <div class="row"><button type="button" id="btnWahoo" hidden>Wahoo verbinden</button><a id="wahooLink" href="#" target="_blank" rel="noopener" hidden>Anmeldung bei Wahoo öffnen</a></div></div>
        <div class="src" id="srcMywhoosh"><div><b>MyWhoosh</b> <span class="muted">virtuelle Fahrten per FIT-Datei</span><div class="muted" id="srcMywhooshState">FIT-Datei im Tab Training unter „Rolle und Leistung“ hochladen.</div></div>
          <button type="button" id="btnFitGo">Zum Upload</button></div>
      </div>`;
    const { $ } = FC;
    $("btnSync").onclick = () => this.sync({}, $("btnSync"), "Gleiche ab …");
    $("btnBackfill").onclick = () => this.sync({ full: true, days: 120 }, $("btnBackfill"), "Lade 120 Tage …");
    $("btnFitGo").onclick = () => { FC.showTab("training"); $("h-fit")?.scrollIntoView({ behavior: "smooth" }); };
    $("btnWahoo").onclick = async () => {
      try { const r = await FC.call("wahoo_connect"); const a = $("wahooLink"); a.href = r.url; a.hidden = false; $("srcWahoo").textContent = `Link ${r.expiresInMinutes} Minuten gültig. Nach der Anmeldung diese Seite neu laden.`; }
      catch (e) { $("srcWahoo").textContent = FC.errText(e); }
    };
  },
  async sync(input, btn, label) {
    const { $ } = FC;
    btn.disabled = true; const old = btn.textContent; btn.textContent = label;
    try {
      const p = (await FC.call("sync_now", input)) ?? {};
      $("syncState").textContent = p.whoop?.ok ? `WHOOP: ${p.whoop.result.days} Tage, ${p.whoop.result.sleeps} Schlafphasen, ${p.whoop.result.workouts} Workouts abgeglichen.` : `WHOOP: ${p.whoop?.message ?? "fehlgeschlagen"}`;
      await FC.invalidate();
      await FC.reload();
    } catch (e) { FC.banner(FC.errText(e), "bad"); }
    finally { btn.disabled = false; btn.textContent = old; }
  },
  async ready() {
    const { $, ago } = FC;
    try {
      const st = await FC.call("wahoo_status", {}, { cache: { staleTime: 60_000 } });
      const t = $("srcWahoo"), b = $("btnWahoo");
      if (!st.configured) { t.textContent = "Wartet auf die Freigabe deiner Wahoo-App (Aufgabe #3). Danach kannst du Wahoo hier verbinden."; b.hidden = true; }
      else if (!st.connected) { t.textContent = "Bereit zum Verbinden."; b.hidden = false; }
      else { t.textContent = st.sync?.last_success_at ? `Verbunden, zuletzt abgeglichen ${ago(st.sync.last_success_at)}` : "Verbunden."; b.hidden = true; }
    } catch (e) { $("srcWahoo").textContent = FC.errText(e); }
  },
  render(d) {
    const { $, el, ago, state } = FC;
    $("btnSync").disabled = false; $("btnBackfill").disabled = false;
    const sy = d.sync.whoop;
    $("srcWhoop").textContent = sy?.last_success_at ? `Zuletzt abgeglichen ${ago(sy.last_success_at)}${sy.last_error ? ` · letzter Fehler: ${sy.last_error}` : ""}` : "Noch nicht abgeglichen.";
    $("syncState").textContent = sy?.last_success_at ? `WHOOP abgeglichen ${ago(sy.last_success_at)}` : "WHOOP noch nicht abgeglichen";
    $("foot").replaceChildren(el("span", { text: "Trainingsempfehlungen, keine medizinischen Diagnosen. Belastung, Fitness, Ermüdung und Form sind Schätzungen." }),
      el("span", { text: d.notes.join(" ") }), el("span", { text: `Stand der Daten: ${new Date(state.storedAt ?? d.generatedAt).toLocaleString("de-DE")}.` }));
  },
  rerender() {},
});
