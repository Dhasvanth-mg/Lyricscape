// SKC-OBJ-DOD: the cute register, the Sketch cards doodles kept and redrawn with the shared pen so they sit with the new
// drawings. Six come from the original sketch.ts (face, eyes, chibi, flower, cat, stars); the rest from the motif set the old
// looks used. Each drawing lives in a 100 x 100 box centred on (0, 0) and only uses paint roles (pen.ts).

import type { Drawing } from './types';

export const DOODLES: Record<string, Drawing> = {
  'SKC-OBJ-DOD-001': {
    name: 'face',
    tags: ['girl', 'me', 'her', 'she', 'friend'],
    draw(p) {
      p.curve([[-34, 10], [-36, -26], [-12, -42], [14, -42], [36, -24], [34, 12]], { closed: false, stroke: 'ink', w: 1.2 });
      p.ellipse(0, 4, 26, 30, { fill: 'paper' });
      p.poly([[-26, -10], [-20, -26], [0, -30], [22, -26], [27, -8], [10, -16], [-6, -14]], { fill: 'ink' });
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) p.ellipse(s * 36, 2 + i * 11, 7, 6, { fill: 'ink' });
        p.poly([[s * 36 - 6, 46], [s * 36 + 6, 46], [s * 36, 40]], { fill: 'accent' });
        p.dot(s * 10, 2, 3.2);
        p.ellipse(s * 17, 13, 5, 3, { fill: 'accent', stroke: null });
      }
      p.curve([[-6, 18], [0, 22], [6, 18]], { closed: false });
    },
  },
  'SKC-OBJ-DOD-002': {
    name: 'eyes',
    tags: ['eyes', 'see', 'look', 'watch', 'stare'],
    draw(p) {
      for (const [x, y, f] of [[-24, -2, 1], [24, -6, -1]] as const) {
        p.curve([[x - 20, y + 2], [x, y - 16], [x + 20, y]], { closed: false, w: 1.1 });
        p.curve([[x - 20, y + 2], [x, y + 12], [x + 20, y]], { closed: false });
        p.circle(x + f * 2, y, 7, { fill: 'ink' });
        p.dot(x + f * 2 - 2, y - 3, 1.6, 'paper');
        for (let i = -3; i <= 3; i++) p.line([x + i * 5, y - 9 + Math.abs(i)], [x + i * 6.5, y - 16 + Math.abs(i) * 1.5]);
      }
      for (let i = 0; i < 5; i++) p.circle(-36 + i * 18, 30 + (i % 2) * 6, 3.4, { fill: 'accent' });
    },
  },
  'SKC-OBJ-DOD-003': {
    name: 'chibi',
    tags: ['cute', 'little', 'baby', 'happy'],
    draw(p) {
      p.ellipse(0, -10, 30, 26, { fill: 'paper', w: 1.1 });
      p.ellipse(-11, -10, 5, 6, { fill: 'ink' });
      p.ellipse(11, -10, 5, 6, { fill: 'ink' });
      p.ellipse(-20, -1, 5, 3, { fill: 'accent', stroke: null });
      p.ellipse(20, -1, 5, 3, { fill: 'accent', stroke: null });
      p.curve([[-4, 2], [0, 5], [4, 2]], { closed: false });
      p.ellipse(0, 28, 16, 16, { fill: 'paper' });
      p.line([-14, 24], [-26, 16]);
      p.line([14, 24], [26, 34]);
      p.line([28, -44], [30, -24]);
      p.dot(30, -20, 3);
    },
  },
  'SKC-OBJ-DOD-004': {
    name: 'flower',
    tags: ['flower', 'bloom', 'spring', 'garden', 'rose'],
    draw(p) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        p.ellipse(Math.cos(a) * 17, Math.sin(a) * 17 - 8, 12, 9, { fill: 'accent' });
      }
      p.circle(0, -8, 9, { fill: 'ink' });
      p.curve([[0, 8], [-3, 24], [2, 44]], { closed: false, w: 1.2 });
      p.curve([[0, 30], [-14, 22], [-20, 30], [-2, 34]], { fill: 'shade' });
    },
  },
  'SKC-OBJ-DOD-005': {
    name: 'cat',
    tags: ['cat', 'kitty', 'pet', 'meow'],
    draw(p) {
      p.ellipse(0, 4, 30, 26, { fill: 'paper', w: 1.1 });
      p.poly([[-26, -8], [-20, -36], [-6, -20]], { fill: 'paper' });
      p.poly([[26, -8], [20, -36], [6, -20]], { fill: 'paper' });
      p.rect(-13, -4, 4, 7, { fill: 'ink' });
      p.rect(9, -4, 4, 7, { fill: 'ink' });
      p.poly([[-3, 8], [3, 8], [0, 12]], { fill: 'accent' });
      for (const s of [-1, 1]) {
        p.line([s * 8, 12], [s * 34, 8]);
        p.line([s * 8, 15], [s * 32, 18]);
      }
    },
  },
  'SKC-OBJ-DOD-006': {
    name: 'stars',
    tags: ['star', 'stars', 'wish', 'shine', 'sky'],
    draw(p) {
      const star = (x: number, y: number, R: number, fill?: 'ink' | 'accent') => {
        const pts: [number, number][] = [];
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          const rr = i % 2 ? R * 0.42 : R;
          pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
        }
        p.poly(pts, { closed: true, fill });
      };
      star(-12, -8, 30);
      star(22, 26, 14, 'ink');
      star(30, -30, 8, 'accent');
      p.dot(-38, 30, 2.5);
      p.dot(-30, 40, 1.8);
    },
  },
  'SKC-OBJ-DOD-007': {
    name: 'heart',
    tags: ['love', 'heart', 'darling', 'kiss', 'romance'],
    draw(p) {
      p.curve([[0, -20], [16, -38], [38, -24], [30, 4], [0, 34], [-30, 4], [-38, -24], [-16, -38]], { fill: 'accent', w: 1.2 });
      p.curve([[-20, -18], [-24, -8]], { closed: false, stroke: 'paper', w: 1.4 });
      p.rays(0, 0, 44, 50, 6, -Math.PI / 2);
    },
  },
  'SKC-OBJ-DOD-008': {
    name: 'sun',
    tags: ['sun', 'summer', 'morning', 'day', 'light', 'warm'],
    draw(p) {
      p.circle(0, 0, 20, { fill: 'accent', w: 1.2 });
      p.rays(0, 0, 27, 40, 12);
      p.dot(-7, -4, 2.4);
      p.dot(7, -4, 2.4);
      p.curve([[-8, 6], [0, 11], [8, 6]], { closed: false });
    },
  },
  'SKC-OBJ-DOD-009': {
    name: 'moon',
    tags: ['moon', 'night', 'sleep', 'dream', 'tonight'],
    draw(p) {
      p.curve([[6, -36], [-24, -26], [-30, 8], [-6, 34], [24, 28], [2, 18], [-8, -6], [6, -36]], { fill: 'accent', w: 1.2 });
      p.dot(-14, 0, 2);
      p.curve([[-20, 10], [-14, 14]], { closed: false });
      p.dot(28, -22, 2);
      p.dot(34, -4, 1.5);
    },
  },
  'SKC-OBJ-DOD-010': {
    name: 'cloud',
    tags: ['cloud', 'sky', 'float', 'grey', 'weather'],
    draw(p) {
      p.curve([[-36, 12], [-40, -4], [-24, -12], [-14, -28], [8, -28], [18, -14], [36, -12], [40, 8], [26, 16]], { fill: 'paper', w: 1.2 });
      p.curve([[-20, 4], [-10, 0]], { closed: false, stroke: 'shade' });
      p.curve([[10, 2], [22, -2]], { closed: false, stroke: 'shade' });
    },
  },
  'SKC-OBJ-DOD-011': {
    name: 'bolt',
    tags: ['electric', 'shock', 'energy', 'power', 'thunder'],
    draw(p) {
      p.poly([[6, -44], [-20, 4], [-2, 4], [-10, 44], [22, -10], [4, -10], [14, -44]], { fill: 'accent', w: 1.2 });
      p.line([-30, -24], [-22, -18]);
      p.line([30, 20], [24, 26]);
    },
  },
  'SKC-OBJ-DOD-012': {
    name: 'note',
    tags: ['song', 'music', 'sing', 'melody', 'tune'],
    draw(p) {
      p.ellipse(-16, 24, 10, 7, { fill: 'ink' });
      p.ellipse(18, 16, 10, 7, { fill: 'ink' });
      p.line([-7, 22], [-6, -26]);
      p.line([27, 14], [28, -34]);
      p.poly([[-6, -26], [28, -34], [28, -24], [-6, -16]], { fill: 'ink' });
    },
  },
  'SKC-OBJ-DOD-013': {
    name: 'planet',
    tags: ['planet', 'space', 'orbit', 'universe', 'galaxy'],
    draw(p) {
      p.circle(0, 0, 22, { fill: 'accent', w: 1.2 });
      p.ellipse(0, 2, 42, 10, { from: -0.2, to: Math.PI + 0.2, stroke: 'ink', w: 1.2 });
      p.curve([[-12, -10], [4, -14], [14, -6]], { closed: false, stroke: 'shade' });
      p.dot(-36, -30, 2);
      p.dot(34, -36, 2.5);
    },
  },
  'SKC-OBJ-DOD-014': {
    name: 'ghost',
    tags: ['ghost', 'haunt', 'boo', 'spooky'],
    draw(p) {
      p.curve([[-24, 36], [-26, -12], [-10, -36], [12, -36], [26, -12], [24, 36], [14, 28], [4, 38], [-6, 28], [-16, 38]], { fill: 'paper', w: 1.2 });
      p.ellipse(-9, -10, 4, 6, { fill: 'ink' });
      p.ellipse(9, -10, 4, 6, { fill: 'ink' });
      p.ellipse(0, 6, 4, 5, { fill: 'ink' });
    },
  },
  'SKC-OBJ-DOD-015': {
    name: 'smile',
    tags: ['smile', 'happy', 'laugh', 'fun', 'joy'],
    draw(p) {
      p.circle(0, 0, 34, { fill: 'accent', w: 1.2 });
      p.ellipse(-12, -8, 4, 7, { fill: 'ink' });
      p.ellipse(12, -8, 4, 7, { fill: 'ink' });
      p.curve([[-20, 8], [0, 24], [20, 8]], { closed: false, w: 1.2 });
    },
  },
  'SKC-OBJ-DOD-016': {
    name: 'mushroom',
    tags: ['forest', 'grow', 'tiny', 'trip'],
    draw(p) {
      p.curve([[-36, 0], [-30, -26], [0, -36], [30, -26], [36, 0]], { fill: 'accent', w: 1.2 });
      p.line([-36, 0], [36, 0]);
      p.curve([[-12, 0], [-14, 26], [-10, 38], [10, 38], [14, 26], [12, 0]], { fill: 'paper' });
      p.circle(-14, -16, 5, { fill: 'paper' });
      p.circle(12, -20, 6, { fill: 'paper' });
      p.circle(24, -8, 3, { fill: 'paper' });
    },
  },
  'SKC-OBJ-DOD-017': {
    name: 'wave',
    tags: ['sea', 'ocean', 'wave', 'beach', 'surf', 'water'],
    draw(p) {
      p.curve([[-44, 10], [-30, -18], [-6, -28], [10, -12], [0, 0], [-10, -6]], { closed: false, w: 1.3 });
      p.curve([[-44, 22], [-24, 16], [-4, 24], [16, 16], [40, 22]], { closed: false });
      p.curve([[-40, 34], [-18, 28], [4, 36], [24, 28], [44, 34]], { closed: false, stroke: 'accent', w: 1.2 });
    },
  },
  'SKC-OBJ-DOD-018': {
    name: 'mountain',
    tags: ['mountain', 'climb', 'high', 'peak', 'hike'],
    draw(p) {
      p.poly([[-44, 30], [-12, -26], [6, 4], [18, -10], [44, 30]], { fill: 'paper', w: 1.2 });
      p.poly([[-20, -12], [-12, -26], [-4, -12], [-10, -16]], { fill: 'accent', stroke: null });
      p.hatchIn([[6, 4], [18, -10], [44, 30], [16, 30]], 5);
      p.circle(30, -30, 8, { fill: 'accent' });
    },
  },
  'SKC-OBJ-DOD-019': {
    name: 'rainbow',
    tags: ['rainbow', 'colour', 'color', 'pride', 'hope'],
    draw(p) {
      p.arc(0, 18, 38, Math.PI, Math.PI * 2, 'accent', 2.4);
      p.arc(0, 18, 29, Math.PI, Math.PI * 2, 'ink', 1.2);
      p.arc(0, 18, 21, Math.PI, Math.PI * 2, 'shade', 2);
      p.curve([[-48, 22], [-44, 12], [-32, 14], [-26, 24]], { fill: 'paper' });
      p.curve([[26, 24], [32, 12], [44, 14], [48, 24]], { fill: 'paper' });
    },
  },
  'SKC-OBJ-DOD-020': {
    name: 'sparkle',
    tags: ['sparkle', 'shine', 'magic', 'glitter', 'bright'],
    draw(p) {
      const sp = (x: number, y: number, r: number, f: 'accent' | 'ink') =>
        p.poly([[x, y - r], [x + r * 0.16, y - r * 0.16], [x + r, y], [x + r * 0.16, y + r * 0.16], [x, y + r], [x - r * 0.16, y + r * 0.16], [x - r, y], [x - r * 0.16, y - r * 0.16]], { fill: f });
      sp(-6, -4, 30, 'accent');
      sp(28, 26, 12, 'ink');
      sp(-30, 30, 8, 'accent');
    },
  },
  'SKC-OBJ-DOD-021': {
    name: 'eye',
    tags: ['eye', 'see', 'look', 'vision'],
    draw(p) {
      p.curve([[-42, 0], [0, -26], [42, 0]], { closed: false, w: 1.3 });
      p.curve([[-42, 0], [0, 26], [42, 0]], { closed: false, w: 1.3 });
      p.circle(0, 0, 14, { fill: 'accent' });
      p.circle(0, 0, 6, { fill: 'ink' });
      p.dot(-4, -4, 2, 'paper');
      p.rays(0, 0, 32, 40, 7, -Math.PI * 0.9);
    },
  },
  'SKC-OBJ-DOD-022': {
    name: 'drop',
    tags: ['rain', 'tear', 'water', 'drop', 'cry'],
    draw(p) {
      p.curve([[0, -40], [16, -10], [22, 12], [12, 30], [-12, 30], [-22, 12], [-16, -10]], { fill: 'accent', w: 1.2 });
      p.curve([[-10, 8], [-8, 18], [0, 22]], { closed: false, stroke: 'paper', w: 1.3 });
    },
  },
  'SKC-OBJ-DOD-023': {
    name: 'cactus',
    tags: ['desert', 'dry', 'hot', 'alone', 'prick'],
    draw(p) {
      p.curve([[-10, 34], [-12, -20], [0, -38], [12, -20], [10, 34]], { fill: 'accent', w: 1.2 });
      p.curve([[-11, 4], [-26, 2], [-28, -18], [-20, -20], [-18, -6], [-11, -6]], { fill: 'accent' });
      p.curve([[11, 10], [26, 8], [28, -6], [20, -8], [18, 2], [11, 2]], { fill: 'accent' });
      p.rect(-24, 34, 48, 12, { fill: 'paper' });
      for (const [x, y] of [[-4, -16], [4, -2], [-4, 12], [4, 24]]) p.line([x!, y!], [x! + 3, y! - 2]);
    },
  },
  'SKC-OBJ-DOD-024': {
    name: 'rocket',
    tags: ['rocket', 'fly', 'launch', 'space', 'up', 'high'],
    draw(p) {
      p.curve([[0, -44], [14, -20], [14, 18], [-14, 18], [-14, -20]], { fill: 'paper', w: 1.2 });
      p.circle(0, -12, 6, { fill: 'accent' });
      p.poly([[-14, 6], [-26, 24], [-14, 18]], { fill: 'accent' });
      p.poly([[14, 6], [26, 24], [14, 18]], { fill: 'accent' });
      p.curve([[-8, 20], [-6, 34], [0, 44], [6, 34], [8, 20]], { fill: 'accent' });
    },
  },
};
