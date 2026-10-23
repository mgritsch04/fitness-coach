import { scenario, deviceStep } from "./_auto.mjs";
const why = "Echte WHOOP-/Wahoo-Geräte und Webhook-Konfiguration beim Anbieter: in der Cloud-Vorprüfung nicht prüfbar. Die Webhook-Annahme selbst ist durch Unit-Tests des Workers abgedeckt (worker/test/webhooks*.test.ts).";
export default scenario(29, "Webhooks für WHOOP und Wahoo", "Webhooks WHOOP/Wahoo", [
  deviceStep(1, "WHOOP: Workout aufzeichnen oder Schlaf auswerten lassen.", "Ereignis liegt vor.", why),
  deviceStep(2, "Nach ~5 min im Fitness Coach „Zeig meine Workouts von heute“.", "Neues Workout/Schlaf nach wenigen Minuten da, nicht erst zur vollen Stunde.", why),
  deviceStep(3, "Wahoo: Fahrt aufzeichnen, nach 5 min Workouts zeigen.", "Fahrt mit Quelle „wahoo“.", why + " Wahoo-App ist außerdem noch nicht freigegeben (Aufgabe #3)."),
]);
