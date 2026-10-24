// A custom vector icon set that replaces every emoji.
//
// Each icon is a handful of shapes on a 24 x 24 grid, written as plain SVG path data so the SAME artwork draws on the canvas
// (Path2D, cached into sprites) and in the React interface (<Icon/>). The style is one consistent family: soft rounded flat shapes in
// a few tones (main / dark / light), a sprinkle of white highlight, and a sticker outline added when it is drawn. Tones are derived
// from the icon's own hue pulled toward the current accent, so icons sit inside whatever palette the look has instead of
// clashing with it the way platform emoji do.

import { INDIC_ICONS } from '../lyrics/indicLexicon';
import { clamp, hexToRgb, mix, rgbToHex } from './util';

export type Role = 'main' | 'dark' | 'light' | 'white' | 'ink';
/** `s` set = stroked with that width (round caps), otherwise filled. `o` = opacity. */
export type IconPart = { d: string; r: Role; s?: number; o?: number };
export type IconDef = { /** the colour the icon wants on its own (a heart is red, a sun is yellow) */ hue: string; parts: IconPart[] };

// ---- tiny path builders (24 x 24 grid) ------------------------------------------------------------------------------------
const f = (n: number) => Math.round(n * 100) / 100;
const circle = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M${f(cx - rx)} ${f(cy)}a${rx} ${ry} 0 1 0 ${f(2 * rx)} 0a${rx} ${ry} 0 1 0 ${f(-2 * rx)} 0Z`;
const rrect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${f(x + r)} ${y}H${f(x + w - r)}A${r} ${r} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${r} ${r} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${r} ${r} 0 0 1 ${x} ${f(y + h - r)}V${f(y + r)}A${r} ${r} 0 0 1 ${f(x + r)} ${y}Z`;
const poly = (pts: number[][]) => 'M' + pts.map(([x, y]) => `${f(x!)} ${f(y!)}`).join('L') + 'Z';
const open = (pts: number[][]) => 'M' + pts.map(([x, y]) => `${f(x!)} ${f(y!)}`).join('L');
const star = (cx: number, cy: number, R: number, r: number, n: number, rot = -90) =>
  poly(Array.from({ length: n * 2 }, (_, i) => {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rad = i % 2 ? r : R;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  }));
/** a pinched four-point sparkle */
const spark = (cx: number, cy: number, R: number, k = 0.16) => `M${cx} ${f(cy - R)}Q${f(cx + R * k)} ${f(cy - R * k)} ${f(cx + R)} ${cy}Q${f(cx + R * k)} ${f(cy + R * k)} ${cx} ${f(cy + R)}Q${f(cx - R * k)} ${f(cy + R * k)} ${f(cx - R)} ${cy}Q${f(cx - R * k)} ${f(cy - R * k)} ${cx} ${f(cy - R)}Z`;
const tilted = (cx: number, cy: number, rx: number, ry: number, deg: number, n = 32) =>
  poly(Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    const a = (deg * Math.PI) / 180;
    return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
  }));
const ray = (cx: number, cy: number, r1: number, r2: number, w: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const p = (r: number, off: number) => [cx + r * c - off * s, cy + r * s + off * c];
  return poly([p(r1, -w / 2), p(r2, -w / 2), p(r2, w / 2), p(r1, w / 2)]);
};
const drop = (cx: number, top: number, w: number, h: number) => `M${cx} ${top}C${f(cx + w * 0.15)} ${f(top + h * 0.25)} ${f(cx + w)} ${f(top + h * 0.55)} ${f(cx + w)} ${f(top + h * 0.72)}A${w} ${w} 0 0 1 ${f(cx - w)} ${f(top + h * 0.72)}C${f(cx - w)} ${f(top + h * 0.55)} ${f(cx - w * 0.15)} ${f(top + h * 0.25)} ${cx} ${top}Z`;
const cloudPath = (x: number, y: number, s: number) =>
  `M${f(x + 4 * s)} ${f(y + 14 * s)}A${f(4.4 * s)} ${f(4.4 * s)} 0 0 1 ${f(x + 3.6 * s)} ${f(y + 5.4 * s)}A${f(6.2 * s)} ${f(6.2 * s)} 0 0 1 ${f(x + 15.2 * s)} ${f(y + 4.6 * s)}A${f(4.7 * s)} ${f(4.7 * s)} 0 0 1 ${f(x + 15.4 * s)} ${f(y + 14 * s)}Z`;

