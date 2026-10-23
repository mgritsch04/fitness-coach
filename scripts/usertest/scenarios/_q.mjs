// Kleine Helfer für die Szenarien: Ergebnis-Kurzformen.
export { unit } from "./_unit.mjs";
export const dev = (observed) => ({ status: "device", observed });
export const look = (observed, locator) => ({ status: "look", observed, locator });
export const skip = (observed) => ({ status: "skip", observed });
export const res = (ok, observed, locator) => ({ status: ok ? "ok" : "fail", observed, locator });
/** Gym-Einheit leer starten, Übung mit n Sätzen à 5 × kg anlegen. */
export async function gymStart(t, name, n = 2, kg = 60) {
  await t.open("training");
  await t.section("gym");
  await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
  await t.page.selectOption("#gySrc", "");
  await t.page.click("#gyBody button.primary");
  await t.page.locator(".gy-list").waitFor();
  const ex = t.page.locator(".gy-ex input[list=stEx]").first();
  await ex.fill(name); await ex.dispatchEvent("change");
  for (let i = 1; i < n; i++) await t.page.getByRole("button", { name: "+ Satz" }).first().click();
  const set = t.page.locator(".gy-set").first();
  await set.locator("input").nth(0).fill("5"); await set.locator("input").nth(0).dispatchEvent("change");
  await set.locator("input").nth(1).fill(String(kg)); await set.locator("input").nth(1).dispatchEvent("change");
}
