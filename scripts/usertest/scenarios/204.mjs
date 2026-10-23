// #204 Gym-Modus: Übung tauschen (Alternativen bei belegtem Gerät).
import { gymStart, res, look, dev } from "./_q.mjs";
export default {
  issue: 204, feature: 204, title: "Gym-Modus: Übung tauschen (#204)", name: "Übung tauschen", device: "phone",
  steps: [
    { nr: 1, action: "Gym-Modus starten.", expected: "Der Gym-Modus ist offen.",
      async run(t) { await gymStart(t, "Kniebeuge", 2, 60); const n = await t.page.locator(".gy-set").count();
        return res(n === 2, `Gym-Einheit offen mit Kniebeuge, ${n} Sätze.`, t.page.locator("#sec-gym")); } },
    { nr: 2, action: "Bei einer offenen Übung auf „Tauschen“ tippen.", expected: "Alternativen werden angeboten.",
      async run(t) { await t.page.locator(".gy-swap").first().click();
        const box = t.page.locator(".gy-swapbox button"); await box.first().waitFor({ timeout: 8000 });
        t.alts = await box.allInnerTexts();
        return res(t.alts.length >= 2, `Alternativen: ${t.alts.join(" | ")}`, t.page.locator("#sec-gym")); } },
    { nr: 3, action: "Prüfen, ob die Alternativen passen (z. B. Beinpresse statt Kniebeuge) und das Startgewicht stimmt.", expected: "Die Alternativen passen und das Startgewicht stimmt.",
      async run(t) { return look(`Vorgeschlagen: ${t.alts.join(" | ")}. Ob sie fachlich passen und das Startgewicht zur eigenen Historie stimmt, beurteilt G.`, t.page.locator("#sec-gym")); } },
    { nr: 4, action: "Nach dem Tauschen weiter trainieren und die Einheit speichern.", expected: "Die Satzzahl bleibt gleich; die Einheit wird mit der neuen Übung gespeichert.",
      async run(t) { const first = t.alts[0].split(" · ")[0];
        await t.page.locator(".gy-swapbox button").first().click(); await t.page.waitForTimeout(300);
        const name = await t.page.locator(".gy-exh h3").first().innerText();
        const n = await t.page.locator(".gy-set").count();
        const before = (await t.tool("get_strength", { weeks: 1 })).sessions.length;
        await t.page.locator(".gy-set").first().locator("button.ok").click(); await t.page.waitForTimeout(300);
        await t.page.getByRole("button", { name: "Einheit beenden" }).click();
        await t.page.locator("#gyFinish .gy-rpe button", { hasText: /^6$/ }).click();
        await t.page.locator("#gyFinish button.primary").click();
        await t.page.waitForTimeout(1200);
        const s = (await t.tool("get_strength", { weeks: 1 })).sessions;
        const last = JSON.stringify(s.at(-1) ?? s[0] ?? {});
        return res(name === first && n === 2 && s.length === before + 1 && last.includes(first.split(" ")[0]), `Übung getauscht zu „${name}“, Sätze weiter ${n}. Gespeicherte Einheiten ${before} → ${s.length}; neue Übung in der gespeicherten Einheit: ${last.includes(first.split(" ")[0]) ? "ja" : "nein"}.`, t.page.locator("#sec-gym")); } },
  ],
};
