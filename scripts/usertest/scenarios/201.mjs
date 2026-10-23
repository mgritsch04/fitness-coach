// #201 Wiedereinstieg nach Krankheit oder Pause (Heute › Karte „Wiedereinstieg“, Tagesempfehlung).
// Synthetisch: Check-in „krank“ heute, danach „krank“ an den Tagen davor und heute gesund.
const add = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export default {
  issue: 201,
  feature: 201,
  title: "Wiedereinstieg nach Krankheit oder Pause (#201)",
  name: "Wiedereinstieg",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Im Check-in den Tag „krank“ setzen.",
      expected: "Die Empfehlung lautet Ruhe; die Karte zeigt „Erst gesund werden“.",
      async run(t) {
        await t.tool("save_journal", { tags: ["krank"] });
        await t.open("heute");
        const head = (await t.text("#cbHead")).trim(), pill = (await t.text("#readyPill")).trim();
        return { status: /Erst gesund werden/.test(head) && /Ruhe/.test(pill) ? "ok" : "fail", observed: `Karte: „${head}“; Empfehlung: „${pill}“.`, locator: t.page.locator("#sec-comeback") };
      },
    },
    {
      nr: 2,
      action: "Am ersten Tag ohne „krank“ die Karte „Wiedereinstieg“ ansehen.",
      expected: "Die Karte zeigt „Wiedereinstieg … Tag 1 von N“ mit Dauer, Intensität und Kraft. Die Tagesempfehlung ist höchstens „locker“.",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        for (let i = 1; i <= 4; i++) await t.tool("save_journal", { day: add(today, -i), tags: ["krank"] });
        await t.tool("save_journal", { tags: [], feeling: 4, energy: 4 });
        await t.open("heute");
        const head = (await t.text("#cbHead")).trim(), list = await t.page.locator("#cbList li").allInnerTexts(), pill = (await t.text("#readyPill")).trim();
        const rank = { Ruhe: 0, Locker: 1, Normal: 2, Hart: 3 };
        const rec = Object.keys(rank).find((k) => pill.endsWith(k));
        const ok = /Wiedereinstieg nach Krankheit: Tag 1 von \d+/.test(head) && list.length === 3 && /Dauer/.test(list[0]) && /Intensität/.test(list[1]) && /Kraft/.test(list[2]) && rank[rec] <= 1;
        return { status: ok ? "ok" : "fail", observed: `Karte: „${head}“; ${list.map((l) => `„${l}“`).join(", ")}; Empfehlung: „${pill}“.`, locator: t.page.locator("#sec-comeback") };
      },
    },
    {
      nr: 3,
      action: "Im Coach-Chat fragen: „Wie steige ich nach der Erkältung wieder ein?“",
      expected: "Der Coach steigt stufenweise wieder ein (locker/kurz, dann Grundlage mit leichter Kraft, zuletzt fast normal); bei schlechterem Ruhepuls oder HRV rät er, nicht zu steigern.",
      async run(t) {
        return { status: "device", observed: "Die Chat-Antwort schreibt Claude (in der Testumgebung nur Beispielantworten). Die Stufen stehen im Coach-Kontext (returnToTraining), die Abbruchregel ist per Unit-Test „Abbruchregel bei erhöhtem Ruhepuls“ abgedeckt." };
      },
    },
  ],
};
