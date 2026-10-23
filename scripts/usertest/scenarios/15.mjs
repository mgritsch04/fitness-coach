// #15 Trainingscoach im Dashboard. Claude (`sample`) ist im Test eine Beispielantwort: geprüft wird, dass die Knöpfe
// funktionieren und Claude die eigenen Werte bekommt; ob Claudes echte Antwort plausibel ist, beurteilt nur G.
const spy = (t) => t.page.evaluate(() => {
  const s = window.FC.state.sample;
  window.__prompts = [];
  const rec = (i) => window.__prompts.push(typeof i === "string" ? i : i.map((m) => m.content).join("\n"));
  const w = async (i, o) => { rec(i); return s(i, o); };
  w.json = async (i, o) => { rec(i); return s.json(i, o); };
  w.limits = s.limits;
  window.FC.state.sample = w;
});
const lastPrompt = (t) => t.page.evaluate(() => window.__prompts.at(-1) ?? "");
// Heutige Werte, die Claude laut Prompt mitbekommen muss.
const todayVals = (t) => t.page.evaluate(() => {
  const d = window.FC.state.data, p = d.days.find((x) => x.day === d.today) ?? d.days.at(-1);
  return { today: d.today, recovery: p.recovery, hrv: p.hrv, load: p.load, readiness: d.coach.readiness };
});
const hasData = (p, v) => p.includes(`"heute":"${v.today}"`) && p.includes(`"erholung":${v.recovery}`) && p.includes(`"hrv":${v.hrv}`) && p.includes("keine medizinischen Diagnosen");

