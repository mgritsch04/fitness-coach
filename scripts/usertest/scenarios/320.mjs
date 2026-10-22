// #320 Anstrengung am Ende der Krafteinheit: Nachfrage, wenn vergessen, und danach überall sichtbar.
// Synthetisch: leere Einheit mit Kniebeuge 1 × 5 @ 60 kg. Start auf den Beginn des synthetischen WHOOP-Krafttrainings von heute
// gesetzt (wie im echten Gym: WHOOP zeichnet dieselbe Einheit auf), sonst 45 min vorher.
const tick = async (t) => {
  const row = t.page.locator(".gy-list .gy-ex").first().locator(".gy-set").first();
  await row.locator("button.ok").click();
  await t.page.waitForTimeout(300);
};

export default {
  issue: 320,
  feature: 320,
  title: "Anstrengung am Ende der Krafteinheit (#320)",
  name: "Anstrengung nach der Gym-Einheit",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Im Gym-Modus eine Einheit starten, einen Satz abhaken, „Einheit beenden“ und ohne Anstrengung auf „Speichern“ tippen.",
      expected: "Hinweis „Anstrengung noch nicht gewählt“, es wird noch nicht gespeichert.",
      async run(t) {
        t.today = (await t.tool("get_dashboard", { days: 7 })).today;
        t.before = (await t.tool("get_strength", { weeks: 1 })).sessions.length;
        await t.open("training");
        await t.section("gym");
        await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
        await t.page.selectOption("#gySrc", "");
        await t.page.click("#gyBody button.primary");
        await t.page.locator(".gy-list").waitFor();
        await t.page.locator(".gy-ex input[list=stEx]").first().fill("Kniebeuge");
        await t.page.locator(".gy-ex input[list=stEx]").first().dispatchEvent("change");
        const set = t.page.locator(".gy-set").first();
        await set.locator("input").nth(0).fill("5"); await set.locator("input").nth(0).dispatchEvent("change");
        await set.locator("input").nth(1).fill("60"); await set.locator("input").nth(1).dispatchEvent("change");
        await tick(t);
        const whoop = (await t.tool("get_workouts", { days: 1 })).find((w) => w.day === t.today && w.source === "whoop" && /bodybuilding|weight|strength/i.test(w.sport ?? ""));
        t.linked = !!whoop && Date.parse(whoop.start_time) < Date.now();
        const start = t.linked ? new Date(Date.parse(whoop.start_time) + 2 * 60_000).toISOString() : new Date(Date.now() - 45 * 60_000).toISOString();
        await t.page.evaluate((iso) => { const g = window.FC.state.gym; g.st.startedAt = iso; g.persist(); }, start);
        await t.page.getByRole("button", { name: "Einheit beenden" }).click();
        await t.page.locator("#gyFinish button.primary").click();
        await t.page.waitForTimeout(600);
        const msg = await t.text("#gyMsg");
        const after = (await t.tool("get_strength", { weeks: 1 })).sessions.length;
        const ok = /Anstrengung noch nicht gewählt/.test(msg) && after === t.before;
        return { status: ok ? "ok" : "fail", observed: `Hinweis: „${msg}“. Gespeicherte Einheiten vorher ${t.before}, jetzt ${after}.`, locator: t.page.locator("#sec-gym") };
      },
    },
    {
      nr: 2,
      action: "Eine Anstrengung (7) antippen und „Speichern“.",
      expected: "„Gespeichert.“ mit geschätzter Belastung.",
      async run(t) {
        await t.page.locator("#gyFinish .gy-rpe button", { hasText: /^7$/ }).click();
        await t.page.locator("#gyFinish button.primary").click();
        const msg = await t.poll(async () => { const s = await t.text("#gyMsg"); return /Gespeichert\./.test(s) && s; });
        const ok = !!msg && /Belastung ≈ \d+ \(Schätzung\)/.test(msg);
        return { status: ok ? "ok" : "fail", observed: `Meldung: „${msg || (await t.text("#gyMsg"))}“`, locator: t.page.locator("#sec-gym") };
      },
    },
    {
      nr: 3,
      action: "Im Krafttraining unter „Letzte Einheiten“ nachsehen.",
      expected: "Bei der Einheit steht „Anstrengung 7“.",
      async run(t) {
        await t.open("training");
        const sec = await t.section("strength");
        const day = await t.page.evaluate((d) => window.FC.fmtDayLong(d), t.today);
        const rows = t.page.locator("#stSessions > .row").filter({ hasText: day }).filter({ hasText: "Kniebeuge" });
        const txt = (await rows.count()) ? (await rows.first().innerText()).replace(/\s+/g, " ") : "";
        return { status: /Anstrengung 7\b/.test(txt) ? "ok" : "fail", observed: txt ? `Zeile: „${txt}“` : "Einheit von heute nicht gefunden.", locator: t.page.locator("#stSessions") ?? sec };
      },
    },
    {
      nr: 4,
      action: "In der Workout-Liste (Verlauf) und in „Heute dran“ dieselbe Einheit ansehen.",
      expected: "Dort steht 7 statt „eintragen“.",
      async run(t) {
        const day = await t.page.evaluate((d) => window.FC.fmtDayLong(d), t.today);
        const sec = await t.section("workouts");
        const all = sec.locator("#tWorkouts tbody tr").filter({ hasText: day });
        const list = [];
        for (let i = 0; i < (await all.count()); i++) {
          const r = all.nth(i);
          list.push({ sport: (await r.locator("td").nth(1).innerText()).trim(), rpe: (await r.locator("td[data-k=Anstrengung]").innerText()).trim(), src: (await r.locator("td[data-k=Quelle]").innerText()).trim() });
        }
        const rows = all.filter({ hasText: "Krafttraining" });
        const strength = list.filter((x) => /Kraft/i.test(x.sport));
        const n = strength.length, cells = strength.map((x) => x.rpe);
        await t.section("agenda");
        const asks = await t.page.locator("#sec-agenda .ag-rpe p").allInnerTexts();
        const askStrength = asks.filter((s) => /Krafttraining/.test(s));
        const ok = n >= 1 && cells.some((c) => /^7\b/.test(c)) && !cells.includes("eintragen") && askStrength.length === 0;
        return {
          status: ok ? "ok" : "fail",
          observed: `${t.linked ? "Einheit zur Zeit des WHOOP-Krafttrainings gestartet. " : ""}Workout-Liste heute: ${list.map((x) => `${x.sport} (${x.src}): Anstrengung „${x.rpe}“`).join("; ") || "–"}. „Heute dran“ fragt ${askStrength.length ? `noch: „${askStrength.join(" / ")}“` : "nicht mehr nach der Anstrengung fürs Krafttraining"}.`,
          locator: rows.first(),
        };
      },
    },
  ],
};