const RAW = {
  heart: { hue: '#ff3d6e', parts: [
    { d: 'M12 21.2C5 15.8 2.4 12.2 2.4 8.4C2.4 5.5 4.6 3.4 7.2 3.4C9.2 3.4 11 4.5 12 6.3C13 4.5 14.8 3.4 16.8 3.4C19.4 3.4 21.6 5.5 21.6 8.4C21.6 12.2 19 15.8 12 21.2Z', r: 'main' },
    { d: 'M12 21.2C19 15.8 21.6 12.2 21.6 8.4C21.6 8 21.5 7.6 21.4 7.2C20 12 15 15.6 12 17.6Z', r: 'dark', o: 0.45 },
    { d: ellipse(7.2, 7.5, 2.3, 1.5), r: 'white', o: 0.75 },
  ] },
  heartbreak: { hue: '#ff3d6e', parts: [
    { d: 'M12 21.2C5 15.8 2.4 12.2 2.4 8.4C2.4 5.5 4.6 3.4 7.2 3.4C9.2 3.4 11 4.5 12 6.3C13 4.5 14.8 3.4 16.8 3.4C19.4 3.4 21.6 5.5 21.6 8.4C21.6 12.2 19 15.8 12 21.2Z', r: 'main' },
    { d: poly([[12.6, 4.6], [10.2, 9.4], [13.6, 11.2], [10.6, 16.4], [11.6, 12.2], [8.8, 10.4], [11.4, 6.6]]), r: 'ink', o: 0.9 },
    { d: ellipse(6.8, 7.4, 2, 1.3), r: 'white', o: 0.7 },
  ] },
  flame: { hue: '#ff6a2b', parts: [
    { d: 'M12 2.2C13.2 6 18.8 8.4 18.8 14.6C18.8 18.5 15.9 21.8 12 21.8C8.1 21.8 5.2 18.5 5.2 14.6C5.2 12.2 6.5 10.5 7.8 9C8.1 10.6 8.9 11.5 10 11.8C9.5 8.5 10.1 4.8 12 2.2Z', r: 'main' },
    { d: 'M12 21.8C9.6 21.8 8 20 8 17.8C8 15.5 10 14.4 10.9 12.2C12.4 13.8 16 15.1 16 17.8C16 20 14.4 21.8 12 21.8Z', r: 'light' },
  ] },
  sun: { hue: '#ffc21a', parts: [
    ...Array.from({ length: 8 }, (_, i) => ({ d: ray(12, 12, 8.4, 11.4, 2.2, i * 45), r: 'main' as Role })),
    { d: circle(12, 12, 5.6), r: 'main' },
    { d: circle(12, 12, 5.6), r: 'light', o: 0.35 },
    { d: ellipse(10.2, 10.2, 2.1, 1.3), r: 'white', o: 0.6 },
  ] },
  moon: { hue: '#ffd75a', parts: [
    { d: 'M19.5 15.2A8.6 8.6 0 1 1 8.8 4.3A7.2 7.2 0 0 0 19.5 15.2Z', r: 'main' },
    { d: circle(8.4, 12, 1.1), r: 'dark', o: 0.28 },
    { d: circle(12.4, 16.6, 1.4), r: 'dark', o: 0.28 },
  ] },
  star: { hue: '#ffc21a', parts: [
    { d: star(12, 12.6, 10.6, 4.7, 5), r: 'main' },
    { d: poly([[12, 2], [14.2, 8.2], [12, 12.6]]), r: 'light', o: 0.55 },
  ] },
  sparkle: { hue: '#ffd75a', parts: [
    { d: spark(11, 12, 10.2), r: 'main' },
    { d: spark(19.2, 4.6, 3.6), r: 'light' },
    { d: spark(18.6, 19, 2.6), r: 'light' },
  ] },
  cloud: { hue: '#cfe6ff', parts: [
    { d: cloudPath(3, 4.2, 1.1), r: 'main' },
    { d: cloudPath(3, 4.2, 1.1), r: 'white', o: 0.35 },
    { d: ellipse(9.2, 10.2, 3, 1.5), r: 'white', o: 0.6 },
  ] },
  rain: { hue: '#8fb8ff', parts: [
    { d: cloudPath(2.6, 1.6, 1.1), r: 'main' },
    { d: drop(8, 16, 1.5, 4.8), r: 'dark' },
    { d: drop(13, 15.2, 1.5, 4.8), r: 'dark' },
    { d: drop(18, 16, 1.5, 4.8), r: 'dark' },
  ] },
  wave: { hue: '#3ab0ff', parts: [
    { d: 'M2 8.5C4.5 5.2 7 5.2 9.5 8.5S14.5 11.8 17 8.5S20.5 6.4 22 7.6', r: 'main', s: 2.6 },
    { d: 'M2 13.5C4.5 10.2 7 10.2 9.5 13.5S14.5 16.8 17 13.5S20.5 11.4 22 12.6', r: 'main', s: 2.6 },
    { d: 'M2 18.5C4.5 15.2 7 15.2 9.5 18.5S14.5 21.8 17 18.5S20.5 16.4 22 17.6', r: 'light', s: 2.6 },
  ] },
  bolt: { hue: '#ffd21a', parts: [
    { d: 'M14 1.8L4.6 13.6H10.6L9.2 22.2L19.4 9.6H13Z', r: 'main' },
    { d: 'M14 1.8L9.4 10.6L10.6 13.6H4.6Z', r: 'light', o: 0.55 },
  ] },
  eye: { hue: '#3aa8ff', parts: [
    { d: 'M1.4 12C4.4 6.6 8 5 12 5C16 5 19.6 6.6 22.6 12C19.6 17.4 16 19 12 19C8 19 4.4 17.4 1.4 12Z', r: 'white' },
    { d: circle(12, 12, 5), r: 'main' },
    { d: circle(12, 12, 2.5), r: 'ink' },
    { d: circle(13.4, 10.4, 1.15), r: 'white' },
    { d: 'M1.4 12C4.4 6.6 8 5 12 5C16 5 19.6 6.6 22.6 12', r: 'ink', s: 1.5 },
  ] },
  wing: { hue: '#f2f7ff', parts: [
    { d: 'M2.4 17.4C2.6 9.6 9 3.4 21.8 3.8C20.2 5.6 19.4 7 19 8.6C20.4 8.4 21.4 8.6 22.4 9C20.6 11.2 19 12.2 17.2 12.6C18.4 12.8 19.4 13 20.4 13C18.4 15.6 15.6 16.8 12.8 17C13.6 17.3 14.4 17.4 15.4 17.4C13 20.2 8.4 21.4 2.4 17.4Z', r: 'main' },
    { d: 'M2.4 17.4C2.6 9.6 9 3.4 21.8 3.8C16 6.2 10.6 9.8 7 17.6Z', r: 'light', o: 0.7 },
    { d: 'M6.6 15.8C10.4 11.6 15 9.6 19 8.8M7.8 17.6C11 14.8 14.4 13.4 17.2 12.8M9.4 19C11.6 17.8 13.4 17.4 15.4 17.4', r: 'dark', s: 0.9, o: 0.4 },
  ] },
  crown: { hue: '#ffc21a', parts: [
    { d: 'M2.8 18.4L2.2 6.8L8 12L12 4.6L16 12L21.8 6.8L21.2 18.4Z', r: 'main' },
    { d: rrect(2.8, 17.6, 18.4, 3.4, 1.2), r: 'dark' },
    { d: circle(12, 4.6, 1.5), r: 'light' },
    { d: circle(2.2, 6.6, 1.4), r: 'light' },
    { d: circle(21.8, 6.6, 1.4), r: 'light' },
    { d: circle(12, 14, 1.3), r: 'white', o: 0.8 },
  ] },
  diamond: { hue: '#4fd6ff', parts: [
    { d: 'M12 21.6L1.6 9.2L5.8 2.8H18.2L22.4 9.2Z', r: 'main' },
    { d: 'M5.8 2.8L8.6 9.2H1.6Z', r: 'light', o: 0.7 },
    { d: 'M18.2 2.8L15.4 9.2H22.4Z', r: 'dark', o: 0.35 },
    { d: 'M8.6 9.2L12 2.8L15.4 9.2L12 21.6Z', r: 'light', o: 0.35 },
  ] },
  car: { hue: '#ff4d4d', parts: [
    { d: 'M2.4 16V12.4C2.4 11.5 3 10.8 3.8 10.5L6.2 6.2C6.6 5.6 7.2 5.2 8 5.2H16C16.8 5.2 17.4 5.6 17.8 6.2L20.2 10.5C21 10.8 21.6 11.5 21.6 12.4V16Z', r: 'main' },
    { d: 'M7.4 10.2L8.9 7H15.1L16.6 10.2Z', r: 'white', o: 0.85 },
    { d: circle(7.2, 16.4, 2.7), r: 'ink' },
    { d: circle(16.8, 16.4, 2.7), r: 'ink' },
    { d: circle(7.2, 16.4, 1.1), r: 'light' },
    { d: circle(16.8, 16.4, 1.1), r: 'light' },
  ] },
  road: { hue: '#6a6f85', parts: [
    { d: 'M10 2.4C14 6.4 6.6 10.4 9 14.8C10.2 17.2 7 19.6 2.6 21.6H21.4C17.8 19 16 16.6 15.2 14C14 10 18 7 14 2.4Z', r: 'main' },
    { d: 'M11.8 4.6L12.2 7.2M10.4 10.4L10.6 12.6M11 16.4L10.6 19', r: 'white', s: 1.5 },
    { d: 'M10 2.4C14 6.4 6.6 10.4 9 14.8', r: 'dark', s: 1, o: 0.5 },
  ] },
  clock: { hue: '#ffffff', parts: [
    { d: circle(12, 12, 9.4), r: 'white' },
    { d: circle(12, 12, 9.4), r: 'main', s: 2.4 },
    { d: open([[12, 6.2], [12, 12], [16, 14.4]]), r: 'ink', s: 1.9 },
  ] },
  note: { hue: '#a06bff', parts: [
    { d: 'M9 4.6L20 2.6V16.8', r: 'main', s: 2.4 },
    { d: poly([[8.2, 5.2], [20.6, 2.8], [20.6, 7], [8.2, 9.4]]), r: 'main' },
    { d: 'M9 4.6V17.4', r: 'main', s: 2.4 },
    { d: ellipse(5.6, 18, 3.9, 3), r: 'main' },
    { d: ellipse(16.6, 17, 3.9, 3), r: 'main' },
    { d: ellipse(4.6, 17.2, 1.3, 0.9), r: 'white', o: 0.6 },
  ] },
  mic: { hue: '#ff4d8d', parts: [
    { d: rrect(8.4, 2.4, 7.2, 12.2, 3.6), r: 'main' },
    { d: 'M5.4 11.4C5.4 15.2 8.2 17.6 12 17.6C15.8 17.6 18.6 15.2 18.6 11.4', r: 'dark', s: 1.9 },
    { d: 'M12 17.6V21.4', r: 'dark', s: 1.9 },
    { d: 'M8.4 21.6H15.6', r: 'dark', s: 1.9 },
    { d: 'M9.4 7H14.6M9.4 10H14.6', r: 'white', s: 1, o: 0.55 },
  ] },
  flower: { hue: '#ff6fb1', parts: [
    ...Array.from({ length: 5 }, (_, i) => {
      const a = (-90 + i * 72) * (Math.PI / 180);
      return { d: circle(12 + 5.4 * Math.cos(a), 12 + 5.4 * Math.sin(a), 4.1), r: 'main' as Role };
    }),
    { d: circle(12, 12, 3.4), r: 'light' },
    { d: circle(11.2, 11.2, 1.1), r: 'white', o: 0.7 },
  ] },
  ghost: { hue: '#f4f1ff', parts: [
    { d: 'M4.6 21.4V11.4A7.4 7.4 0 0 1 19.4 11.4V21.4L16.8 18.8L14.4 21.4L12 18.8L9.6 21.4L7.2 18.8Z', r: 'main' },
    { d: ellipse(9.4, 11, 1.3, 1.9), r: 'ink' },
    { d: ellipse(14.6, 11, 1.3, 1.9), r: 'ink' },
    { d: ellipse(7.6, 6.4, 1.8, 1.1), r: 'white', o: 0.7 },
  ] },
  skull: { hue: '#f4f1ff', parts: [
    { d: 'M12 2.4C7 2.4 3.8 5.9 3.8 10C3.8 12.6 5 14.3 6.8 15.4V19.4H17.2V15.4C19 14.3 20.2 12.6 20.2 10C20.2 5.9 17 2.4 12 2.4Z', r: 'main' },
    { d: ellipse(8.6, 10.2, 2.3, 2.7), r: 'ink' },
    { d: ellipse(15.4, 10.2, 2.3, 2.7), r: 'ink' },
    { d: poly([[12, 12.6], [10.8, 15], [13.2, 15]]), r: 'ink' },
    { d: 'M9.6 16.4V19.4M12 16.4V19.4M14.4 16.4V19.4', r: 'ink', s: 1.1, o: 0.7 },
  ] },
  cash: { hue: '#38c776', parts: [
    { d: rrect(1.8, 5.2, 20.4, 13.6, 2.4), r: 'main' },
    { d: rrect(1.8, 5.2, 20.4, 13.6, 2.4), r: 'dark', s: 1.2, o: 0.5 },
    { d: circle(12, 12, 3.7), r: 'light' },
    { d: circle(12, 12, 3.7), r: 'dark', s: 1.1, o: 0.5 },
    { d: circle(5.4, 9, 1), r: 'light' },
    { d: circle(18.6, 15, 1), r: 'light' },
  ] },
  glass: { hue: '#ffd75a', parts: [
    { d: 'M3.2 3.6H20.8L12 13.6Z', r: 'white', o: 0.9 },
    { d: 'M5.6 6.4H18.4L12 13.6Z', r: 'main', o: 0.85 },
    { d: 'M12 13.6V20', r: 'white', s: 1.8 },
    { d: ellipse(12, 20.8, 4.6, 1.2), r: 'white' },
    { d: circle(16.4, 4.4, 1.5), r: 'light' },
  ] },
  city: { hue: '#4b4f8a', parts: [
    { d: rrect(2.2, 9.4, 5.2, 12, 0.9), r: 'main' },
    { d: rrect(8.4, 3.6, 6.2, 17.8, 0.9), r: 'dark' },
    { d: rrect(15.6, 7.6, 6.2, 13.8, 0.9), r: 'main' },
    ...[[10.2, 7], [12.2, 7], [10.2, 10.4], [12.2, 10.4], [10.2, 13.8], [12.2, 13.8], [17.4, 11], [19.6, 11], [17.4, 14.4], [19.6, 14.4], [3.6, 13], [5.2, 13]].map(([x, y]) => ({ d: rrect(x! - 0.5, y! - 0.7, 1.1, 1.5, 0.3), r: 'light' as Role })),
  ] },
  signal: { hue: '#38d6ff', parts: [
    { d: circle(12, 14.4, 2.1), r: 'main' },
    { d: 'M7.6 10C9.8 7.8 14.2 7.8 16.4 10', r: 'main', s: 2 },
    { d: 'M4.4 6.8C8.6 2.8 15.4 2.8 19.6 6.8', r: 'main', s: 2 },
    { d: 'M12 16.6V21', r: 'dark', s: 2 },
  ] },
  snowflake: { hue: '#bfe6ff', parts: [
    { d: 'M12 2.4V21.6M3.7 7.2L20.3 16.8M3.7 16.8L20.3 7.2', r: 'main', s: 2 },
    { d: 'M9.6 4L12 6.4L14.4 4M9.6 20L12 17.6L14.4 20', r: 'main', s: 1.6 },
    { d: circle(12, 12, 1.8), r: 'white' },
  ] },
  wind: { hue: '#9ddcff', parts: [
    { d: 'M2.4 9H14.2A3.2 3.2 0 1 0 11.4 4.4', r: 'main', s: 2.2 },
    { d: 'M2.4 14H17.4A3.4 3.4 0 1 1 14.4 19.2', r: 'main', s: 2.2 },
    { d: 'M2.4 11.5H9', r: 'light', s: 2.2 },
  ] },
  storm: { hue: '#7d86a8', parts: [
    { d: cloudPath(2.6, 1.4, 1.1), r: 'main' },
    { d: 'M13.2 11.2L9.4 17.4H12.8L11.4 22.2L16.6 15.4H13.2Z', r: 'light' },
  ] },
  hand: { hue: '#ffc9a0', parts: [
    { d: rrect(4.6, 11, 12.2, 10.8, 5), r: 'main' },
    { d: rrect(5, 3.6, 3, 11, 1.5), r: 'main' },
    { d: rrect(8.6, 2.4, 3, 12, 1.5), r: 'main' },
    { d: rrect(12.2, 3.2, 3, 11.4, 1.5), r: 'main' },
    { d: rrect(15.4, 5.4, 2.9, 9.4, 1.45), r: 'main' },
    { d: tilted(5, 13.8, 3.8, 1.55, -38), r: 'main' },
    { d: 'M8.4 12.4V8M11.8 12.4V7M15.2 12.4V8', r: 'dark', s: 0.9, o: 0.25 },
  ] },
  house: { hue: '#ff7a59', parts: [
    { d: 'M4.6 11.4H19.4V21H4.6Z', r: 'main' },
    { d: 'M1.8 12L12 2.6L22.2 12L20.6 13.4L12 5.6L3.4 13.4Z', r: 'dark' },
    { d: rrect(9.6, 14.4, 4.8, 6.6, 1.2), r: 'ink' },
    { d: rrect(15.4, 4.2, 2.4, 4, 0.6), r: 'dark' },
  ] },
  planet: { hue: '#ff9a3d', parts: [
    { d: tilted(12, 12, 11, 3.6, -22), r: 'dark', s: 1.5, o: 0.9 },
    { d: circle(12, 12, 6.2), r: 'main' },
    { d: 'M7 8.4C9.4 9.4 13.6 9.2 17 7.4', r: 'dark', s: 1, o: 0.35 },
    { d: ellipse(9.6, 9.4, 2, 1.2), r: 'white', o: 0.5 },
    { d: 'M2.6 14.2C5.4 16 10.2 15.4 14 13.4', r: 'dark', s: 1.5, o: 0.9 },
  ] },
  link: { hue: '#c0c4d8', parts: [
    { d: tilted(8.6, 15.2, 6, 3.3, -45), r: 'main', s: 2.4 },
    { d: tilted(15.4, 8.8, 6, 3.3, -45), r: 'light', s: 2.4 },
  ] },
  tear: { hue: '#4aa8ff', parts: [
    { d: drop(12, 2.2, 6.4, 19.2), r: 'main' },
    { d: 'M12 21.4A6.4 6.4 0 0 0 18.4 15C18.4 12 15.8 8.2 12 4Z', r: 'dark', o: 0.3 },
    { d: ellipse(9.4, 14.4, 1.3, 2.4), r: 'white', o: 0.65 },
  ] },
  'face-smile': { hue: '#ffcf2e', parts: [
    { d: circle(12, 12, 10), r: 'main' },
    { d: ellipse(8.6, 9.8, 1.3, 1.8), r: 'ink' },
    { d: ellipse(15.4, 9.8, 1.3, 1.8), r: 'ink' },
    { d: 'M6.8 14C8.2 17.4 15.8 17.4 17.2 14', r: 'ink', s: 1.9 },
  ] },
  'face-sad': { hue: '#ffcf2e', parts: [
    { d: circle(12, 12, 10), r: 'main' },
    { d: ellipse(8.6, 10, 1.3, 1.8), r: 'ink' },
    { d: ellipse(15.4, 10, 1.3, 1.8), r: 'ink' },
    { d: 'M7.4 17.4C9 14.2 15 14.2 16.6 17.4', r: 'ink', s: 1.9 },
    { d: drop(19, 11.6, 1.4, 4.6), r: 'light' },
  ] },
  'face-angry': { hue: '#ff6a4d', parts: [
    { d: circle(12, 12, 10), r: 'main' },
    { d: 'M5.8 7.4L10.2 9.4M18.2 7.4L13.8 9.4', r: 'ink', s: 2 },
    { d: ellipse(8.6, 11.4, 1.2, 1.5), r: 'ink' },
    { d: ellipse(15.4, 11.4, 1.2, 1.5), r: 'ink' },
    { d: 'M7.8 17.4C9.4 14.8 14.6 14.8 16.2 17.4', r: 'ink', s: 1.9 },
  ] },
  cassette: { hue: '#ff9a3d', parts: [
    { d: rrect(1.8, 4.6, 20.4, 14.8, 2.2), r: 'main' },
    { d: rrect(4.6, 7, 14.8, 6.4, 1.2), r: 'white' },
    { d: circle(8.8, 10.2, 1.9), r: 'dark' },
    { d: circle(15.2, 10.2, 1.9), r: 'dark' },
    { d: poly([[6.4, 19.4], [8.2, 14.8], [15.8, 14.8], [17.6, 19.4]]), r: 'dark', o: 0.8 },
    { d: circle(9.4, 17.1, 0.8), r: 'light' },
    { d: circle(14.6, 17.1, 0.8), r: 'light' },
  ] },
  camera: { hue: '#8d8fa8', parts: [
    { d: rrect(1.8, 6.6, 20.4, 13.4, 2.6), r: 'main' },
    { d: rrect(7.4, 3.6, 6.4, 4.4, 1.2), r: 'main' },
    { d: circle(12, 13.4, 5), r: 'white' },
    { d: circle(12, 13.4, 3.3), r: 'ink' },
    { d: circle(13.2, 12.2, 1), r: 'white' },
    { d: circle(19, 9.6, 1), r: 'light' },
  ] },
  leaf: { hue: '#ffa13d', parts: [
    { d: 'M20.6 3.4C9.6 3.4 3.8 9 3.8 16.2C3.8 17.8 4.1 19 4.6 20C5.6 20.4 6.9 20.6 8.4 20.6C15.6 20.6 20.6 15 20.6 3.4Z', r: 'main' },
    { d: 'M4 20.4C8 14 12.4 10 18 7', r: 'dark', s: 1.3, o: 0.55 },
  ] },
  key: { hue: '#ffc21a', parts: [
    { d: circle(7.6, 8, 5.2), r: 'main' },
    { d: circle(7.6, 8, 2), r: 'ink', o: 0.55 },
    { d: 'M11.4 11.8L20.6 21', r: 'main', s: 3 },
    { d: 'M16.4 16.6L19.2 13.8M18.8 19.2L21.4 16.6', r: 'main', s: 2.4 },
  ] },
  rocket: { hue: '#ff5a5a', parts: [
    { d: 'M12 1.8C16 5 17.6 9.4 17 15.2H7C6.4 9.4 8 5 12 1.8Z', r: 'white' },
    { d: 'M12 1.8C14 3.4 15.4 5.4 16 7.6H8C8.6 5.4 10 3.4 12 1.8Z', r: 'main' },
    { d: circle(12, 10.8, 2), r: 'dark' },
    { d: 'M7 11.4L3.2 16.4L7.4 15.4Z', r: 'main' },
    { d: 'M17 11.4L20.8 16.4L16.6 15.4Z', r: 'main' },
    { d: 'M9.4 16.4C9.4 19 11 21 12 22C13 21 14.6 19 14.6 16.4Z', r: 'light' },
  ] },
  party: { hue: '#ff6fb1', parts: [
    { d: 'M2.6 21.4L8.4 7L17 15.6Z', r: 'main' },
    { d: 'M5.4 14.4L10.8 9.6M3.8 18.4L14 12', r: 'white', s: 1.2, o: 0.6 },
    { d: spark(17.4, 5.6, 3.4), r: 'light' },
    { d: circle(20.4, 12.2, 1.2), r: 'main' },
    { d: circle(12.6, 3.4, 1.1), r: 'main' },
    { d: rrect(15.4, 17, 4.4, 1.7, 0.8), r: 'light' },
  ] },
  bulb: { hue: '#ffd21a', parts: [
    { d: 'M12 2C7.8 2 5 5 5 8.8C5 11.4 6.4 12.8 7.6 14.2C8.4 15.2 8.6 15.8 8.6 16.8H15.4C15.4 15.8 15.6 15.2 16.4 14.2C17.6 12.8 19 11.4 19 8.8C19 5 16.2 2 12 2Z', r: 'main' },
    { d: rrect(8.8, 17.6, 6.4, 2, 1), r: 'dark' },
    { d: rrect(9.8, 20, 4.4, 1.8, 0.9), r: 'dark' },
    { d: ellipse(9.4, 7, 1.8, 1.2), r: 'white', o: 0.7 },
  ] },
  tv: { hue: '#5ad1ff', parts: [
    { d: 'M7 3.4L12 7.2L17 3.4', r: 'ink', s: 1.6 },
    { d: rrect(2.2, 7, 19.6, 13.6, 2.6), r: 'dark' },
    { d: rrect(4, 8.8, 16, 10, 1.6), r: 'main' },
    ...[[7, 11], [10.4, 14], [13.4, 11.4], [16.6, 15], [8, 16.4], [15.6, 11]].map(([x, y]) => ({ d: rrect(x! - 0.9, y! - 0.5, 1.8, 1, 0.3), r: 'white' as Role, o: 0.8 })),
  ] },
  page: { hue: '#ffffff', parts: [
    { d: 'M5.6 2.6H14.4L19.4 7.6V21.4H5.6Z', r: 'white' },
    { d: 'M14.4 2.6V7.6H19.4Z', r: 'light', o: 0.9 },
    { d: 'M8.4 11.6H16.6M8.4 14.8H16.6M8.4 18H13.4', r: 'main', s: 1.4 },
  ] },
  burst: { hue: '#ffc21a', parts: [
    { d: star(12, 12, 11.2, 6.2, 11, -90), r: 'main' },
    { d: star(12, 12, 6.8, 3.6, 11, -80), r: 'light', o: 0.7 },
  ] },
} satisfies Record<string, IconDef>;

