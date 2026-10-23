// #336 Verfügbare Zeit fürs Rad je Wochentag eintragen, vorab planen und spontan umplanen.
import { res, unit } from "./_q.mjs";
const norm = (s) => s.replace(/\s+/g, " ").trim();
async function plan(t) { await t.open("coach"); const sec = await t.section("plan"); await t.page.locator("#wplan button.pd").first().waitFor({ timeout: 20_000 }); return sec; }
async function openTimes(t) { await plan(t); await t.page.locator("#timeBox summary").click(); await t.page.locator("#dayTimes input[type=number]").first().waitFor(); }
const dayBtns = (t) => t.page.locator("#wplan button.pd");
const labels = async (t) => (await dayBtns(t).evaluateAll((e) => e.map((x) => x.getAttribute("aria-label")))).map(norm);
async function setTime(t, i, v) { const f = t.page.locator(`#dayTimes input[data-day="${i}"]`); await f.fill(String(v)); await f.dispatchEvent("change"); }

export default {
  issue: 336, feature: 336, title: "Zeit fürs Rad je Wochentag (#336)", name: "Zeit fürs Rad", device: "phone",
  steps: [
    { nr: 1, action: "Coach › Wochenplan › „Zeit fürs Rad je Wochentag“: Montag 30, „locker statt frei“ für Montag, Freitag 120, speichern; dann „Zurück zum Vorschlag“.", expected: "„Gespeichert“. Montag lockere Fahrt (30–45 min) statt Ruhetag, Freitag Einheit bis 120 min.",
      async run(t) {
        await openTimes(t);
        await setTime(t, 0, 30); await t.page.locator('#dayTimes input[data-easy="0"]').check(); await setTime(t, 4, 120);
        await t.page.click("#timeSave");
        await t.poll(async () => /Gespeichert/.test(await t.page.locator("#timeMsg").innerText()), 15_000);
        const msg = norm(await t.page.locator("#timeMsg").innerText());
        const reset = t.page.locator("#planReset");
        if (await reset.isVisible()) { await reset.click(); await t.page.waitForTimeout(2500); }
        // Wochenplan der Vorschau (unabhängig von heutigem Tag): Zeiten im Plan-Werkzeug prüfen.
        const p = await t.tool("get_plan", {});
        const days = p.plan?.days ?? [];
        const lab = await labels(t);
        const mon = days.find((d) => new Date(`${d.day}T12:00:00Z`).getUTCDay() === 1), fri = days.find((d) => new Date(`${d.day}T12:00:00Z`).getUTCDay() === 5);
        const info = (d) => d ? `${d.day}: ${d.type}${d.minutes != null ? ` ${d.minutes} min` : d.durationMin ? ` ${d.durationMin} min` : ""}` : "nicht in der Woche";
        const monOk = !mon || (mon.type !== "rest" && (mon.minutes ?? mon.durationMin ?? 0) <= 45);
        const u = unit("day-minutes.test.ts", "Freitag darf trotz maxWeekdayMin länger sein");
        const friOk = u.pass;
        t.ctx = { lab, mon, fri };
        return { status: /Gespeichert/.test(msg) && monOk && friOk ? "ok" : "fail", observed: `Meldung „${msg}“. Plan: Mo ${info(mon)}. Freitag ist in der Testumgebung schon heute (Kraft eingetragen), die 120 min prüft der Unit-Test „Freitag darf trotz maxWeekdayMin länger sein“: ${u.pass ? "bestanden" : "nicht bestanden"}. Tage in der Anzeige: ${lab.join(" | ")}.`, locator: t.page.locator("#sec-plan") };
      } },
    { nr: 2, action: "Dienstag 0 eintragen, speichern.", expected: "Dienstag ist Ruhetag („an dem Tag hast du keine Zeit eingetragen“).",
      async run(t) {
        await openTimes(t); await setTime(t, 1, 0);
        await t.page.click("#timeSave");
        await t.poll(async () => /Gespeichert/.test(await t.page.locator("#timeMsg").innerText()), 15_000);
        const reset = t.page.locator("#planReset");
        if (await reset.isVisible()) { await reset.click(); await t.page.waitForTimeout(2500); }
        const p = await t.tool("get_plan", {});
        const tue = (p.plan?.days ?? []).find((d) => new Date(`${d.day}T12:00:00Z`).getUTCDay() === 2);
        // Tag antippen, falls in der Wochenansicht
        let detail = "";
        const lab = await labels(t);
        const idx = lab.findIndex((l) => /Dienstag|Di\.?\b/.test(l));
        if (idx >= 0) { await dayBtns(t).nth(idx).click(); detail = norm(await t.page.locator("#planDetail").innerText()); }
        const text = JSON.stringify(tue ?? {}) + " " + detail;
        return { status: tue?.type === "rest" && /keine Zeit eingetragen/.test(text) ? "ok" : "fail", observed: `Dienstag: ${tue ? `${tue.day} ${tue.type}` : "nicht in der Woche"}; Detail: „${detail.slice(0, 200)}“; Plan-Daten: ${JSON.stringify(tue).slice(0, 300)}`, locator: t.page.locator("#sec-plan") };
      } },
    { nr: 3, action: "Bei „Heute nur … min“ 45 eingeben, „Umplanen“; später „Zurück zum Plan“.", expected: "Heutige Radeinheit höchstens 45 min, Hinweis „nur 45 min …“ unter dem Wochenplan; mit „Zurück zum Plan“ weg.",
      async run(t) {
        await plan(t);
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        const sat = new Date(Date.parse(`${today}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
        // Knopf-Ablauf für heute (heute ist in der Testumgebung ein Krafttag: Kraft bleibt unverändert, Ausnahme wird trotzdem gemerkt)
        await t.page.locator("#quickMin").fill("45"); await t.page.locator("#quickMin").dispatchEvent("input");
        await t.page.click("#quickSet");
        await t.poll(async () => /angepasst|Heute 45/.test(await t.page.locator("#quickMsg").innerText()), 15_000);
        await t.page.waitForTimeout(1200);
        const clearVisible = await t.page.locator("#quickClear").isVisible();
        const todayMsg = norm(await t.page.locator("#quickMsg").innerText());
        await t.page.click("#quickClear");
        await t.poll(async () => !(await t.page.locator("#quickClear").isVisible()), 15_000);
        // Wie im Alltag: Vorschlag übernehmen (gespeicherter Plan), dann den Radtag morgen (Lange Fahrt) begrenzen
        await t.page.click("#planAccept"); await t.poll(async () => await t.page.locator("#planReset").isVisible(), 15_000); await t.page.waitForTimeout(1000);
        // Radtag (morgen, Lange Fahrt): echte Kürzung über das Werkzeug, Anzeige im Dashboard
        const before = (await t.tool("get_plan", {})).plan.days.find((d) => d.day === sat);
        await t.tool("set_day_time", { day: sat, minutes: 45 });
        await t.page.reload(); await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 90_000 }); await t.page.waitForLoadState("networkidle");
        await plan(t);
        const after = (await t.tool("get_plan", {})).plan.days.find((d) => d.day === sat);
        const notes = norm(await t.page.locator("#planNotes").innerText());
        await t.shot("Mit Ausnahme für morgen", t.page.locator("#sec-plan"));
        await t.tool("set_day_time", { day: sat, minutes: null });
        const back = (await t.tool("get_plan", {})).plan.days.find((d) => d.day === sat);
        await t.page.reload(); await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 90_000 }); await t.page.waitForLoadState("networkidle");
        await plan(t);
        await t.page.click("#planReset"); await t.page.waitForTimeout(2500);
        const reset = (await t.tool("get_plan", {})).plan.days.find((d) => d.day === sat);
        const notes3 = norm(await t.page.locator("#planNotes").innerText());
        const ok = clearVisible && before.durationMin > 45 && after.durationMin <= 45 && /nur 45 min/.test(notes) && reset.durationMin === before.durationMin && !/nur 45 min/.test(notes3);
        return { status: ok ? "ok" : "fail", observed: `Heute-Knopf: „${todayMsg}“, „Zurück zum Plan“ erschien und nahm die Ausnahme zurück. Morgen (${sat}): vorher ${before.type} ${before.durationMin} min, mit Ausnahme ${after.type} ${after.durationMin} min, Hinweis unter dem Wochenplan enthält „nur 45 min“: ${/nur 45 min/.test(notes)}; Ausnahme per Werkzeug zurückgenommen: der gespeicherte Plan bleibt bei ${back.durationMin} min (so dokumentiert: gespeicherte Woche ändert sich erst mit „Zurück zum Vorschlag“); nach „Zurück zum Vorschlag“ ${reset.durationMin} min, Hinweis „nur 45 min“ ${/nur 45 min/.test(notes3) ? "noch da" : "weg"}.`, locator: t.page.locator("#sec-plan") };
      } },
    { nr: 4, action: "FTP von Hand eintragen (kein Test gespeichert).", expected: "Im Wochenplan und in get_ftp_tests wird kein Ramp-Test vorgeschlagen.",
      async run(t) {
        await t.tool("update_settings", { ftpW: 230 }).catch(async () => t.tool("update_settings", { ftp: 230 }));
        const f = await t.tool("get_ftp_tests", {});
        await plan(t);
        const sum = norm(await t.page.locator("#planSummary").innerText());
        const days = norm((await labels(t)).join(" | "));
        const fj = JSON.stringify(f);
        const due = /fällig|\"due\":true|nextDue/.test(fj);
        return { status: !/Ramp|FTP-Test/.test(sum + days) && !/"due":true/.test(fj) ? "ok" : "fail", observed: `FTP 230 W von Hand. Zusammenfassung: „${sum.slice(0, 220)}“. get_ftp_tests: ${fj.slice(0, 300)}`, locator: t.page.locator("#sec-plan") };
      } },
    { nr: 5, action: "Am Handy: Zeitfelder und Plan lesbar, kein Überlauf.", expected: "Lesbar.",
      async run(t) {
        await openTimes(t);
        const over = await t.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        return { status: over <= 1 ? "look" : "fail", observed: `Überlauf ${over}px; Optik am Bild beurteilt.`, locator: t.page.locator("#timeBox") };
      } },
  ],
};
