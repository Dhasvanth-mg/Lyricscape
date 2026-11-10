// SKC-OBJ-EVD: everyday objects, the things that make a card feel like somebody's life rather than clip art. No brands, no
// logos (the review rejected a branded sneaker). Same pen as the doodles, with fewer faces and more specific objects.

import type { Drawing } from './types';

export const EVERYDAY: Record<string, Drawing> = {
  'SKC-OBJ-EVD-001': {
    name: 'Headphones',
    tags: ['music', 'listen', 'song', 'loud', 'headphones', 'play'],
    draw(p) {
      p.curve([[-30, 10], [-32, -22], [0, -38], [32, -22], [30, 10]], { closed: false, w: 1.4 });
      p.rect(-38, 2, 14, 26, { fill: 'accent' });
      p.rect(24, 2, 14, 26, { fill: 'accent' });
      p.curve([[31, 28], [30, 40], [10, 44], [-4, 40]], { closed: false, stroke: 'shade' });
    },
  },
  'SKC-OBJ-EVD-002': {
    name: 'Coffee cup with steam',
    tags: ['coffee', 'morning', 'wake', 'cafe', 'cup'],
    draw(p) {
      p.poly([[-20, -6], [-16, 34], [16, 34], [20, -6]], { closed: false, w: 1.2 });
      p.ellipse(0, -6, 20, 5, { fill: 'accent' });
      p.curve([[20, 2], [32, 4], [32, 18], [18, 22]], { closed: false });
      p.squiggle(-6, -16, 24, 4);
      p.squiggle(6, -14, 20, 3);
    },
  },
  'SKC-OBJ-EVD-003': {
    name: 'Bus ticket',
    tags: ['bus', 'ride', 'city', 'ticket', 'trip', 'go'],
    draw(p) {
      p.rect(-38, -18, 76, 36, { fill: 'paper', w: 1.2 });
      p.line([12, -18], [12, 18]);
      for (let y = -14; y <= 14; y += 6) p.dot(12, y, 1.2, 'paper');
      p.rect(-32, -12, 20, 8, { fill: 'accent' });
      p.line([-32, 4], [4, 4]);
      p.line([-32, 10], [-6, 10]);
      p.circle(26, 0, 7, { stroke: 'shade' });
    },
  },
  'SKC-OBJ-EVD-004': {
    name: 'Sneakers',
    tags: ['run', 'walk', 'shoes', 'street', 'dance'],
    draw(p) {
      // a canvas trainer seen from the side, toe to the right
      p.curve([[-38, 16], [-40, -4], [-34, -22], [-18, -24], [-12, -10], [4, -6], [24, -2], [38, 6], [40, 16]], { closed: true, fill: 'paper', w: 1.2 });
      p.rect(-42, 16, 84, 7, { fill: 'accent' });
      p.line([-42, 19], [42, 19]);
      for (let i = 0; i < 4; i++) p.line([-16 + i * 7, -14 + i * 2.5], [-8 + i * 7, -18 + i * 2.5]);
      p.curve([[18, -2], [26, 8], [40, 10]], { closed: false, stroke: 'shade' });
      p.circle(-30, -6, 4, { fill: 'accent' });
    },
  },
  'SKC-OBJ-EVD-005': {
    name: 'Cassette',
    tags: ['tape', 'mixtape', 'old', 'song', 'rewind', 'play'],
    draw(p) {
      p.rect(-40, -24, 80, 48, { fill: 'paper', w: 1.2 });
      p.rect(-30, -18, 60, 14, { fill: 'accent' });
      p.circle(-16, 6, 7);
      p.circle(16, 6, 7);
      p.rect(-8, 2, 16, 8);
      p.poly([[-24, 24], [-18, 14], [18, 14], [24, 24]], { closed: false });
    },
  },
  'SKC-OBJ-EVD-006': {
    name: 'Instant camera',
    tags: ['photo', 'picture', 'camera', 'memory', 'smile'],
    draw(p) {
      p.rect(-36, -22, 72, 50, { fill: 'paper', w: 1.2 });
      p.circle(0, 4, 15, { fill: 'shade' });
      p.circle(0, 4, 7, { fill: 'ink' });
      p.rect(20, -16, 10, 7, { fill: 'accent' });
      p.rect(-28, -16, 10, 6);
      p.line([-30, 22], [30, 22]);
    },
  },
  'SKC-OBJ-EVD-007': {
    name: 'Bicycle',
    tags: ['ride', 'bike', 'summer', 'road', 'free'],
    draw(p) {
      p.circle(-26, 16, 16, { w: 1.2 });
      p.circle(26, 16, 16, { w: 1.2 });
      p.line([-26, 16], [-6, -10], [18, -10], [26, 16]);
      p.line([-6, -10], [2, 16], [18, -10]);
      p.line([2, 16], [-26, 16]);
      p.line([-10, -16], [0, -16]);
      p.line([18, -10], [16, -20], [24, -22]);
    },
  },
  'SKC-OBJ-EVD-008': {
    name: 'Houseplant',
    tags: ['plant', 'grow', 'home', 'green', 'leaf'],
    draw(p) {
      p.poly([[-18, 12], [-14, 40], [14, 40], [18, 12]], { closed: true, fill: 'accent' });
      for (const [a, l] of [[-2.2, 30], [-1.6, 36], [-1.1, 32], [-0.5, 26], [-2.7, 22]] as const) {
        const ex = Math.cos(a) * l;
        const ey = 10 + Math.sin(a) * l;
        p.curve([[0, 10], [ex * 0.5 - 6, (10 + ey) / 2], [ex, ey], [ex * 0.5 + 6, (10 + ey) / 2]], { fill: 'paper' });
      }
    },
  },
  'SKC-OBJ-EVD-009': {
    name: 'Takeaway noodle box',
    tags: ['food', 'late', 'night', 'hungry', 'noodles'],
    draw(p) {
      p.poly([[-24, -10], [24, -10], [16, 34], [-16, 34]], { closed: true, fill: 'paper', w: 1.2 });
      p.poly([[-24, -10], [-14, -22], [14, -22], [24, -10]], { closed: false });
      p.curve([[-14, -22], [0, -36], [14, -22]], { closed: false, stroke: 'shade' });
      p.line([8, -10], [30, -42]);
      p.line([12, -10], [36, -38]);
      p.circle(0, 10, 7, { fill: 'accent' });
    },
  },
  'SKC-OBJ-EVD-010': {
    name: 'Sunglasses',
    tags: ['cool', 'sun', 'summer', 'shades', 'shine'],
    draw(p) {
      p.curve([[-40, -6], [-38, 14], [-18, 16], [-8, -4]], { fill: 'ink', w: 1.2 });
      p.curve([[40, -6], [38, 14], [18, 16], [8, -4]], { fill: 'ink', w: 1.2 });
      p.line([-40, -6], [40, -6]);
      p.curve([[-8, -4], [0, -10], [8, -4]], { closed: false });
      p.line([-30, 0], [-24, 8]);
    },
  },
  'SKC-OBJ-EVD-011': {
    name: 'Backpack',
    tags: ['school', 'travel', 'leave', 'bag', 'pack'],
    draw(p) {
      p.curve([[-24, 38], [-26, -14], [-14, -30], [14, -30], [26, -14], [24, 38]], { closed: true, fill: 'accent', w: 1.2 });
      p.rect(-16, 6, 32, 22, { fill: 'paper' });
      p.line([-16, 14], [16, 14]);
      p.curve([[-8, -30], [-6, -42], [6, -42], [8, -30]], { closed: false });
    },
  },
  'SKC-OBJ-EVD-012': {
    name: 'House keys on a ring',
    tags: ['keys', 'home', 'door', 'lock', 'leave'],
    draw(p) {
      // a split ring with two keys hanging from it: round bows with a hole, long shafts, cut teeth
      p.circle(0, -34, 9, { w: 1.2 });
      for (const [dx, rot, role] of [[-10, 0.35, 'accent'], [10, -0.3, 'paper']] as const) {
        const ca = Math.cos(rot);
        const sa = Math.sin(rot);
        const T = (x: number, y: number): [number, number] => [dx + x * ca - y * sa, -24 + x * sa + y * ca];
        p.circle(...T(0, 8), 10, { fill: role, w: 1.1 });
        p.circle(...T(0, 6), 2.5);
        p.poly([T(-3, 18), T(3, 18), T(3, 50), T(-3, 50)], { closed: true, fill: 'paper' });
        p.poly([T(3, 36), T(9, 36), T(9, 40), T(6, 42), T(9, 45), T(9, 49), T(3, 49)], { closed: false });
      }
    },
  },
  'SKC-OBJ-EVD-013': {
    name: 'Umbrella',
    tags: ['rain', 'umbrella', 'storm', 'shelter', 'weather'],
    draw(p) {
      p.curve([[-40, 0], [-30, -26], [0, -36], [30, -26], [40, 0], [26, -4], [14, 0], [0, -4], [-14, 0], [-26, -4]], { fill: 'accent', w: 1.2 });
      p.line([0, -4], [0, 30]);
      p.curve([[0, 30], [2, 38], [10, 38], [12, 32]], { closed: false });
      for (let i = 0; i < 4; i++) p.line([-30 + i * 18, 18 + (i % 2) * 6], [-32 + i * 18, 24 + (i % 2) * 6]);
    },
  },
  'SKC-OBJ-EVD-014': {
    name: 'Toothbrush pair (love songs)',
    tags: ['together', 'us', 'home', 'stay', 'love', 'morning'],
    draw(p) {
      p.poly([[-16, -6], [-12, 36], [12, 36], [16, -6]], { closed: true, fill: 'paper', w: 1.2 });
      p.line([-6, -6], [-10, -38]);
      p.line([6, -6], [10, -38]);
      p.rect(-14, -46, 6, 10, { fill: 'accent' });
      p.rect(8, -46, 6, 10, { fill: 'shade' });
      p.curve([[-6, 14], [0, 20], [6, 14]], { closed: false });
    },
  },
  'SKC-OBJ-EVD-015': {
    name: 'Alarm clock',
    tags: ['time', 'wake', 'morning', 'late', 'clock'],
    draw(p) {
      p.circle(0, 4, 28, { fill: 'paper', w: 1.2 });
      p.circle(-22, -24, 8, { fill: 'accent' });
      p.circle(22, -24, 8, { fill: 'accent' });
      p.line([0, 4], [0, -14]);
      p.line([0, 4], [12, 10]);
      p.line([-18, 30], [-24, 40]);
      p.line([18, 30], [24, 40]);
      p.rays(0, 4, 36, 42, 5, -Math.PI * 0.9, 'shade');
    },
  },
  'SKC-OBJ-EVD-016': {
    name: 'Guitar',
    tags: ['guitar', 'song', 'play', 'band', 'strum', 'music'],
    draw(p) {
      p.curve([[0, -2], [16, -6], [18, 10], [12, 20], [20, 32], [0, 44], [-20, 32], [-12, 20], [-18, 10], [-16, -6]], { fill: 'accent', w: 1.2 });
      p.circle(0, 18, 6, { fill: 'ink' });
      p.rect(-3, -44, 6, 44, { fill: 'paper' });
      p.rect(-6, -50, 12, 8, { fill: 'ink' });
      p.line([-1, -40], [-1, 34]);
      p.line([1, -40], [1, 34]);
    },
  },
  'SKC-OBJ-EVD-017': {
    name: 'Skateboard',
    tags: ['skate', 'street', 'ride', 'park', 'roll'],
    draw(p) {
      p.curve([[-44, -6], [-40, -12], [40, -12], [44, -6], [40, 0], [-40, 0]], { fill: 'accent', w: 1.2 });
      p.circle(-26, 8, 6, { fill: 'paper' });
      p.circle(26, 8, 6, { fill: 'paper' });
      p.line([-20, -6], [20, -6]);
    },
  },
  'SKC-OBJ-EVD-018': {
    name: 'Paper airplane',
    tags: ['fly', 'away', 'plane', 'paper', 'send', 'far'],
    draw(p) {
      p.poly([[-40, 10], [40, -22], [-6, 30]], { closed: true, fill: 'paper', w: 1.2 });
      p.line([40, -22], [-12, 16], [-6, 30]);
      p.poly([[-12, 16], [-40, 10], [-4, 4]], { closed: true, fill: 'shade' });
      p.curve([[-44, 20], [-34, 30], [-44, 38], [-30, 44]], { closed: false, stroke: 'shade' });
    },
  },
  'SKC-OBJ-EVD-019': {
    name: 'Ice cream cone',
    tags: ['sweet', 'summer', 'treat', 'ice', 'cream'],
    draw(p) {
      p.poly([[-14, 0], [14, 0], [0, 40]], { closed: true, fill: 'paper', w: 1.2 });
      p.hatchIn([[-14, 0], [14, 0], [0, 40]], 5, 0.8, 'ink');
      p.circle(0, -12, 15, { fill: 'accent' });
      p.circle(-2, -30, 10, { fill: 'paper' });
      p.dot(4, -14, 1.5, 'paper');
      p.dot(-6, -8, 1.5, 'paper');
    },
  },
  'SKC-OBJ-EVD-020': {
    name: 'Pizza slice',
    tags: ['food', 'party', 'friends', 'pizza', 'night'],
    draw(p) {
      p.poly([[-30, -26], [30, -26], [0, 40]], { closed: true, fill: 'paper', w: 1.2 });
      p.rect(-32, -34, 64, 9, { fill: 'shade' });
      for (const [x, y] of [[-12, -12], [8, -6], [-2, 12], [10, -18]]) p.circle(x!, y!, 5, { fill: 'accent' });
    },
  },
  'SKC-OBJ-EVD-021': {
    name: 'Plane ticket',
    tags: ['flight', 'travel', 'away', 'ticket', 'leave', 'fly'],
    draw(p) {
      p.rect(-42, -20, 84, 40, { fill: 'paper', w: 1.2 });
      p.line([18, -20], [18, 20]);
      p.poly([[-26, 0], [-6, -6], [-2, -12], [2, -6], [-6, 4]], { fill: 'accent' });
      p.line([-36, 10], [8, 10]);
      p.line([24, -10], [36, -10]);
      p.line([24, 0], [36, 0]);
      p.rect(24, 6, 12, 8, { fill: 'ink' });
    },
  },
  'SKC-OBJ-EVD-022': {
    name: 'Suitcase',
    tags: ['leave', 'travel', 'pack', 'trip', 'away', 'move'],
    draw(p) {
      p.rect(-34, -16, 68, 48, { fill: 'accent', w: 1.2 });
      p.rect(-10, -26, 20, 10);
      p.line([-18, -16], [-18, 32]);
      p.line([18, -16], [18, 32]);
      p.rect(-6, 4, 14, 9, { fill: 'paper' });
      p.circle(-26, 36, 3);
      p.circle(26, 36, 3);
    },
  },
  'SKC-OBJ-EVD-023': {
    name: 'Moon and stars mobile',
    tags: ['sleep', 'dream', 'night', 'baby', 'lullaby', 'moon'],
    draw(p) {
      p.line([-36, -36], [36, -36]);
      p.line([0, -44], [0, -36]);
      p.line([-24, -36], [-24, -4]);
      p.line([0, -36], [0, 10]);
      p.line([24, -36], [24, -14]);
      p.curve([[-20, -6], [-32, 0], [-28, 14], [-16, 14], [-24, 6]], { fill: 'accent' });
      const star = (x: number, y: number, r: number) => {
        const pts: [number, number][] = [];
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          pts.push([x + Math.cos(a) * (i % 2 ? r * 0.45 : r), y + Math.sin(a) * (i % 2 ? r * 0.45 : r)]);
        }
        p.poly(pts, { closed: true, fill: 'paper' });
      };
      star(0, 18, 10);
      star(24, -6, 8);
    },
  },
  'SKC-OBJ-EVD-024': {
    name: 'Lipstick',
    tags: ['kiss', 'red', 'lips', 'night', 'dress'],
    draw(p) {
      p.rect(-12, 4, 24, 36, { fill: 'paper', w: 1.2 });
      p.rect(-9, -10, 18, 14, { fill: 'shade' });
      p.poly([[-7, -10], [-7, -30], [7, -38], [7, -10]], { closed: true, fill: 'accent' });
      p.line([-12, 14], [12, 14]);
    },
  },
  'SKC-OBJ-EVD-025': {
    name: 'Rubber duck',
    tags: ['bath', 'silly', 'cute', 'float', 'duck'],
    draw(p) {
      p.curve([[-34, 10], [-30, 30], [24, 30], [34, 10], [20, 6], [12, -4], [14, -22], [0, -32], [-14, -20], [-10, 2]], { fill: 'accent', w: 1.2 });
      p.poly([[12, -18], [26, -14], [12, -10]], { fill: 'ink' });
      p.dot(2, -20, 2.4);
      p.curve([[-22, 12], [-10, 18], [4, 12]], { closed: false });
    },
  },
  'SKC-OBJ-EVD-026': {
    name: 'Lamp',
    tags: ['light', 'room', 'night', 'read', 'lamp', 'glow'],
    draw(p) {
      p.poly([[-20, -8], [-12, -36], [12, -36], [20, -8]], { closed: true, fill: 'accent', w: 1.2 });
      p.line([0, -8], [0, 30]);
      p.ellipse(0, 34, 18, 5, { fill: 'paper' });
      p.rays(0, -8, 24, 32, 5, Math.PI * 0.15, 'shade');
    },
  },
  'SKC-OBJ-EVD-027': {
    name: 'Goldfish bowl',
    tags: ['fish', 'swim', 'round', 'pet', 'water', 'small'],
    draw(p) {
      p.curve([[-20, -26], [-36, -6], [-30, 24], [0, 34], [30, 24], [36, -6], [20, -26]], { closed: false, w: 1.2 });
      p.ellipse(0, -26, 20, 4);
      p.curve([[-28, -2], [0, 4], [28, -2]], { closed: false, stroke: 'shade' });
      p.ellipse(-2, 14, 10, 6, { fill: 'accent' });
      p.poly([[8, 14], [16, 8], [16, 20]], { fill: 'accent' });
      p.dot(-7, 12, 1.4);
      p.circle(-12, -10, 2.5);
      p.circle(-8, -16, 1.8);
    },
  },
  'SKC-OBJ-EVD-028': {
    name: 'Basketball',
    tags: ['ball', 'game', 'win', 'play', 'shoot', 'court'],
    draw(p) {
      p.circle(0, 0, 32, { fill: 'accent', w: 1.2 });
      p.line([-32, 0], [32, 0]);
      p.line([0, -32], [0, 32]);
      p.curve([[-22, -24], [-12, 0], [-22, 24]], { closed: false });
      p.curve([[22, -24], [12, 0], [22, 24]], { closed: false });
    },
  },
  'SKC-OBJ-EVD-029': {
    name: 'Microphone',
    tags: ['sing', 'mic', 'voice', 'stage', 'shout', 'say'],
    draw(p) {
      p.circle(0, -22, 16, { fill: 'shade', w: 1.2 });
      p.hatch(-11, -33, 22, 22, 4, 0.8, 'ink');
      p.poly([[-9, -8], [9, -8], [5, 30], [-5, 30]], { closed: true, fill: 'paper' });
      p.curve([[0, 30], [-2, 40], [14, 44], [30, 40]], { closed: false });
    },
  },
  'SKC-OBJ-EVD-030': {
    name: 'Record player',
    tags: ['vinyl', 'record', 'spin', 'music', 'old', 'play'],
    draw(p) {
      p.rect(-42, -24, 84, 52, { fill: 'paper', w: 1.2 });
      p.circle(-8, 2, 20, { fill: 'ink' });
      p.circle(-8, 2, 6, { fill: 'accent' });
      p.line([30, -18], [26, 10], [8, 14]);
      p.circle(30, -18, 3);
    },
  },
  'SKC-OBJ-EVD-031': {
    name: 'Teacup',
    tags: ['tea', 'calm', 'afternoon', 'cup', 'rest'],
    draw(p) {
      p.curve([[-22, -6], [-18, 16], [0, 22], [18, 16], [22, -6]], { closed: false, w: 1.2 });
      p.ellipse(0, -6, 22, 5, { fill: 'accent' });
      p.curve([[20, 2], [30, 0], [28, 12], [16, 14]], { closed: false });
      p.ellipse(0, 26, 34, 6);
      p.squiggle(0, -14, 18, 3, 'shade');
    },
  },
  'SKC-OBJ-EVD-032': {
    name: 'Love letter envelope',
    tags: ['letter', 'love', 'send', 'write', 'mail', 'words'],
    draw(p) {
      p.rect(-38, -24, 76, 48, { fill: 'paper', w: 1.2 });
      p.line([-38, -24], [0, 4], [38, -24]);
      p.curve([[0, 0], [6, -8], [12, -2], [0, 12], [-12, -2], [-6, -8]], { fill: 'accent' });
    },
  },
  'SKC-OBJ-EVD-033': {
    name: 'Map with a dotted route',
    tags: ['map', 'road', 'way', 'find', 'travel', 'home'],
    draw(p) {
      p.poly([[-40, -26], [-14, -32], [14, -26], [40, -32], [40, 28], [14, 34], [-14, 28], [-40, 34]], { closed: true, fill: 'paper', w: 1.2 });
      p.line([-14, -32], [-14, 28]);
      p.line([14, -26], [14, 34]);
      for (let i = 0; i < 9; i++) p.dot(-30 + i * 7, 12 - Math.sin(i * 0.8) * 14, 1.6);
      p.line([26, -10], [34, -2]);
      p.line([34, -10], [26, -2]);
      p.circle(-30, 14, 4, { fill: 'accent' });
    },
  },
  'SKC-OBJ-EVD-034': {
    name: 'Lighthouse toy',
    tags: ['light', 'sea', 'guide', 'home', 'shore', 'lost'],
    draw(p) {
      p.poly([[-12, 40], [-8, -20], [8, -20], [12, 40]], { closed: true, fill: 'paper', w: 1.2 });
      p.poly([[-10, 10], [10, 10], [11, 22], [-11, 22]], { closed: true, fill: 'accent' });
      p.poly([[-9, -6], [9, -6], [9, 0], [-9, 0]], { closed: true, fill: 'accent' });
      p.rect(-8, -32, 16, 12, { fill: 'shade' });
      p.poly([[-10, -32], [0, -42], [10, -32]], { fill: 'ink' });
      p.poly([[8, -26], [44, -38], [44, -14]], { closed: false, stroke: 'shade' });
    },
  },
  'SKC-OBJ-EVD-035': {
    name: 'Bunch of balloons',
    tags: ['party', 'birthday', 'balloon', 'float', 'celebrate'],
    draw(p) {
      p.ellipse(-14, -20, 13, 16, { fill: 'accent' });
      p.ellipse(12, -24, 13, 16, { fill: 'paper' });
      p.ellipse(0, -2, 12, 15, { fill: 'shade' });
      for (const [x, y] of [[-14, -4], [12, -8], [0, 13]]) p.curve([[x!, y!], [x! * 0.6 + 2, 26], [0, 42]], { closed: false });
    },
  },
  'SKC-OBJ-EVD-036': {
    name: 'Polaroid frame (empty)',
    tags: ['photo', 'memory', 'picture', 'us', 'then'],
    draw(p) {
      p.rect(-30, -36, 60, 70, { fill: 'paper', w: 1.2 });
      p.rect(-24, -30, 48, 46, { fill: 'shade' });
      p.curve([[-18, 26], [-4, 22], [10, 28]], { closed: false });
      p.rect(-10, -42, 20, 8, { fill: 'accent', stroke: null });
    },
  },
  'SKC-OBJ-EVD-037': {
    name: 'Chai glass',
    tags: ['chai', 'tea', 'evening', 'talk', 'street', 'friends'],
    draw(p) {
      p.poly([[-14, -18], [-11, 30], [11, 30], [14, -18]], { closed: false, w: 1.2 });
      p.ellipse(0, -18, 14, 3.5);
      p.poly([[-13, -6], [-11, 28], [11, 28], [13, -6]], { closed: true, fill: 'accent', stroke: null });
      for (let i = 0; i < 4; i++) p.line([-9 + i * 6, -14], [-8 + i * 6, 26]);
      p.squiggle(-2, -26, 18, 3, 'shade');
      p.squiggle(6, -24, 14, 3, 'shade');
    },
  },
  'SKC-OBJ-EVD-038': {
    name: 'Auto-rickshaw',
    tags: ['auto', 'ride', 'street', 'city', 'traffic', 'home'],
    draw(p) {
      // a three-wheeler from the side: a tall canopy over an open cabin, a narrow nose down to one front wheel
      p.curve([[-36, 16], [-38, -20], [-28, -34], [4, -34], [16, -26], [18, -10]], { closed: false, w: 1.3 });
      p.poly([[-38, -30], [6, -36], [18, -26], [-36, -22]], { closed: true, fill: 'ink' });
      p.poly([[18, -10], [30, -4], [34, 14], [24, 22], [-36, 22], [-36, 6], [-4, 6], [8, -8]], { closed: true, fill: 'accent' });
      p.rect(-30, -8, 18, 10, { fill: 'paper' });
      p.line([8, -8], [4, -26]);
      p.line([26, -6], [36, -14]);
      p.circle(-26, 26, 7, { fill: 'paper' });
      p.circle(-12, 26, 7, { fill: 'paper' });
      p.circle(30, 26, 7, { fill: 'paper' });
    },
  },
  'SKC-OBJ-EVD-039': {
    name: 'Kite with a tail',
    tags: ['kite', 'fly', 'wind', 'sky', 'high', 'free'],
    draw(p) {
      p.poly([[-6, -42], [16, -18], [-6, 12], [-26, -18]], { closed: true, fill: 'accent', w: 1.2 });
      p.line([-6, -42], [-6, 12]);
      p.line([-26, -18], [16, -18]);
      p.curve([[-6, 12], [4, 22], [-8, 30], [6, 40], [0, 48]], { closed: false });
      for (const [x, y] of [[2, 22], [-4, 31], [4, 40]]) p.poly([[x!, y!], [x! + 6, y! - 4], [x! + 6, y! + 4]], { fill: 'paper' });
    },
  },
  'SKC-OBJ-EVD-040': {
    name: 'Mango',
    tags: ['summer', 'sweet', 'mango', 'fruit', 'home'],
    draw(p) {
      p.curve([[-6, -26], [18, -30], [32, -6], [24, 22], [0, 32], [-24, 20], [-26, -6]], { fill: 'accent', w: 1.2 });
      p.line([-4, -26], [0, -36]);
      p.curve([[0, -34], [14, -44], [24, -36], [10, -30]], { fill: 'shade' });
      p.curve([[-14, -10], [-16, 4], [-10, 14]], { closed: false, stroke: 'paper', w: 1.2 });
    },
  },
};
