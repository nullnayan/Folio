/**
 * Minimal ZIP writer: stored (no compression) entries,
 * with optional traditional ZipCrypto password encryption.
 * 100% offline, zero dependencies — works in Expo Go and Node.
 */

function crc32Table(): Uint32Array {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC_TABLE = crc32Table();

export function crc32(data: Uint8Array, prev = 0): number {
  let c = (prev ^ 0xffffffff) >>> 0;
  for (let i = 0; i < data.length; i++) c = (CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  return ((c ^ 0xffffffff) >>> 0);
}

const utf8 = (s: string): Uint8Array => {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
  // tiny fallback for ASCII-only names
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0x7f;
  return b;
};

class ZipCrypto {
  private k0 = 0x12345678;
  private k1 = 0x23456789;
  private k2 = 0x34567890;

  constructor(password: string) {
    const bytes = utf8(password);
    for (let i = 0; i < bytes.length; i++) this.update(bytes[i]);
  }

  // Raw CRC32 step on the running key — note: NO xor-in/xor-out here.
  // (The key register is used directly, unlike a standalone CRC32 checksum.)
  private update(c: number) {
    this.k0 = (CRC_TABLE[(this.k0 ^ c) & 0xff] ^ (this.k0 >>> 8)) >>> 0;
    this.k1 = (Math.imul(this.k1 + (this.k0 & 0xff), 134775813) + 1) >>> 0;
    this.k2 = (CRC_TABLE[(this.k2 ^ ((this.k1 >>> 24) & 0xff)) & 0xff] ^ (this.k2 >>> 8)) >>> 0;
  }

  private streamByte(): number {
    const t = (this.k2 | 2) >>> 0;
    return ((Math.imul(t, t ^ 1) >>> 8) & 0xff) >>> 0;
  }

  /** Returns 12-byte encryption header (caller appends encrypted file data after). */
  header(crc: number): Uint8Array {
    const h = new Uint8Array(12);
    // pseudo-random bytes (not cryptographic — ZipCrypto never is)
    let seed = (Date.now() ^ crc) >>> 0;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed >>> 16) & 0xff;
    };
    for (let i = 0; i < 11; i++) h[i] = rnd();
    h[11] = (crc >>> 24) & 0xff; // verification byte (bit 3 of flags is clear)
    const out = new Uint8Array(12);
    for (let i = 0; i < 12; i++) {
      out[i] = h[i] ^ this.streamByte();
      this.update(h[i]);
    }
    return out;
  }

  encrypt(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      out[i] = data[i] ^ this.streamByte();
      this.update(data[i]);
    }
    return out;
  }
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function u16(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
}
function u32(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}
function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/**
 * Build a .zip file. Entries are stored (no deflate) so it works
 * everywhere with zero dependencies. Password enables ZipCrypto
 * ("basic lock" — keeps casual eyes out; not military-grade).
 */
export function createZip(entries: ZipEntry[], password?: string): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = utf8(e.name);
    const crc = crc32(e.data);
    const encrypted = !!password;
    const crypto = encrypted ? new ZipCrypto(password as string) : null;
    const encHeader = crypto ? crypto.header(crc) : new Uint8Array(0);
    const body = crypto ? crypto.encrypt(e.data) : e.data;
    const compSize = encHeader.length + body.length;
    const flags = (encrypted ? 0x0001 : 0x0000) | 0x0800; // encrypted? + UTF-8 names

    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(flags),
      u16(0), // method: stored
      u16(0), // time/date (zeroed — fine)
      u16(0),
      u32(crc),
      u32(compSize),
      u32(e.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      encHeader,
      body,
    ]);
    chunks.push(local);

    central.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(flags),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(compSize),
        u32(e.data.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ])
    );
    offset += local.length;
  }

  const centralDir = concat(central);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return concat([...chunks, centralDir, end]);
}
