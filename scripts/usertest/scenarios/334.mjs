// #334 Workout-Liste: Workout anklicken und Details ansehen (Kraft mit Übungen, Rad mit Fahrtdaten).
const norm = (s) => s.replace(/\s+/g, " ").trim();
const dlg = (t) => t.page.locator("#woDetail");
async function list(t) { await t.open("training"); const sec = await t.section("workouts"); await t.poll(async () => (await t.page.locator("#tWorkouts tbody tr").count()) > 0, 15_000); return sec; }
async function openRow(t, day, sportRe) {
  await list(t);
  const rows = t.page.locator("#tWorkouts tbody tr");
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const r = rows.nth(i), txt = norm(await r.innerText());
    if (sportRe.test(txt) && (!day || txt.includes(day.dayLabel))) { await r.locator("button.link").first().click(); await dlg(t).waitFor({ state: "visible", timeout: 10_000 }); await t.page.waitForTimeout(1200); return norm(await dlg(t).innerText()); }
  }
  throw new Error(`Keine Zeile ${sportRe}`);
}
const dayRows = async (t, kind) => (await t.tool("get_dashboard", { days: 60 })).workouts ?? [];

export default {
  issue: 334, feature: 334, title: "Workout-Detail (#334)", name: "Workout-Detail", device: "phone",
  steps: [
    { nr: 1, action: "Dashboard öffnen, Reiter Training, Abschnitt „Workouts“.", expected: "Liste mit Sportnamen als Knöpfen.",
      async run(t) {
        await t.open("training");
        const d = await t.tool("get_dashboard", { days: 60 });
        const ws = d.workouts ?? d.training?.workouts ?? [];
        const bb = ws.filter((w) => /bodybuild|strength|weight/i.test(w.sport ?? "")).sort((a, b) => b.day.localeCompare(a.day));
        t.ctx = { today: d.today, bbDays: bb.map((w) => w.day) };
        // Krafttraining mit Übungen: Satz an einem vorhandenen Kraft-Workout-Tag anlegen.
        await t.tool("log_strength_session", { day: bb[1]?.day ?? bb[0].day, name: "Test-Kraft (synthetisch)", durationMin: 35, rpe: 7, exercises: [{ exercise: "Kniebeuge", sets: [{ reps: 5, weightKg: 100 }, { reps: 5, weightKg: 100 }, { reps: 4, weightKg: 105 }] }, { exercise: "Bankdrücken", sets: [{ reps: 8, weightKg: 60 }] }] });
        await t.tool("log_strength_session", { day: bb[4].day, name: "Test-Kraft früher (synthetisch)", durationMin: 35, rpe: 7, exercises: [{ exercise: "Kniebeuge", sets: [{ reps: 5, weightKg: 95 }, { reps: 5, weightKg: 95 }] }] });
        await t.page.reload(); await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 90_000 }); await t.page.waitForLoadState("networkidle");
        const sec = await list(t);
        const n = await t.page.locator("#tWorkouts tbody tr button.link").filter({ hasNotText: /eintragen|\d/ }).count();
        return { status: n > 3 ? "ok" : "fail", observed: `${n} anklickbare Sportnamen in der Liste. Kraft-Tage: ${bb.length}.`, locator: sec };
      } },
    { nr: 2, action: "Sportnamen eines Krafttrainings mit Übungen antippen.", expected: "Fenster mit Übungen, Sätzen (Wdh × Gewicht), Volumen, bestem Satz mit 1RM und Vergleich zur letzten gleichen Übung.",
      async run(t) {
        const day = t.ctx?.bbDays?.[1] ?? t.ctx?.bbDays?.[0];
        await list(t);
        const link = t.page.locator("#tWorkouts tbody tr", { has: t.page.locator("button.wo-tpl") }).first().locator("button.link").first();
        await link.click(); await dlg(t).waitFor({ state: "visible" }); await t.page.waitForTimeout(1500);
        const txt = norm(await dlg(t).innerText());
        const ok = /Kniebeuge/.test(txt) && /5 × 100/.test(txt.replace(/\s/g, " ")) && /Volumen/.test(txt) && /1RM/i.test(txt) && /zuletzt .*5 × 95 kg/.test(txt);
        return { status: ok ? "ok" : "fail", observed: `Fenster: „${txt.slice(0, 600)}“`, locator: dlg(t) };
      } },
    { nr: 3, action: "Fenster schließen (Schließen-Knopf, daneben tippen, Escape): Filter und Liste unverändert.", expected: "Liste unverändert.",
      async run(t) {
        const before = norm(await t.page.locator("#woCount").innerText());
        const res = [];
        await t.page.locator("#woDetail .wd-close").click(); res.push(await dlg(t).isVisible());
        await t.page.locator("#tWorkouts tbody tr", { has: t.page.locator("button.wo-tpl") }).first().locator("button.link").first().click(); await dlg(t).waitFor({ state: "visible" });
        await t.page.keyboard.press("Escape"); await t.page.waitForTimeout(300); res.push(await dlg(t).isVisible());
        await t.page.locator("#tWorkouts tbody tr", { has: t.page.locator("button.wo-tpl") }).first().locator("button.link").first().click(); await dlg(t).waitFor({ state: "visible" });
        await t.page.mouse.click(3, 3); await t.page.waitForTimeout(300); res.push(await dlg(t).isVisible());
        const after = norm(await t.page.locator("#woCount").innerText());
        return { status: res.every((v) => !v) && before === after ? "ok" : "fail", observed: `Nach Schließen-Knopf/Escape/Tippen daneben noch offen: ${res.join(", ")}. Zähler vorher „${before}“, nachher „${after}“.`, locator: t.page.locator("#sec-workouts") };
      } },
    { nr: 4, action: "Ein Krafttraining ohne eingetragene Übungen öffnen.", expected: "Hinweis statt leerer Ansicht.",
      async run(t) {
        await list(t);
        const rows = t.page.locator("#tWorkouts tbody tr", { hasNot: t.page.locator("button.wo-tpl") }).filter({ hasText: /Kraft|Bodybuild|Gewicht/i });
        const n = await rows.count();
        if (!n) return { status: "fail", observed: "Keine Kraftzeile ohne Übungen gefunden." };
        await rows.first().locator("button.link").first().click(); await dlg(t).waitFor({ state: "visible" }); await t.page.waitForTimeout(800);
        const txt = norm(await dlg(t).innerText());
        return { status: /keine Übungen eingetragen/.test(txt) ? "ok" : "fail", observed: `Fenster: „${txt.slice(0, 400)}“`, locator: dlg(t) };
      } },
    { nr: 5, action: "Eine Radfahrt mit FIT-Import öffnen.", expected: "Kennzahlen, Leistungs-/Pulsverlauf, Zonen und Intervalle sichtbar.",
      async run(t) {
        await t.page.keyboard.press("Escape");
        const today = t.ctx.today, day = new Date(Date.parse(`${today}T12:00:00Z`) - 2 * 864e5).toISOString().slice(0, 10);
        await t.tool("import_fit", { fileName: "ut-334.fit", fileBase64: await t.fit({ start: `${day}T07:00:00Z`, shape: "intervals" }) });
        await t.page.reload(); await t.page.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 }); await t.page.waitForLoadState("networkidle");
        await list(t);
        const rows = t.page.locator("#tWorkouts tbody tr").filter({ hasText: /Rad|Spinning|Cycling|Zwift|MyWhoosh/i });
        let txt = "", hit = false;
        const n = Math.min(await rows.count(), 12);
        for (let i = 0; i < n && !hit; i++) {
          await rows.nth(i).locator("button.link").first().click(); await dlg(t).waitFor({ state: "visible" }); await t.page.waitForTimeout(1500);
          txt = norm(await dlg(t).innerText());
          hit = /Zonen|Intervall/i.test(txt) && (await dlg(t).locator("svg").count()) > 0;
          if (!hit) await t.page.locator("#woDetail .wd-close").click();
        }
        t.ctx.fitTxt = txt;
        return { status: hit ? "ok" : "fail", observed: `Fenster (Auszug): „${txt.slice(0, 700)}“`, locator: dlg(t) };
      } },
    { nr: 6, action: "Eine Radfahrt nur aus WHOOP öffnen.", expected: "Basisdaten plus Hinweis auf FIT-Upload.",
      async run(t) {
        await t.page.locator("#woDetail .wd-close").click().catch(() => {});
        await list(t);
        const rows = t.page.locator("#tWorkouts tbody tr").filter({ hasText: /WHOOP/ }).filter({ hasText: /Rad|Spinning|Cycling/i }).filter({ hasNotText: /MyWhoosh|FIT|Wahoo/ });
        const n = await rows.count();
        if (!n) return { status: "fail", observed: "Keine reine WHOOP-Radfahrt in der Liste." };
        let txt = "", hit = false;
        for (let i = 0; i < Math.min(n, 6) && !hit; i++) {
          await rows.nth(i).locator("button.link").first().click(); await dlg(t).waitFor({ state: "visible" }); await t.page.waitForTimeout(1200);
          txt = norm(await dlg(t).innerText()); hit = /FIT/.test(txt) && /Dauer/.test(txt);
          if (!hit) await t.page.locator("#woDetail .wd-close").click();
        }
        return { status: hit ? "ok" : "fail", observed: `Fenster: „${txt.slice(0, 500)}“`, locator: dlg(t) };
      } },
    { nr: 7, action: "Am Handy prüfen: alles lesbar und bedienbar.", expected: "Kein seitlicher Überlauf, Fenster passt auf den Bildschirm.",
      async run(t) {
        await t.page.locator("#woDetail .wd-close").click().catch(() => {});
        await t.page.locator("#tWorkouts tbody tr", { hasText: /Rad|Spinning|Cycling/i }).filter({ hasText: /MyWhoosh|FIT/ }).first().locator("button.link").first().click().catch(() => {});
        await t.page.waitForTimeout(1500);
        const box = await dlg(t).boundingBox(); const vp = t.page.viewportSize();
        const over = await t.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const inW = box && box.x >= 0 && box.x + box.width <= vp.width + 1;
        return { status: over <= 1 && inW ? "look" : "fail", observed: `Fenster ${box ? Math.round(box.width) : "?"}px breit bei ${vp.width}px Bildschirm, seitlicher Überlauf ${over}px. Optik am Bild beurteilt.`, locator: dlg(t) };
      } },
  ],
};
