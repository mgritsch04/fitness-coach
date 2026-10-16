// Connector-Werkzeug für strukturierte Radeinheiten (#63): Planeinheit → Intervalle in % FTP und Watt → ZWO-Datei für MyWhoosh.
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { weekStart } from "./core/analysis";
import { buildBikeWorkout, RIDE_TYPES, toZwo, zwoFileName, type Step } from "./core/bike-workout";
import { buildDashboard } from "./core/dashboard";
import type { SessionType } from "./core/plan";
import { weekView } from "./core/training";
import type { Env } from "./env";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (error: string, message: string) => ({ ...json({ error, message }), isError: true });

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-TT");

const HOW_TO = [
  "Datei herunterladen.",
  "Auf workout.mywhoosh.com mit dem MyWhoosh-Konto anmelden und die .zwo-Datei hochladen.",
  "„Export to MyWhoosh“ wählen; die Einheit erscheint in der App unter „MyWorkouts“ (läuft die App schon, einmal neu starten).",
];

export function registerBikeWorkoutTools(server: McpServer, env: Env) {
  const db = env.DB;

  server.registerTool(
    "get_bike_workout",
    {
      description:
        "Strukturierte Radeinheit für die Rolle: aus der geplanten Einheit eines Tages (Wochenplan) oder aus type und durationMin. " +
        "Liefert Schritte in % FTP und Watt, geschätzte Belastung und eine ZWO-Datei (zwo, fileName) zum Import über den MyWhoosh Workout Builder (workout.mywhoosh.com). " +
        "Intervalle folgen gängigen Faustregeln und sind eine Trainingsempfehlung.",
      inputSchema: {
        day: DAY.optional().describe("Tag im Wochenplan, Standard heute"),
        type: z.enum(RIDE_TYPES as [SessionType, ...SessionType[]]).optional().describe("statt der Planeinheit: recovery, endurance, long, tempo, threshold, vo2max, opener, race"),
        durationMin: z.number().int().min(20).max(360).optional().describe("Dauer in Minuten (Standard: aus dem Plan bzw. 60)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ day, type, durationMin }) => {
      const dash = await buildDashboard(db, { days: 56 });
      const d = day ?? dash.today;
      let planned = null;
      if (!type) {
        const view = await weekView(db, dash, weekStart(d));
        const s = view.plan.days.find((x) => x.day === d) ?? null;
        planned = s && { type: s.type, title: s.title, durationMin: s.durationMin, intensity: s.intensity, stored: view.stored };
        if (!s || !RIDE_TYPES.includes(s.type)) {
          return fail("no_ride", `Für ${d} ist keine Radeinheit geplant${s ? ` (${s.title})` : ""}. Mit type und durationMin lässt sich trotzdem eine Einheit bauen.`);
        }
      }
      const w = buildBikeWorkout(type ?? planned!.type, durationMin ?? planned?.durationMin ?? 60)!;
      const ftp = dash.settings.ftpW;
      const watts = (x: number | undefined) => (ftp && x != null ? Math.round(x * ftp) : null);
      const steps = w.steps.map((s: Step) => ({ ...s, watts: watts(s.power), wattsLow: watts(s.powerLow), wattsHigh: watts(s.powerHigh), onWatts: watts(s.onPower), offWatts: watts(s.offPower) }));
      return json({
        day: d,
        planned,
        ftpW: ftp,
        ftpEstimated: dash.settings.origin.ftpW === "data",
        workout: { ...w, steps },
        fileName: zwoFileName(w, d),
        zwo: toZwo(w),
        howTo: HOW_TO,
        note: ftp ? "Watt aus deiner FTP; MyWhoosh rechnet die Prozentwerte mit der FTP aus deinem MyWhoosh-Profil." : "Ohne FTP nur Prozentwerte; MyWhoosh nutzt die FTP aus deinem Profil.",
      });
    },
  );
}
