// #211 Vorschau-CI prüft Barrierefreiheit / Lesbarkeit kleiner Texte (Kontrast).
import { res, look } from "./_q.mjs";
const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
async function measure(t) {
  return t.page.evaluate(() => {
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; } return "rgb(255,255,255)"; };
    const pick = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent && e.innerText.trim()).slice(0, 25).map((e) => ({ sel, color: getComputedStyle(e).color, bg: bgOf(e), size: parseFloat(getComputedStyle(e).fontSize), text: e.innerText.trim().slice(0, 30) }));
    return { muted: pick(".muted, .fine"), good: pick(".good, .ok-text, [class*=good]"), warn: pick(".warn, [class*=warn]") };
  });
}
export default {
  issue: 211, feature: 211, title: "Lesbarkeit / Kontrast (#211)", name: "Kontrast", device: "phone",
  steps: [
    { nr: 1, action: "Tab „Heute“: die kleinen grauen Texte ansehen, auch bei Sonne.", expected: "Gut lesbar.",
      async run(t) { const out = [];
        for (const scheme of ["light", "dark"]) { await t.page.emulateMedia({ colorScheme: scheme }); await t.open("heute"); const m = await measure(t);
          const worst = m.muted.map((x) => ({ ...x, r: ratio(x.color, x.bg) })).sort((a, b) => a.r - b.r)[0];
          out.push(`${scheme === "light" ? "hell" : "dunkel"}: schwächster grauer Text „${worst?.text}“ Kontrast ${worst ? worst.r.toFixed(2) : "?"}:1 (Soll ≥ 4,5:1)`); t.worst = (t.worst ?? []).concat(worst?.r ?? 0); }
        return look(`Gemessen (WCAG-Formel): ${out.join(" · ")}. Wie es draußen in der Sonne wirkt, beurteilt nur G.`, t.page.locator("body")); } },
    { nr: 2, action: "Die grünen „gut“- und orangen „Achtung“-Texte ansehen.", expected: "Noch klar als Farbe erkennbar und gut lesbar.",
      async run(t) { const m = await measure(t); const all = [...m.good, ...m.warn].map((x) => ({ ...x, r: ratio(x.color, x.bg) }));
        const bad = all.filter((x) => x.r < 4.5);
        return look(`${all.length} grüne/orange Texte gemessen, ${bad.length} unter 4,5:1${bad.length ? ` (z. B. „${bad[0].text}“ ${bad[0].r.toFixed(2)}:1)` : ""}. Farbwirkung beurteilt G.`, t.page.locator("body")); } },
    { nr: 3, action: "Auf Stellen achten, die zu dunkel oder zu blass wirken.", expected: "Nichts wirkt zu dunkel oder zu blass.",
      async run() { return look("Rein subjektive Beurteilung am Bild. Die Vorschau-CI prüft Kontraste mit axe-core automatisch (Hell und Dunkel), siehe Bilder des Berichts."); } },
  ],
};
