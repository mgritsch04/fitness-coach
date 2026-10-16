// Kompakte Übertragung (#69): Zeilenlisten als Spalten-Kopf plus Werte-Arrays, damit sich Feldnamen nicht je Zeile wiederholen.
// Das Artefakt fordert das mit `compact: true` an und packt es in app/core.js wieder aus; Claude im Chat bekommt die lesbare Form.

export interface Columns {
  keys: string[];
  rows: unknown[][];
}

/** Zeilen → Spalten. Fehlende Felder werden zu null. */
export function toColumns(rows: readonly Record<string, unknown>[]): Columns {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return { keys, rows: rows.map((r) => keys.map((k) => r[k] ?? null)) };
}

/** Spalten → Zeilen (Gegenstück zu toColumns, auch im Artefakt nachgebaut). */
export function fromColumns<T = Record<string, unknown>>(c: Columns): T[] {
  return c.rows.map((v) => Object.fromEntries(c.keys.map((k, i) => [k, v[i]])) as T);
}

/** get_dashboard kompakt: Tagesreihe und Workouts als Spalten, der Rest unverändert. */
export function compactDashboard<D extends { days: readonly object[]; workouts: readonly object[] }>(d: D) {
  return { ...d, compact: 1, days: toColumns(d.days as Record<string, unknown>[]), workouts: toColumns(d.workouts as Record<string, unknown>[]) };
}
