// #337 Radempfehlung mit passendem MyWhoosh-Workout (vorhanden oder als .zwo zum Import).
import { res, chatCtx, unit } from "./_q.mjs";
const norm = (s) => s.replace(/\s+/g, " ").trim();
async function plan(t) { await t.open("coach"); const sec = await t.section("plan"); await t.page.locator("#wplan button.pd").first().waitFor({ timeout: 20_000 }); return sec; }
const labels = async (t) => (await t.page.locator("#wplan button.pd").evaluateAll((e) => e.map((x) => x.getAttribute("aria-label")))).map(norm);

export default {
  issue: 337, feature: 337, title: "Radempfehlung mit MyWhoosh-Workout (#337)", name: "MyWhoosh-Workout zur Empfehlung", device: "phone",
  steps: [
    { nr: 1, action: "Coach › Wochenplan: einen Tag mit Radeinheit antippen.", expected: "„Workout für MyWhoosh: <Name>“ mit Belastung, Herkunft (Bibliothek oder gebaut) und Aufbau in % FTP.",
      async run(t) {
        await plan(t);
        const lab = await labels(t);
        const idx = lab.findIndex((l) => /^(Sa|So)\..*(Lange Fahrt|Tempo|Grundlagen|Schwelle|Intervall)/i.test(l));
        const btn = t.page.locator("#wplan button.pd").nth(idx);
        await btn.click(); await t.page.waitForTimeout(800);
        const txt = norm(await t.page.locator("#planDetail").innerText());
        const ok = /Workout für MyWhoosh: .+/.test(txt) && /Belastung/.test(txt) && /(aus der Bibliothek|aus Art und Dauer gebaut)/.test(txt) && /% FTP/.test(txt);
        t.ctx = { idx, lab: lab[idx] };
        return { status: ok ? "ok" : "fail", observed: `Tag „${lab[idx]}“; Detail: „${txt.slice(0, 520)}“`, locator: t.page.locator("#planDetail") };
      } },
    { nr: 2, action: "„Workout für MyWhoosh öffnen“ drücken; „Als .zwo herunterladen“.", expected: "Abschnitt „Workout für MyWhoosh“ öffnet sich mit diesem Tag; Download liefert die Datei.",
      async run(t) {
        await t.page.getByRole("button", { name: "Workout für MyWhoosh öffnen" }).click();
        await t.page.waitForTimeout(2500);
        const dayVal = await t.page.locator("#bwDay").inputValue().catch(() => "");
        const dayTxt = await t.page.locator("#bwDay option:checked").innerText().catch(() => "");
        const visible = await t.page.locator("#sec-bikewo").isVisible();
        await t.poll(async () => !(await t.page.locator("#bwGet").isDisabled()), 15_000);
        const dl = t.page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
        await t.page.click("#bwGet");
        const d = await dl; let size = 0, name = "";
        if (d) { name = d.suggestedFilename(); const p = await d.path(); if (p) size = (await import("node:fs")).statSync(p).size; }
        const msg = norm(await t.page.locator("#bwMsg").innerText());
        const out = norm(await t.page.locator("#bwOut").innerText());
        const lbl = t.ctx.lab.replace(/^[^:]*:\s*/, "").split(/[ :,]/)[0];
        t.ctx.dayVal = dayVal; t.ctx.sugg = norm(await t.page.locator("#planDetail").innerText().catch(() => ""));
        const shown = (t.ctx.sugg.match(/Workout für MyWhoosh: (.+?) ·/) ?? [])[1] ?? "";
        const same = !shown || out.includes(shown); // #364: angezeigte Empfehlung = geladenes Workout
        return { status: visible && dayVal && same && /\.zwo gespeichert/.test(msg) && /FTP/.test(out) ? "ok" : "fail", observed: `Abschnitt sichtbar: ${visible}; gewählter Tag „${dayTxt}“ (${dayVal}); Download-Meldung (im Testbrowser kein Dateisystem-Download); Meldung „${msg}“; Anzeige: „${out.slice(0, 200)}“.`, locator: t.page.locator("#sec-bikewo") };
      } },
    { nr: 3, action: "An einem Ruhetag mit „Locker ausfahren: ja“ (Heute-Tab): Hinweis mit passendem lockeren Workout.", expected: "Im Hinweis steht das passende lockere Workout (z. B. „Ausrollen 30 min“).",
      async run(t) {
        const u = unit("rest-ride.test.ts", "spin: passendes lockeres Workout mit Name und Aufbau (#337)");
        const code = (await import("node:fs")).readFileSync(new URL("../../../artifact/sections/today.js", import.meta.url), "utf8");
        const shown = /Passendes Workout für MyWhoosh: \$\{c\.restRide\.workout\.name\}/.test(code);
        const ctx = await t.tool("get_coach_context", {});
        return { status: u.pass && shown ? "ok" : "fail", observed: `Heute ist in der Testumgebung ein Krafttag (kein Ruhetag), daher kein Live-Hinweis (restRide: ${JSON.stringify(ctx.restRide ?? null)}). Regel per Unit-Test (Name, Typ recovery, Dauer, Aufbau, .zwo-Dateiname): ${u.pass ? "bestanden" : "nicht bestanden"}; Heute-Tab zeigt „Passendes Workout für MyWhoosh: <Name>“ aus restRide.workout: ${shown}.`, noFinalShot: true };
      } },
    { nr: 4, action: "Im Coach-Chat „Soll ich heute Rad fahren?“ fragen.", expected: "Antwort nennt das passende Workout (Name, Aufbau) und verweist auf die Datei.",
      async run(t) { return chatCtx(t, "das passende Workout (workoutToday/restRide.workout mit Name und Aufbau)", /workoutToday|"workout":\{"name"/, "get_coach_context"); } },
  ],
};
