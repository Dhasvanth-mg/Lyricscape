// SKC-OBJ-DRK: the dark register. Loss, anger and rawness drawn with objects, not symbols of death or violence (the review
// rejected skulls, guns and nooses). Drawn looser than the cute register, with hatching instead of spot fills, so it reads
// as a sketchbook at 2 a.m. Used only when the song's identity is dark (rules.ts), mostly on black paper with white pen.

import type { Drawing } from './types';

export const DARK: Record<string, Drawing> = {
  'SKC-OBJ-DRK-001': {
    name: 'Stitched broken heart',
    tags: ['heart', 'broken', 'break', 'hurt', 'love'],
    draw(p) {
      p.curve([[0, -20], [16, -38], [38, -24], [30, 4], [0, 34], [-30, 4], [-38, -24], [-16, -38]], { closed: true, w: 1.2 });
      p.line([0, -20], [-6, -6], [6, 4], [-4, 16], [0, 34]);
      for (let i = 0; i < 5; i++) p.line([-7 + (i % 2) * 2, -14 + i * 9], [7 + (i % 2) * 2, -12 + i * 9]);
      p.hatchIn([[-30, 4], [-38, -24], [-16, -38], [0, -20], [-6, -6], [6, 4], [-4, 16], [0, 34]], 4.5, -0.7);
    },
  },
  'SKC-OBJ-DRK-002': {
    name: 'Rain cloud over a small house',
    tags: ['rain', 'home', 'house', 'storm', 'grey'],
    draw(p) {
      p.curve([[-34, -18], [-36, -32], [-20, -38], [-8, -46], [12, -44], [20, -34], [36, -32], [36, -18]], { closed: true, fill: 'shade' });
      for (let i = 0; i < 7; i++) p.line([-30 + i * 10, -12], [-34 + i * 10, -2]);
      p.rect(-14, 14, 28, 26);
      p.poly([[-20, 16], [0, 0], [20, 16]], { closed: false, w: 1.2 });
      p.rect(-4, 26, 8, 14, { fill: 'ink' });
      p.line([-46, 40], [46, 40]);
    },
  },
  'SKC-OBJ-DRK-003': {
    name: 'Empty chair',
    tags: ['alone', 'gone', 'empty', 'missing', 'chair', 'wait'],
    draw(p) {
      p.line([-16, -40], [-16, 40]);
      p.line([-16, 4], [18, 4], [18, 40]);
      p.line([-16, -40], [-8, -40], [-8, 4]);
      p.line([-2, 4], [-2, 40]);
      p.line([-16, -24], [-8, -24]);
      p.line([-16, -10], [-8, -10]);
      p.hatch(-30, 40, 60, 6, 4, 0);
      p.ellipse(4, 42, 32, 4, { stroke: 'shade' });
    },
  },
  'SKC-OBJ-DRK-004': {
    name: 'Wilted flower in a glass',
    tags: ['flower', 'dying', 'wilt', 'fade', 'old'],
    draw(p) {
      p.poly([[-14, 0], [-12, 40], [12, 40], [14, 0]], { closed: false });
      p.line([-14, 14], [14, 14]);
      p.curve([[0, 30], [2, -2], [8, -26], [22, -30], [30, -18]], { closed: false, w: 1.1 });
      p.ellipse(30, -10, 7, 10, { stroke: 'ink' });
      p.curve([[26, -2], [24, 10], [28, 18]], { closed: false });
      p.curve([[8, -14], [-8, -18], [-10, -8]], { closed: false });
      p.hatch(-12, 16, 24, 23, 4, 0.6);
    },
  },
  'SKC-OBJ-DRK-005': {
    name: 'Burnt-out candle',
    tags: ['candle', 'out', 'over', 'end', 'burn', 'dark'],
    draw(p) {
      p.curve([[-12, 40], [-12, -6], [-6, -10], [2, -4], [10, -10], [12, -6], [12, 40]], { closed: false, w: 1.2 });
      p.curve([[4, -6], [6, 8], [4, 14]], { closed: false });
      p.line([0, -8], [1, -18]);
      p.squiggle(2, -20, 26, 4, 'shade');
      p.ellipse(0, 40, 26, 5);
      p.hatch(-12, 0, 8, 38, 4, 1.4);
    },
  },
  'SKC-OBJ-DRK-006': {
    name: 'Cracked phone screen',
    tags: ['phone', 'call', 'text', 'broken', 'screen', 'message'],
    draw(p) {
      p.rect(-20, -40, 40, 80, { w: 1.2 });
      p.rect(-15, -32, 30, 62);
      p.line([4, -18], [-6, -4], [4, 6], [-10, 22]);
      p.line([-6, -4], [-15, -8]);
      p.line([4, 6], [15, 12]);
      p.line([4, -18], [12, -32]);
      p.circle(0, 35, 2.5);
    },
  },
  'SKC-OBJ-DRK-007': {
    name: 'Key without a lock',
    tags: ['key', 'lock', 'door', 'open', 'lost'],
    draw(p) {
      p.circle(-24, 0, 12, { w: 1.2 });
      p.circle(-24, 0, 4);
      p.line([-12, 0], [36, 0]);
      p.line([26, 0], [26, 10]);
      p.line([32, 0], [32, 8]);
      p.line([-44, 30], [-30, 30]);
      p.line([30, 34], [44, 34]);
    },
  },
  'SKC-OBJ-DRK-008': {
    name: 'Closed door with light under it',
    tags: ['door', 'closed', 'room', 'outside', 'wait'],
    draw(p) {
      p.rect(-22, -44, 44, 84, { w: 1.2 });
      p.rect(-15, -36, 30, 30);
      p.rect(-15, 0, 30, 32);
      p.dot(15, 6, 2.5);
      p.hatch(-46, -44, 24, 84, 4, 0.9);
      p.hatch(22, -44, 24, 84, 4, 0.9);
      p.poly([[-22, 40], [22, 40], [40, 48], [-40, 48]], { fill: 'accent', stroke: null });
    },
  },
  'SKC-OBJ-DRK-009': {
    name: 'Raven on a wire',
    tags: ['bird', 'raven', 'crow', 'wire', 'wait', 'black'],
    draw(p) {
      p.curve([[-48, 16], [0, 22], [48, 14]], { closed: false });
      p.curve([[-8, 18], [-14, 4], [-10, -12], [2, -18], [10, -16], [16, -10], [10, -6], [12, 6], [4, 18]], { fill: 'ink' });
      p.poly([[16, -10], [24, -8], [15, -6]], { fill: 'ink' });
      p.poly([[-12, 4], [-26, 10], [-12, 12]], { fill: 'ink' });
      p.line([-2, 18], [-2, 22]);
      p.line([2, 18], [3, 22]);
      p.dot(9, -12, 1.4, 'paper');
    },
  },
  'SKC-OBJ-DRK-010': {
    name: 'Moth at a bulb',
    tags: ['light', 'moth', 'bulb', 'drawn', 'night'],
    draw(p) {
      p.line([0, -48], [0, -30]);
      p.rect(-6, -30, 12, 8);
      p.curve([[-6, -22], [-16, -10], [-12, 6], [0, 12], [12, 6], [16, -10], [6, -22]], { closed: false, w: 1.1 });
      p.rays(0, -6, 22, 30, 8, 0.3, 'shade');
      p.ellipse(28, 20, 8, 5, { fill: 'shade' });
      p.ellipse(20, 26, 8, 5, { fill: 'shade' });
      p.line([24, 23], [30, 30]);
    },
  },
  'SKC-OBJ-DRK-011': {
    name: 'Storm over the sea',
    tags: ['storm', 'sea', 'wave', 'thunder', 'ocean'],
    draw(p) {
      p.curve([[-44, -20], [-40, -36], [-20, -40], [0, -46], [20, -40], [40, -38], [44, -20]], { closed: true, fill: 'shade' });
      p.poly([[4, -20], [-6, 2], [2, 2], [-4, 18]], { closed: false, stroke: 'accent', w: 1.3 });
      for (let k = 0; k < 3; k++) p.curve([[-46, 20 + k * 10], [-30, 14 + k * 10], [-14, 22 + k * 10], [2, 14 + k * 10], [18, 22 + k * 10], [34, 14 + k * 10], [46, 20 + k * 10]], { closed: false });
    },
  },
  'SKC-OBJ-DRK-012': {
    name: 'Single bare tree',
    tags: ['tree', 'winter', 'cold', 'alone', 'bare'],
    draw(p) {
      p.line([0, 42], [-2, 10], [0, -10]);
      p.line([-2, 10], [-22, -10], [-30, -28]);
      p.line([-22, -10], [-34, -12]);
      p.line([0, -10], [8, -30], [6, -44]);
      p.line([8, -30], [24, -38]);
      p.line([-1, 0], [20, -12], [34, -16]);
      p.line([20, -12], [28, -26]);
      p.line([-40, 42], [40, 42]);
    },
  },
  'SKC-OBJ-DRK-013': {
    name: 'Clock with no hands',
    tags: ['time', 'clock', 'wait', 'stuck', 'hours'],
    draw(p) {
      p.circle(0, 0, 34, { w: 1.2 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        p.line([Math.cos(a) * 28, Math.sin(a) * 28], [Math.cos(a) * 32, Math.sin(a) * 32]);
      }
      p.dot(0, 0, 2.5);
    },
  },
  'SKC-OBJ-DRK-014': {
    name: 'Torn photograph outline (no image)',
    tags: ['photo', 'picture', 'memory', 'torn', 'us'],
    draw(p) {
      p.poly([[-34, -30], [4, -30], [-2, -16], [6, -2], [-4, 10], [4, 30], [-34, 30]], { closed: true, w: 1.2 });
      p.poly([[12, -30], [36, -30], [36, 30], [12, 30], [18, 12], [10, -2], [16, -16]], { closed: true, w: 1.2 });
      p.rect(-28, -24, 26, 40, { stroke: 'shade' });
      p.hatch(18, -24, 12, 40, 4, -0.7);
    },
  },
  'SKC-OBJ-DRK-015': {
    name: 'Hand letting go of a balloon',
    tags: ['balloon', 'let', 'go', 'goodbye', 'away', 'release'],
    draw(p) {
      p.ellipse(18, -26, 14, 17, { fill: 'accent' });
      p.poly([[16, -9], [20, -9], [18, -5]], { fill: 'ink' });
      p.curve([[18, -5], [12, 8], [16, 18], [8, 28]], { closed: false, stroke: 'shade' });
      p.curve([[-40, 40], [-30, 24], [-16, 22], [-6, 28], [-12, 34], [-24, 34], [-28, 44]], { closed: false, w: 1.1 });
      p.line([-16, 22], [-8, 14]);
      p.line([-10, 24], [-2, 18]);
    },
  },
  'SKC-OBJ-DRK-016': {
    name: 'Footprints walking away',
    tags: ['walk', 'away', 'leave', 'left', 'steps', 'gone'],
    draw(p) {
      for (let i = 0; i < 5; i++) {
        const x = -30 + i * 14 + (i % 2) * 6;
        const y = 34 - i * 18;
        const s = 1 - i * 0.12;
        p.ellipse(x, y, 4 * s, 7 * s, { fill: 'ink' });
        p.dot(x - 2 * s, y - 10 * s, 1.6 * s);
        p.dot(x + 2 * s, y - 10 * s, 1.6 * s);
      }
    },
  },
  'SKC-OBJ-DRK-017': {
    name: 'Smoke from an extinguished match',
    tags: ['smoke', 'match', 'out', 'over', 'fire'],
    draw(p) {
      p.line([-10, 40], [8, -2]);
      p.ellipse(9, -5, 4, 5, { fill: 'ink' });
      p.squiggle(10, -12, 36, 6, 'shade');
      p.squiggle(16, -16, 26, 4, 'shade');
    },
  },
  'SKC-OBJ-DRK-018': {
    name: 'Paper boat sinking',
    tags: ['boat', 'sink', 'sea', 'drown', 'water', 'paper'],
    draw(p) {
      p.poly([[-26, -4], [24, 6], [14, 18], [-20, 10]], { closed: true, w: 1.1 });
      p.poly([[-6, 0], [2, -26], [10, 4]], { closed: false });
      p.curve([[-46, 10], [-30, 4], [-14, 12], [2, 4], [18, 12], [34, 4], [46, 10]], { closed: false, w: 1.2 });
      p.hatch(-46, 12, 92, 30, 5, 0);
      p.circle(-30, 28, 2);
      p.circle(-24, 20, 3);
    },
  },
  'SKC-OBJ-DRK-019': {
    name: 'Fist',
    tags: ['fight', 'fist', 'angry', 'strong', 'rise', 'power'],
    draw(p) {
      p.curve([[-22, 6], [-24, -14], [-14, -22], [14, -22], [22, -14], [22, 8], [12, 18], [-14, 18]], { closed: true, w: 1.3 });
      for (const x of [-12, -2, 8]) p.line([x, -22], [x + 1, -8]);
      p.curve([[-22, -2], [-6, 0], [4, -6]], { closed: false });
      p.poly([[-12, 18], [-10, 44], [12, 44], [12, 18]], { closed: false });
      p.rays(0, -4, 34, 42, 7, -Math.PI * 0.95);
    },
  },
  'SKC-OBJ-DRK-020': {
    name: 'Shattered glass',
    tags: ['glass', 'shatter', 'break', 'pieces', 'broken'],
    draw(p) {
      // a tumbler with a crack running down it, and the piece that fell out on the floor
      p.poly([[-16, -36], [16, -36], [12, 18], [-12, 18]], { closed: true, w: 1.2 });
      p.ellipse(0, -36, 16, 4);
      p.line([4, -36], [-2, -22], [6, -12], [-1, 2], [3, 18]);
      p.line([-2, -22], [-10, -18]);
      p.poly([[16, -36], [10, -26], [14, -18]], { closed: false });
      p.poly([[22, 34], [30, 24], [36, 36]], { closed: true, fill: 'shade' });
      p.poly([[-30, 36], [-24, 30], [-20, 38]], { closed: true });
      p.poly([[8, 38], [12, 32], [16, 40]], { closed: true, fill: 'shade' });
      p.line([-44, 42], [44, 42]);
    },
  },
  'SKC-OBJ-DRK-021': {
    name: 'Barbed wire line',
    tags: ['wire', 'fence', 'trapped', 'border', 'pain'],
    draw(p) {
      p.curve([[-48, 4], [-24, -2], [0, 6], [24, -2], [48, 4]], { closed: false, w: 1.1 });
      p.curve([[-48, 8], [-24, 2], [0, 10], [24, 2], [48, 8]], { closed: false });
      for (const x of [-30, -6, 18, 40]) {
        p.line([x - 6, -4], [x + 6, 12]);
        p.line([x + 6, -4], [x - 6, 12]);
      }
    },
  },
  'SKC-OBJ-DRK-022': {
    name: 'Memorial candle',
    tags: ['candle', 'memory', 'remember', 'pray', 'light'],
    draw(p) {
      p.rect(-14, -2, 28, 40, { w: 1.2 });
      p.ellipse(0, -2, 14, 4);
      p.line([0, -4], [0, -10]);
      p.curve([[0, -34], [6, -22], [4, -12], [-4, -12], [-6, -22]], { fill: 'accent' });
      p.hatch(-14, 6, 28, 32, 5, -0.9);
      p.rays(0, -20, 18, 24, 6, -Math.PI / 2, 'shade');
    },
  },
  'SKC-OBJ-DRK-023': {
    name: 'Empty bed',
    tags: ['bed', 'sleep', 'alone', 'night', 'empty'],
    draw(p) {
      p.line([-42, -10], [-42, 30]);
      p.line([42, 6], [42, 30]);
      p.rect(-42, 6, 84, 14);
      p.curve([[-36, 6], [-34, -4], [-20, -6], [-16, 6]], { fill: 'paper' });
      p.curve([[-10, 6], [10, 2], [40, 4]], { closed: false, stroke: 'shade' });
      p.hatch(-42, 20, 84, 10, 4, 0.8);
    },
  },
  'SKC-OBJ-DRK-024': {
    name: 'Phone off the hook',
    tags: ['phone', 'call', 'ring', 'answer', 'hang'],
    draw(p) {
      // a desk phone on the left; the handset hangs down off the table edge on its cord
      p.poly([[-40, -10], [-34, -24], [-2, -24], [4, -10], [4, 10], [-40, 10]], { closed: true, w: 1.2 });
      p.circle(-18, -4, 8);
      p.dot(-18, -4, 2);
      p.line([-48, 10], [18, 10], [18, 46]);
      const coil: [number, number][] = [];
      for (let i = 0; i <= 26; i++) coil.push([4 + i * 0.9 + Math.cos(i * 1.1) * 3.5, 2 + i * 0.9 + Math.sin(i * 1.1) * 3.5]);
      p.stroke(coil, 'ink', 0.8);
      p.curve([[24, 26], [34, 30], [38, 42], [34, 48]], { closed: false, w: 2.2 });
      p.poly([[20, 20], [28, 20], [28, 30], [20, 28]], { closed: true, fill: 'ink' });
      p.poly([[30, 44], [38, 44], [40, 50], [30, 50]], { closed: true, fill: 'ink' });
    },
  },
  'SKC-OBJ-DRK-025': {
    name: 'Lonely streetlight',
    tags: ['street', 'light', 'night', 'city', 'alone', 'lamp'],
    draw(p) {
      p.line([-6, 44], [-6, -30], [12, -38]);
      p.poly([[8, -40], [22, -40], [18, -32], [12, -32]], { closed: true, fill: 'accent' });
      p.poly([[12, -32], [-10, 44], [44, 44], [18, -32]], { closed: false, stroke: 'shade' });
      p.line([-30, 44], [46, 44]);
    },
  },
  'SKC-OBJ-DRK-026': {
    name: 'Wolf howling (simple line)',
    tags: ['wolf', 'howl', 'moon', 'wild', 'night'],
    draw(p) {
      // a wolf sitting on a rise, muzzle up at the moon
      p.circle(28, -32, 11, { stroke: 'shade' });
      p.curve([[-34, 40], [-30, 20], [-22, 6], [-16, -6], [-12, -18], [-6, -26], [0, -36], [6, -30], [2, -24], [8, -20], [-2, -14], [0, 0], [6, 16], [4, 40]], { fill: 'ink' });
      p.poly([[-10, -22], [-8, -34], [-4, -26]], { fill: 'ink' });
      p.curve([[-34, 40], [-44, 30], [-40, 18]], { closed: false, w: 1.4 });
      p.curve([[-48, 44], [-10, 38], [26, 42], [48, 40]], { closed: false });
      p.line([2, -32], [6, -40]);
    },
  },
  'SKC-OBJ-DRK-027': {
    name: 'Thorned rose stem',
    tags: ['rose', 'thorn', 'love', 'hurt', 'beauty'],
    draw(p) {
      p.curve([[0, 44], [-4, 10], [4, -16]], { closed: false, w: 1.2 });
      for (const [x, y, s] of [[-2, 30, -1], [1, 16, 1], [-1, 2, -1]] as const) p.poly([[x, y], [x + s * 7, y - 2], [x, y - 4]], { fill: 'ink' });
      p.curve([[4, -16], [-10, -22], [-8, -36], [6, -40], [16, -32], [14, -18]], { closed: true, fill: 'accent' });
      p.curve([[0, -26], [6, -32], [8, -24]], { closed: false });
    },
  },
  'SKC-OBJ-DRK-028': {
    name: 'Heart in a cage',
    tags: ['heart', 'cage', 'trapped', 'love', 'locked'],
    draw(p) {
      p.curve([[-26, 40], [-26, -20], [0, -40], [26, -20], [26, 40]], { closed: false, w: 1.2 });
      p.line([-30, 40], [30, 40]);
      for (const x of [-13, 0, 13]) p.line([x, -36 + Math.abs(x) * 0.4], [x, 40]);
      p.curve([[0, 4], [8, -6], [16, 2], [0, 22], [-16, 2], [-8, -6]], { fill: 'accent' });
    },
  },
  'SKC-OBJ-DRK-029': {
    name: 'Eye with a tear',
    tags: ['cry', 'tear', 'tears', 'eye', 'sad'],
    draw(p) {
      p.curve([[-38, 0], [0, -22], [38, 0]], { closed: false, w: 1.2 });
      p.curve([[-38, 0], [0, 18], [38, 0]], { closed: false });
      p.circle(0, -2, 10, { fill: 'ink' });
      p.curve([[10, 18], [14, 28], [12, 36], [6, 36], [5, 28]], { fill: 'accent' });
    },
  },
  'SKC-OBJ-DRK-030': {
    name: 'Spiral scribble (anxiety)',
    tags: ['anxious', 'mind', 'head', 'spin', 'crazy', 'lost'],
    draw(p) {
      const pts: [number, number][] = [];
      for (let i = 0; i < 90; i++) {
        const a = i * 0.42;
        const r = 4 + i * 0.42;
        pts.push([Math.cos(a) * r * 1.1, Math.sin(a) * r * 0.9]);
      }
      p.stroke(pts, 'ink', 0.9);
    },
  },
  'SKC-OBJ-DRK-031': {
    name: 'Shadow figure in a doorway',
    tags: ['shadow', 'someone', 'stranger', 'door', 'there'],
    draw(p) {
      p.rect(-24, -44, 48, 88, { w: 1.2 });
      p.hatch(-24, -44, 48, 88, 3.5, 0.9, 'shade');
      p.circle(0, -18, 8, { fill: 'ink' });
      p.poly([[-12, 44], [-10, -6], [10, -6], [12, 44]], { fill: 'ink' });
    },
  },
  'SKC-OBJ-DRK-032': {
    name: 'Melting ice cream (bittersweet)',
    tags: ['summer', 'melt', 'sweet', 'gone', 'ice'],
    draw(p) {
      p.poly([[-12, -2], [12, -2], [0, 30]], { closed: true });
      p.hatchIn([[-12, -2], [12, -2], [0, 30]], 4, 0.8);
      p.curve([[-16, -2], [-16, -18], [0, -26], [16, -18], [16, -2], [10, 6], [6, 0], [2, 10], [-4, 0], [-10, 4]], { fill: 'accent' });
      p.curve([[10, 6], [12, 22], [10, 30]], { closed: false, stroke: 'accent' });
      p.ellipse(10, 40, 10, 3, { fill: 'accent' });
    },
  },
  'SKC-OBJ-DRK-033': {
    name: 'Burning letter',
    tags: ['letter', 'burn', 'fire', 'words', 'forget'],
    draw(p) {
      p.poly([[-28, -10], [-6, -12], [2, -22], [12, -14], [26, -18], [28, 34], [-28, 34]], { closed: true, w: 1.1 });
      for (let i = 0; i < 4; i++) p.line([-20, 2 + i * 8], [18 - (i % 2) * 8, 2 + i * 8]);
      p.curve([[-6, -12], [-2, -30], [4, -24], [8, -38], [14, -26], [12, -14]], { fill: 'accent' });
    },
  },
  'SKC-OBJ-DRK-034': {
    name: 'Snapped pencil',
    tags: ['pencil', 'write', 'broke', 'stop', 'snap'],
    draw(p) {
      p.poly([[-44, 8], [-6, -4], [-2, 6], [-40, 18]], { closed: true, w: 1.1 });
      p.poly([[-44, 8], [-52, 14], [-40, 18]], { fill: 'ink' });
      p.poly([[4, 2], [36, -14], [40, -4], [8, 12]], { closed: true, w: 1.1 });
      p.rect(36, -16, 8, 12, { fill: 'accent' });
      p.line([-6, -4], [-1, 0], [-4, 3], [-2, 6]);
      p.line([4, 2], [1, 6], [8, 12]);
    },
  },
  'SKC-OBJ-DRK-035': {
    name: 'Unplugged cable',
    tags: ['plug', 'cable', 'disconnect', 'off', 'signal'],
    draw(p) {
      p.curve([[-48, -20], [-24, -30], [-20, 0], [-12, 8]], { closed: false, w: 1.2 });
      p.rect(-14, 2, 14, 12, { fill: 'ink' });
      p.line([0, 5], [6, 5]);
      p.line([0, 11], [6, 11]);
      p.rect(22, -4, 20, 30, { w: 1.1 });
      p.rect(28, 4, 3, 7, { fill: 'ink' });
      p.rect(34, 4, 3, 7, { fill: 'ink' });
    },
  },
  'SKC-OBJ-DRK-036': {
    name: 'Coffee cup gone cold',
    tags: ['coffee', 'cold', 'morning', 'wait', 'cup'],
    draw(p) {
      p.poly([[-20, -12], [-16, 30], [16, 30], [20, -12]], { closed: false, w: 1.2 });
      p.ellipse(0, -12, 20, 5);
      p.curve([[20, -4], [32, -2], [32, 12], [18, 16]], { closed: false });
      p.ellipse(0, -11, 15, 3, { fill: 'shade', stroke: null });
      p.ellipse(0, 34, 30, 5, { stroke: 'shade' });
    },
  },
  'SKC-OBJ-DRK-037': {
    name: 'Ladder to nowhere',
    tags: ['climb', 'up', 'ladder', 'nowhere', 'try'],
    draw(p) {
      p.line([-14, 44], [-8, -44]);
      p.line([14, 44], [8, -44]);
      for (let i = 0; i < 7; i++) p.line([-13 + i * 0.8, 34 - i * 12], [13 - i * 0.8, 34 - i * 12]);
      p.curve([[-30, -44], [-14, -50], [0, -46], [16, -50], [30, -44]], { closed: false, stroke: 'shade' });
    },
  },
  'SKC-OBJ-DRK-038': {
    name: 'Locked diary',
    tags: ['diary', 'secret', 'lock', 'words', 'private'],
    draw(p) {
      p.rect(-26, -32, 52, 64, { w: 1.2 });
      p.line([-20, -32], [-20, 32]);
      p.rect(18, -8, 16, 16, { fill: 'accent' });
      p.arc(26, -8, 6, Math.PI, Math.PI * 2);
      p.dot(26, 0, 2);
      p.hatch(-20, -32, 38, 64, 6, 0.9);
    },
  },
  'SKC-OBJ-DRK-039': {
    name: 'Bird cage open and empty',
    tags: ['cage', 'free', 'gone', 'bird', 'fly', 'open'],
    draw(p) {
      p.curve([[-22, 34], [-22, -12], [0, -30], [22, -12], [22, 34]], { closed: false, w: 1.2 });
      p.line([-26, 34], [26, 34]);
      p.circle(0, -34, 4);
      for (const x of [-11, 11]) p.line([x, -24], [x, 34]);
      p.poly([[22, 4], [38, -6], [38, 18], [22, 22]], { closed: false });
      p.line([-18, 14], [18, 14]);
    },
  },
  'SKC-OBJ-DRK-040': {
    name: 'Anchor chain',
    tags: ['anchor', 'chain', 'heavy', 'down', 'stay', 'hold'],
    draw(p) {
      for (let i = 0; i < 4; i++) p.ellipse(0, -42 + i * 9, 4, 6);
      p.line([0, -6], [0, 34]);
      p.line([-10, 2], [10, 2]);
      p.circle(0, -6, 4);
      p.curve([[-26, 18], [-18, 34], [0, 38], [18, 34], [26, 18]], { closed: false, w: 1.2 });
      p.poly([[-30, 22], [-26, 14], [-20, 22]], { fill: 'ink' });
      p.poly([[30, 22], [26, 14], [20, 22]], { fill: 'ink' });
    },
  },
};
