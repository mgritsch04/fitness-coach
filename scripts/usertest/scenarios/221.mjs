// #221 Workout-Bibliothek für MyWhoosh (Training › Workout für MyWhoosh › „Aus der Bibliothek wählen“).
export default {
  issue: 221,
  feature: 221,
  title: "Workout-Bibliothek für MyWhoosh (#221)",
  name: "MyWhoosh-Bibliothek",
  device: "desktop",
  realDevice: ["Hochladen auf workout.mywhoosh.com und Anzeige in der MyWhoosh-App lassen sich nur mit echtem Konto und App prüfen."],
  steps: [
    {
      nr: 1,
      action: "Dashboard öffnen, Reiter Training, Abschnitt „Workout für MyWhoosh“ ansehen.",
      expected: "Der Abschnitt mit „Aus der Bibliothek wählen“ ist zu sehen.",
      async run(t) {
        await t.open("training");
        await t.section("bikewo");
        const s = await t.page.locator("#bwLib summary").innerText();
        return { status: /Aus der Bibliothek wählen/.test(s) ? "ok" : "fail", observed: `Überschrift „${await t.text("#h-bikewo")}“, Aufklapper „${s}“.`, locator: t.page.locator("#sec-bikewo") };
      },
    },
    {
      nr: 2,
      action: "„Aus der Bibliothek wählen“ aufklappen.",
      expected: "Oben steht, was heute zu deiner Erholung passt (z. B. gelb: kein VO2max).",
      async run(t) {
        await t.page.locator("#bwLib summary").click();
        await t.page.locator("#bwList .bw-item").first().waitFor({ timeout: 10_000 });
        const hint = (await t.text("#bwLHint")).trim(), n = await t.page.locator("#bwList .bw-item").count();
        return { status: hint.length > 10 && n > 3 ? "ok" : "fail", observed: `Hinweis: „${hint}“. Vorlagen in der Liste: ${n}.`, locator: t.page.locator("#bwLib") };
      },
    },
    {
      nr: 3,
      action: "Mit Art und Zeit filtern (Sweet Spot, bis 75 min).",
      expected: "Die Liste wird nach Art und Zeit gefiltert.",
      async run(t) {
        await t.page.selectOption("#bwLCat", "sweetspot");
        await t.page.selectOption("#bwLMax", "75");
        await t.page.waitForTimeout(1200);
        const items = await t.page.locator("#bwList .bw-item span:first-of-type").allInnerTexts();
        const mins = items.map((s) => Number((s.match(/(\d+) min/) ?? [])[1]));
        const ok = items.length > 0 && items.every((s) => /Sweet Spot/.test(s)) && mins.every((m) => m <= 75);
        return { status: ok ? "ok" : "fail", observed: `${items.length} Treffer: ${items.slice(0, 4).join(" | ")}.`, locator: t.page.locator("#bwLib") };
      },
    },
    {
      nr: 4,
      action: "Eine Einheit antippen.",
      expected: "Profil und Schritte darunter wechseln auf diese Einheit. Die Einheit passt (z. B. nicht zu hart oder zu leicht); Intensitäten sind Faustregeln.",
      async run(t) {
        const item = t.page.locator("#bwList .bw-item").first();
        const title = (await item.locator("b").innerText()).trim();
        await item.click();
        await t.page.waitForTimeout(1200);
        const name = (await t.text("#bwOut .bw-sum b")).trim();
        const steps = await t.page.locator("#bwOut .bw-steps li").count(), prof = await t.page.locator("#bwOut .bw-prof svg").count();
        const pressed = await item.getAttribute("aria-pressed");
        const ok = name.includes(title) || title.includes(name);
        return { status: ok && steps > 0 && prof > 0 && pressed === "true" ? "look" : "fail", observed: `Gewählt „${title}“, Anzeige „${name}“, ${steps} Schritte, Profil-Grafik ${prof ? "da" : "fehlt"}. Ob die Einheit zu deiner Form und deinem Gefühl passt, kannst nur du beurteilen.`, locator: t.page.locator("#bwOut") };
      },
    },
    {
      nr: 5,
      action: "Als .zwo herunterladen, auf workout.mywhoosh.com hochladen und „Export to MyWhoosh“ wählen.",
      expected: "Die Einheit erscheint in der App unter „MyWorkouts“.",
      async run(t) {
        const dis = await t.page.locator("#bwGet").isDisabled();
        return { status: "device", observed: `Der Knopf „Als .zwo herunterladen“ ist ${dis ? "in der Testumgebung gesperrt (Download-Funktion nur in claude.ai)" : "aktiv"}. Hochladen und die MyWhoosh-App sind nur mit echtem Konto prüfbar.` };
      },
    },
  ],
};
