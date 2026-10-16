-- Zeit je Pulszone und Workout (#19): JSON-Array mit Sekunden für Zone 0–5 nach WHOOP-Schema
-- (Anteile der maximalen Herzfrequenz: 0 < 50 %, 1 50–60 %, 2 60–70 %, 3 70–80 %, 4 80–90 %, 5 ≥ 90 %).
ALTER TABLE workouts ADD COLUMN hr_zone_s TEXT;