export type IconId = keyof typeof RAW;
export const ICONS: Record<IconId, IconDef> = RAW;
export const ICON_IDS = Object.keys(ICONS) as IconId[];

// ---- words → icons ---------------------------------------------------------------------------------------------------------
const WORD_ICON: Record<string, IconId> = {
  love: 'heart', heart: 'heart', hearts: 'heart', kiss: 'heart', baby: 'heart', darling: 'heart', lover: 'heart', adore: 'heart', romance: 'heart', angel: 'wing', heaven: 'wing',
  broken: 'heartbreak', break: 'heartbreak', heartbreak: 'heartbreak', goodbye: 'heartbreak',
  fire: 'flame', burn: 'flame', flame: 'flame', hot: 'flame',
  sun: 'sun', sunshine: 'sun', summer: 'sun', sunrise: 'sun', morning: 'sun',
  moon: 'moon', night: 'moon', midnight: 'moon', dark: 'moon', shadow: 'ghost', ghost: 'ghost', alone: 'ghost', lonely: 'ghost', ghosts: 'ghost',
  star: 'star', stars: 'star', gold: 'sparkle', golden: 'sparkle', lights: 'sparkle', shine: 'sparkle', glow: 'sparkle', magic: 'sparkle', diamond: 'diamond', diamonds: 'diamond', crown: 'crown', king: 'crown', queen: 'crown',
  cloud: 'cloud', clouds: 'cloud', sky: 'cloud', skies: 'cloud', dream: 'cloud', dreams: 'cloud', dreaming: 'cloud', float: 'cloud',
  rain: 'rain', raining: 'rain', storm: 'storm', thunder: 'bolt', lightning: 'bolt', electric: 'bolt', fast: 'bolt', power: 'bolt', energy: 'bolt',
  ocean: 'wave', sea: 'wave', wave: 'wave', waves: 'wave', water: 'wave', river: 'wave', drown: 'wave',
  eye: 'eye', eyes: 'eye', look: 'eye', watch: 'eye', see: 'eye', show: 'eye', seen: 'eye',
  wing: 'wing', wings: 'wing', fly: 'wing', flying: 'wing', free: 'wing', freedom: 'wing', soar: 'wing',
  car: 'car', drive: 'car', driving: 'car', ride: 'car', road: 'road', highway: 'road', street: 'road', streets: 'road',
  time: 'clock', hours: 'clock', hour: 'clock', clock: 'clock', minutes: 'clock', forever: 'clock', yesterday: 'clock', tonight: 'moon',
  music: 'note', song: 'note', songs: 'note', sing: 'mic', singing: 'mic', mic: 'mic', voice: 'mic', dance: 'note', dancing: 'note', beat: 'note', radio: 'note', guitar: 'note',
  flower: 'flower', flowers: 'flower', rose: 'flower', roses: 'flower', garden: 'flower', bloom: 'flower',
  money: 'cash', cash: 'cash', paid: 'cash', rich: 'cash', bank: 'cash', dollar: 'cash', dollars: 'cash',
  glass: 'glass', drink: 'glass', drinks: 'glass', champagne: 'glass', party: 'party', celebrate: 'party', celebration: 'party',
  city: 'city', neon: 'city', town: 'city', downtown: 'city', skyline: 'city', buildings: 'city',
  signal: 'signal', static: 'tv', tv: 'tv', screen: 'tv', channel: 'tv',
  snow: 'snowflake', ice: 'snowflake', cold: 'snowflake', frozen: 'snowflake', winter: 'snowflake',
  wind: 'wind', breeze: 'wind', blow: 'wind', blowing: 'wind',
  hand: 'hand', hands: 'hand', hold: 'hand', catch: 'hand', touch: 'hand', grab: 'hand',
  home: 'house', house: 'house', door: 'house',
  planet: 'planet', planets: 'planet', orbit: 'planet', space: 'planet', world: 'planet', earth: 'planet',
  chain: 'link', chains: 'link', link: 'link', together: 'link', tied: 'link',
  cry: 'tear', crying: 'tear', tears: 'tear', tear: 'tear', sad: 'face-sad', hurt: 'tear',
  smile: 'face-smile', smiling: 'face-smile', laugh: 'face-smile', happy: 'face-smile', joy: 'face-smile', fun: 'face-smile',
  angry: 'face-angry', rage: 'face-angry', mad: 'face-angry', hate: 'face-angry',
  tape: 'cassette', cassette: 'cassette', record: 'cassette', camera: 'camera', photograph: 'camera', photo: 'camera', picture: 'camera', pictures: 'camera',
  leaf: 'leaf', leaves: 'leaf', fall: 'leaf', autumn: 'leaf',
  key: 'key', keys: 'key', lock: 'key', unlock: 'key',
  rocket: 'rocket', launch: 'rocket', high: 'rocket', up: 'rocket',
  light: 'bulb', idea: 'bulb', bright: 'bulb',
  paper: 'page', page: 'page', letter: 'page', letters: 'page', book: 'page', words: 'page', write: 'page', wrote: 'page',
  boom: 'burst', hit: 'burst', crash: 'burst', explode: 'burst', blast: 'burst',
  skull: 'skull', death: 'skull', dead: 'skull', die: 'skull', grave: 'skull', demon: 'skull', devil: 'skull',
};

