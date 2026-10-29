// Monate und Jahre: Trainingsstunden nach Art (Kraft, Rad, Sonstiges), Belastung, Erholung, Fitnessänderung (get_period_summaries).
FC.section({
  id: "periods",
  simple: true,
  tab: "training",
  order: 55,
  KRAFT: /bodybuilding|weight|strength|functional|crossfit|powerlifting/i,
  RAD: /cycl|spin|bike|mtb|gravel|ride/i,
  mount(root) {
    root.innerHTML = `
      <div class="sec-head"><h2 id="h-periods">Monate und Jahre</h2>
        <div class="seg" role="group" aria-label="Zeitraum" id="perSeg"><button type="button" data-p="month" aria-pressed="true">Monate</button><button type="button" data-p="year">Jahre</button></div></div>
      <div class="panel"><h3>Trainingsstunden</h3><div class="chart" id="cPeriods"></div><p class="chart-cap" id="perCap"></p></div>
      <div class="panel tablewrap" style="margin-top:16px"><table id="tPeriods" class="cards"><thead><tr>
        <th class="l">Zeitraum</th><th>Trainingstage</th><th>Stunden</th><th>Rad km</th><th>Belastung</th><th>Fitness</th><th>Ø Erholung</th><th>grün/gelb/rot</th><th>Ø HRV</th><th>Ø Schlaf</th>
      </tr></thead><tbody></tbody></table></div>`;
    this.period = "month";
    root.querySelectorAll("#perSeg button").forEach((b) => b.addEventListener("click", () => {
      this.period = b.dataset.p;
      root.querySelectorAll("#perSeg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      this.subscribe();
    }));
  },
  ready() { this.subscribe(); },
  subscribe() {
    this.unwatch?.();
    this.payload = null; if (FC.state.data) this.render();
    const input = this.period === "year" ? { period: "year", days: 730 } : { period: "month", days: 365 };
    this.unwatch = FC.watch("get_period_summaries", input, (p, err) => { this.payload = p ?? { error: FC.errText(err) }; if (FC.state.data) this.render(); },
      { cache: { staleTime: 600_000, gcTime: 86_400_000 } });
  },
  label(p) {
    if (this.period === "year") return p.period;
    const [y, m] = p.period.split("-");
    return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString("de-DE", { month: "short", year: "2-digit", timeZone: "UTC" });
  },
  render() {
    const { $, el, de, chart, cssVar, fmtH } = FC, p = this.payload, box = $("cPeriods"), tb = $("tPeriods").tBodies[0];
    if (!p || p.error) { box.replaceChildren(el("div", { class: "empty", text: p?.error ?? "Lädt …" })); tb.replaceChildren(); return; }
    // Zeiträume vor den ersten Daten weglassen.
    const first = p.periods.findIndex((x) => x.workouts > 0 || x.avgRecovery != null || x.avgSleepH != null);
    const rows = (first < 0 ? [] : p.periods.slice(first)).map((x) => {
      let kraft = 0, rad = 0, other = 0, radKm = 0;
      for (const [s, v] of Object.entries(x.bySport ?? {})) {
        if (this.KRAFT.test(s)) kraft += v.minutes; else if (this.RAD.test(s)) { rad += v.minutes; radKm += v.distanceKm ?? 0; } else other += v.minutes;
      }
      return { ...x, kraftH: kraft / 60, radH: rad / 60, otherH: other / 60, radKm };
    });
    chart(box, { days: rows, yMin: 0, aria: "Trainingsstunden je Zeitraum", maxBar: 36, xFmt: (r) => this.label(r),
      tipTitle: (r) => `${this.label(r)}${r.days < (this.period === "year" ? 365 : 28) ? ` (${r.days} Tage erfasst)` : ""}`, series: [
        { label: "Kraft", kind: "stack", color: cssVar("--s2"), value: (r) => r.kraftH || null, fmt: (v) => `${fmtH(v)} h` },
        { label: "Rad", kind: "stack", color: cssVar("--s1"), value: (r) => r.radH || null, fmt: (v) => `${fmtH(v)} h` },
        { label: "Sonstiges", kind: "stack", color: cssVar("--ink-3"), value: (r) => r.otherH || null, fmt: (v) => `${fmtH(v)} h` },
      ], extraTip: [{ label: "Belastung", color: cssVar("--accent"), value: (r) => r.load, fmt: (v) => de(v) }] });
    $("perCap").textContent = "Kraft = WHOOP-Krafttraining, Rad = Rolle und Straße. Erster und laufender Zeitraum sind unvollständig.";
    tb.replaceChildren(...rows.slice().reverse().map((r) => el("tr", {},
      el("td", { text: this.label(r) }), el("td", { "data-k": "Trainingstage", text: `${de(r.trainingDays)} / ${de(r.days)}` }),
      el("td", { "data-k": "Stunden", text: fmtH(r.trainingH) }), el("td", { "data-k": "Rad km", text: r.radKm ? de(r.radKm) : "–" }),
      el("td", { "data-k": "Belastung", text: de(r.load) }),
      el("td", { "data-k": "Fitness", text: r.ctlEnd == null ? "–" : `${de(r.ctlEnd)} (${r.ctlChange >= 0 ? "+" : ""}${de(r.ctlChange, 1)})` }),
      el("td", { "data-k": "Ø Erholung", text: r.avgRecovery == null ? "–" : `${de(r.avgRecovery)} %` }),
      el("td", { "data-k": "grün/gelb/rot", text: r.recoveryDays ? `${r.recoveryDays.green}/${r.recoveryDays.yellow}/${r.recoveryDays.red}` : "–" }),
      el("td", { "data-k": "Ø HRV", text: r.avgHrv == null ? "–" : `${de(r.avgHrv)} ms` }),
      el("td", { "data-k": "Ø Schlaf", text: r.avgSleepH == null ? "–" : `${fmtH(r.avgSleepH)} h` }))));
    if (!rows.length) tb.append(el("tr", {}, el("td", { colspan: 10, class: "empty", text: "Noch keine Daten." })));
  },
  rerender() { if (this.payload) this.render(); },
});
