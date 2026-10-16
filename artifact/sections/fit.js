// MyWhoosh-Fahrten per FIT-Datei hochladen (import_fit) und Leistungskurve (get_power_curve) mit FTP-Schätzung.
FC.section({
  id: "fit",
  tab: "training",
  order: 45,
  css: `
    .fit-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 16px; }
    @media (max-width: 900px) { .fit-grid { grid-template-columns: minmax(0, 1fr); } }
    .dropzone label { color: var(--accent); text-decoration: underline; cursor: pointer; }
    .dropzone input { position: absolute; width: 1px; height: 1px; opacity: 0; }
    .fit-log { display: grid; gap: 8px; margin-top: 12px; }
    .fit-log .item { border-left: 3px solid var(--line); padding: 2px 0 2px 10px; }
    .fit-log .item.ok { border-color: var(--good); } .fit-log .item.bad { border-color: var(--bad); }
    .pc-stats { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-bottom: 8px; }
    .pc-stats b { font-family: var(--font-display); font-size: 1.4rem; }`,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-fit">Rolle und Leistung</h2><span class="muted">MyWhoosh-Fahrten per FIT-Datei, Bestleistungen aus Sekundenwerten</span></div>
      <div class="fit-grid">
        <div class="panel"><h3>FIT-Datei hochladen</h3>
          <div class="dropzone" id="fitDrop">Datei hierher ziehen oder <label>auswählen<input type="file" id="fitFile" accept=".fit,application/octet-stream" multiple></label>
            <div class="muted" style="margin-top:6px">Export aus dem MyWhoosh-Webportal. Dieselbe Datei nochmal hochladen aktualisiert die Fahrt.</div></div>
          <div class="fit-log" id="fitLog"></div></div>
        <div class="panel"><h3>Leistungskurve</h3><div class="pc-stats" id="pcStats"></div><div class="chart" id="cPower"></div>
          <p class="chart-cap" id="pcCap">Beste Durchschnittsleistung je Dauer. Nur Fahrten mit Sekundenwerten (FIT-Import).</p></div>
      </div>`;
    const { $ } = FC, drop = $("fitDrop");
    $("fitFile").onchange = (e) => { this.upload([...e.target.files]); e.target.value = ""; };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); this.upload([...e.dataTransfer.files]); };
  },
  async fileInput(file) {
    // Große Dateien als Datei-Argument (zählt nicht zum 1-MiB-Limit), kleine direkt als Base64.
    const buf = await file.arrayBuffer();
    if (buf.byteLength < 700_000) {
      let bin = ""; const b = new Uint8Array(buf);
      for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return { fileBase64: btoa(bin), fileName: file.name };
    }
    const lt = await FC.state.mcp.listTools().catch(() => null);
    if (!lt?.fileArgs) throw new Error("Die Datei ist für diese Ansicht zu groß (über 700 KB). Bitte in der Claude-App oder im Browser öffnen.");
    return { fileBase64: { $file: { data: buf, name: file.name.replace(/[^\w.-]/g, "_"), type: "application/octet-stream" } }, fileName: file.name };
  },
  async upload(files) {
    const { $, el, de, fmtDayLong } = FC, log = $("fitLog");
    let any = false;
    for (const f of files) {
      const item = el("div", { class: "item", text: `${f.name}: wird importiert …` });
      log.prepend(item);
      if (!/\.fit$/i.test(f.name)) { item.className = "item bad"; item.textContent = `${f.name}: keine .fit-Datei.`; continue; }
      try {
        const r = await FC.call("import_fit", await this.fileInput(f));
        if (r?.error) throw new Error(r.message);
        const w = r.workout, parts = [`${Math.round(w.durationS / 60)} min`];
        if (w.distanceM) parts.push(`${de(w.distanceM / 1000, 1)} km`);
        if (w.normalizedPowerW) parts.push(`NP ${de(w.normalizedPowerW)} W`); else if (w.avgPowerW) parts.push(`Ø ${de(w.avgPowerW)} W`);
        if (w.tss != null) parts.push(`TSS ${de(w.tss)}`);
        if (w.avgHr) parts.push(`Ø ${de(w.avgHr)} bpm`);
        item.className = "item ok";
        item.replaceChildren(el("b", { text: `${fmtDayLong(w.day)} ${r.updated ? "aktualisiert" : "importiert"}` }), el("div", { text: parts.join(" · ") }),
          ...(r.sameRideIn?.length ? [el("div", { class: "muted", text: `Dieselbe Fahrt ist auch aus ${r.sameRideIn.map((s) => FC.SOURCES[s] ?? s).join(", ")} da und wird zusammengeführt.` })] : []));
        any = true;
      } catch (e) {
        item.className = "item bad";
        item.textContent = `${f.name}: ${e?.code ? FC.errText(e) : e?.message ?? "Import fehlgeschlagen."}`;
      }
    }
    if (any) { await FC.invalidate(); await Promise.all([FC.reload(), this.loadCurve(true)]); }
  },
  fmtDur(s) { return s < 60 ? `${s} s` : s < 3600 ? `${s / 60} min` : `${de2(s / 3600)} h`; },
  async ready() { await this.loadCurve(); },
  async loadCurve(fresh) {
    try { this.curve = await FC.call("get_power_curve", { days: 365 }, fresh ? { cache: false } : { cache: { staleTime: 300_000, gcTime: 86_400_000 } }); }
    catch (e) { this.curve = { error: FC.errText(e) }; }
    if (FC.state.data) this.render(FC.state.data);
  },
  render(d) {
    const { $, el, chart, cssVar, de, addDays } = FC, c = this.curve;
    const box = $("cPower"), stats = $("pcStats");
    if (!c) { box.replaceChildren(el("div", { class: "empty", text: "Lädt …" })); stats.replaceChildren(); return; }
    if (c.error) { box.replaceChildren(el("div", { class: "empty", text: c.error })); stats.replaceChildren(); return; }
    const recentFrom = addDays(d.today, -41), recent = {};
    for (const w of c.workouts ?? []) if (w.day >= recentFrom) for (const [k, v] of Object.entries(w.power_curve)) recent[k] = Math.max(recent[k] ?? 0, v);
    const pts = Object.keys(c.best ?? {}).map(Number).sort((a, b) => a - b).map((s) => ({ s, best: c.best[s], recent: recent[s] ?? null }));
    if (!pts.length) { box.replaceChildren(el("div", { class: "empty", text: "Noch keine Fahrt mit Sekundenwerten. Lade links eine FIT-Datei hoch." })); stats.replaceChildren(); return; }
    const w20 = c.best[1200], ftpEst = w20 ? Math.round(w20 * 0.95) : null, ftp = d.settings.ftpW;
    const stat = (label, v, hint) => el("div", {}, el("div", { class: "muted", text: label }), el("b", { text: v }), ...(hint ? [el("div", { class: "muted", text: hint })] : []));
    stats.replaceChildren(stat("5 s", c.best[5] ? `${de(c.best[5])} W` : "–"), stat("1 min", c.best[60] ? `${de(c.best[60])} W` : "–"),
      stat("5 min", c.best[300] ? `${de(c.best[300])} W` : "–"), stat("20 min", w20 ? `${de(w20)} W` : "–"),
      stat("FTP geschätzt", ftpEst ? `${de(ftpEst)} W` : "–", ftpEst ? (ftp ? `eingestellt: ${de(ftp)} W` : "95 % der 20-min-Leistung") : "braucht eine Fahrt ≥ 20 min"));
    if (ftpEst && (!ftp || Math.abs(ftpEst - ftp) / ftp > 0.05)) {
      const b = el("button", { type: "button", text: `FTP auf ${de(ftpEst)} W setzen` });
      b.onclick = async () => { b.disabled = true; try { await FC.call("update_settings", { ftpW: ftpEst }); await FC.invalidate(); await FC.reload(); } catch (e) { FC.banner(FC.errText(e), "bad"); b.disabled = false; } };
      stats.append(el("div", { style: "align-self:end" }, b));
    }
    chart(box, { days: pts, yMin: 0, aria: "Leistungskurve", xFmt: (p) => this.fmtDur(p.s), tipTitle: (p) => `Beste Leistung über ${this.fmtDur(p.s)}`,
      ref: ftp ? { value: ftp } : undefined, series: [
        { label: "12 Monate", kind: "line", color: cssVar("--s1"), value: (p) => p.best, fmt: (v) => `${de(v)} W` },
        { label: "letzte 6 Wochen", kind: "line", color: cssVar("--s2"), value: (p) => p.recent, fmt: (v) => `${de(v)} W` },
      ] });
    $("pcCap").textContent = `Beste Durchschnittsleistung je Dauer aus ${c.workouts.length} Fahrt${c.workouts.length === 1 ? "" : "en"} mit Sekundenwerten.${ftp ? " Gestrichelt: eingestellte FTP." : ""} FTP-Schätzung = 95 % der besten 20 Minuten, nur ein Richtwert.`;
  },
});
function de2(v) { return FC.de(v, v % 1 ? 1 : 0); }
