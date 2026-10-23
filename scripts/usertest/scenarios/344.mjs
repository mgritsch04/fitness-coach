// #344 Krafteinheit nachträglich eintragen: Gewicht und Wiederholungen je Satz einzeln.
// Synthetisch: Kniebeuge mit 3 Sätzen 60/65/65 kg × 10/8/6, danach Bearbeiten und Schnelleingabe.
const sessions = async (t) => (await t.tool("get_strength", { weeks: 2 })).sessions;
const squat = (s) => s.sets.filter((x) => /kniebeuge/i.test(x.exerciseName ?? x.exercise));

export default {
  issue: 344,
  feature: 344,
  title: "Krafteinheit nachträglich eintragen, je Satz einzeln (#344)",
  name: "Sätze einzeln nachtragen",
  device: "desktop",
  steps: [
    {
      nr: 1,
      action: "Dashboard öffnen, Tab Training, „Einheit eintragen“, Übung „Kniebeuge“ eingeben, Sätze anlegen.",
      expected: "Mehrere Sätze lassen sich anlegen (+ Satz), je Satz eigenes Gewicht und eigene Wiederholungen.",
      async run(t) {
        t.before = (await sessions(t)).length;
        await t.open("training");
        await t.section("strength");
        const box = t.page.locator("#stRows .st-ex").first();
        await box.locator(".ex").fill("Kniebeuge");
        const n0 = await box.locator(".st-set").count();
        while ((await box.locator(".st-set").count()) < 3) await box.locator(".st-addset").click();
        const n1 = await box.locator(".st-set").count();
        const vals = [[60, 10], [65, 8], [65, 6]];
        for (let i = 0; i < 3; i++) {
          const r = box.locator(".st-set").nth(i);
          await r.locator(".kg").fill(String(vals[i][0]));
          await r.locator(".reps").fill(String(vals[i][1]));
        }
        const read = await box.locator(".st-set").evaluateAll((rs) => rs.map((r) => `${r.querySelector(".kg").value}×${r.querySelector(".reps").value}`));
        const ok = n1 >= 3 && read.join() === "60×10,65×8,65×6";
        return { status: ok ? "ok" : "fail", observed: `Sätze vorher ${n0}, nach „+ Satz“ ${n1}. Werte je Satz (kg×Wdh): ${read.join(", ")}.`, locator: t.page.locator("#stForm") };
      },
    },
    {
      nr: 2,
      action: "Die drei Sätze (60/65/65 kg, 10/8/6 Wdh.) speichern.",
      expected: "Die Einheit erscheint unter „Letzte Einheiten“, Volumen und geschätztes 1RM stimmen dazu.",
      async run(t) {
        // übrige leere Übungszeilen bleiben leer und werden ignoriert
        await t.page.click("#stSave");
        const msg = await t.poll(async () => { const s = await t.text("#stMsg"); return /Gespeichert\./.test(s) && s; });
        const list = await sessions(t);
        const mine = list.find((s) => squat(s).length === 3 && squat(s).map((x) => x.weightKg).join() === "60,65,65");
        const day = await t.page.evaluate((d) => window.FC.fmtDayLong(d), mine?.day ?? "");
        const row = t.page.locator("#stSessions > .row").filter({ hasText: "Kniebeuge" }).first();
        const txt = (await row.count()) ? (await row.innerText()).replace(/\s+/g, " ") : "";
        const tonnage = 60 * 10 + 65 * 8 + 65 * 6;
        const e1rm = Math.max(60 * (1 + 10 / 30), 65 * (1 + 8 / 30), 65 * (1 + 6 / 30));
        const sessTon = mine ? squat(mine).reduce((a, x) => a + x.weightKg * x.reps, 0) : 0;
        const ok = !!msg && !!mine && list.length === t.before + 1 && sessTon === tonnage && /Kniebeuge/.test(txt);
        t.mine = mine;
        return { status: ok ? "ok" : "fail", observed: `Meldung „${msg || (await t.text("#stMsg"))}“. Einheiten ${t.before} → ${list.length}. Gespeichert: ${mine ? squat(mine).map((x) => `${x.weightKg} kg × ${x.reps}`).join(", ") : "nicht gefunden"}; Volumen ${sessTon} kg (erwartet ${tonnage}); 1RM-Schätzung Epley der besten Sätze ≈ ${e1rm.toFixed(0)} kg. Zeile: „${txt.slice(0, 160)}“.`, locator: t.page.locator("#stSessions") };
      },
    },
    {
      nr: 3,
      action: "Bei der gespeicherten Einheit „Bearbeiten“ wählen, einen Satz ändern, speichern.",
      expected: "Änderung wird übernommen, andere Sätze bleiben, keine doppelte Einheit.",
      async run(t) {
        const before = (await sessions(t)).length;
        const row = t.page.locator("#stSessions > .row").filter({ hasText: "Kniebeuge" }).first();
        await row.getByRole("button", { name: /Bearbeiten/ }).click();
        const r = t.page.locator("#stRows .st-ex").first().locator(".st-set").nth(1);
        await r.locator(".kg").fill("70");
        await t.page.click("#stSave");
        await t.poll(async () => /Gespeichert\./.test(await t.text("#stMsg")));
        const list = await sessions(t);
        const mine = list.find((s) => s.id === t.mine.id);
        const w = mine ? squat(mine).map((x) => x.weightKg).join() : "–";
        const ok = list.length === before && w === "60,70,65";
        return { status: ok ? "ok" : "fail", observed: `Einheiten vorher ${before}, danach ${list.length}. Kniebeuge-Gewichte jetzt ${w} (erwartet 60,70,65).`, locator: t.page.locator("#stSessions") };
      },
    },
    {
      nr: 4,
      action: "Schnelleingabe „3 × 60 kg × 10“ bei einer Übung, „Füllen“.",
      expected: "Drei gleiche Sätze, einzeln änderbar.",
      async run(t) {
        const box = t.page.locator("#stRows .st-ex").first();
        await box.locator(".ex").fill("Bankdrücken");
        await box.locator(".quick").fill("3 × 60 kg × 10");
        await box.locator(".st-exh > button", { hasText: "Füllen" }).click();
        const same = await box.locator(".st-set").evaluateAll((rs) => rs.map((r) => `${r.querySelector(".kg").value}×${r.querySelector(".reps").value}`));
        await box.locator(".st-set").nth(1).locator(".kg").fill("62.5");
        const changed = await box.locator(".st-set").evaluateAll((rs) => rs.map((r) => `${r.querySelector(".kg").value}×${r.querySelector(".reps").value}`));
        const ok = same.join() === "60×10,60×10,60×10" && changed.join() === "60×10,62.5×10,60×10";
        return { status: ok ? "ok" : "fail", observed: `Nach „Füllen“: ${same.join(", ")}. Nach Änderung von Satz 2: ${changed.join(", ")}.`, locator: t.page.locator("#stForm") };
      },
    },
    {
      nr: 5,
      action: "Zusätzlich Dauer (min) eintragen und speichern.",
      expected: "Speichern klappt (vorher brach es im Dashboard wegen doppelter ID ab).",
      async run(t) {
        const errors = [];
        t.page.on("pageerror", (e) => errors.push(String(e)));
        await t.page.fill("#stDurMin", "55");
        await t.page.click("#stSave");
        const msg = await t.poll(async () => { const s = await t.text("#stMsg"); return /Gespeichert\.|Nicht gespeichert/.test(s) && s; });
        const list = await sessions(t);
        const s = list.find((x) => x.sets.some((y) => /bankdr/i.test(y.exerciseName ?? y.exercise)) && x.durationMin === 55);
        const dup = await t.page.evaluate(() => { const ids = [...document.querySelectorAll("[id]")].map((e) => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); });
        const durDup = dup.filter((x) => /^stDur/.test(x));
        const ok = /Gespeichert\./.test(msg || "") && !!s && durDup.length === 0 && errors.length === 0;
        return { status: ok ? "ok" : "fail", observed: `Meldung „${msg || (await t.text("#stMsg"))}“. Einheit mit Dauer 55 min gespeichert: ${s ? "ja" : "nein"}. Doppelte IDs bei der Dauer: ${durDup.length ? durDup.join(", ") : "keine"} (sonst auf der Seite doppelt: ${dup.filter((x) => !/^stDur/.test(x)).join(", ") || "nichts"}). Seitenfehler: ${errors.length ? errors.join("; ") : "keine"}.`, locator: t.page.locator("#stSessions") };
      },
    },
  ],
};
