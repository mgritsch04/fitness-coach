// Gemeinsame Bausteine für Vorprüfungen: Abschnitt öffnen, Inhalt und Überlauf prüfen.
const norm = (s) => s.replace(/\s+/g, " ").trim();

/** Schritt: Abschnitt `id` öffnen; sichtbar, nicht leer, enthält alle `has`-Muster, kein seitlicher Überlauf. */
export function sectionStep({ nr, action, expected, tab, id, has = [], hasNot = [], min = 40, after }) {
  return {
    nr,
    action,
    expected,
    async run(t) {
      await t.open(tab);
      const sec = await t.section(id);
      await t.poll(async () => (norm(await sec.innerText()).length >= min ? true : false), 10_000);
      if (after) await after(t, sec);
      const text = norm(await sec.innerText());
      const visible = await sec.isVisible();
      const missing = has.filter((r) => !r.test(text)).map(String);
      const bad = hasNot.filter((r) => r.test(text)).map(String);
      const over = await t.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const ok = visible && text.length >= min && !missing.length && !bad.length && over <= 1;
      return {
        status: ok ? "ok" : "fail",
        observed: `Abschnitt ${visible ? "sichtbar" : "nicht sichtbar"}, ${text.length} Zeichen${missing.length ? `, fehlt: ${missing.join(", ")}` : ""}${bad.length ? `, unerwünscht: ${bad.join(", ")}` : ""}${over > 1 ? `, seitlicher Überlauf ${over}px` : ", kein seitlicher Überlauf"}. Anfang: „${text.slice(0, 160)}“`,
        locator: sec,
      };
    },
  };
}

/** Schritt, den nur ein Mensch am echten Gerät/mit echten Daten beurteilt. */
export const deviceStep = (nr, action, expected, why) => ({ nr, action, expected, run: async () => ({ status: "device", observed: why, noFinalShot: true }) });
export const lookStep = (nr, action, expected, why) => ({ nr, action, expected, run: async () => ({ status: "look", observed: why }) });

/** Schritt: Werkzeug direkt prüfen. check(payload) -> string (Beobachtung) oder null/false (nicht erfüllt). */
export function toolStep({ nr, action, expected, name, input = {}, check, setup }) {
  return {
    nr,
    action,
    expected,
    async run(t) {
      if (setup) await setup(t);
      const p = await t.tool(name, input);
      const obs = check(p);
      return obs ? { status: "ok", observed: `${name}: ${obs}`, noFinalShot: true } : { status: "fail", observed: `${name}: unerwartete Antwort ${JSON.stringify(p).slice(0, 300)}`, noFinalShot: true };
    },
  };
}

const D = {
  whoop: "Vergleich mit der WHOOP-App/echten Daten: nur der Nutzer kann das beurteilen (hier synthetische Daten).",
  chat: "Echter claude.ai-Chat mit dem Connector: in der Vorprüfung nicht möglich; geprüft wurde das Werkzeug dahinter (siehe vorheriger Schritt bzw. Beobachtung).",
  feel: "Ob es zum eigenen Gefühl passt, beurteilt nur der Nutzer.",
  claude: "Text von Claude (Coach-Antwort) – in der Vorprüfung nur Beispielantwort, echte Antwort nur in claude.ai.",
  phone: "Echtes Handy in der Claude-App: nur am Gerät prüfbar (hier Emulation mit 390 px Breite ohne seitlichen Überlauf geprüft).",
};
export { D };

/** Szenario-Rahmen. */
export const scenario = (issue, title, name, steps, o = {}) => ({ issue, feature: issue, title: `${title} (#${issue})`, name, device: o.device ?? "desktop", steps: steps.map((s, i) => ({ ...s, nr: s.nr ?? i + 1 })), ...(o.extra ?? {}) });

/** Beobachtung aus Werkzeug + Bewertung: check liefert String (ok) oder null (fail). */
export const toolOk = async (t, name, input, check) => {
  const p = await t.tool(name, input ?? {});
  const obs = check(p);
  return obs ? { status: "ok", observed: `${name}: ${obs}`, noFinalShot: true } : { status: "fail", observed: `${name}: unerwartet ${JSON.stringify(p).slice(0, 300)}`, noFinalShot: true };
};

/** Seitlichen Überlauf der Seite messen. */
export const overflow = (t) => t.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

export const seedStrength = async (t, days = 12) => {
  const UP = [{ exercise: "Kniebeuge", setCount: 3, reps: 5, weightKg: 100 }, { exercise: "Bankdrücken", setCount: 3, reps: 8, weightKg: 70 }, { exercise: "Kreuzheben", setCount: 3, reps: 5, weightKg: 110 }, { exercise: "Latzug", setCount: 3, reps: 10, weightKg: 50 }, { exercise: "Beinpresse", setCount: 3, reps: 10, weightKg: 150 }];
  const today = new Date();
  for (const back of [2, 5, 9, 12, 16, 19, 23]) {
    const d = new Date(today.getTime() - back * 86400000).toISOString().slice(0, 10);
    try { await t.tool("log_strength_session", { day: d, name: `Test ${back}`, durationMin: 45, rpe: 7, exercises: UP.map((e, i) => ({ ...e, weightKg: e.weightKg + (back < 10 ? 2.5 : 0) })) }); } catch { /* Tag schon belegt */ }
  }
};
export const seedFits = async (t) => {
  const today = new Date();
  const day = (b) => new Date(today.getTime() - b * 86400000).toISOString().slice(0, 10);
  await t.tool("import_fit", { fileName: "ut-intervals.fit", fileBase64: await t.fit({ start: `${day(3)}T16:00:00Z`, shape: "intervals" }) });
  await t.tool("import_fit", { fileName: "ut-long.fit", fileBase64: await t.fit({ start: `${day(6)}T09:00:00Z`, shape: "long" }) });
  await t.tool("import_fit", { fileName: "ut-steady.fit", fileBase64: await t.fit({ start: `${day(9)}T17:00:00Z`, seconds: 3600, watts: 150 }) });
};

/** Zweite Seite im Desktop-Format (neuer Kontext), z. B. wenn das Szenario sonst mit Handy-Emulation läuft. */
export async function desktopPage(t) {
  const ctx = await t.context.browser().newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(new URL("/", t.page.url()).href);
  await p.waitForFunction(() => window.FC?.state?.data, null, { timeout: 30_000 });
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(1500);
  return { p, ctx };
}

/** Gym-Modus mit einer Vorlage starten (Vorlage wird angelegt). */
export async function startGym(t, exercises, name = "GymT") {
  await t.tool("save_strength_template", { name, exercises });
  await t.open("training");
  await t.section("gym");
  await t.page.locator("#gySrc").waitFor({ timeout: 15_000 });
  await t.page.selectOption("#gySrc", `t:${name}`);
  await t.page.click("#gyBody button.primary");
  await t.page.locator(".gy-list").waitFor({ timeout: 15_000 });
}
