// Wiedereinstieg nach Krankheit oder Pause (#201) aus get_dashboard.returnToTraining. Nur sichtbar, solange er läuft.
FC.section({
  id: "comeback",
  tab: "heute",
  order: 6,
  css: `
    .cb { border-left: 4px solid var(--accent); }
    .cb.sick { border-color: var(--bad); }
    .cb h3 { margin: 0 0 6px; }
    .cb .cb-bar { height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; margin: 8px 0; }
    .cb .cb-bar span { display: block; height: 100%; background: var(--accent); }
    .cb ul { margin: 8px 0; padding-left: 1.2em; display: grid; gap: 4px; }
    .cb .fine { margin: 6px 0 0; }`,
  mount(root) {
    this.root = root;
    root.hidden = true;
    root.innerHTML = `<div class="panel cb" id="cbBox" role="status"><h3 id="cbHead"></h3><div class="cb-bar" id="cbBar" hidden><span id="cbFill"></span></div><p id="cbText"></p><ul id="cbList"></ul><p class="fine muted" id="cbFine"></p></div>`;
  },
  render(d) {
    const { $, el } = FC, r = d.returnToTraining;
    this.root.hidden = !r;
    if (!r) return;
    const what = r.reason === "sick" ? "Krankheit" : r.reason === "injured" ? "Verletzung" : "Pause";
    $("cbBox").className = `panel cb${r.status === "sick" ? " sick" : ""}`;
    $("cbHead").textContent = r.status === "sick" ? "Erst gesund werden" : `Wiedereinstieg nach ${what}: Tag ${r.day} von ${r.totalDays}`;
    $("cbBar").hidden = r.status === "sick";
    if (r.day) $("cbFill").style.width = `${Math.round((r.day / r.totalDays) * 100)}%`;
    $("cbText").textContent = r.status === "sick" ? r.text : r.abort ?? r.stage.label;
    $("cbList").replaceChildren(...(r.stage ? [`Dauer: etwa ${r.stage.durationPct} % der üblichen`, `Intensität: ${r.stage.intensity}`, `Kraft: ${r.stage.strength}`].map((t) => el("li", { text: t })) : []));
    $("cbFine").textContent = r.disclaimer;
  },
});
