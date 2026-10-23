// Erzeugt synthetische FIT-Dateien für Tests (keine echten Messwerte).
import { FIT_EPOCH_S, fitCrc } from "../src/providers/mywhoosh/fit";

type Field = [num: number, baseType: number, value: number | null];
const SIZE: Record<number, number> = { 0x00: 1, 0x02: 1, 0x84: 2, 0x86: 4, 0x8c: 4 };
const INVALID: Record<number, number> = { 0x00: 0xff, 0x02: 0xff, 0x84: 0xffff, 0x86: 0xffffffff, 0x8c: 0 };

export const fitTime = (iso: string) => Date.parse(iso) / 1000 - FIT_EPOCH_S;

export class FitBuilder {
  private bytes: number[] = [];
  private defined = new Map<number, string>();

  /** Datennachricht; legt die Definition für den lokalen Typ bei Bedarf an. */
  message(local: number, global: number, fields: Field[], bigEndian = false) {
    const key = `${global}:${bigEndian}:${fields.map((f) => f[0] + "/" + f[1]).join(",")}`;
    if (this.defined.get(local) !== key) {
      this.bytes.push(0x40 | local, 0, bigEndian ? 1 : 0);
      this.push(global, 2, bigEndian);
      this.bytes.push(fields.length);
      for (const [num, type] of fields) this.bytes.push(num, SIZE[type], type);
      this.defined.set(local, key);
    }
    this.bytes.push(local);
    for (const [, type, value] of fields) this.push(value ?? INVALID[type], SIZE[type], bigEndian);
    return this;
  }

  /** Datennachricht mit komprimiertem Zeitstempel-Header (Definition muss schon existieren). */
  compressed(local: number, offset: number, values: number[], sizes: number[]) {
    this.bytes.push(0x80 | (local << 5) | (offset & 0x1f));
    values.forEach((v, i) => this.push(v, sizes[i], false));
    return this;
  }

  private push(value: number, size: number, bigEndian: boolean) {
    const b: number[] = [];
    for (let i = 0; i < size; i++) b.push(Math.floor(value / 2 ** (8 * i)) & 0xff);
    this.bytes.push(...(bigEndian ? b.reverse() : b));
  }

  build({ badCrc = false } = {}): Uint8Array {
    const header = [14, 0x20, 0x08, 0x08, 0, 0, 0, 0, 0x2e, 0x46, 0x49, 0x54, 0, 0];
    const n = this.bytes.length;
    header[4] = n & 0xff; header[5] = (n >> 8) & 0xff; header[6] = (n >> 16) & 0xff; header[7] = (n >> 24) & 0xff;
    const hcrc = fitCrc(Uint8Array.from(header.slice(0, 12)));
    header[12] = hcrc & 0xff; header[13] = hcrc >> 8;
    const body = Uint8Array.from([...header, ...this.bytes, 0, 0]);
    const crc = fitCrc(body, 0, body.length - 2) ^ (badCrc ? 1 : 0);
    body[body.length - 2] = crc & 0xff; body[body.length - 1] = crc >> 8;
    return body;
  }
}

export interface RideOptions {
  start?: string;
  seconds?: number;
  /** Leistung je Sekunde. */
  power?: (s: number) => number;
  /** Puls je Sekunde (Standard: 120 + s/20, läuft bei langen Fahrten über 255 über). */
  hr?: (s: number) => number;
  /** Trittfrequenz je Sekunde (Standard 90). */
  cadence?: (s: number) => number;
  withSession?: boolean;
  /** Versatz der Ortszeit in Sekunden (activity.local_timestamp). */
  utcOffsetS?: number | null;
}

/** Synthetische Fahrt: 1 record pro Sekunde mit Leistung, Puls, Trittfrequenz, Distanz. */
export function syntheticRide(o: RideOptions = {}): Uint8Array {
  const start = fitTime(o.start ?? "2026-03-01T17:00:00Z");
  const seconds = o.seconds ?? 600;
  const power = o.power ?? ((s) => (s < 300 ? 150 : 250));
  const f = new FitBuilder();
  f.message(0, 0, [[0, 0x00, 4], [1, 0x84, 255], [4, 0x86, start]]); // file_id: activity
  let dist = 0;
  for (let s = 0; s < seconds; s++) {
    dist += 8; // 8 m/s
    f.message(1, 20, [[253, 0x86, start + s], [7, 0x84, power(s)], [3, 0x02, o.hr ? o.hr(s) : 120 + Math.floor(s / 20)], [4, 0x02, o.cadence ? o.cadence(s) : 90], [5, 0x86, dist * 100]]);
  }
  if (o.withSession !== false) {
    f.message(2, 18, [
      [253, 0x86, start + seconds], [2, 0x86, start], [5, 0x00, 2], [6, 0x00, 58],
      [7, 0x86, seconds * 1000], [8, 0x86, seconds * 1000], [9, 0x86, dist * 100], [11, 0x84, 300],
      [16, 0x02, 135], [17, 0x02, 149], [18, 0x02, 90], [20, 0x84, 200], [34, 0x84, 212], [35, 0x84, 123],
    ]);
  }
  if (o.utcOffsetS !== null) {
    f.message(3, 34, [[253, 0x86, start + seconds], [5, 0x86, start + seconds + (o.utcOffsetS ?? 3600)]]);
  }
  return f.build();
}

export const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
