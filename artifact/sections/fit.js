// MyWhoosh-Fahrten per FIT-Datei hochladen (import_fit) Leistungskurve, FTP-Schätzung und Zeit je Zone (get_fitness_profile).
FC.section({
  id: "fit",
  simple: true,
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
    .zones { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px 24px; margin-top: 12px; }
    .zones .chart-cap { grid-column: 1 / -1; margin: 0; }
    .zl { display: grid; gap: 4px; } .zl h4 { margin: 0 0 2px; font-size: .95rem; }
    .zr { display: grid; grid-template-columns: 9.5em minmax(0, 1fr) 4.5em; gap: 8px; align-items: center; font-size: .88rem; }
    .zr .zb { height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; } .zr .zb i { display: block; height: 100%; background: var(--accent); border-radius: 4px; }
    .zr .num { text-align: right; }
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
          <p class="chart-cap" id="pcCap"></p><div class="zones" id="pcZones"></div></div>
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
        item.textContent = `${f.name}: ${this.errMsg(e)}`;
      }
    }
    if (any) { await FC.invalidate(); await Promise.all([FC.reload(), this.loadProfile(true)]); }
  },
  /** Klartext aus der Server-Antwort ({"error":…,"message":…}); ohne JSON-Reste (#359). */
  errMsg(e) {
    if (e?.code === "tool_error") {
      const raw = String(e.message ?? "");
      try { const j = JSON.parse(raw); if (j?.message) return String(j.message); } catch { /* gekürzt oder kein JSON */ }
      const m = raw.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m) { try { return JSON.parse(`"${m[1]}"`); } catch { return m[1]; } }
    }
    return e?.code ? FC.errText(e) : e?.message ?? "Import fehlgeschlagen.";
  },
  fmtDur(s) { return s < 60 ? `${s} s` : s < 3600 ? `${s / 60} min` : `${FC.de(s / 3600, s % 3600 ? 1 : 0)} h`; },
  async ready() { await this.loadProfile(); },
  async loadProfile(fresh) {
    try { this.prof = await FC.call("get_fitness_profile", { days: 42 }, fresh ? { cache: false } : { cache: { staleTime: 300_000, gcTime: 86_400_000 } }); }
    catch (e) { this.prof = { error: FC.errText(e) }; }
    if (FC.state.data) this.render(FC.state.data);
  },
  zoneList(dist, label) {
    const { el, de } = FC;
    if (!dist?.totalMinutes) return null;
    const max = Math.max(...dist.zones.map((z) => z.minutes));
    return el("div", { class: "zl" }, el("h4", { text: `${label} · ${de(dist.totalMinutes / 60, 1)} h` }),
      ...dist.zones.map((z, i) => el("div", { class: "zr" }, el("span", { text: `Z${z.zone} ${z.name}` }),
        el("span", { class: "zb" }, Object.assign(el("i"), { style: `width:${max ? (z.minutes / max) * 100 : 0}%;opacity:${0.35 + (0.65 * i) / (dist.zones.length - 1)}` })),
        el("span", { class: "num", text: `${de(z.minutes)} min` }))),
      el("div", { class: "muted", text: `locker ${de(dist.intensity.easyPct)} % · mittel ${de(dist.intensity.moderatePct)} % · hart ${de(dist.intensity.hardPct)} %` }));
  },
  render(d) {
    const { $, el, chart, cssVar, de } = FC, c = this.prof;
    const box = $("cPower"), stats = $("pcStats"), zones = $("pcZones");
    if (!c || c.error) { box.replaceChildren(el("div", { class: "empty", text: c?.error ?? "Lädt …" })); stats.replaceChildren(); zones.replaceChildren(); return; }
    const cur = Object.fromEntries((c.powerCurve.last42d ?? []).map((p) => [p.durationS, p]));
    const all = Object.fromEntries((c.powerCurve.last90d ?? []).map((p) => [p.durationS, p]));
    const pts = Object.keys(all).map(Number).sort((a, b) => a - b).map((s) => ({ s, best: all[s].watts, bestDay: all[s].day, recent: cur[s]?.watts ?? null }));
    const ftp = c.ftp, est = ftp.estimate;
    const stat = (label, v, hint) => el("div", {}, el("div", { class: "muted", text: label }), el("b", { text: v }), ...(hint ? [el("div", { class: "muted", text: hint })] : []));
    const w = (s) => (all[s] ? `${de(all[s].watts)} W` : "–");
    stats.replaceChildren(stat("5 s", w(5)), stat("1 min", w(60)), stat("5 min", w(300)), stat("20 min", w(1200)),
      stat(ftp.origin === "user" ? "FTP (eingestellt)" : "FTP geschätzt", ftp.watts ? `${de(ftp.watts)} W` : "–",
        [ftp.wattsPerKg ? `${de(ftp.wattsPerKg, 2)} W/kg` : null, ftp.origin === "user" && est ? `Schätzung ${de(est.watts)} W` : est?.note ?? (ftp.watts ? null : "braucht Fahrten mit Leistung")].filter(Boolean).join(" · ")));
    if (est && (ftp.origin !== "user" || Math.abs(est.watts - ftp.watts) / ftp.watts > 0.05)) {
      const b = el("button", { type: "button", text: `${de(est.watts)} W als FTP übernehmen` });
      b.title = "Speichert die Schätzung als deine FTP. Belastung und Zonen rechnen dann damit.";
      b.onclick = async () => { b.disabled = true; try { await FC.call("update_settings", { ftpW: est.watts }); await FC.invalidate(); await Promise.all([FC.reload(), this.loadProfile(true)]); } catch (e) { FC.banner(FC.errText(e), "bad"); b.disabled = false; } };
      stats.append(el("div", { style: "align-self:end" }, b));
    }
    if (!pts.length) box.replaceChildren(el("div", { class: "empty", text: "Noch keine Fahrt mit Sekundenwerten in den letzten 90 Tagen. Lade links eine FIT-Datei hoch." }));
    else chart(box, { days: pts, yMin: 0, aria: "Leistungskurve", xFmt: (p) => this.fmtDur(p.s), tipTitle: (p) => `Beste Leistung über ${this.fmtDur(p.s)}`,
      ref: ftp.watts ? { value: ftp.watts } : undefined, series: [
        { label: "90 Tage", kind: "line", color: cssVar("--s1"), value: (p) => p.best, fmt: (v) => `${de(v)} W` },
        { label: "letzte 6 Wochen", kind: "line", color: cssVar("--s2"), value: (p) => p.recent, fmt: (v) => `${de(v)} W` },
      ] });
    $("pcCap").textContent = `Beste Durchschnittsleistung je Dauer, nur Fahrten mit Sekundenwerten (FIT-Import).${ftp.watts ? " Gestrichelt: FTP." : ""} Geschätzte Werte sind Richtwerte.`;
    zones.replaceChildren(...[this.zoneList(c.zoneDistribution.power, "Leistungszonen"), this.zoneList(c.zoneDistribution.hr, "Pulszonen")].filter(Boolean));
    if (zones.children.length) zones.append(el("p", { class: "chart-cap", text: "Letzte 6 Wochen. Näherung: jede Einheit zählt ganz in die Zone ihres Mittelwerts." }));
  },
});
