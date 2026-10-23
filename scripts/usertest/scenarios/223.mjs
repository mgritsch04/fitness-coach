// #223 Mobility-Routine nach der Einheit (Heute › Mobility nach der Einheit, Timer je Übung und Seite).
// Der Timer läuft mit vorgespielter Uhr (Playwright clock), damit die 5–10 Minuten nicht real abgewartet werden müssen.
export default {
  issue: 223,
  feature: 223,
  title: "Mobility-Routine nach der Einheit (#223)",
  name: "Mobility-Timer",
  device: "phone",
  realDevice: ["Ob das Handy am Ende wirklich vibriert und die Routine zur Einheit passt, lässt sich nur am Gerät prüfen."],
  steps: [
    {
      nr: 1,
      action: "Nach dem Training „Mobility starten“ antippen (hier direkt im Abschnitt, weil „Heute dran“ den Knopf nur nach erledigter Einheit oder am Ruhetag zeigt).",
      expected: "Die Ansicht springt zum Abschnitt und der Timer läuft.",
      async run(t) {
        await t.context.addInitScript(() => { window.__vib = []; navigator.vibrate = (p) => { window.__vib.push(p); return true; }; });
        await t.context.clock.install();
        await t.open("heute");
        const agendaBtn = await t.page.locator("#sec-agenda button", { hasText: "Mobility starten" }).count();
        await t.section("mobility");
        const title = await t.text("#moTitle"), n = await t.page.locator("#moList li").count();
        await t.page.click("#moStart");
        await t.page.waitForTimeout(300);
        const run = (await t.text("#moRun")).replace(/\s+/g, " ");
        await t.context.clock.fastForward(3000);
        const run2 = (await t.text("#moRun")).replace(/\s+/g, " ");
        t.total = n;
        const ok = /^1\/\d+:/.test(run) && run !== run2 && (await t.page.locator("#moRun").isVisible());
        return { status: ok ? "ok" : "fail", observed: `Routine „${title}“ mit ${n} Übungen. Knopf in „Heute dran“ vorhanden: ${agendaBtn ? "ja" : "nein (Einheit heute noch nicht erledigt, kein Ruhetag)"}. Timer: „${run}“, 3 s später „${run2}“.`, locator: t.page.locator("#sec-mobility") };
      },
    },
    {
      nr: 2,
      action: "Den Timer ablaufen lassen.",
      expected: "Er zählt je Übung und je Seite herunter, wechselt die Seite und dann zur nächsten Übung. Am Ende steht „Fertig“; am Handy vibriert es kurz.",
      async run(t) {
        const seen = [];
        let vibBeforeEnd = 0;
        for (let i = 0; i < 900; i++) {
          vibBeforeEnd = await t.page.evaluate(() => window.__vib.length);
          await t.context.clock.fastForward(1000);
          const head = (await t.page.locator("#moRun p").first().innerText().catch(() => "")).trim();
          const txt = (await t.text("#moRun")).trim();
          if (head && seen.at(-1) !== head) seen.push(head);
          if (/^Fertig/.test(txt)) break;
        }
        const fin = (await t.text("#moRun")).trim();
        const vib = await t.page.evaluate(() => window.__vib.length);
        const sides = seen.filter((s) => /Seite/.test(s)).length;
        const exs = new Set(seen.map((s) => s.replace(/ \((erste|zweite) Seite\)/, ""))).size;
        const ok = /^Fertig/.test(fin) && exs === t.total && sides >= 2;
        const endVib = vib > vibBeforeEnd;
        return { status: ok && endVib ? "ok" : "fail", observed: `Beim letzten Takt (Übergang zu „Fertig“) ${endVib ? "vibriert es" : "wird NICHT vibriert (der Code kehrt vor navigator.vibrate zurück)"}. Durchlauf: ${exs} von ${t.total} Übungen, ${sides} Seitenwechsel-Anzeigen (z. B. „${seen.filter((s) => /Seite/.test(s)).slice(0, 2).join("“, „")}“). Am Ende: „${fin}“. Aufrufe von navigator.vibrate: ${vib} (nur beim Wechsel zwischen Übungen/Seiten).`, locator: t.page.locator("#sec-mobility") };
      },
    },
    {
      nr: 3,
      action: "Über die Auswahl eine andere Routine öffnen („Nach Beintag“).",
      expected: "Die andere Routine wird geöffnet.",
      async run(t) {
        const before = await t.text("#moTitle");
        await t.page.selectOption("#moKind", "legs");
        await t.page.waitForTimeout(800);
        const title = await t.text("#moTitle"), list = (await t.text("#moList")).replace(/\s+/g, " ");
        return { status: title !== before && /bein/i.test(`${title} ${list}`) ? "ok" : "fail", observed: `Titel vorher „${before}“, jetzt „${title}“. Übungen: ${list.slice(0, 200)}`, locator: t.page.locator("#sec-mobility") };
      },
    },
    {
      nr: 4,
      action: "Im Coach-Chat „Gib mir Mobility nach dem Beintag“ eingeben.",
      expected: "Es kommt eine passende Routine.",
      async run(t) {
        const r = await t.tool("get_mobility_routine", { kind: "legs" });
        return { status: "device", observed: `Die Chat-Antwort schreibt Claude (in der Testumgebung nur Beispielantworten). Das Werkzeug dahinter liefert „${r.title}“ mit ${r.exercises.length} Übungen.` };
      },
    },
  ],
};