export default {
  issue: 15,
  feature: 15,
  title: "Trainingscoach im Dashboard (#15)",
  name: "Trainingscoach: Empfehlung, Wochenplan, Rückblick, Fragen",
  device: "phone",
  realDevice: ["Claudes echte Antworten: klingen Erklärung, Wochenplan, Rückblick-Text und Antwort plausibel und passen zur eigenen Woche?"],
  steps: [
    {
      nr: 1,
      action: "Tab Coach: „Empfehlung erklären“ antippen.",
      expected: "Claude erklärt die heutige Empfehlung mit den eigenen Werten (Erholung, HRV, Belastung); die Begründung klingt plausibel.",
      async run(t) {
        await t.open("coach");
        await spy(t);
        const sec = await t.section("coach");
        await t.page.click("[data-coach=explain]");
        const out = await t.poll(async () => { const s = await t.text("#coachOut"); return !/Denke nach|Wähle oben/.test(s) && s; });
        const p = await lastPrompt(t), v = await todayVals(t);
        const ok = !!out && hasData(p, v);
        return {
          status: ok ? "device" : "fail",
          observed: `Text erscheint (${out ? out.length : 0} Zeichen, im Test eine Beispielantwort). Claude bekommt die heutigen Werte: Erholung ${v.recovery} %, HRV ${v.hrv} ms, Bereitschaft „${v.readiness}“, ${hasData(p, v) ? "samt Regel „keine medizinischen Diagnosen“" : "aber nicht vollständig"}. Ob die echte Erklärung plausibel ist, nur mit echtem Claude prüfbar.`,
          locator: sec,
        };
      },
    },
    {
      nr: 2,
      action: "„Wochenplan vorschlagen“ antippen.",
      expected: "Es kommt ein Plan für die Woche mit Rad und Kraft, der grob zur eigenen Woche passt.",
      async run(t) {
        await t.page.click("[data-coach=plan]");
        const n = await t.poll(async () => t.page.locator("#coachOut table.plan tbody tr").count());
        const p = await lastPrompt(t), v = await todayVals(t);
        // #358: Der Plan darf die Seite nicht breiter als den Bildschirm machen; Fragen-Feld und Knopf müssen im Bild liegen.
        const fit = await t.page.evaluate(() => {
          const w = document.documentElement.clientWidth, r = (s) => document.querySelector(s).getBoundingClientRect();
          return { page: document.documentElement.scrollWidth <= w + 1, btn: r("#askBtn").right <= w + 1, input: r("#askInput").right <= w + 1 };
        });
        const fits = fit.page && fit.btn && fit.input;
        const ok = n > 0 && fits && hasData(p, v) && /7 Tage/.test(p) && /Rad\/Spinning, Krafttraining/.test(p);
        return {
          status: ok ? "device" : "fail",
          observed: `Plan-Tabelle mit ${n ?? 0} Zeile(n) (Beispielantwort), Seite ${fit.page ? "passt in den Bildschirm" : "BREITER als der Bildschirm"}, Fragen-Feld und Knopf ${fit.btn && fit.input ? "im Bild" : "ragen über den Rand"}. Auftrag an Claude: 7 Tage ab ${v.today}, Rad und Kraft, eigene Werte dabei: ${hasData(p, v) ? "ja" : "nein"}. Ob der echte Plan zur Woche passt, nur mit echtem Claude prüfbar.`,
          locator: t.page.locator("#sec-coach"),
        };
      },
    },
    {
      nr: 3,
      action: "Abschnitt „Wochenrückblick“ ansehen (und „Rückblick schreiben“ antippen).",
      expected: "Kennzahlen der letzten Woche und ein kurzer Text von Claude.",
      async run(t) {
        const sec = await t.section("review");
        const stats = await t.poll(async () => { const s = await t.text("#rvStats"); return !/Lädt/.test(s) && s; });
        await t.page.click("#rvWrite");
        const txt = await t.poll(async () => (await t.text("#rvText")).trim());
        const ok = !!stats && /\d/.test(stats) && !!txt;
        return {
          status: ok ? "ok" : "fail",
          observed: `Kennzahlen: „${(stats || "").replace(/\s+/g, " ").slice(0, 160)}“. Text erscheint nach „Rückblick schreiben“ (${txt ? txt.length : 0} Zeichen, im Test Beispieltext).`,
          locator: sec,
        };
      },
    },
    {
      nr: 4,
      action: "Eine eigene Frage stellen („Soll ich heute Intervalle fahren?“) und „Fragen“ antippen.",
      expected: "Die Antwort bezieht sich auf die eigenen Daten. Es sind Trainingsempfehlungen, keine medizinischen Diagnosen.",
      async run(t) {
        await t.section("coach");
        await t.page.fill("#askInput", "Soll ich heute Intervalle fahren?");
        // Auf dem Handy liegt das Eingabefeld über dem Knopf „Fragen“; dann mit Enter absenden und das melden.
        const covered = await t.page.click("#askBtn", { timeout: 5000 }).then(() => null, (e) => (/intercepts pointer events/.test(e.message) ? e.message.match(/<(\w+)[^>]*id="(\w+)"[^>]*> intercepts/)?.[2] ?? "anderes Element" : Promise.reject(e)));
        if (covered) await t.page.press("#askInput", "Enter");
        const a = await t.poll(async () => { const s = await t.text("#chat .a"); return !/Denke nach/.test(s) && s; });
        const p = await lastPrompt(t), v = await todayVals(t);
        const ok = !!a && hasData(p, v) && p.includes("Frage: Soll ich heute Intervalle fahren?");
        const cov = covered ? ` Auffällig: Im Test (Handy-Ansicht 390 px) ließ sich „Fragen“ nicht antippen, laut Browser liegt das Feld „${covered}“ darüber (abgeschickt per Enter). Bitte am Handy nachsehen.` : "";
        return {
          status: ok ? (covered ? "look" : "device") : "fail",
          observed: `Antwort erscheint im Chat (Beispielantwort).${cov} Claude bekommt Frage, heutige Werte und die Regel „Nur Trainingsempfehlungen, keine medizinischen Diagnosen“: ${ok ? "ja" : "nein"}. Ob sich die echte Antwort auf die eigenen Daten bezieht, nur mit echtem Claude prüfbar.`,
          locator: t.page.locator("#sec-coach"),
        };
      },
    },
  ],
};
