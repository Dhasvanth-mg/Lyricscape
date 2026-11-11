// CVP-ENV-FBK-001..005: the stage when there is no cover to stand on (missing, unreadable, turned off, or text-only/flat).
// Painted from the song's palette, so the style stays cover-driven in spirit: the colours are the song's own.

import { mix } from '../../kinetic/util';

export type FallbackId = `CVP-ENV-FBK-00${1 | 2 | 3 | 4 | 5}`;
export const FALLBACK_IDS: FallbackId[] = ['CVP-ENV-FBK-001', 'CVP-ENV-FBK-002', 'CVP-ENV-FBK-003', 'CVP-ENV-FBK-004', 'CVP-ENV-FBK-005'];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function paintFallback(c: CanvasRenderingContext2D, id: FallbackId, w: number, h: number, palette: string[], seed: number, title: string) {
  const r = rng(seed);
  const p = palette.length >= 2 ? palette : ['#ff3d6e', '#2b2d6e'];
  const A = p[0]!;
  const B = p[1]!;
  const C = p[2] ?? mix(A, B, 0.5);
  switch (id) {
    case 'CVP-ENV-FBK-001': {
      // gradient mesh: four soft colour pools over a base
      c.fillStyle = mix(B, '#000000', 0.25);
      c.fillRect(0, 0, w, h);
      for (const [x, y, col] of [[0.2, 0.25, A], [0.8, 0.3, C], [0.3, 0.8, B], [0.75, 0.75, mix(A, '#ffffff', 0.3)]] as const) {
        const g = c.createRadialGradient(x * w, y * h, 0, x * w, y * h, Math.max(w, h) * 0.6);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
      }
      break;
    }
    case 'CVP-ENV-FBK-002': {
      // duotone grain: two colours split by a diagonal, grained
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, A);
      g.addColorStop(1, B);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      const img = c.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const n = (r() - 0.5) * 46;
        d[i] = d[i]! + n;
        d[i + 1] = d[i + 1]! + n;
        d[i + 2] = d[i + 2]! + n;
      }
      c.putImageData(img, 0, 0);
      break;
    }
    case 'CVP-ENV-FBK-003': {
      // colour blocks: a few large flat rectangles
      c.fillStyle = A;
      c.fillRect(0, 0, w, h);
      const cols = [B, C, mix(A, '#ffffff', 0.5), mix(B, '#000000', 0.3)];
      for (let i = 0; i < 5; i++) {
        c.fillStyle = cols[i % cols.length]!;
        const bw = w * (0.25 + r() * 0.45);
        const bh = h * (0.2 + r() * 0.45);
        c.fillRect(r() * (w - bw), r() * (h - bh), bw, bh);
      }
      break;
    }
    case 'CVP-ENV-FBK-004': {
      // halftone field: dots that grow toward one corner
      c.fillStyle = B;
      c.fillRect(0, 0, w, h);
      c.fillStyle = A;
      const step = Math.max(w, h) / 46;
      for (let y = 0; y < h + step; y += step)
        for (let x = 0; x < w + step; x += step) {
          const t = (x / w + y / h) / 2;
          c.beginPath();
          c.arc(x, y, step * 0.5 * t, 0, Math.PI * 2);
          c.fill();
        }
      break;
    }
    default: {
      // the title as a big type pattern
      c.fillStyle = A;
      c.fillRect(0, 0, w, h);
      const word = (title || 'LYRICS').toUpperCase();
      const px = Math.round(h / 5.5);
      c.font = `400 ${px}px "Bebas Neue", sans-serif`;
      c.textBaseline = 'top';
      for (let row = 0; row * px * 0.95 < h; row++) {
        c.fillStyle = row % 2 ? mix(A, '#000000', 0.18) : mix(A, '#ffffff', 0.16);
        const tw = c.measureText(word + '  ').width || px * 4;
        for (let x = -((row * px * 0.7) % tw); x < w; x += tw) c.fillText(word, x, row * px * 0.95);
      }
    }
  }
}
