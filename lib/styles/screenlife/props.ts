// Overlays: original stickers (SCR-PRP-STK-001..018: flat, thick-outlined, in the accent and its complement; no emoji artwork)
// and notifications (SCR-PRP-NTF-*: kit-consistent banners whose words come only from the song's metadata and sung lines).

import { heartGlyph } from './kits';
import { clock, fillRR, rr, textAt, withA, type Ctx } from './draw';
import { font } from './fonts';

export const STICKER_IDS = Array.from({ length: 18 }, (_, i) => `SCR-PRP-STK-${String(i + 1).padStart(3, '0')}`) as StickerId[];
export type StickerId = `SCR-PRP-STK-0${string}`;
/** stickers that read as playful; never with a dark-register song */
export const PLAYFUL_STK = new Set<string>(['SCR-PRP-STK-002', 'SCR-PRP-STK-013', 'SCR-PRP-STK-017', 'SCR-PRP-STK-010']);

const INK = '#16171b';

function star4(c: Ctx, x: number, y: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const k = i % 2 ? r * 0.32 : r;
    c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  c.closePath();
}

/** a sticker centred in an s x s canvas */
export function paintSticker(c: Ctx, id: StickerId, s: number, a: string, b: string) {
  const m = s / 2;
  const R = s * 0.36;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = s * 0.045;
  c.strokeStyle = INK;
  const both = () => {
    c.fill();
    c.stroke();
  };
  c.fillStyle = a;
  switch (id) {
    case 'SCR-PRP-STK-001': // heart burst
      for (let i = 0; i < 8; i++) {
        const an = (i / 8) * Math.PI * 2;
        c.beginPath();
        c.moveTo(m + Math.cos(an) * R * 1.05, m + Math.sin(an) * R * 1.05);
        c.lineTo(m + Math.cos(an) * R * 1.3, m + Math.sin(an) * R * 1.3);
        c.stroke();
      }
      heartGlyph(c, m, m + R * 0.1, R * 0.8, a);
      c.beginPath();
      c.moveTo(m, m + R * 0.82);
      c.bezierCurveTo(m - R * 1.28, m - R * 0.0, m - R * 0.56, m - R * 0.94, m, m - R * 0.26);
      c.bezierCurveTo(m + R * 0.56, m - R * 0.94, m + R * 1.28, m - R * 0.0, m, m + R * 0.82);
      c.stroke();
      return;
    case 'SCR-PRP-STK-002': // round blob with tear arcs (no face-set copy)
      c.beginPath();
      c.arc(m, m, R, 0, Math.PI * 2);
      both();
      c.fillStyle = b;
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(m + sx * R * 0.95, m + R * 0.2, R * 0.18, R * 0.32, sx * 0.4, 0, Math.PI * 2);
        both();
      }
      c.beginPath();
      c.arc(m, m + R * 0.15, R * 0.42, 0.15, Math.PI - 0.15);
      c.stroke();
      return;
    case 'SCR-PRP-STK-003': // flame
      c.beginPath();
      c.moveTo(m, m - R * 1.15);
      c.bezierCurveTo(m + R * 1.1, m - R * 0.2, m + R * 0.9, m + R, m, m + R);
      c.bezierCurveTo(m - R * 0.9, m + R, m - R * 1.0, m - R * 0.1, m - R * 0.35, m - R * 0.55);
      c.bezierCurveTo(m - R * 0.3, m - R * 0.1, m - R * 0.05, m - R * 0.3, m, m - R * 1.15);
      both();
      c.fillStyle = b;
      c.beginPath();
      c.ellipse(m, m + R * 0.45, R * 0.35, R * 0.48, 0, 0, Math.PI * 2);
      both();
      return;
    case 'SCR-PRP-STK-004': // sparkle trio
      star4(c, m - R * 0.25, m + R * 0.1, R * 0.85);
      both();
      c.fillStyle = b;
      star4(c, m + R * 0.7, m - R * 0.6, R * 0.42);
      both();
      star4(c, m + R * 0.75, m + R * 0.75, R * 0.3);
      both();
      return;
    case 'SCR-PRP-STK-005': // mitten (thumbs shape, abstract)
      c.beginPath();
      rr(c, m - R * 0.7, m - R * 0.2, R * 1.4, R * 1.15, R * 0.4);
      both();
      c.beginPath();
      rr(c, m - R * 0.45, m - R * 1.05, R * 0.5, R * 1.0, R * 0.25);
      both();
      return;
    case 'SCR-PRP-STK-006': // lightning
      c.beginPath();
      [[0.15, -1.15], [-0.6, 0.1], [-0.05, 0.1], [-0.3, 1.15], [0.65, -0.25], [0.1, -0.25], [0.45, -1.15]].forEach(([x, y]) => c.lineTo(m + x! * R, m + y! * R));
      c.closePath();
      both();
      return;
    case 'SCR-PRP-STK-007': // broken heart
      for (const sx of [-1, 1]) {
        c.save();
        c.translate(sx * R * 0.12, 0);
        c.rotate(sx * 0.1);
        c.beginPath();
        c.moveTo(m, m + R * 0.85);
        c.bezierCurveTo(m + sx * R * 1.3, m, m + sx * R * 0.6, m - R, m, m - R * 0.3);
        c.lineTo(m + sx * R * 0.15, m - R * 0.05);
        c.lineTo(m - sx * R * 0.1, m + R * 0.25);
        c.closePath();
        both();
        c.restore();
      }
      return;
    case 'SCR-PRP-STK-008': // moon and z
      c.beginPath();
      c.arc(m - R * 0.1, m + R * 0.1, R * 0.85, Math.PI * 0.35, Math.PI * 1.65);
      c.arc(m + R * 0.25, m - R * 0.05, R * 0.62, Math.PI * 1.45, Math.PI * 0.55, true);
      c.closePath();
      both();
      textAt(c, 'z', m + R * 0.7, m - R * 0.75, `900 ${R * 0.8}px "Nunito", sans-serif`, INK, false, 'center');
      return;
    case 'SCR-PRP-STK-009': // two beamed notes
      c.fillStyle = a;
      for (const x of [-0.5, 0.45]) {
        c.beginPath();
        c.ellipse(m + x * R, m + R * 0.6, R * 0.32, R * 0.24, -0.4, 0, Math.PI * 2);
        both();
        c.beginPath();
        c.moveTo(m + x * R + R * 0.28, m + R * 0.55);
        c.lineTo(m + x * R + R * 0.28, m - R * 0.8);
        c.stroke();
      }
      c.lineWidth = s * 0.08;
      c.beginPath();
      c.moveTo(m - R * 0.22, m - R * 0.8);
      c.lineTo(m + R * 0.73, m - R * 0.95);
      c.stroke();
      return;
    case 'SCR-PRP-STK-010': // double bang
      for (const x of [-0.35, 0.35]) {
        c.beginPath();
        rr(c, m + x * R - R * 0.17, m - R * 1.0, R * 0.34, R * 1.3, R * 0.17);
        both();
        c.beginPath();
        c.arc(m + x * R, m + R * 0.78, R * 0.19, 0, Math.PI * 2);
        both();
      }
      return;
    case 'SCR-PRP-STK-011': // question swirl
      c.lineWidth = s * 0.11;
      c.strokeStyle = INK;
      c.beginPath();
      c.arc(m, m - R * 0.35, R * 0.55, Math.PI * 1.05, Math.PI * 0.45);
      c.lineTo(m, m + R * 0.4);
      c.stroke();
      c.lineWidth = s * 0.06;
      c.strokeStyle = a;
      c.stroke();
      c.lineWidth = s * 0.045;
      c.strokeStyle = INK;
      c.beginPath();
      c.arc(m, m + R * 0.88, R * 0.16, 0, Math.PI * 2);
      both();
      return;
    case 'SCR-PRP-STK-012': // rose
      c.fillStyle = b;
      c.beginPath();
      c.moveTo(m, m + R * 1.15);
      c.lineTo(m, m);
      c.stroke();
      c.beginPath();
      c.ellipse(m + R * 0.3, m + R * 0.65, R * 0.3, R * 0.14, -0.6, 0, Math.PI * 2);
      both();
      c.fillStyle = a;
      c.beginPath();
      c.arc(m, m - R * 0.3, R * 0.6, 0, Math.PI * 2);
      both();
      c.beginPath();
      c.arc(m, m - R * 0.3, R * 0.3, 0.4, Math.PI * 1.8);
      c.stroke();
      return;
    case 'SCR-PRP-STK-013': // stamp with 100 in the style's own lettering
      c.save();
      c.translate(m, m);
      c.rotate(-0.18);
      c.beginPath();
      rr(c, -R, -R * 0.6, R * 2, R * 1.2, R * 0.2);
      both();
      textAt(c, '100', 0, R * 0.04, `800 ${R * 0.85}px "Inter Variable", sans-serif`, INK, false, 'center');
      c.restore();
      return;
    case 'SCR-PRP-STK-014': // abstract hand wave
      c.beginPath();
      rr(c, m - R * 0.55, m - R * 0.1, R * 1.1, R * 1.05, R * 0.45);
      both();
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        rr(c, m - R * 0.55 + i * R * 0.29, m - R * 0.95 + Math.abs(i - 1.5) * R * 0.12, R * 0.24, R * 0.95, R * 0.12);
        both();
      }
      return;
    case 'SCR-PRP-STK-015': // sun
      for (let i = 0; i < 10; i++) {
        const an = (i / 10) * Math.PI * 2;
        c.beginPath();
        c.moveTo(m + Math.cos(an) * R * 0.75, m + Math.sin(an) * R * 0.75);
        c.lineTo(m + Math.cos(an) * R * 1.15, m + Math.sin(an) * R * 1.15);
        c.stroke();
      }
      c.beginPath();
      c.arc(m, m, R * 0.6, 0, Math.PI * 2);
      both();
      return;
    case 'SCR-PRP-STK-016': // raindrop
      c.beginPath();
      c.moveTo(m, m - R * 1.1);
      c.bezierCurveTo(m + R * 0.4, m - R * 0.4, m + R * 0.8, m + R * 0.1, m + R * 0.8, m + R * 0.45);
      c.arc(m, m + R * 0.45, R * 0.8, 0, Math.PI);
      c.bezierCurveTo(m - R * 0.8, m + R * 0.1, m - R * 0.4, m - R * 0.4, m, m - R * 1.1);
      both();
      return;
    case 'SCR-PRP-STK-017': // party popper
      c.beginPath();
      c.moveTo(m - R * 0.9, m + R * 1.0);
      c.lineTo(m - R * 0.25, m - R * 0.3);
      c.lineTo(m + R * 0.35, m + R * 0.35);
      c.closePath();
      both();
      c.fillStyle = b;
      for (let i = 0; i < 6; i++) {
        const an = -Math.PI / 4 + (i - 2.5) * 0.35;
        c.beginPath();
        c.arc(m + Math.cos(an) * R * (0.6 + (i % 2) * 0.4), m + Math.sin(an) * R * (0.6 + (i % 2) * 0.4) - R * 0.2, R * 0.11, 0, Math.PI * 2);
        both();
      }
      return;
    default: // flower bunch
      [[-0.45, -0.25], [0.45, -0.3], [0, 0.25]].forEach(([x, y], i) => {
        c.fillStyle = i === 1 ? b : a;
        for (let p = 0; p < 5; p++) {
          const an = (p / 5) * Math.PI * 2;
          c.beginPath();
          c.arc(m + x! * R + Math.cos(an) * R * 0.25, m + y! * R + Math.sin(an) * R * 0.25, R * 0.2, 0, Math.PI * 2);
          both();
        }
        c.fillStyle = '#ffd34d';
        c.beginPath();
        c.arc(m + x! * R, m + y! * R, R * 0.13, 0, Math.PI * 2);
        both();
      });
  }
}

