// SKC-OBJ-HND hands and SKC-PRP-TOL desk tools. Hands are ink outlines filled with paper, never skin tones (the family's
// exclusion rule), so they read as part of the drawing, not as a photograph. A hand's box has the card's gripped edge on
// y = 0 (the card is above, y < 0); the scene scales the box to the card width.

import type { Drawing } from './types';

const finger = (p: import('../pen').Pen, x: number, y: number, len: number, ang: number, w = 7) => {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const T = (u: number, v: number): [number, number] => [x + u * ca - v * sa, y + u * sa + v * ca];
  p.curve([T(0, -w / 2), T(len * 0.7, -w / 2), T(len, -w * 0.2), T(len, w * 0.2), T(len * 0.7, w / 2), T(0, w / 2)], { fill: 'paper', w: 1.1 });
  p.line(T(len * 0.82, -w * 0.3), T(len * 0.9, w * 0.1));
};

export const HANDS: Record<string, Drawing> = {
  'SKC-OBJ-HND-001': {
    name: 'Right hand holding bottom edge',
    tags: [],
    draw(p) {
      // from below: sleeve cuff, wrist, the palm behind the card and the thumb pressed on its front
      p.rect(-12, 34, 34, 18, { fill: 'accent' });
      p.poly([[-8, 34], [-10, 12], [18, 12], [18, 34]], { closed: true, fill: 'paper', w: 1.2 });
      p.curve([[-14, 14], [-16, -2], [-6, -8], [18, -8], [24, 2], [20, 14]], { fill: 'paper', w: 1.2 });
      p.curve([[-12, -2], [-14, -16], [-10, -24], [-4, -24], [-2, -14], [-2, -2]], { fill: 'paper', w: 1.2 });
      p.line([-10, -18], [-5, -19]);
      for (const x of [2, 9, 16]) p.line([x, -8], [x + 1, -2]);
    },
  },
  'SKC-OBJ-HND-002': {
    name: 'Two hands holding sides',
    tags: [],
    draw(p) {
      // left and right: sleeve cuffs at the frame edges, palms on the card sides, thumbs over the front
      for (const s of [-1, 1]) {
        p.rect(s > 0 ? 44 : -62, 6, 18, 30, { fill: 'accent' });
        p.curve([[s * 46, 34], [s * 40, 14], [s * 38, -12], [s * 44, -22], [s * 56, -20], [s * 58, 34]], { fill: 'paper', w: 1.2 });
        p.curve([[s * 42, -14], [s * 30, -16], [s * 24, -12], [s * 26, -6], [s * 38, -4]], { fill: 'paper', w: 1.2 });
        p.line([s * 28, -12], [s * 29, -7]);
      }
    },
  },
  'SKC-OBJ-HND-003': {
    name: 'Hand flicking a card away',
    tags: [],
    draw(p) {
      // a flick: the hand at the lower right with two fingers snapped out, speed lines behind the card
      p.rect(30, 34, 26, 18, { fill: 'accent' });
      p.curve([[26, 36], [18, 22], [22, 8], [40, 4], [52, 14], [54, 36]], { fill: 'paper', w: 1.2 });
      p.curve([[24, 12], [8, 2], [2, 4], [4, 10], [20, 18]], { fill: 'paper', w: 1.2 });
      p.curve([[26, 6], [14, -8], [8, -8], [8, -2], [22, 10]], { fill: 'paper', w: 1.2 });
      for (let i = 0; i < 3; i++) p.line([-6 - i * 10, -2 + i * 9], [-20 - i * 10, -6 + i * 9]);
    },
  },
  'SKC-OBJ-HND-004': {
    name: 'Hand raising a card',
    tags: [],
    draw(p) {
      // holding the card up from below: a fist round the card's lower edge, an arm going down out of frame
      p.poly([[-10, 52], [-8, 22], [14, 22], [16, 52]], { closed: true, fill: 'accent', w: 1.2 });
      p.curve([[-16, 24], [-18, 0], [-10, -10], [14, -10], [20, 0], [18, 24]], { fill: 'paper', w: 1.2 });
      for (const x of [-12, -4, 4, 12]) p.curve([[x - 3, -6], [x - 3, -14], [x + 3, -14], [x + 3, -6]], { closed: false });
      p.curve([[18, 4], [26, -4], [24, -12], [16, -8]], { fill: 'paper', w: 1.1 });
    },
  },
  'SKC-OBJ-HND-005': {
    name: 'Hand pointing at a word',
    tags: [],
    draw(p) {
      // a hand coming in from the lower right, index finger pointing up and left at the card
      p.rect(40, 30, 22, 22, { fill: 'accent' });
      p.curve([[36, 34], [28, 22], [32, 10], [48, 8], [56, 20], [56, 34]], { fill: 'paper', w: 1.2 });
      p.curve([[34, 12], [18, -6], [12, -12], [8, -8], [12, -2], [30, 18]], { fill: 'paper', w: 1.2 });
      p.line([12, -8], [16, -10]);
      for (const y of [14, 20, 26]) p.curve([[32, y], [28, y + 2], [32, y + 5]], { closed: false });
    },
  },
};

