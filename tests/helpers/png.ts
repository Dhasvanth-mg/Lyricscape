import { deflateSync } from 'node:zlib';

// Tiny PNG encoder (RGB, 8-bit) so tests can create real image files with no dependencies.

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePng(w: number, h: number, pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A "photo-like" test pattern: colour gradient + hard-edged shapes (so it's sharp) + deterministic texture. */
export function patternPng(w: number, h: number, seed: number): Buffer {
  const hue = (seed * 67) % 360;
  return encodePng(w, h, (x, y) => {
    const circle = Math.hypot(x - w * (0.3 + 0.1 * (seed % 5)), y - h * 0.5) < h * 0.25;
    const stripe = Math.floor((x + y * 0.5 + seed * 13) / 22) % 2 === 0;
    const tex = ((x * 7919 + y * 104729 + seed * 31) % 23) - 11;
    const base = [(hue + x * 0.3) % 255, (120 + y * 0.2) % 255, (200 - x * 0.1) % 255];
    const v = circle ? 235 : stripe ? 40 : 110;
    return [clamp(base[0]! * 0.4 + v * 0.6 + tex), clamp(base[1]! * 0.4 + v * 0.6 + tex), clamp(base[2]! * 0.4 + v * 0.6 + tex)];
  });
}

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
