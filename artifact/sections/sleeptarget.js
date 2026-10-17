// Schlafziel für heute Nacht (#205) aus get_dashboard.sleepTarget. Nur abends (ab 18 Uhr) sichtbar.
FC.section({
  id: "sleeptarget",
  tab: "heute",
  order: 7,
  css: `
    .st { display: flex; flex-wrap: wrap; gap: 6px 22px; align-items: baseline; }
    .st b { font-family: var(--font-display); font-size: 1.5rem; }
    .st-parts { margin: 8px 0 0; padding-left: 1.2em; display: grid; gap: 4px; font-size: .92rem; }
    .st-fine { margin: 8px 0 0; }`,
  mount(root) {
    this.root = root;
    root.hidden = true;
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-sleeptarget">Schlafziel heute Nacht</h2><span class="muted">Schätzung</span></div>
      <div class="panel">
        <div class="st"><span>Schlaf <b id="stDur"></b></span><span id="stBedW">Licht aus bis <b id="stBed"></b></span></div>
        <ul class="st-parts" id="stParts"></ul>
        <p class="fine muted st-fine" id="stFine"></p>
      </div>`;
  },
  render(d) {
    const { $, el } = FC, t = d.sleepTarget, h = new Date().getHours();
    this.root.hidden = !t || !(h >= 18 || h < 3);
    if (this.root.hidden) return;
    $("stDur").textContent = t.targetText;
    $("stBedW").hidden = !t.bedtime;
    $("stBed").textContent = t.bedtime ?? "";
    const base = Math.round(t.base.hours * 60);
    $("stParts").replaceChildren(
      el("li", { text: `Grundbedarf ${Math.floor(base / 60)} h${base % 60 ? ` ${base % 60} min` : ""}` }),
      ...t.parts.map((p) => el("li", { text: `+ ${p.minutes} min: ${p.label}` })),
      ...(t.wake ? [el("li", { text: `Aufstehen wie üblich um ${t.wake}, Zeit im Bett etwa ${String(t.inBedH).replace(".", ",")} h` })] : []),
    );
    $("stFine").textContent = t.note;
  },
});