// Hindi and Tamil words (native script and romanised)
Object.assign(WORD_ICON, INDIC_ICONS);

/** The icon that goes with a lyric word, or null (most words have none). */
export function iconForWord(word: string): IconId | null {
  const w = word.toLowerCase().replace(/[^\p{L}\p{M}']/gu, '');
  return WORD_ICON[w] ?? null;
}

// ---- colouring ----------------------------------------------------------------------------------------------------------------
export type IconColors = Record<Role, string>;

const sat = (hex: string, k: number) => {
  const [r, g, b] = hexToRgb(hex);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return rgbToHex(clamp(l + (r - l) * k, 0, 255), clamp(l + (g - l) * k, 0, 255), clamp(l + (b - l) * k, 0, 255));
};

/**
 * Tones for one icon: its own hue, pulled `pull` of the way toward the current accent (so the set belongs to the look), then a
 * darker and a lighter shade. `dark` = the stage is dark (white sticker edge) so shades keep their contrast.
 */
export function iconColors(id: IconId, accent: string, pull = 0.18, ink = '#1b1626'): IconColors {
  const hue = ICONS[id].hue;
  const main = sat(mix(hue, accent, pull), 1.05);
  return { main, dark: mix(main, '#000000', 0.34), light: mix(main, '#ffffff', 0.5), white: '#ffffff', ink };
}

export const iconKey = (id: IconId, colors: IconColors) => `${id}|${colors.main}|${colors.ink}`;

// ---- canvas drawing ------------------------------------------------------------------------------------------------------------
const path2d = new Map<string, Path2D>();
const p2d = (d: string) => {
  let p = path2d.get(d);
  if (!p) {
    p = new Path2D(d);
    path2d.set(d, p);
  }
  return p;
};

/**
 * Draw an icon centred at (0,0) at `size` px, as a sticker: a thick pale edge underneath, then the shapes. Sprite-friendly: call it once
 * into a canvas and blit (see render.ts).
 */
export function drawIcon(ctx: CanvasRenderingContext2D, id: IconId, size: number, colors: IconColors, edge: string | null = '#ffffff') {
  const def = ICONS[id];
  const k = size / 24;
  ctx.save();
  ctx.translate(-size / 2, -size / 2);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (edge) {
    ctx.strokeStyle = edge;
    ctx.fillStyle = edge;
    ctx.lineWidth = 2.6;
    for (const part of def.parts) {
      if (part.o !== undefined && part.o < 0.5 && !part.s) continue;
      const p = p2d(part.d);
      ctx.lineWidth = part.s ? part.s + 2.6 : 2.6;
      ctx.stroke(p);
      if (!part.s) ctx.fill(p);
    }
  }
  for (const part of def.parts) {
    const p = p2d(part.d);
    ctx.globalAlpha = part.o ?? 1;
    if (part.s) {
      ctx.strokeStyle = colors[part.r];
      ctx.lineWidth = part.s;
      ctx.stroke(p);
    } else {
      ctx.fillStyle = colors[part.r];
      ctx.fill(p);
    }
  }
  ctx.restore();
}
