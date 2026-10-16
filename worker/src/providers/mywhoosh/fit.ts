// Schlanker Leser für FIT-Dateien (Garmin Flexible and Interoperable Data Transfer), wie sie
// MyWhoosh im Webportal zum Herunterladen anbietet. Liest nur, was der Import braucht: alle
// Nachrichten mit ihren Zahlen-/Textfeldern; Entwicklerfelder werden übersprungen.

export interface FitMessage {
  /** Globale Nachrichtennummer, z. B. 18 = session, 20 = record. */
  global: number;
  fields: Map<number, number | string>;
}

export class FitError extends Error {}

/** Sekunden zwischen Unix-Epoche und FIT-Epoche (1989-12-31T00:00:00Z). */
export const FIT_EPOCH_S = 631_065_600;

export const fitTimeToIso = (t: number) => new Date((t + FIT_EPOCH_S) * 1000).toISOString();

interface FieldDef {
  num: number;
  size: number;
  baseType: number;
}

interface Definition {
  global: number;
  littleEndian: boolean;
  fields: FieldDef[];
  devBytes: number;
}

// Basistypen (untere 5 Bit): Größe in Byte und Ungültig-Wert.
const BASE: Record<number, { size: number; invalid: number | bigint | null }> = {
  0: { size: 1, invalid: 0xff }, // enum
  1: { size: 1, invalid: 0x7f }, // sint8
  2: { size: 1, invalid: 0xff }, // uint8
  3: { size: 2, invalid: 0x7fff }, // sint16
  4: { size: 2, invalid: 0xffff }, // uint16
  5: { size: 4, invalid: 0x7fffffff }, // sint32
  6: { size: 4, invalid: 0xffffffff }, // uint32
  7: { size: 1, invalid: null }, // string
  8: { size: 4, invalid: null }, // float32 (ungültig = NaN-Muster)
  9: { size: 8, invalid: null }, // float64
  10: { size: 1, invalid: 0 }, // uint8z
  11: { size: 2, invalid: 0 }, // uint16z
  12: { size: 4, invalid: 0 }, // uint32z
  13: { size: 1, invalid: 0xff }, // byte
  14: { size: 8, invalid: 0x7fffffffffffffffn }, // sint64
  15: { size: 8, invalid: 0xffffffffffffffffn }, // uint64
  16: { size: 8, invalid: 0n }, // uint64z
};

const CRC_TABLE = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];

export function fitCrc(bytes: Uint8Array, start = 0, end = bytes.length): number {
  let crc = 0;
  for (let i = start; i < end; i++) {
    const b = bytes[i];
    let tmp = CRC_TABLE[crc & 0xf];
    crc = ((crc >> 4) & 0x0fff) ^ tmp ^ CRC_TABLE[b & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = ((crc >> 4) & 0x0fff) ^ tmp ^ CRC_TABLE[(b >> 4) & 0xf];
  }
  return crc;
}

function readValue(view: DataView, offset: number, f: FieldDef, le: boolean): number | string | null {
  const type = f.baseType & 0x1f;
  const base = BASE[type];
  if (!base) return null;
  if (type === 7) {
    const raw = new Uint8Array(view.buffer, view.byteOffset + offset, f.size);
    const end = raw.indexOf(0);
    return new TextDecoder().decode(end >= 0 ? raw.subarray(0, end) : raw) || null;
  }
  // Felder, die mehrere Werte enthalten (Arrays), braucht der Import nicht.
  if (f.size !== base.size) return null;
  let v: number | bigint;
  switch (type) {
    case 1: v = view.getInt8(offset); break;
    case 3: v = view.getInt16(offset, le); break;
    case 4: case 11: v = view.getUint16(offset, le); break;
    case 5: v = view.getInt32(offset, le); break;
    case 6: case 12: v = view.getUint32(offset, le); break;
    case 8: v = view.getFloat32(offset, le); break;
    case 9: v = view.getFloat64(offset, le); break;
    case 14: v = view.getBigInt64(offset, le); break;
    case 15: case 16: v = view.getBigUint64(offset, le); break;
    default: v = view.getUint8(offset);
  }
  if (v === base.invalid) return null;
  if (typeof v === "bigint") return Number(v);
  return Number.isFinite(v) ? v : null;
}

/** Liest die erste FIT-Datei im Puffer. Wirft FitError bei kaputten oder fremden Dateien. */
export function parseFit(bytes: Uint8Array): FitMessage[] {
  if (bytes.length < 12) throw new FitError("Datei zu kurz für eine FIT-Datei.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = bytes[0];
  const signature = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if ((headerSize !== 12 && headerSize !== 14) || signature !== ".FIT") throw new FitError("Keine FIT-Datei (Kennung „.FIT“ fehlt).");
  const dataSize = view.getUint32(4, true);
  const end = headerSize + dataSize;
  if (end + 2 > bytes.length) throw new FitError("FIT-Datei ist unvollständig (abgeschnitten?).");
  const fileCrc = view.getUint16(end, true);
  // CRC 0 heißt „nicht gesetzt“; manche Exporte lassen sie weg.
  if (fileCrc !== 0 && fitCrc(bytes, 0, end) !== fileCrc) throw new FitError("Prüfsumme der FIT-Datei stimmt nicht (Datei beschädigt?).");

  const defs = new Map<number, Definition>();
  const out: FitMessage[] = [];
  let pos = headerSize;
  let lastTimestamp = 0;
  while (pos < end) {
    const header = bytes[pos++];
    if (header & 0x80) {
      // Komprimierter Zeitstempel: 5 Bit Versatz zum letzten vollen Zeitstempel.
      const local = (header >> 5) & 0x03;
      const offset = header & 0x1f;
      let ts = (lastTimestamp & ~0x1f) + offset;
      if (offset < (lastTimestamp & 0x1f)) ts += 0x20;
      lastTimestamp = ts;
      pos = readData(local, pos, ts);
    } else if (header & 0x40) {
      const local = header & 0x0f;
      const hasDev = (header & 0x20) !== 0;
      if (pos + 5 > end) throw new FitError("FIT-Datei ist beschädigt (Definition).");
      const littleEndian = bytes[pos + 1] === 0;
      const global = view.getUint16(pos + 2, littleEndian);
      const count = bytes[pos + 4];
      pos += 5;
      const fields: FieldDef[] = [];
      for (let i = 0; i < count; i++, pos += 3) fields.push({ num: bytes[pos], size: bytes[pos + 1], baseType: bytes[pos + 2] });
      let devBytes = 0;
      if (hasDev) {
        const devCount = bytes[pos++];
        for (let i = 0; i < devCount; i++, pos += 3) devBytes += bytes[pos + 1];
      }
      defs.set(local, { global, littleEndian, fields, devBytes });
    } else {
      pos = readData(header & 0x0f, pos, null);
    }
  }
  return out;

  function readData(local: number, at: number, compressedTs: number | null): number {
    const def = defs.get(local);
    if (!def) throw new FitError("FIT-Datei ist beschädigt (Daten ohne Definition).");
    const fields = new Map<number, number | string>();
    let p = at;
    for (const f of def.fields) {
      if (p + f.size > end) throw new FitError("FIT-Datei ist beschädigt (Daten über das Ende hinaus).");
      const v = readValue(view, p, f, def.littleEndian);
      if (v !== null) fields.set(f.num, v);
      p += f.size;
    }
    p += def.devBytes;
    const ts = fields.get(253);
    if (typeof ts === "number") lastTimestamp = ts;
    else if (compressedTs !== null) fields.set(253, compressedTs);
    out.push({ global: def.global, fields });
    return p;
  }
}