// ---- notifications ----------------------------------------------------------------------------------------------------------
export type NotifId =
  | 'SCR-PRP-NTF-001' // message banner: artist as sender, an earlier line as the preview
  | 'SCR-PRP-NTF-002' // missed call (artist), for breaks after a chorus
  | 'SCR-PRP-NTF-003' // low battery: song remaining, last 10%
  | 'SCR-PRP-NTF-004' // alarm: song time, intros of morning songs
  | 'SCR-PRP-NTF-005' // now recording (voice memo)
  | 'SCR-PRP-NTF-006' // download complete: title, at the start of a song
  | 'SCR-PRP-NTF-007' // do not disturb: quiet sections
  | 'SCR-PRP-NTF-008' // calendar reminder: the chorus as an event
  | 'SCR-PRP-NTF-012'; // screenshot taken: thumbnail corner, no flash

export type Notif = { id: NotifId; title: string; body: string; atMs: number };

/** a banner w x h (units), kit-consistent, dark or light */
export function paintBanner(c: Ctx, n: Notif, w: number, h: number, dark: boolean, accent: string) {
  fillRR(c, 0, 0, w, h, Math.min(22, h / 3), dark ? 'rgba(30,33,40,0.94)' : 'rgba(250,250,252,0.95)');
  const fg = dark ? '#E9ECF1' : '#15171B';
  const dim = dark ? '#9AA1AD' : '#5F6570';
  // a plain round glyph, coloured by kind (generic shapes only)
  const gx = 30;
  const gy = h / 2;
  const glyphCol = n.id === 'SCR-PRP-NTF-003' || n.id === 'SCR-PRP-NTF-005' ? '#e5484d' : n.id === 'SCR-PRP-NTF-007' ? '#7c6cf0' : accent;
  c.fillStyle = glyphCol;
  c.beginPath();
  c.arc(gx, gy, 15, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#ffffff';
  c.lineWidth = 2;
  switch (n.id) {
    case 'SCR-PRP-NTF-003':
      c.strokeRect(gx - 8, gy - 4, 14, 8);
      c.fillRect(gx - 7, gy - 3, 3, 6);
      break;
    case 'SCR-PRP-NTF-007':
      c.beginPath();
      c.arc(gx, gy, 7, Math.PI * 0.3, Math.PI * 1.7);
      c.stroke();
      break;
    case 'SCR-PRP-NTF-005':
      c.beginPath();
      c.arc(gx, gy, 5, 0, Math.PI * 2);
      c.fill();
      break;
    case 'SCR-PRP-NTF-002':
    case 'SCR-PRP-NTF-004':
    case 'SCR-PRP-NTF-008':
      c.beginPath();
      c.arc(gx, gy, 7, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(gx, gy - 4);
      c.lineTo(gx, gy);
      c.lineTo(gx + 3, gy + 2);
      c.stroke();
      break;
    default:
      fillRR(c, gx - 7, gy - 5, 14, 10, 3, '#ffffff');
  }
  textAt(c, n.title, 56, h * 0.36, font('ui', 600, 14), fg);
  textAt(c, clock(n.atMs), w - 14, h * 0.36, font('ui', 500, 12), dim, false, 'end');
  const body = n.body.length > 46 ? `${n.body.slice(0, 44)}…` : n.body;
  textAt(c, body, 56, h * 0.68, font('ui', 400, 13.5), withA(fg, 0.85));
}
