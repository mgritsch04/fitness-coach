// Tagebuch (#23): kurzer Check-in für heute (Befinden, Energie, Muskelkater, Stress, Motivation,
// Tags, Notiz). Fließt in die Tagesempfehlung ein. Daten: get_dashboard → journal; speichern: save_journal.
FC.section({
  id: "journal",
  tab: "heute",
  order: 12,
  css: `
    .ci { display: grid; gap: 10px; }
    .ci-row { display: grid; grid-template-columns: 8.5em 1fr; gap: 8px; align-items: center; }
    .ci-scale { display: flex; gap: 4px; flex-wrap: wrap; }
    .ci-scale button { min-width: 2.4em; padding: 4px 0; }
    .ci-scale button[aria-pressed="true"], .ci-tags button[aria-pressed="true"] { background: var(--accent, #4fb3cf); color: var(--accent-ink, #fff); border-color: transparent; }
    .ci-tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .ci-tags button { border-radius: 999px; padding: 3px 10px; font-size: 13px; }
    .ci textarea { width: 100%; min-height: 2.6em; font: inherit; box-sizing: border-box; }
    .ci-fx { font-size: 13px; }
    @media (max-width: 480px) { .ci-row { grid-template-columns: 1fr; gap: 4px; } }
  `,
  scales: [
    ["feeling", "Befinden", "schlecht", "super"],
    ["energy", "Energie", "leer", "voll"],
    ["soreness", "Muskelkater", "keiner", "stark"],
    ["stress", "Stress", "keiner", "hoch"],
    ["motivation", "Motivation", "keine", "hoch"],
  ],
  tags: ["krank", "verletzt", "reise", "alkohol", "spät gegessen", "koffein spät", "stress arbeit", "gut geschlafen"],
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-journal">Wie geht's dir heute?</h2><span class="muted" id="ciState">Dein Gefühl zählt mit: es fließt in die Empfehlung ein.</span></div>
      <div class="panel ci">
        <div id="ciScales"></div>
        <div class="ci-tags" id="ciTags" aria-label="Tags"></div>
        <textarea id="ciNotes" placeholder="Notiz (optional), z. B. schwere Beine vom Beintag" maxlength="2000" aria-label="Notiz"></textarea>
        <div class="coach-actions"><button type="button" class="primary" id="ciSave" disabled>Check-in speichern</button><span class="muted" id="ciMsg"></span></div>
        <p class="muted ci-fx" id="ciFx" hidden></p>
      </div>`;
    const { $, el } = FC;
    this.root = root;
    this.val = {};
    this.tagSet = new Set();
    const box = $("ciScales");
    for (const [key, label, lo, hi] of this.scales) {
      const sc = el("div", { class: "ci-scale", role: "group", "aria-label": label });
      for (let v = 1; v <= 5; v++) {
        const b = el("button", { type: "button", text: String(v), "aria-pressed": "false", title: v === 1 ? lo : v === 5 ? hi : "" });
        b.onclick = () => { this.dirty = true; this.val[key] = this.val[key] === v ? null : v; this.paint(); };
        sc.append(b);
      }
      box.append(el("div", { class: "ci-row" }, el("span", {}, label, el("span", { class: "muted", text: ` (1 ${lo} – 5 ${hi})`, style: "font-size:12px" })), sc));
    }
    const tags = $("ciTags");
    for (const t of this.tags) {
      const b = el("button", { type: "button", text: t, "aria-pressed": "false" });
      b.onclick = () => { this.dirty = true; this.tagSet.has(t) ? this.tagSet.delete(t) : this.tagSet.add(t); this.paint(); };
      tags.append(b);
    }
    $("ciSave").onclick = () => this.save();
    $("ciNotes").addEventListener("input", () => (this.dirty = true));
  },
  paint() {
    const rows = FC.$("ciScales").children;
    this.scales.forEach(([key], i) => [...rows[i].querySelectorAll("button")].forEach((b, j) => b.setAttribute("aria-pressed", String(this.val[key] === j + 1))));
    for (const b of FC.$("ciTags").children) b.setAttribute("aria-pressed", String(this.tagSet.has(b.textContent)));
  },
  render(d) {
    const j = d.journal;
    this.root.hidden = !j;
    if (!j) return;
    if (!this.dirty) {
      const e = j.today ?? {};
      for (const [key] of this.scales) this.val[key] = e[key] ?? null;
      this.tagSet = new Set(e.tags ?? []);
      for (const t of this.tagSet) if (!this.tags.includes(t)) this.tags.push(t);
      FC.$("ciNotes").value = e.notes ?? "";
      FC.$("ciState").textContent = j.today ? `Heute eingetragen${j.today.updatedAt ? ` (${FC.ago(j.today.updatedAt.replace(" ", "T") + "Z") ?? ""})` : ""}. Ändern geht jederzeit.` : "Dein Gefühl zählt mit: es fließt in die Empfehlung ein.";
      // Neue eigene Tags als Knöpfe ergänzen.
      const tags = FC.$("ciTags");
      for (const t of this.tags) if (![...tags.children].some((b) => b.textContent === t)) {
        const b = FC.el("button", { type: "button", text: t, "aria-pressed": "false" });
        b.onclick = () => { this.dirty = true; this.tagSet.has(t) ? this.tagSet.delete(t) : this.tagSet.add(t); this.paint(); };
        tags.append(b);
      }
      this.paint();
    }
    const fx = (j.tagEffects ?? []).filter((x) => Math.abs(x.deltaPct) >= 5).slice(0, 3);
    FC.$("ciFx").hidden = !fx.length;
    FC.$("ciFx").textContent = fx.length ? `Beobachtung (keine Ursache): ${fx.map((x) => `nach „${x.tag}“ Erholung im Schnitt ${x.recoveryWith} % statt ${x.recoveryWithout} % (${x.count}×)`).join("; ")}.` : "";
    FC.$("ciSave").disabled = !FC.state.mcp;
  },
  rerender() {},
  async save() {
    const { $ } = FC;
    $("ciSave").disabled = true; $("ciMsg").textContent = "Speichere …";
    try {
      await FC.call("save_journal", { ...this.val, tags: [...this.tagSet], notes: $("ciNotes").value.trim() || null });
      $("ciMsg").textContent = "Gespeichert. Die Empfehlung wird neu berechnet.";
      this.dirty = false;
      await FC.reload();
    } catch (e) { $("ciMsg").textContent = FC.errText(e); }
    finally { $("ciSave").disabled = false; }
  },
});
