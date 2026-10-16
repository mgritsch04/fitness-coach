// Datenexport (#30) über export_csv und den Download-Dialog (Capability downloads).
FC.section({
  id: "export",
  tab: "mehr",
  order: 85,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-export">Daten exportieren</h2><span class="muted">als CSV, z. B. für Excel</span></div>
      <form class="panel" id="exForm" style="display:grid; gap:12px;" autocomplete="off">
        <div class="form">
          <label for="exSet">Daten<select id="exSet">
            <option value="daily">Tageswerte (Erholung, HRV, Ruhepuls, Strain)</option>
            <option value="sleeps">Schlaf</option>
            <option value="workouts">Workouts</option>
            <option value="body">Körperwerte</option></select></label>
          <label for="exDays">Zeitraum<select id="exDays">
            <option value="90">90 Tage</option><option value="365" selected>1 Jahr</option><option value="3650">alles</option></select></label>
          <label for="exExcel">Format<select id="exExcel">
            <option value="1">Excel (Semikolon, Dezimalkomma)</option><option value="0">Standard-CSV</option></select></label>
        </div>
        <div class="row"><button type="submit" class="primary" id="exGo">Herunterladen</button><span class="muted" id="exMsg" role="status"></span></div>
      </form>`;
  },
  async ready() {
    const { $ } = FC;
    const dl = await window.claude?.use?.("downloads").catch(() => null);
    if (!dl) { $("exGo").disabled = true; $("exMsg").textContent = "Herunterladen ist in dieser Ansicht nicht verfügbar."; return; }
    $("exForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("exMsg"); $("exGo").disabled = true; msg.textContent = "Lade Daten …";
      try {
        const r = await FC.call("export_csv", { dataset: $("exSet").value, days: Number($("exDays").value), excel: $("exExcel").value === "1" });
        if (!r.rows) { msg.textContent = "Keine Daten im Zeitraum."; return; }
        // BOM, damit Excel Umlaute richtig liest.
        await dl.save({ filename: r.fileName, data: new Blob(["﻿" + r.csv], { type: "text/csv;charset=utf-8" }) });
        msg.textContent = `${r.rows} Zeilen gespeichert.`;
      } catch (err) {
        msg.textContent = err?.code === "declined" ? "Abgebrochen." : err?.code === "rate_limited" ? "Bitte kurz warten und noch einmal." : err?.code === "tool_error" ? String(err.message).slice(0, 160) : FC.errText(err);
      } finally { $("exGo").disabled = false; }
    });
  },
});
