// #299 Wiederholungsrekord je Gewicht im Gym-Modus. Synthetische Vorgeschichte: Bankdrücken 80 kg × 5 (vor 10 Tagen),
// 70 kg × 8 in zwei Sätzen (vor 5 Tagen). 80 × 5 hält das geschätzte 1RM oben, damit 70 × 9 kein neuer 1RM-Bestwert ist.
const add = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const note = (t) => t.page.evaluate(() => document.querySelector(".gy-note:not([hidden])")?.textContent ?? "");
/** Satz j der ersten Übung: Wiederholungen und Gewicht eintragen und abhaken. */
async function tick(t, j, reps, kg) {
  const row = t.page.locator(".gy-list .gy-ex").first().locator(".gy-set").nth(j);
  await row.locator("input").nth(0).fill(String(reps));
  await row.locator("input").nth(0).dispatchEvent("change");
  await row.locator("input").nth(1).fill(String(kg));
  await row.locator("input").nth(1).dispatchEvent("change");
  await row.locator("button.ok").click();
  await t.page.waitForTimeout(400);
  return note(t);
}
const card = (t) => t.page.locator(".gy-list .gy-ex").first();

export default {
  issue: 299,
  feature: 299,
  title: "Wiederholungsrekord je Gewicht im Gym-Modus (#299)",
  name: "Wiederholungsrekord je Gewicht",
  device: "phone",
  steps: [
    {
      nr: 1,
      action: "Connector-Werkzeug get_strength aufrufen (nach synthetischen Einheiten: Bankdrücken 80 kg × 5, später 70 kg × 8).",
      expected: "Das Feld repRecords enthält je Übung marks mit kg, reps und day, nach Gewicht absteigend und mit steigenden Wiederholungen.",
      async run(t) {
        const today = (await t.tool("get_dashboard", { days: 7 })).today;
        await t.tool("log_strength_session", { day: add(today, -10), name: "Drücken (Test A)", durationMin: 40, rpe: 8, exercises: [{ exercise: "Bankdrücken", sets: [{ reps: 5, weightKg: 80 }] }] });
        await t.tool("log_strength_session", { day: add(today, -5), name: "Drücken (Test B)", durationMin: 40, rpe: 7, exercises: [{ exercise: "Bankdrücken", sets: [{ reps: 8, weightKg: 70 }, { reps: 8, weightKg: 70 }] }] });
        const s = await t.tool("get_strength", { weeks: 4 });
        const rec = (s.repRecords ?? []).find((r) => /bankdr|bench/i.test(`${r.name} ${r.exercise}`));
        const m = rec?.marks ?? [];
        const shape = m.length > 0 && m.every((x) => typeof x.kg === "number" && typeof x.reps === "number" && /^\d{4}-\d\d-\d\d$/.test(x.day));
        const order = m.every((x, i) => i === 0 || (x.kg < m[i - 1].kg && x.reps > m[i - 1].reps));
        const ok = shape && order && m.some((x) => x.kg === 80 && x.reps === 5) && m.some((x) => x.kg === 70 && x.reps === 8);
        return { status: ok ? "ok" : "fail", observed: `repRecords Bankdrücken: ${JSON.stringify(m)}`, noFinalShot: true };
      },
    },
    {
      nr: 2,
      action: "Gym-Modus öffnen und eine Einheit mit dieser Übung starten. Bei 70 kg 9 Wiederholungen eintragen und den Satz abhaken.",
      expected: "Hinweis „Wiederholungsrekord: erstmals 9 Wdh. mit 70 kg (bisher höchstens 8).“ (oder ein neuer 1RM-Bestwert, falls der höher liegt).",
      async run(t) {
        await t.open("training");
        await t.section("gym");
        await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
        const v = await t.page.$$eval("#gySrc option", (o) => o.find((x) => x.value.startsWith("s:") && /Test B/.test(x.textContent))?.value);
        await t.page.selectOption("#gySrc", v);
        await t.page.click("#gyBody button.primary");
        await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
        const n = await tick(t, 0, 9, 70);
        const ok = n.includes("Wiederholungsrekord: erstmals 9 Wdh. mit 70 kg (bisher höchstens 8).") || /^Neuer Bestwert/.test(n);
        return { status: ok ? "ok" : "fail", observed: `Hinweis: „${n || "keiner"}“`, locator: card(t) };
      },
    },
    {
      nr: 3,
      action: "Den nächsten Satz mit gleichem Gewicht und gleich vielen Wiederholungen abhaken.",
      expected: "Kein Wiederholungsrekord mehr, weil das heute schon geschafft wurde.",
      async run(t) {
        const n = await tick(t, 1, 9, 70);
        return { status: /Wiederholungsrekord|Neuer Bestwert/.test(n) ? "fail" : "ok", observed: `Hinweis: „${n || "keiner"}“`, locator: card(t) };
      },
    },
    {
      nr: 4,
      action: "Einen Satz mit weniger Wiederholungen als dem bisherigen Bestwert abhaken (70 kg × 7).",
      expected: "Kein Rekord-Hinweis.",
      async run(t) {
        await card(t).getByRole("button", { name: "+ Satz" }).click();
        const n = await tick(t, 2, 7, 70);
        return { status: /Wiederholungsrekord|Neuer Bestwert/.test(n) ? "fail" : "ok", observed: `Hinweis: „${n || "keiner"}“`, locator: card(t) };
      },
    },
    {
      nr: 5,
      action: "Optional: Nach einem Rekord (70 kg × 10) bei der Reserve „1–2“ antippen.",
      expected: "Der Rekord-Hinweis bleibt stehen, dazu kommt der Vorschlag fürs nächste Gewicht.",
      async run(t) {
        await card(t).getByRole("button", { name: "+ Satz" }).click();
        await card(t).getByRole("button", { name: "+ Satz" }).click();
        const rec = await tick(t, 3, 10, 70);
        const rir = card(t).locator(".gy-rir").last().getByRole("button", { name: "1–2" });
        if (!(await rir.count())) return { status: "skip", observed: `Keine Reserve-Auswahl gefunden; Hinweis nach dem Rekordsatz: „${rec}“.`, locator: card(t) };
        await rir.click();
        await t.page.waitForTimeout(300);
        const n = await note(t);
        const ok = /Wiederholungsrekord: erstmals 10 Wdh\. mit 70 kg/.test(n) && /Reserve passt: nächster Satz wieder 70 kg/.test(n);
        return { status: ok ? "ok" : "fail", observed: `Nach dem Rekord: „${rec}“; nach „1–2“: „${n}“`, locator: card(t) };
      },
    },
  ],
};
