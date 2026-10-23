// Fehlerbehebung #351 (Stern in Einklapp-Leiste) und #353 (Vibration am Ende der Mobility-Routine), Handy.
export default {
  issue: 351,
  feature: 291,
  title: "Favoriten-Stern am Handy und Vibration am Ende der Mobility (#351, #353)",
  name: "Stern in Einklapp-Leiste und Vibration am Ende",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Training öffnen, Abschnitt Trainingslast: Stern in der Einklapp-Leiste antippen.",
      expected: "Der Stern ist sichtbar und antippbar, füllt sich und der Abschnitt steht unter „Deine Favoriten“.",
      async run(t) {
        await t.open("training");
        const id = await t.page.evaluate(() => [...document.querySelectorAll("#sections > section.foldable")].find((s) => /Trainingslast/i.test(s.querySelector(":scope > .fold-bar")?.textContent ?? ""))?.id);
        if (!id) return { status: "fail", observed: "Keine einklappbare Leiste „Trainingslast“ gefunden." };
        const star = t.page.locator(`#${id} > .fav-bar`);
        if (!(await star.isVisible())) return { status: "fail", observed: "Stern in der Leiste nicht sichtbar." };
        await star.tap();
        await t.page.waitForTimeout(300);
        const pressed = await star.getAttribute("aria-pressed");
        const favs = await t.page.evaluate(() => JSON.parse(localStorage.getItem("fc-fav") ?? "[]"));
        const ok = pressed === "true" && favs.includes(id.replace(/^sec-/, ""));
        return { status: ok ? "ok" : "fail", observed: `Stern gedrückt: ${pressed}; Favoriten: ${favs.join(", ")}.`, locator: t.page.locator(`#${id}`) };
      },
    },
    {
      nr: 2,
      action: "Mobility-Routine starten und ablaufen lassen (vorgespielte Uhr).",
      expected: "Am Ende steht „Fertig“ und es vibriert (navigator.vibrate wird beim letzten Ablauf aufgerufen).",
      async run(t) {
        await t.page.addInitScript(() => { window.__vib = []; navigator.vibrate = (p) => (window.__vib.push(p), true); });
        await t.page.clock.install();
        await t.open("heute");
        await t.section("mobility");
        await t.page.evaluate(() => { window.__vib = []; navigator.vibrate = (p) => (window.__vib.push(p), true); });
        await t.page.click("#moStart");
        for (let i = 0; i < 60 && !/Fertig/.test(await t.text("#moRun")); i++) await t.page.clock.runFor(30_000);
        const vib = await t.page.evaluate(() => window.__vib);
        const done = /Fertig/.test(await t.text("#moRun"));
        const ok = done && vib.length > 0 && JSON.stringify(vib[vib.length - 1]) !== JSON.stringify(200);
        return { status: ok ? "ok" : "fail", observed: `Fertig angezeigt: ${done}; Vibrationsaufrufe: ${vib.length}, letzter: ${JSON.stringify(vib[vib.length - 1])}.` };
      },
    },
  ],
};
