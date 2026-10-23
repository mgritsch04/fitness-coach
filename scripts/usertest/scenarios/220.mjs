// #220 Workout-Liste: nach Sport, Zeitraum und Art filtern und suchen (Training › Workouts), am Handy.
const rows = (t) => t.page.locator("#tWorkouts tbody tr:not(.rpe-row):not(.wo-tplrow)");
const sports = (t) => rows(t).evaluateAll((rs) => rs.map((r) => r.querySelectorAll("td")[1]?.innerText.trim()));
export default {
  issue: 220,
  feature: 220,
  title: "Workout-Liste filtern und suchen (#220)",
  name: "Workout-Filter",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Tab „Training“, Abschnitt „Workouts“ öffnen.",
      expected: "Über der Liste stehen „Alle / Rad / Kraft / Andere“, eine Quellen-Auswahl und ein Suchfeld. Sportarten sind richtig eingeordnet.",
      async run(t) {
        await t.open("training");
        await t.section("workouts");
        await t.page.locator("#tWorkouts tbody tr").first().waitFor();
        const kinds = await t.page.locator("#woKind button").allInnerTexts();
        const src = await t.page.locator("#woSource").isVisible(), q = await t.page.locator("#woSearch").isVisible();
        const all = [...new Set(await sports(t))];
        await t.page.locator("#woKind button[data-k=other]").click();
        const other = [...new Set(await sports(t))];
        await t.page.locator("#woKind button[data-k=all]").click();
        const ok = kinds.join() === "Alle,Rad,Kraft,Andere" && src && q && !other.some((s) => /Kraft|Rad|Spinning|Cycling/i.test(s));
        return { status: ok ? "ok" : "fail", observed: `Knöpfe: ${kinds.join(", ")}; Quellen-Auswahl sichtbar: ${src}; Suchfeld sichtbar: ${q}. Sportarten gesamt: ${all.join(", ")}. Unter „Andere“: ${other.join(", ") || "nichts"} (kein Kraft/Rad darunter).`, locator: t.page.locator("#sec-workouts") };
      },
    },
    {
      nr: 2,
      action: "„Rad“ antippen.",
      expected: "Nur noch Radfahren und Spinning; darüber steht „x von y Workouts im Zeitraum“.",
      async run(t) {
        await t.page.locator("#woKind button[data-k=bike]").click();
        await t.page.waitForTimeout(300);
        const s = [...new Set(await sports(t))], cnt = (await t.text("#woCount")).trim();
        const ok = s.length > 0 && s.every((x) => /Rad|Spinning|Cycling|Radfahren/i.test(x)) && /^\d+ von \d+ Workouts im Zeitraum/.test(cnt);
        return { status: ok ? "ok" : "fail", observed: `Sportarten: ${s.join(", ")}. Zähler: „${cnt}“.`, locator: t.page.locator("#sec-workouts") };
      },
    },
    {
      nr: 3,
      action: "Im Suchfeld „Spinning“ eingeben und danach die Quelle „MyWhoosh“ auswählen.",
      expected: "Die Liste filtert sofort. Quelle „MyWhoosh“ zeigt nur hochgeladene Fahrten.",
      async run(t) {
        await t.page.locator("#woKind button[data-k=all]").click();
        await t.page.fill("#woSearch", "Spinning");
        await t.page.waitForTimeout(300);
        const s1 = [...new Set(await sports(t))];
        await t.page.fill("#woSearch", "");
        await t.page.selectOption("#woSource", { label: "MyWhoosh" });
        await t.page.waitForTimeout(300);
        const src = await rows(t).evaluateAll((rs) => rs.map((r) => r.querySelector("td[data-k=Quelle]")?.innerText.trim()));
        const ok = s1.length > 0 && s1.every((x) => /Spinning/i.test(x)) && src.length > 0 && src.every((x) => /MyWhoosh/.test(x));
        return { status: ok ? "ok" : "fail", observed: `Suche „Spinning“: ${s1.join(", ")}. Quelle MyWhoosh: ${src.length} Zeilen, Quellen: ${[...new Set(src)].join(", ")}.`, locator: t.page.locator("#sec-workouts") };
      },
    },
    {
      nr: 4,
      action: "Unten „25 weitere laden“ antippen.",
      expected: "Die nächsten Einträge erscheinen.",
      async run(t) {
        await t.page.selectOption("#woSource", "");
        await t.page.waitForTimeout(300);
        const before = await rows(t).count();
        const label = (await t.text("#btnMoreWorkouts")).trim();
        await t.page.locator("#btnMoreWorkouts").click();
        await t.page.waitForTimeout(300);
        const after = await rows(t).count();
        return { status: before === 25 && after > before && /weitere laden/.test(label) ? "ok" : "fail", observed: `Knopf „${label}“; Zeilen ${before} → ${after}.`, locator: t.page.locator("#sec-workouts") };
      },
    },
    {
      nr: 5,
      action: "Dashboard neu laden (Filter noch gesetzt?), danach „Filter zurücksetzen“ antippen.",
      expected: "Der Filter ist nach dem Neuladen noch gesetzt; nach „Filter zurücksetzen“ zeigt die Liste wieder alles.",
      async run(t) {
        await t.page.locator("#woKind button[data-k=bike]").click();
        await t.page.fill("#woSearch", "Spinning");
        await t.page.waitForTimeout(300);
        const filtered = (await t.text("#woCount")).trim();
        await t.page.reload();
        await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 });
        await t.page.waitForTimeout(800);
        await t.tab("training"); await t.section("workouts");
        const kept = { kind: await t.page.locator("#woKind button[aria-pressed=true]").innerText(), q: await t.page.inputValue("#woSearch"), count: (await t.text("#woCount")).trim() };
        await t.page.locator("#btnResetWorkouts").click();
        await t.page.waitForTimeout(300);
        const after = (await t.text("#woCount")).trim(), q = await t.page.inputValue("#woSearch");
        const ok = kept.kind === "Rad" && kept.q === "Spinning" && /von/.test(kept.count) && !/ von /.test(after) && q === "";
        return { status: ok ? "ok" : "fail", observed: `Vorher gefiltert: „${filtered}“. Nach Neuladen: Knopf ${kept.kind}, Suche „${kept.q}“, „${kept.count}“. Nach Zurücksetzen: „${after}“, Suchfeld „${q}“.`, locator: t.page.locator("#sec-workouts") };
      },
    },
  ],
};