export const TOOLS: Record<string, Drawing> = {
  'SKC-PRP-TOL-001': {
    name: 'Marker with cap off',
    tags: [],
    draw(p) {
      p.poly([[-40, 6], [20, -14], [24, -4], [-36, 16]], { closed: true, fill: 'paper', w: 1.2 });
      p.poly([[20, -14], [30, -16], [32, -10], [24, -4]], { closed: true, fill: 'accent' });
      p.poly([[30, -16], [38, -16], [32, -10]], { fill: 'accent' });
      p.rect(-8, -2, 14, 6, { fill: 'accent', stroke: null });
      p.poly([[-46, 24], [-22, 16], [-18, 26], [-42, 34]], { closed: true, fill: 'accent' });
    },
  },
  'SKC-PRP-TOL-002': {
    name: 'Tape roll',
    tags: [],
    draw(p) {
      p.circle(0, 0, 30, { fill: 'shade', w: 1.2 });
      p.circle(0, 0, 18, { fill: 'paper' });
      p.poly([[24, 18], [44, 30], [40, 38], [20, 24]], { closed: true, fill: 'shade' });
      p.line([40, 30], [42, 34], [44, 30], [46, 34]);
    },
  },
  'SKC-PRP-TOL-003': {
    name: 'Scissors',
    tags: [],
    draw(p) {
      p.circle(-26, 14, 10, { w: 1.3 });
      p.circle(-26, -14, 10, { w: 1.3 });
      p.poly([[-18, 8], [40, -6], [-10, 0]], { closed: true, fill: 'paper' });
      p.poly([[-18, -8], [40, 6], [-10, 0]], { closed: true, fill: 'paper' });
      p.dot(-8, 0, 2.5, 'accent');
    },
  },
  'SKC-PRP-TOL-004': {
    name: 'Pencil and eraser',
    tags: [],
    draw(p) {
      p.poly([[-38, 14], [22, -12], [26, -2], [-34, 24]], { closed: true, fill: 'accent', w: 1.2 });
      p.poly([[22, -12], [40, -14], [26, -2]], { closed: true, fill: 'paper' });
      p.poly([[34, -13.5], [40, -14], [36, -9]], { fill: 'ink' });
      p.rect(-34, 20, 4, 4, { fill: 'shade' });
      p.rect(-30, 30, 24, 12, { fill: 'paper', w: 1.1 });
      p.rect(-30, 30, 9, 12, { fill: 'accent' });
    },
  },
  'SKC-PRP-TOL-005': {
    name: 'Coffee ring stain',
    tags: [],
    draw(p) {
      p.arc(0, 0, 28, 0.3, Math.PI * 1.85, 'shade', 2.4);
      p.arc(1, 1, 25, 0.9, Math.PI * 1.6, 'shade', 0.8);
      p.dot(30, 14, 2, 'shade');
      p.dot(34, 20, 1.4, 'shade');
    },
  },
  'SKC-PRP-TOL-006': {
    name: 'Paper clip',
    tags: [],
    draw(p) {
      // the classic wire clip: straight runs joined by half-turns, traced as one wire
      const pts: [number, number][] = [];
      const run = (x: number, y0: number, y1: number) => {
        for (let k = 0; k <= 8; k++) pts.push([x, y0 + ((y1 - y0) * k) / 8]);
      };
      const turn = (cx: number, cy: number, r: number, top: boolean) => {
        for (let k = 1; k < 8; k++) {
          const a = top ? Math.PI + (Math.PI * k) / 8 : (Math.PI * k) / 8;
          pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
        }
      };
      run(-10, 20, -26);
      turn(-1, -26, 9, true);
      run(8, -26, 30);
      turn(-3, 30, 11, false);
      run(-14, 30, -16);
      turn(-9, -16, 5, true);
      run(-4, -16, 22);
      p.stroke(pts, 'ink', 1.1);
    },
  },
};
