// #14 MyWhoosh-Fahrten per FIT-Upload: synthetische FIT-Fahrt statt echter MyWhoosh-Datei.
const RIDE = "usertest-mywhoosh.fit";
const upload = async (t, name, buffer) => {
  await t.page.setInputFiles("#fitFile", { name, mimeType: "application/octet-stream", buffer });
  const item = t.page.locator("#fitLog .item").first();
  await t.poll(async () => !/wird importiert/.test(await item.innerText()), 10_000);
  await t.page.waitForLoadState("networkidle");
  return { text: (await item.innerText()).replace(/\s+/g, " "), cls: await item.getAttribute("class") };
};
const rides = async (t) => (await t.tool("get_workouts", { days: 2 })).filter((w) => w.day === t.today && w.source === "mywhoosh");
const rows = async (t) => {
  const day = await t.page.evaluate((d) => window.FC.fmtDayLong(d), t.today);
  const sec = await t.section("workouts");
  return sec.locator("#tWorkouts tbody tr").filter({ hasText: day }).filter({ hasText: "MyWhoosh" });
};

export default {
  issue: 14,
  feature: 14,
  title: "MyWhoosh-Fahrten per FIT-Datei importieren (#14)",
  name: "MyWhoosh-Fahrten per FIT-Upload",
  device: "desktop",
  realDevice: ["Eine echte MyWhoosh-Datei: stimmen Dauer, Distanz, Leistung, Puls und Trittfrequenz ungefähr mit MyWhoosh überein?"],
  steps: [
    {
      nr: 1,
      action: "Fitness-Dashboard öffnen (Tab Training › „Rolle und Leistung“).",
      expected: "Dashboard lädt wie gewohnt.",
      async run(t) {
        t.today = (await t.tool("get_dashboard", { days: 7 })).today;
        await t.open("training");
        const sec = await t.section("fit");
        const ok = (await sec.isVisible()) && (await t.page.locator("#fitFile").count()) === 1;
        return { status: ok ? "ok" : "fail", observed: ok ? "Dashboard geladen, Feld „FIT-Datei hochladen“ vorhanden." : "Upload-Feld fehlt.", locator: sec };
      },
    },
    {
      nr: 2,
      action: "Auf „FIT-Datei hochladen“ klicken und eine .fit-Datei wählen (hier: synthetische 60-min-Fahrt von heute, 200 W, Puls und Trittfrequenz).",
      expected: "Meldung, dass die Fahrt importiert wurde, mit Datum, Dauer und Ø-Leistung.",
      async run(t) {
        t.file = Buffer.from(await t.fit({ start: `${t.today}T07:00:00Z`, seconds: 3600, watts: 200 }), "base64");
        const r = await upload(t, RIDE, t.file);
        const day = await t.page.evaluate((d) => window.FC.fmtDayLong(d), t.today);
        const ok = /\bok\b/.test(r.cls) && r.text.includes(`${day} importiert`) && /60 min/.test(r.text) && /\d+ W/.test(r.text);
        const np = /NP \d/.test(r.text) ? " Die Leistung steht als NP (normalisierte Leistung), nicht als Ø; bei gleichmäßiger Leistung ist beides gleich." : "";
        return { status: ok ? "ok" : "fail", observed: `Meldung: „${r.text}“.${np}`, locator: t.page.locator("#sec-fit") };
      },
    },
    {
      nr: 3,
      action: "Die Fahrt in der Workout-Liste ansehen.",
      expected: "Sie steht am richtigen Tag mit Dauer, Distanz, Ø-Leistung, NP, Puls und Trittfrequenz (Quelle: MyWhoosh).",
      async run(t) {
        const r = await rows(t);
        const n = await r.count();
        const w = (await rides(t))[0];
        const row = n ? (await r.first().innerText()).replace(/\s+/g, " ") : "";
        const ok = n === 1 && w && Math.round(w.duration_s / 60) === 60 && w.distance_m > 0 && w.avg_power_w > 0 && w.normalized_power_w > 0 && w.avg_hr > 0 && w.avg_cadence_rpm > 0;
        return {
          status: ok ? "ok" : "fail",
          observed: `Zeile: „${row}“. Gespeichert: ${w ? `${Math.round(w.duration_s / 60)} min, ${(w.distance_m / 1000).toFixed(1)} km, Ø ${w.avg_power_w} W, NP ${w.normalized_power_w} W, Ø Puls ${w.avg_hr}, Trittfrequenz ${w.avg_cadence_rpm}` : "keine Fahrt"}. Distanz und Trittfrequenz stehen nicht in der Tabelle, sondern in den Fahrtdaten (Details).`,
          locator: r.first(),
        };
      },
    },
    {
      nr: 4,
      action: "Dieselbe Datei noch einmal hochladen.",
      expected: "Meldung „aktualisiert“; die Fahrt erscheint weiterhin nur einmal.",
      async run(t) {
        await t.section("fit");
        const r = await upload(t, RIDE, t.file);
        const n = await (await rows(t)).count(), m = (await rides(t)).length;
        const ok = /aktualisiert/.test(r.text) && n === 1 && m === 1;
        return { status: ok ? "ok" : "fail", observed: `Meldung: „${r.text}“. In der Liste ${n}×, gespeichert ${m}×.`, locator: t.page.locator("#sec-fit") };
      },
    },
    {
      nr: 5,
      action: "Optional: falls WHOOP dieselbe Fahrt ebenfalls aufgezeichnet hat, in der Workout-Liste nachsehen.",
      expected: "Nur ein Eintrag mit beiden Quellen, nicht zwei.",
      async run() {
        return { status: "skip", observed: "Optional; braucht eine echte WHOOP-Aufzeichnung derselben Fahrt (WHOOP ist im Test nicht erreichbar)." };
      },
    },
    {
      nr: 6,
      action: "Eine andere Datei hochladen (hier: foto.jpg, und dieselben Bilddaten als foto.fit).",
      expected: "Verständliche Fehlermeldung („Keine FIT-Datei …“), nichts wird gespeichert.",
      async run(t) {
        const before = (await t.tool("get_workouts", { days: 2 })).length;
        await t.section("fit");
        const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
        const a = await upload(t, "foto.jpg", jpg);
        const b = await upload(t, "foto.fit", jpg);
        const after = (await t.tool("get_workouts", { days: 2 })).length;
        const ok = /\bbad\b/.test(a.cls) && /\bbad\b/.test(b.cls) && /keine \.fit-Datei/i.test(a.text) && /Keine FIT-Datei/.test(b.text) && before === after;
        // Bei einer .fit-Endung kommt die Meldung vom Server und steht samt technischem JSON in der Zeile.
        const raw = /\{"error"/.test(b.text);
        const note = raw ? " Die Meldung bei foto.fit enthält „Keine FIT-Datei …“, steht aber in technischer Form (JSON) hinter „Der Server hat einen Fehler gemeldet.“; ob das verständlich genug ist, bitte selbst beurteilen." : "";
        return { status: ok ? (raw ? "look" : "ok") : "fail", observed: `foto.jpg: „${a.text}“. foto.fit: „${b.text}“. Workouts vorher ${before}, nachher ${after}.${note}`, locator: t.page.locator("#fitLog") };
      },
    },
  ],
};
