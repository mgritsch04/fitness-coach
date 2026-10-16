// Persönliche Einstellungen (update_settings). Leere Felder = Schätzung aus den Daten.
FC.section({
  id: "settings",
  tab: "mehr",
  order: 80,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-settings">Einstellungen</h2><span class="muted">Leere Felder schätzt der Coach aus deinen Daten.</span></div>
      <form class="panel" id="settingsForm" style="display:grid; gap:14px;" autocomplete="off">
        <div class="form">
          <label for="sFtp">FTP (Watt)<input id="sFtp" type="number" min="50" max="600" step="1" inputmode="numeric"><span class="hint" id="hFtp"></span></label>
          <label for="sMax">Maximaler Puls<input id="sMax" type="number" min="120" max="230" step="1" inputmode="numeric"><span class="hint" id="hMax"></span></label>
          <label for="sRest">Ruhepuls<input id="sRest" type="number" min="30" max="100" step="1" inputmode="numeric"><span class="hint" id="hRest"></span></label>
          <label for="sThr">Schwellenpuls<input id="sThr" type="number" min="100" max="220" step="1" inputmode="numeric"><span class="hint" id="hThr"></span></label>
          <label for="sSleep">Schlafbedarf (h)<input id="sSleep" type="number" min="5" max="11" step="0.25" inputmode="decimal"><span class="hint" id="hSleep"></span></label>
          <label for="sTz">Zeitzone<input id="sTz" type="text" placeholder="Europe/Berlin"><span class="hint" id="hTz"></span></label>
        </div>
        <div class="row"><button type="submit" class="primary" id="saveSettings" disabled>Speichern</button><span id="settingsMsg" class="muted" role="status"></span></div>
      </form>`;
    const { $ } = FC;
    $("settingsForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const num = (id) => { const v = $(id).value.trim(); return v === "" ? null : Number(v.replace(",", ".")); };
      const patch = { ftpW: num("sFtp"), maxHr: num("sMax"), restingHr: num("sRest"), thresholdHr: num("sThr"), sleepNeedH: num("sSleep"), timezone: $("sTz").value.trim() || null };
      for (const k of ["maxHr", "restingHr", "thresholdHr"]) if (patch[k] != null) patch[k] = Math.round(patch[k]);
      const msg = $("settingsMsg"); msg.textContent = "Speichere …"; $("saveSettings").disabled = true;
      try { await FC.call("update_settings", patch); msg.textContent = "Gespeichert."; await FC.reload(); }
      catch (err) { msg.textContent = err?.code === "tool_error" ? `Nicht gespeichert: ${String(err.message).slice(0, 160)}` : FC.errText(err); }
      finally { $("saveSettings").disabled = false; }
    });
  },
  render(d) {
    const { $, de } = FC;
    const s = d.settings, o = s.origin;
    $("saveSettings").disabled = false;
    const hint = (k, v, unit, digits = 0) => (o[k] === "user" ? "selbst gesetzt" : o[k] === "data" ? `aus deinen Daten: ${de(v)}${unit}` : o[k] === "default" ? `Schätzung: ${de(v, digits)}${unit}` : "nicht gesetzt");
    const set = (id, k, v, unit, digits) => { const inp = $(id); if (document.activeElement !== inp) inp.value = o[k] === "user" && v != null ? v : ""; if (v != null) inp.placeholder = String(v); $("h" + id.slice(1)).textContent = hint(k, v, unit, digits); };
    set("sFtp", "ftpW", s.ftpW, " W"); set("sMax", "maxHr", s.maxHr, " bpm"); set("sRest", "restingHr", s.restingHr, " bpm"); set("sThr", "thresholdHr", s.thresholdHr, " bpm"); set("sSleep", "sleepNeedH", s.sleepNeedH, " h", 1);
    if (!s.ftpW) $("hFtp").textContent = "nicht gesetzt: Belastung wird aus dem Puls geschätzt";
    const tz = $("sTz"); if (document.activeElement !== tz) tz.value = o.timezone === "user" ? s.timezone : "";
    $("hTz").textContent = o.timezone === "user" ? "selbst gesetzt" : `Standard: ${s.timezone}`;
  },
  rerender() {},
});
