// Glyph Cinema subjects (GLY-ENV-SUB-001..062): greyscale brightness maps designed for character rendering. Each is drawn
// procedurally on the GPU as bold silhouettes with three to five tones on a near-black field, so a character grid of 40-72 rows
// reads it; each has one motion channel (asset GLY-MOT-ANI-001..011) driven by u_time, which the scene quantises to 30 fps so
// cells change in steps, never slide. Subject i in the shader is GLY-ENV-SUB-(i + 1). The colour of the output is a gradient
// of the register's palette (dark, mid, bright) so the character pass can keep it (colour registers) or read only its
// lightness (ink, teletext and print registers).
//
// Transitions run here too: a noise front that switches cells from one subject to the next (GLY-TRN-NOISE-FRONT), develop from
// noise (cells appear brightest first, GLY-TRN-DEVELOP) and decay to blank (brightest last, GLY-TRN-DECAY-BLANK).

const HEAD = `#version 300 es
precision highp float;
`;

export const SUBJECT_COUNT = 62;

export const GLY_FS = `${HEAD}
in vec2 v_uv;
out vec4 o;
uniform vec2 u_res;
uniform float u_time;
uniform int u_subject;
uniform int u_subject2;    // the next subject while a noise front crosses (-1 = none)
uniform float u_front;     // 0..1 how far the front has gone
uniform vec4 u_rect;       // where the picture lives, uv from the top-left (x0, y0, x1, y1)
uniform float u_zoom;
uniform vec2 u_pan;        // in subject units
uniform float u_develop;   // 1 = full picture; less: only the brightest cells so far
uniform float u_beat;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_bgc;        // outside the picture
uniform vec2 u_cells;      // grid cells across the picture (for cell-level noise)
uniform float u_flash;     // lightning allowed (0 when reduced motion)

#define PI 3.14159265
float sat(float x) { return clamp(x, 0.0, 1.0); }
float hash(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float fill(float d, float w) { return 1.0 - smoothstep(-w, w, d); }
float sdC(vec2 p, float r) { return length(p) - r; }
float sdB(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float sdTri(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 e0 = b - a, e1 = c - b, e2 = a - c, v0 = p - a, v1 = p - b, v2 = p - c;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)), vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))), vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
float sdHeart(vec2 p) { p.x = abs(p.x); if (p.y + p.x > 1.0) return sqrt(dot(p - vec2(0.25, 0.75), p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  return sqrt(min(dot(p - vec2(0.0, 1.0), p - vec2(0.0, 1.0)), dot(p - 0.5 * max(p.x + p.y, 0.0), p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y); }
float stars(vec2 p, float k, float t) { vec2 c = floor(p * k); float h = hash(c); float tw = 0.6 + 0.4 * step(0.5, fract(h * 13.0 + t * 0.35));
  return step(0.965, h) * tw * (1.0 - smoothstep(0.1, 0.35, length(fract(p * k) - 0.5))); }
float sky(vec2 p) { return 0.04 + 0.05 * sat(0.6 - p.y * 0.4); }
float clouds(vec2 p, float t) { return smoothstep(0.5, 0.75, fbm(p * vec2(1.4, 2.6) + vec2(t * 0.05, 0.0))); }
float hills(vec2 p, float y0, float a, float f, float s) { return step(p.y, y0 + a * sin(p.x * f + s) + a * 0.5 * sin(p.x * f * 2.3 + s * 1.7)); }

// ---- the subjects ------------------------------------------------------------------------------------------------------------
float eye(vec2 p, float t) {
  float cyc = mod(t, 6.5); float lid = 1.0 - smoothstep(0.0, 0.12, cyc) * (1.0 - smoothstep(0.12, 0.24, cyc));
  float open = 0.62 * lid + 0.02;
  vec2 q = p; float shape = abs(q.y) - open * (1.0 - q.x * q.x / 1.69);
  float white = fill(shape, 0.02) * step(abs(q.x), 1.3);
  vec2 look = vec2(0.25 * sin(floor(t / 1.6) * 2.1), 0.08 * cos(floor(t / 1.6) * 1.3));
  float r = length(q - look);
  float iris = fill(r - 0.42, 0.02); float pupil = fill(r - 0.16 - 0.03 * u_beat, 0.02);
  float fib = 0.15 * noise(vec2(atan(q.y - look.y, q.x - look.x) * 9.0, r * 6.0));
  float glint = fill(length(q - look - vec2(0.12, 0.12)) - 0.06, 0.02);
  float b = 0.08 + white * 0.62; b = mix(b, 0.42 + fib, iris * white); b = mix(b, 0.03, pupil * white); b = max(b, glint * white);
  float lash = (1.0 - fill(abs(shape) - 0.04, 0.02)) * 0.0 + fill(abs(shape) - 0.035, 0.015) * step(abs(q.x), 1.3) * 0.85;
  return max(b, lash);
}
float highway(vec2 p, float t) {
  float hz = 0.18; if (p.y > hz) return sky(p) + stars(p, 22.0, t) * 0.6 + 0.12 * step(p.y, hz + 0.05 + 0.04 * sin(p.x * 3.0));
  float z = (hz + 0.02) / (hz + 0.02 - p.y); float x = p.x * z;
  float road = step(abs(x), 1.6);
  float lane = step(abs(abs(x) - 0.55), 0.04) * step(0.5, fract(z * 0.6 - t * 1.6));
  float edge = step(abs(abs(x) - 1.55), 0.06);
  float car = fill(length(vec2(x - 0.3, (fract(z * 0.12 - t * 0.06) - 0.5) * 6.0)) - 0.28, 0.06);
  return 0.05 + road * 0.12 + lane * 0.75 + edge * 0.55 + car * 0.95 * step(z, 9.0);
}
float slowLights(vec2 p, float t) {
  float b = 0.04;
  for (int i = 0; i < 4; i++) { float fi = float(i); vec2 o = vec2(-1.1 + fi * 0.73, 1.1);
    float a = -1.57 + 0.45 * sin(t * 0.45 + fi * 1.7);
    vec2 d = rot(a) * (p - o); float beam = step(0.0, d.x) * (1.0 - smoothstep(0.05, 0.16 + d.x * 0.18, abs(d.y)));
    b += beam * (0.35 + 0.25 * sin(t * 0.8 + fi)) * (1.0 - d.x * 0.25); b += fill(length(p - o) - 0.09, 0.02) * 0.9; }
  b += 0.15 * step(p.y, -0.85) * (0.6 + 0.4 * sin(p.x * 22.0));
  return b;
}
float ocean(vec2 p, float t) {
  float hz = 0.28; if (p.y > hz) return sky(p) + 0.75 * fill(length(p - vec2(0.6, 0.62)) - 0.16, 0.02) + clouds(p, t) * 0.25;
  float z = 1.0 / (hz + 0.06 - p.y);
  float w = sin(p.x * z * 2.2 + t * 1.5 + z * 1.4) * 0.5 + 0.5; w *= sin(p.x * z * 1.1 - t + z * 0.7) * 0.5 + 0.5;
  float glit = step(abs(p.x - 0.6), 0.2 / z + 0.04) * step(0.6, w);
  return 0.08 + w * 0.32 * sat(1.4 - z * 0.12) + glit * 0.6;
}
float fire(vec2 p, float t) {
  float tt = floor(t * 3.0) / 3.0; // flicker capped at 3 Hz
  vec2 q = p - vec2(0.0, -0.8); float n = fbm(vec2(q.x * 3.0, q.y * 2.0 - tt * 2.5));
  float flame = sat(1.0 - length(vec2(q.x * 1.6, q.y * 0.55 - 0.45)) - n * 0.55 + 0.25);
  float logs = fill(sdB(rot(0.25) * (q + vec2(0.0, 0.05)), vec2(0.7, 0.07)), 0.02) + fill(sdB(rot(-0.25) * (q + vec2(0.0, 0.05)), vec2(0.7, 0.07)), 0.02);
  return 0.04 + smoothstep(0.1, 0.9, flame) * 0.95 + sat(logs) * 0.25 * step(flame, 0.2);
}
float skyline(vec2 p, float t) {
  float b = sky(p) + stars(p, 20.0, t) * 0.5;
  float x = floor(p.x * 6.0); float hgt = -0.2 + hash(vec2(x, 3.0)) * 0.9; float bx = fract(p.x * 6.0);
  float bld = step(p.y, hgt) * step(0.06, bx) * step(bx, 0.94);
  vec2 w = vec2(fract(p.x * 30.0), fract(p.y * 20.0)); vec2 wc = floor(vec2(p.x * 30.0, p.y * 20.0));
  float lit = step(0.55, hash(wc + floor(t / 3.0) * step(0.93, hash(wc + 9.0)))) * step(0.25, w.x) * step(w.x, 0.75) * step(0.3, w.y) * step(w.y, 0.75);
  float sp = fill(sdSeg(p, vec2(0.25, 0.7), vec2(0.25, 1.0)), 0.015) * 0.7;
  return mix(b, 0.12 + lit * 0.7, bld) + sp + 0.25 * step(p.y, -0.85);
}
float planet(vec2 p, float t) {
  float b = sky(p) + stars(p, 18.0, t) * 0.7;
  vec2 q = rot(0.35) * p; float r = length(p);
  float body = fill(r - 0.55, 0.01); float shade = sat(0.35 + dot(normalize(p + 0.0001), vec2(-0.6, 0.5)) * 0.4 + 0.3 * (1.0 - r / 0.55));
  float bands = 0.12 * sin(q.y * 26.0 + t * 0.3);
  float ring = step(abs(length(q * vec2(1.0, 3.6)) - 0.88), 0.09) * (1.0 - body * step(0.0, q.y));
  return max(mix(b, sat(shade + bands), body), ring * 0.8);
}
float rain(vec2 p, float t) {
  float b = 0.05;
  vec2 q = vec2(p.x * 26.0, p.y * 3.0 + t * 4.5 + hash(vec2(floor(p.x * 26.0), 1.0)) * 7.0);
  float streak = step(0.85, fract(q.y)) * step(0.55, hash(vec2(floor(q.x), floor(q.y))));
  float pole = fill(sdB(p - vec2(-0.6, -0.25), vec2(0.03, 0.75)), 0.01);
  float lamp = fill(length(p - vec2(-0.48, 0.52)) - 0.07, 0.02);
  float cone = sat(1.0 - abs(p.x + 0.48) / (0.12 + (0.52 - p.y) * 0.35)) * step(p.y, 0.5) * 0.35;
  float puddle = step(p.y, -0.92) * 0.25;
  return b + streak * (0.35 + cone * 1.2) + pole * 0.45 + lamp * 0.95 + cone + puddle;
}
float tunnel(vec2 p, float t) {
  float a = atan(p.y, p.x); float r = length(p);
  float z = 0.5 / max(r, 0.04) + t * 2.0;
  float ring = step(0.82, fract(z * 0.5)); float lamps = step(0.9, fract(a / (2.0 * PI) * 8.0)) * step(0.55, fract(z * 0.5));
  return sat(0.06 + r * 0.25 + ring * 0.35 * sat(r * 2.0) + lamps * 0.8) * step(0.05, r);
}
float heart(vec2 p, float t) {
  float s = 1.0 + 0.06 * smoothstep(0.0, 0.15, fract(t * 1.1)) * (1.0 - smoothstep(0.15, 0.4, fract(t * 1.1)));
  float d = sdHeart((p / s) * 1.15 + vec2(0.0, 0.55));
  float b = 0.04 + fill(d, 0.02) * (0.7 + 0.25 * sat(-d * 3.0)); b += fill(abs(d + 0.05) - 0.02, 0.01) * 0.2;
  return b + 0.25 * fill(length(p - vec2(-0.28, 0.25)) - 0.1, 0.05);
}
float flower(vec2 p, float t) {
  vec2 c = p - vec2(0.0, 0.25); float a = atan(c.y, c.x) + 0.1 * sin(t * 0.6); float r = length(c);
  float pet = fill(r - (0.38 + 0.16 * cos(a * 6.0)), 0.02); float cen = fill(r - 0.14, 0.02);
  float stem = fill(sdSeg(p, vec2(0.0, -1.0), vec2(0.03 * sin(t * 0.6), 0.1)), 0.035);
  float leaf = fill(length((p - vec2(0.18, -0.5)) * vec2(1.0, 2.4)) - 0.16, 0.02);
  return 0.04 + max(pet * (0.55 + 0.25 * cos(a * 6.0)), max(cen * 0.95, max(stem, leaf) * 0.42));
}
float mountains(vec2 p, float t) {
  float b = sky(p) + 0.6 * fill(length(p - vec2(-0.7, 0.55)) - 0.12, 0.02);
  float m1 = step(p.y, 0.2 + 0.45 * (1.0 - abs(fract(p.x * 0.6 + 0.3) - 0.5) * 2.0) - 0.15 * noise(p * 6.0));
  float snow = m1 * step(0.32 - 0.05 * noise(p * 12.0), p.y);
  float m2 = step(p.y, -0.35 + 0.25 * sin(p.x * 2.0 + 1.0) + 0.08 * noise(p * 8.0));
  b = mix(b, 0.32, m1); b = mix(b, 0.9, snow); b = mix(b, 0.14, m2);
  return b + clouds(p + vec2(0.0, -0.3), t) * 0.2 * (1.0 - m1);
}
float globe(vec2 p, float t) {
  float r = length(p); if (r > 0.75) return sky(p) + stars(p, 16.0, t) * 0.6;
  float z = sqrt(0.5625 - r * r); float lon = atan(p.x, z) + t * 0.25; float lat = asin(clamp(p.y / 0.75, -1.0, 1.0));
  float land = step(0.52, fbm(vec2(lon * 1.6, lat * 2.2) + 3.0));
  float grid = step(0.94, fract(lon * 12.0 / (2.0 * PI))) + step(0.94, fract(lat * 8.0 / PI));
  float shade = 0.4 + 0.6 * sat(dot(normalize(vec3(p, z)), normalize(vec3(-0.5, 0.4, 0.8))));
  return sat((0.18 + land * 0.55 + grid * 0.12) * shade);
}
float helix(vec2 p, float t) {
  float b = 0.04; float y = p.y * 5.0 + t * 1.2;
  float x1 = 0.45 * sin(y); float x2 = -x1; float dep = cos(y);
  b += fill(abs(p.x - x1) - 0.06, 0.02) * (0.55 + 0.4 * dep) + fill(abs(p.x - x2) - 0.06, 0.02) * (0.55 - 0.4 * dep);
  float rung = step(fract(y / PI * 3.0), 0.2) * step(abs(p.x), abs(x1)) * 0.35;
  return b + rung;
}
float butterfly(vec2 p, float t) {
  float flap = 0.35 + 0.65 * abs(cos(t * 2.4)); vec2 q = vec2(abs(p.x) / max(flap, 0.12), p.y);
  float up = fill(length((q - vec2(0.42, 0.25)) * vec2(1.0, 1.25)) - 0.36, 0.02);
  float lo = fill(length((q - vec2(0.3, -0.3)) * vec2(1.2, 1.0)) - 0.24, 0.02);
  float spot = fill(length(q - vec2(0.5, 0.32)) - 0.09, 0.02);
  float body = fill(sdB(p, vec2(0.035, 0.42)), 0.015);
  float ant = fill(sdSeg(vec2(abs(p.x), p.y), vec2(0.0, 0.4), vec2(0.15, 0.65)), 0.01);
  return 0.04 + max(max(up, lo) * (0.6 - spot * 0.45 + 0.15 * q.x), max(body, ant) * 0.9);
}
float moon(vec2 p, float t) {
  float b = sky(p) + stars(p, 20.0, t) * 0.5;
  float m = fill(length(p - vec2(0.2, 0.25)) - 0.45, 0.01) * (1.0 - fill(length(p - vec2(0.38, 0.38)) - 0.42, 0.01));
  b = max(b, m * 0.95);
  float cl = clouds(p * 0.8 + vec2(0.0, 0.2), t * 2.0);
  return mix(b, 0.22 + 0.2 * cl, cl * 0.85);
}
float comet(vec2 p, float t) {
  float b = sky(p) + stars(p, 22.0, t) * 0.6;
  vec2 h = vec2(0.55, 0.55) + vec2(-0.03, -0.01) * mod(t, 20.0) * 0.1; vec2 d = normalize(vec2(1.0, 0.45));
  vec2 q = p - h; float along = dot(q, d); float across = abs(dot(q, vec2(-d.y, d.x)));
  float tail = step(0.0, along) * sat(1.0 - across / (0.02 + along * 0.18)) * sat(1.0 - along / 1.6);
  b = max(b, max(tail * 0.75, fill(length(q) - 0.06, 0.02)));
  float grass = step(p.y, -0.55 + 0.05 * sin(p.x * 40.0) * hash(vec2(floor(p.x * 40.0), 2.0)));
  return mix(b, 0.16, grass);
}
float constellation(vec2 p, float t) {
  float b = 0.03 + stars(p, 26.0, t) * 0.35;
  vec2 s[7]; s[0] = vec2(-1.0, 0.3); s[1] = vec2(-0.55, 0.42); s[2] = vec2(-0.15, 0.25); s[3] = vec2(0.2, 0.35); s[4] = vec2(0.35, -0.05); s[5] = vec2(0.85, -0.12); s[6] = vec2(0.8, 0.28);
  for (int i = 0; i < 7; i++) { float tw = 0.75 + 0.25 * step(0.5, fract(t * 0.3 + float(i) * 0.37));
    b = max(b, fill(length(p - s[i]) - 0.055, 0.02) * tw); if (i < 6) b = max(b, fill(sdSeg(p, s[i], s[i + 1]) - 0.008, 0.008) * 0.4); }
  return b;
}
float eclipse(vec2 p, float t) {
  float r = length(p); float a = atan(p.y, p.x);
  float corona = sat(1.0 - (r - 0.5) * 2.2) * (0.6 + 0.4 * noise(vec2(a * 6.0, t * 0.2))) * step(0.5, r);
  float rays = step(0.0, r - 0.5) * sat(1.0 - (r - 0.5) * 1.1) * pow(abs(sin(a * 7.0 + 0.3)), 8.0) * 0.5;
  return 0.03 + corona * 0.9 + rays + stars(p, 18.0, t) * 0.3 * step(1.0, r);
}
float lighthouse(vec2 p, float t) {
  float b = 0.05 + 0.12 * fbm(p * 2.0 + vec2(t * 0.1, 0.0));
  vec2 top = vec2(-0.45, 0.38); float a = t * 0.7;
  vec2 dir = vec2(cos(a), sin(a) * 0.25); vec2 q = p - top; float along = dot(q, normalize(dir)) ; float ac = abs(dot(q, vec2(-normalize(dir).y, normalize(dir).x)));
  float beam = step(0.0, along) * sat(1.0 - ac / (0.03 + along * 0.2)) * sat(1.0 - along * 0.45) * (0.4 + 0.6 * abs(cos(a)));
  float tower = fill(sdTri(p, vec2(-0.6, -0.65), vec2(-0.3, -0.65), vec2(-0.45, 0.38)), 0.01) * step(p.y, 0.33);
  float band = tower * step(0.5, fract(p.y * 4.0));
  float rock = step(p.y, -0.62 + 0.06 * sin(p.x * 7.0)); float sea = step(p.y, -0.7) * (0.12 + 0.1 * sin(p.x * 30.0 + t * 2.0));
  return max(b + beam * 0.8, max(tower * (0.45 + band * 0.3), max(fill(length(q) - 0.07, 0.02), rock * 0.2 + sea)));
}
float sailboat(vec2 p, float t) {
  float hz = -0.25; float b = p.y > hz ? 0.06 + 0.35 * sat(1.0 - (p.y - hz) * 1.2) : 0.12 + 0.1 * sin(p.x * 18.0 + p.y * 40.0 + t * 2.0);
  b = max(b, fill(length(p - vec2(0.55, hz + 0.08)) - 0.22, 0.01) * step(hz, p.y) * 0.95);
  b += step(p.y, hz) * step(abs(p.x - 0.55), 0.06 + (hz - p.y) * 0.12) * 0.35 * step(0.5, fract(p.y * 30.0 + t));
  float bob = 0.015 * sin(t * 1.5); vec2 q = p - vec2(-0.3, bob);
  float sail = fill(sdTri(q, vec2(0.0, -0.18), vec2(0.0, 0.55), vec2(0.32, -0.18)), 0.01);
  float hull = fill(sdB(q - vec2(0.05, -0.24), vec2(0.3, 0.05)), 0.01);
  return mix(b, 0.02, max(sail, hull));
}
float rowboat(vec2 p, float t) {
  float hz = 0.1; float m = p.y < hz ? -1.0 : 1.0; vec2 q = vec2(p.x + 0.004 * sin(p.y * 80.0 + t * 2.0) * step(p.y, hz), hz + abs(p.y - hz));
  float b = 0.05 + 0.2 * sat((q.y - hz) * 0.6) + fill(length(q - vec2(-0.6, 0.7)) - 0.13, 0.02) * 0.8;
  b = mix(b, 0.18, hills(q, 0.38, 0.06, 3.0, 1.0));
  float boat = fill(sdB(q - vec2(0.1, hz + 0.06), vec2(0.32 - (q.y - hz) * 0.8, 0.06)), 0.01);
  float oar = fill(sdSeg(q, vec2(-0.1, hz + 0.1), vec2(-0.45, hz + 0.01)) - 0.01, 0.01);
  b = mix(b, 0.75, max(boat, oar));
  return m < 0.0 ? b * 0.55 : b;
}
float whale(vec2 p, float t) {
  float sf = 0.55 + 0.03 * sin(p.x * 8.0 + t * 1.2); if (p.y > sf) return 0.25 + 0.2 * sat(p.y - sf) + 0.5 * step(abs(p.y - sf), 0.02);
  float light = 0.14 + 0.18 * sat(p.y + 0.4) + 0.12 * pow(sat(sin(p.x * 3.0 + p.y + t * 0.3)), 6.0);
  vec2 q = p - vec2(0.15 * sin(t * 0.12), -0.1);
  float body = fill(length(q * vec2(0.62, 2.1)) - 0.5, 0.02);
  float tail = fill(sdTri(q, vec2(-0.75, 0.0), vec2(-1.05, 0.18), vec2(-1.05, -0.18)), 0.01);
  float fin = fill(sdTri(q, vec2(0.0, -0.12), vec2(-0.2, -0.38), vec2(0.18, -0.15)), 0.01);
  return mix(light, 0.03, max(body, max(tail, fin)));
}
float viaduct(vec2 p, float t) {
  float b = sky(p) + 0.25 * sat(0.3 - p.y);
  float deck = step(abs(p.y - 0.1), 0.05); float x = fract(p.x * 2.2) - 0.5;
  float pier = step(p.y, 0.05) * (1.0 - fill(length(vec2(x, max(p.y + 0.15, 0.0) * 1.2)) - 0.35, 0.01)) * step(-1.0, p.y);
  float train = step(abs(p.y - 0.22), 0.07) * step(abs(p.x - (mod(t * 0.35, 4.0) - 2.0)), 0.6);
  float win = train * step(0.5, fract(p.x * 14.0)) * step(abs(p.y - 0.24), 0.025);
  return max(b, max(max(deck, pier) * 0.42, train * 0.7 + win * 0.3));
}
float stationClock(vec2 p, float t) {
  float r = length(p); float b = 0.05 + fill(r - 0.68, 0.01) * 0.62 + fill(abs(r - 0.7) - 0.04, 0.01) * 0.3;
  float a = atan(p.x, p.y); float tick = step(0.85, fract(a / (2.0 * PI) * 12.0 + 0.075)) * step(0.54, r) * step(r, 0.64);
  float sec = floor(mod(t, 60.0)); float sa = sec / 60.0 * 2.0 * PI; float ma = (17.0 + sec / 60.0) / 60.0 * 2.0 * PI; float ha = 0.31 * 2.0 * PI;
  float hand = fill(sdSeg(p, vec2(0.0), 0.32 * vec2(sin(ha), cos(ha))) - 0.03, 0.01) + fill(sdSeg(p, vec2(0.0), 0.5 * vec2(sin(ma), cos(ma))) - 0.02, 0.01);
  float sh = fill(sdSeg(p, vec2(0.0), 0.56 * vec2(sin(sa), cos(sa))) - 0.008, 0.008);
  return mix(b, 0.03, sat(tick + hand + sh)) + fill(sdB(p - vec2(0.0, 0.9), vec2(0.03, 0.2)), 0.01) * 0.3;
}
float planeWindow(vec2 p, float t) {
  float w = sdB(p, vec2(0.45, 0.62)) - 0.25; float frame = fill(abs(w) - 0.06, 0.01);
  float view = fill(w, 0.01); float c = clouds(p * 1.2 + vec2(t * 0.15, 0.4), 0.0);
  float horizon = sat(0.5 - p.y * 0.6);
  return 0.18 * (1.0 - view) + view * (0.25 + horizon * 0.25 + c * 0.55) + frame * 0.55 + 0.1 * fill(length(p - vec2(0.35, 0.52)) - 0.05, 0.03) * view;
}
float desertRoad(vec2 p, float t) {
  float hz = 0.05; if (p.y > hz) return 0.15 + 0.35 * sat(1.0 - (p.y - hz) * 1.5) + 0.06 * sin(p.y * 90.0 + t * 3.0) * step(p.y, hz + 0.06) + 0.7 * fill(length(p - vec2(0.0, 0.42)) - 0.12, 0.02);
  float z = (hz + 0.02) / (hz + 0.02 - p.y); float x = p.x * z;
  float road = step(abs(x), 0.9); float dash = step(abs(x), 0.04) * step(0.5, fract(z * 0.5 - t * 0.6));
  return 0.32 * (1.0 - road) + 0.08 * road + dash * 0.85 + 0.05 * hash(floor(p * 40.0));
}
float lampSnow(vec2 p, float t) {
  float b = 0.04; float cone = sat(1.0 - abs(p.x - 0.1) / (0.08 + (0.55 - p.y) * 0.45)) * step(p.y, 0.55) * step(-0.9, p.y);
  vec2 q = vec2(p.x * 14.0 + sin(p.y * 3.0 + t) * 0.6, p.y * 14.0 + t * 1.8);
  float flake = step(0.88, hash(floor(q))) * fill(length(fract(q) - 0.5) - 0.2, 0.08);
  float pole = fill(sdB(p - vec2(0.1, -0.2), vec2(0.03, 0.75)), 0.01) * step(p.y, 0.55);
  float lamp = fill(sdB(p - vec2(0.1, 0.6), vec2(0.12, 0.05)), 0.02);
  float ground = step(p.y, -0.88);
  return b + cone * 0.35 + flake * (0.25 + cone) + pole * 0.4 + lamp * 0.95 + ground * (0.3 + cone * 0.5);
}
float windowGrid(vec2 p, float t) {
  float bld = step(abs(p.x), 0.85) * step(p.y, 0.85);
  vec2 c = floor(vec2(p.x * 6.0, p.y * 7.0)); vec2 f = fract(vec2(p.x * 6.0, p.y * 7.0));
  float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.8);
  float on = step(hash(c), sat(0.25 + mod(t, 40.0) / 40.0 * 0.6));
  return mix(0.05 + stars(p, 16.0, t) * 0.4, 0.13 + win * (0.1 + on * 0.75 * (0.8 + 0.2 * hash(c + 3.0))), bld);
}
float bridge(vec2 p, float t) {
  float b = sky(p) + stars(p, 16.0, t) * 0.4;
  float deck = step(abs(p.y + 0.05), 0.03); float tw = step(abs(abs(p.x) - 0.55), 0.04) * step(-0.6, p.y) * step(p.y, 0.6);
  float cab = fill(abs(p.y - (0.6 - 0.65 * sat(1.0 - pow(abs(abs(p.x) - 0.55) / 0.55, 0.6)) - 0.0)) - 0.012, 0.008) * step(abs(p.x), 1.1) * step(abs(p.x), 1.1);
  float lights = step(abs(p.y + 0.02), 0.012) * step(0.6, fract(p.x * 10.0));
  float river = step(p.y, -0.1); float refl = river * step(0.6, fract(p.x * 10.0)) * step(0.5, noise(vec2(p.x * 10.0, p.y * 30.0 + t))) * 0.4;
  return max(b * (1.0 - river) + river * 0.08 + refl, max(max(deck, tw) * 0.55, max(cab * 0.5, lights)));
}
float thunder(vec2 p, float t) {
  float c = fbm(p * 2.0 + vec2(t * 0.05, 0.0)); float b = 0.06 + 0.22 * smoothstep(0.4, 0.8, c) * step(0.0, p.y);
  float slot = floor(t / 4.0); float local = t - slot * 4.0; float on = step(local, 0.12) * step(0.55, hash(vec2(slot, 7.0))) * u_flash;
  float x0 = (hash(vec2(slot, 3.0)) - 0.5) * 1.2; float bolt = fill(abs(p.x - x0 - 0.12 * sin(p.y * 9.0 + slot) - 0.05 * sin(p.y * 31.0)) - 0.02, 0.01) * step(-0.75, p.y) * step(p.y, 0.4);
  float plains = step(p.y, -0.75) * (0.12 + on * 0.2);
  return b + on * (0.25 + bolt * 0.7) + plains;
}
float snowForest(vec2 p, float t) {
  float b = 0.08 + 0.1 * sat(p.y);
  for (int i = 0; i < 6; i++) { float fi = float(i); float x = -1.2 + fi * 0.48 + 0.1 * sin(fi * 3.0); float hgt = 0.5 + 0.35 * hash(vec2(fi, 1.0)); float base = -0.75 + 0.06 * hash(vec2(fi, 4.0));
    vec2 q = p - vec2(x, base); float tri = fill(sdTri(q, vec2(-0.22, 0.0), vec2(0.22, 0.0), vec2(0.0, hgt)), 0.01) + fill(sdTri(q, vec2(-0.18, hgt * 0.35), vec2(0.18, hgt * 0.35), vec2(0.0, hgt * 1.1)), 0.01);
    b = mix(b, 0.25 + 0.12 * step(0.75, fract(q.y * 8.0)), sat(tri)); }
  vec2 s = vec2(p.x * 16.0 + sin(p.y * 2.0 + t * 0.5) * 0.5, p.y * 16.0 + t * 1.3);
  b += step(0.9, hash(floor(s))) * fill(length(fract(s) - 0.5) - 0.18, 0.08) * 0.65;
  return b + step(p.y, -0.75) * 0.55;
}
float fogValley(vec2 p, float t) {
  float b = 0.5 + 0.3 * sat(p.y);
  for (int i = 0; i < 4; i++) { float fi = float(i); float y0 = 0.25 - fi * 0.3;
    float m = hills(p, y0, 0.12, 2.0 + fi, fi * 2.1); float fog = 0.55 - fi * 0.14;
    b = mix(b, fog - 0.2 + 0.08 * fbm(p * 3.0 + vec2(t * 0.06 * (fi + 1.0), 0.0)), m); }
  return b * 0.9;
}
float treeHill(vec2 p, float t) {
  float b = sky(p) + 0.2 * sat(0.4 - p.y);
  float hill = step(p.y, -0.45 - 0.25 * p.x * p.x); b = mix(b, 0.25, hill);
  float trunk = fill(sdB(p - vec2(0.0, -0.25), vec2(0.04, 0.25)), 0.01);
  vec2 c = p - vec2(0.0, 0.18); float sway = 0.03 * sin(t * 0.9);
  float canopy = fill(length(c * vec2(0.8, 1.2)) - 0.45 + 0.1 * fbm(c * 6.0 + vec2(sway * 20.0, 0.0)), 0.01);
  return mix(b, 0.04, max(trunk, canopy) * (1.0 - hill * 0.0)) + canopy * 0.12 * fbm(c * 9.0 + sway * 8.0);
}
float rose(vec2 p, float t) {
  vec2 c = p - vec2(0.0, 0.1); float r = length(c); float a = atan(c.y, c.x) + t * 0.05;
  float spiral = fract((log(max(r, 0.01)) * 1.4 + a / (2.0 * PI)) * 3.0);
  float head = fill(r - 0.62 - 0.05 * cos(a * 5.0), 0.01);
  float b = 0.04 + head * (0.35 + 0.5 * smoothstep(0.0, 0.25, spiral) * (1.0 - smoothstep(0.7, 1.0, spiral)) * (1.0 - r * 0.6));
  float stem = fill(sdSeg(p, vec2(0.0, -1.1), vec2(0.0, -0.5)) - 0.035, 0.01) * 0.4;
  return max(b, stem);
}
float sunflowers(vec2 p, float t) {
  float hz = 0.3; float b = p.y > hz ? 0.2 + 0.4 * sat(1.0 - (p.y - hz)) + 0.6 * fill(length(p - vec2(-0.6, 0.65)) - 0.15, 0.02) : 0.12;
  if (p.y < hz) { float z = 1.0 / (hz + 0.1 - p.y); vec2 g = vec2(p.x * z * 1.2, z * 1.4); vec2 f = fract(g) - 0.5; float sway = 0.06 * sin(t * 0.8 + floor(g.x));
    float head = fill(length(f - vec2(sway, 0.0)) - 0.32, 0.03); float cen = fill(length(f - vec2(sway, 0.0)) - 0.13, 0.03);
    b = mix(b, 0.85 - cen * 0.6, head * sat(1.6 - z * 0.12)); }
  return b;
}
float cactus(vec2 p, float t) {
  float b = 0.1 + 0.55 * sat(0.3 - p.y * 0.5) * step(-0.4, p.y) + 0.85 * fill(length(p - vec2(0.45, -0.25)) - 0.3, 0.01) * step(-0.4, p.y);
  float ground = step(p.y, -0.4 + 0.03 * sin(p.x * 5.0)); b = mix(b, 0.06, ground);
  float trunk = fill(sdB(p - vec2(-0.3, -0.05), vec2(0.09, 0.6)) - 0.05, 0.01);
  float arm1 = fill(sdB(p - vec2(-0.5, 0.05), vec2(0.06, 0.2)) - 0.04, 0.01) + fill(sdB(p - vec2(-0.42, -0.12), vec2(0.12, 0.05)) - 0.02, 0.01);
  float arm2 = fill(sdB(p - vec2(-0.1, 0.2), vec2(0.06, 0.16)) - 0.04, 0.01) + fill(sdB(p - vec2(-0.18, 0.06), vec2(0.1, 0.05)) - 0.02, 0.01);
  return mix(b, 0.02, sat(trunk + arm1 + arm2)) + 0.0 * t;
}
float waterfall(vec2 p, float t) {
  float cliff = step(abs(p.x), 0.4); float b = mix(0.18 + 0.1 * fbm(p * 5.0), 0.0, 0.0);
  float fall = cliff * step(-0.55, p.y) * step(p.y, 0.7) * (0.55 + 0.4 * step(0.5, fract(p.x * 18.0 + hash(vec2(floor(p.x * 18.0), 0.0)) + 0.0)) * fract(p.y * 3.0 + t * 1.6 + hash(vec2(floor(p.x * 18.0), 1.0))));
  float rock = (1.0 - cliff) * step(-0.55, p.y) * (0.12 + 0.12 * fbm(p * 7.0));
  float pool = step(p.y, -0.55) * (0.2 + 0.25 * noise(vec2(p.x * 10.0, p.y * 20.0 + t)));
  float spray = step(abs(p.y + 0.55), 0.15) * smoothstep(0.5, 0.8, noise(p * 14.0 + t * 2.0)) * 0.6 * step(abs(p.x), 0.6);
  return sat(b * 0.3 + fall + rock + pool + spray);
}
float candle(vec2 p, float t) {
  float tt = floor(t * 3.0) / 3.0; vec2 q = p - vec2(0.02 * sin(tt * 5.0), 0.25);
  float flame = fill(length(q * vec2(2.6, 1.0) - vec2(0.0, 0.1 * sat(q.y * 3.0))) - 0.22, 0.03);
  float core = fill(length(q * vec2(3.0, 1.4)) - 0.08, 0.02);
  float body = fill(sdB(p - vec2(0.0, -0.4), vec2(0.18, 0.45)), 0.01);
  float glow = sat(0.5 - length(p - vec2(0.0, 0.25)) * 0.6);
  return 0.03 + glow * 0.4 + body * (0.3 + glow * 0.4) + flame * 0.85 - core * 0.3;
}
float match(vec2 p, float t) {
  float cyc = mod(t, 12.0); float flare = 1.0 + 1.2 * smoothstep(0.0, 0.2, cyc) * (1.0 - smoothstep(0.2, 1.4, cyc));
  float stick = fill(sdSeg(p, vec2(-0.6, -0.8), vec2(0.0, 0.1)) - 0.04, 0.01);
  vec2 h = p - vec2(0.02, 0.14); float head = fill(length(h) - 0.08, 0.01);
  float flame = fill(length((h - vec2(0.02, 0.2 * flare)) * vec2(2.2, 0.9 / flare)) - 0.22, 0.03);
  return 0.03 + stick * 0.35 + max(head * 0.5, flame * 0.9) + sat(0.4 - length(h)) * 0.3 * flare;
}
float sunrise(vec2 p, float t) {
  float hz = -0.2 + 0.0; float rise = sat(mod(t, 60.0) / 60.0);
  vec2 s = vec2(0.0, -0.35 + rise * 0.35); float r = length(p - s); float a = atan(p.y - s.y, p.x - s.x);
  float sun = fill(r - 0.3, 0.01); float rays = step(0.0, p.y - hz) * step(0.35, r) * step(0.75, fract(a / (2.0 * PI) * 16.0 + t * 0.01)) * sat(1.2 - r);
  float b = 0.08 + 0.4 * sat(1.0 - p.y * 0.8) * step(hz, p.y);
  float hill = hills(p, hz, 0.06, 2.4, 0.5);
  return mix(max(b + rays * 0.45, sun), 0.06, hill);
}
float hands(vec2 p, float t) {
  float gap = 0.12 + 0.02 * sin(t * 0.5);
  vec2 l = p - vec2(-gap, 0.0); vec2 r = vec2(-p.x, p.y) - vec2(-gap, 0.0);
  float fl = fill(sdSeg(l, vec2(-1.2, -0.1), vec2(-0.02, 0.0)) - 0.06, 0.01) + fill(sdSeg(l, vec2(-1.3, -0.25), vec2(-0.55, -0.12)) - 0.16, 0.01);
  float fr = fill(sdSeg(r, vec2(-1.2, 0.1), vec2(-0.02, 0.0)) - 0.06, 0.01) + fill(sdSeg(r, vec2(-1.3, 0.25), vec2(-0.55, 0.12)) - 0.16, 0.01);
  float spark = fill(length(p) - 0.03, 0.03) * 0.6;
  return 0.05 + sat(fl) * 0.7 + sat(fr) * 0.55 + spark;
}
float dancer(vec2 p, float t) {
  float spin = sin(t * 1.4); vec2 q = p;
  float head = fill(length(q - vec2(0.0, 0.62)) - 0.11, 0.01);
  float torso = fill(sdTri(q, vec2(-0.08, 0.48), vec2(0.08, 0.48), vec2(0.0, 0.0)) - 0.03, 0.01);
  float skirt = fill(sdTri(q, vec2(0.0, 0.08), vec2(-0.7 - 0.15 * spin, -0.45 + 0.08 * spin), vec2(0.7 - 0.15 * spin, -0.45 - 0.08 * spin)), 0.01);
  float arm = fill(sdSeg(q, vec2(0.0, 0.42), vec2(0.45, 0.8)) - 0.03, 0.01) + fill(sdSeg(q, vec2(0.0, 0.42), vec2(-0.5, 0.55)) - 0.03, 0.01);
  float leg = fill(sdSeg(q, vec2(0.05, -0.4), vec2(0.08, -0.95)) - 0.03, 0.01);
  float spot = sat(0.6 - length(p * vec2(1.0, 0.6)) * 0.6);
  return 0.04 + spot * 0.4 - sat(head + torso + skirt + arm + leg) * spot * 0.4 + sat(head + torso + skirt + arm + leg) * 0.04 + step(p.y, -0.95) * 0.3;
}
float crowd(vec2 p, float t) {
  float b = 0.08 + 0.55 * sat(1.0 - length(p - vec2(0.0, 0.9)) * 0.8);
  for (int i = 0; i < 7; i++) { float fi = float(i); float x = -1.1 + fi * 0.37; float up = 0.2 * sin(t * 1.3 + fi * 1.9);
    float arm = fill(sdSeg(p, vec2(x, -1.0), vec2(x + 0.08 * sin(fi), -0.2 + up + 0.15 * hash(vec2(fi, 2.0)))) - 0.04, 0.01);
    float palm = fill(length(p - vec2(x + 0.08 * sin(fi), -0.15 + up + 0.15 * hash(vec2(fi, 2.0)))) - 0.08, 0.01);
    b = mix(b, 0.02, sat(arm + palm)); }
  float heads = step(p.y, -0.7 + 0.08 * sin(p.x * 12.0)); return mix(b, 0.02, heads);
}
float cassette(vec2 p, float t) {
  float body = fill(sdB(p, vec2(0.95, 0.6)) - 0.05, 0.01); float label = fill(sdB(p - vec2(0.0, 0.15), vec2(0.78, 0.32)), 0.01);
  float win = fill(sdB(p - vec2(0.0, 0.12), vec2(0.45, 0.13)) - 0.05, 0.01);
  float b = 0.04 + body * 0.35 + label * 0.25 - win * 0.45;
  for (int i = 0; i < 2; i++) { vec2 c = p - vec2(i == 0 ? -0.32 : 0.32, 0.12); float r = length(c); float a = atan(c.y, c.x) - t * 2.0;
    b = mix(b, 0.85, fill(abs(r - 0.1) - 0.025, 0.01)); b = mix(b, 0.85, fill(r - 0.1, 0.01) * step(0.7, fract(a / (2.0 * PI) * 6.0))); }
  b += fill(sdB(p - vec2(0.0, -0.42), vec2(0.5, 0.08)), 0.01) * 0.2;
  return b;
}
float vinyl(vec2 p, float t) {
  vec2 c = p - vec2(-0.15, 0.0); float r = length(c); float a = atan(c.y, c.x) + t * 3.5;
  float disc = fill(r - 0.82, 0.01); float grooves = 0.12 + 0.06 * step(0.5, fract(r * 40.0)) + 0.35 * pow(sat(cos(a * 1.0 + 0.6)), 20.0) * step(0.3, r);
  float label = fill(r - 0.26, 0.01); float hole = fill(r - 0.03, 0.01);
  float arm = fill(sdSeg(p, vec2(0.85, 0.75), vec2(0.45, -0.15)) - 0.03, 0.01) + fill(length(p - vec2(0.85, 0.75)) - 0.09, 0.01);
  float b = 0.04 + disc * grooves; b = mix(b, 0.7 + 0.15 * step(0.5, fract(a / PI)), label); b = mix(b, 0.02, hole);
  return max(b, arm * 0.85);
}
float telephone(vec2 p, float t) {
  float base = fill(sdB(p - vec2(0.0, -0.5), vec2(0.55, 0.28)) - 0.08, 0.01);
  float dial = fill(length(p - vec2(0.0, -0.45)) - 0.2, 0.01) * (0.4 + 0.4 * step(0.5, fract(atan(p.y + 0.45, p.x) / (2.0 * PI) * 10.0)));
  vec2 h = rot(0.35 + 0.03 * sin(t)) * (p - vec2(0.35, 0.35));
  float hs = fill(sdB(h, vec2(0.45, 0.07)) - 0.03, 0.01) + fill(length(h - vec2(-0.45, -0.06)) - 0.12, 0.01) + fill(length(h - vec2(0.45, -0.06)) - 0.12, 0.01);
  float cord = fill(abs(p.y - (-0.05 + 0.3 * (p.x + 0.6)) - 0.04 * sin(p.x * 60.0)) - 0.012, 0.008) * step(-0.6, p.x) * step(p.x, 0.0);
  return 0.04 + base * 0.45 + dial * 0.5 + sat(hs) * 0.8 + cord * 0.55;
}
float radio(vec2 p, float t) {
  float body = fill(sdB(p, vec2(0.95, 0.55)) - 0.08, 0.01);
  float grille = fill(sdB(p - vec2(-0.4, 0.0), vec2(0.38, 0.4)), 0.01) * step(0.5, fract(p.y * 14.0));
  float dial = fill(sdB(p - vec2(0.45, 0.2), vec2(0.38, 0.12)), 0.01);
  float needle = fill(sdB(p - vec2(0.15 + 0.6 * (0.5 + 0.5 * sin(t * 0.25)), 0.2), vec2(0.012, 0.11)), 0.005);
  float knob = fill(length(p - vec2(0.3, -0.25)) - 0.1, 0.01) + fill(length(p - vec2(0.62, -0.25)) - 0.1, 0.01);
  return 0.04 + body * 0.3 + grille * 0.35 + dial * 0.5 - needle * 0.45 + sat(knob) * 0.4 + 0.0 * t;
}
float speaker(vec2 p, float t) {
  float pulse = 1.0 + 0.05 * u_beat; float r = length(p) / pulse;
  float b = 0.05 + fill(sdB(p, vec2(0.8, 0.95)) - 0.05, 0.01) * 0.15;
  b = mix(b, 0.25 + 0.4 * (1.0 - r), fill(r - 0.62, 0.01)); b = mix(b, 0.75, fill(abs(r - 0.62) - 0.04, 0.01)); b = mix(b, 0.85, fill(r - 0.16, 0.01));
  b += step(0.5, fract(r * 7.0)) * 0.08 * step(r, 0.6);
  return b;
}
float hourglass(vec2 p, float t) {
  float ph = mod(t, 30.0) / 30.0;
  float glass = fill(abs(p.x) - (0.06 + 0.42 * pow(abs(p.y) / 0.75, 1.2)), 0.01) * step(abs(p.y), 0.75);
  float top = glass * step(0.0, p.y) * step(p.y, 0.7 * (1.0 - ph));
  float bot = glass * step(p.y, 0.0) * step(p.y, -0.75 + 0.6 * ph * (1.0 - abs(p.x) * 0.8));
  float stream = step(abs(p.x), 0.015) * step(abs(p.y), 0.4) * step(0.3, fract(p.y * 12.0 + t * 4.0));
  float caps = fill(sdB(vec2(p.x, abs(p.y) - 0.8), vec2(0.6, 0.05)), 0.01);
  return 0.04 + glass * 0.12 + (top + bot) * 0.8 + stream * 0.8 + caps * 0.5;
}
float keyLock(vec2 p, float t) {
  float shackle = fill(abs(sdB(p - vec2(-0.35, 0.3), vec2(0.2, 0.3)) - 0.12) - 0.07, 0.01) * step(0.2, p.y);
  float body = fill(sdB(p - vec2(-0.35, -0.2), vec2(0.4, 0.33)) - 0.05, 0.01);
  float hole = fill(length(p - vec2(-0.35, -0.12)) - 0.07, 0.01) + fill(sdB(p - vec2(-0.35, -0.25), vec2(0.025, 0.1)), 0.01);
  vec2 k = rot(0.2 * sin(t * 0.8)) * (p - vec2(0.45, -0.15));
  float key = fill(abs(length(k - vec2(0.3, 0.0)) - 0.15) - 0.05, 0.01) + fill(sdB(k - vec2(-0.05, 0.0), vec2(0.22, 0.035)), 0.01) + fill(sdB(k - vec2(-0.2, -0.07), vec2(0.03, 0.06)), 0.01);
  return 0.04 + sat(shackle) * 0.6 + body * 0.5 - sat(hole) * 0.45 + sat(key) * 0.85;
}
float crown(vec2 p, float t) {
  float band = fill(sdB(p - vec2(0.0, -0.35), vec2(0.7, 0.13)), 0.01);
  float spikes = fill(sdTri(p, vec2(-0.7, -0.25), vec2(-0.7, 0.45), vec2(-0.35, -0.25)), 0.01) + fill(sdTri(p, vec2(-0.35, -0.25), vec2(0.0, 0.55), vec2(0.35, -0.25)), 0.01) + fill(sdTri(p, vec2(0.35, -0.25), vec2(0.7, 0.45), vec2(0.7, -0.25)), 0.01);
  float jewels = fill(length(p - vec2(0.0, -0.35)) - 0.07, 0.01) + fill(length(p - vec2(-0.4, -0.35)) - 0.05, 0.01) + fill(length(p - vec2(0.4, -0.35)) - 0.05, 0.01);
  float glint = step(0.92, fract(t * 0.25)) * fill(length(p - vec2(0.0, 0.55)) - 0.08, 0.03);
  return 0.04 + sat(band + spikes) * 0.55 + sat(jewels) * 0.35 + glint * 0.6 + fill(sdB(p - vec2(0.0, -0.35), vec2(0.7, 0.02)), 0.01) * 0.2;
}
float diamond(vec2 p, float t) {
  float top = fill(sdB(p - vec2(0.0, 0.3), vec2(0.6 - (p.y - 0.3) * 0.6, 0.15)), 0.01) * step(0.15, p.y);
  float bot = fill(sdTri(p, vec2(-0.7, 0.15), vec2(0.7, 0.15), vec2(0.0, -0.75)), 0.01);
  float facet = step(0.5, fract((p.x + abs(p.y - 0.15) * 0.8) * 3.0)) * 0.25;
  float glint = step(0.85, fract(t * 0.2)) * sat(1.0 - length((p - vec2(0.25, 0.32)) * vec2(1.0, 4.0)) * 4.0) + step(0.85, fract(t * 0.2)) * sat(1.0 - length((p - vec2(0.25, 0.32)) * vec2(4.0, 1.0)) * 4.0);
  return 0.04 + sat(top + bot) * (0.4 + facet) + glint * 0.7;
}
float swallow(vec2 p, float t) {
  vec2 q = p - vec2(mod(t * 0.12, 3.0) - 1.5, 0.15 * sin(t * 0.5)); float flap = 0.15 * sin(t * 3.0);
  float body = fill(length(q * vec2(1.0, 2.8)) - 0.22, 0.01);
  float wl = fill(sdTri(q, vec2(-0.05, 0.0), vec2(0.1, 0.0), vec2(-0.25, 0.55 + flap)), 0.01) + fill(sdTri(q, vec2(-0.05, 0.0), vec2(0.1, 0.0), vec2(-0.2, -0.5 - flap)), 0.01);
  float tail = fill(sdTri(q, vec2(-0.15, 0.0), vec2(-0.45, 0.1), vec2(-0.35, 0.0)), 0.01) + fill(sdTri(q, vec2(-0.15, 0.0), vec2(-0.45, -0.1), vec2(-0.35, 0.0)), 0.01);
  return mix(sky(p) + 0.3 * sat(0.5 - p.y * 0.5) + clouds(p, t) * 0.2, 0.02, sat(body + wl + tail));
}
float birdsWire(vec2 p, float t) {
  float b = 0.12 + 0.35 * sat(0.6 - p.y * 0.6);
  float wire = fill(abs(p.y + 0.08 * p.x * p.x - 0.0) - 0.008, 0.006);
  for (int i = 0; i < 5; i++) { float fi = float(i); float x = -0.8 + fi * 0.38 + 0.05 * hash(vec2(fi, 9.0)); float y = -0.08 * x * x;
    float hop = step(0.97, fract(t * 0.07 + fi * 0.21)) * 0.04;
    vec2 q = p - vec2(x, y + 0.12 + hop); float body = fill(length(q * vec2(1.0, 1.25)) - 0.1, 0.01) + fill(length(q - vec2(0.06, 0.1)) - 0.055, 0.01) + fill(sdTri(q, vec2(-0.05, -0.04), vec2(-0.2, -0.12), vec2(-0.08, -0.08)), 0.01);
    b = mix(b, 0.02, sat(body)); }
  return mix(b, 0.02, wire);
}
float cat(vec2 p, float t) {
  float win = fill(sdB(p - vec2(0.0, 0.15), vec2(0.8, 0.75)), 0.01); float mull = step(abs(p.x), 0.02) + step(abs(p.y - 0.2), 0.02);
  float moonl = 0.25 + 0.45 * win + 0.4 * fill(length(p - vec2(0.45, 0.55)) - 0.12, 0.01);
  float sill = step(p.y, -0.55) * step(-0.62, p.y);
  float body = fill(length((p - vec2(-0.2, -0.38)) * vec2(1.0, 1.4)) - 0.25, 0.01); float head = fill(length(p - vec2(-0.2, -0.05)) - 0.13, 0.01);
  float ears = fill(sdTri(p, vec2(-0.32, 0.02), vec2(-0.24, 0.02), vec2(-0.3, 0.15)), 0.01) + fill(sdTri(p, vec2(-0.16, 0.02), vec2(-0.08, 0.02), vec2(-0.1, 0.15)), 0.01);
  float flick = 0.15 * sin(t * 1.8) * step(0.6, fract(t * 0.2));
  float tail = fill(sdSeg(p, vec2(0.02, -0.5), vec2(0.15 + flick, -0.75)) - 0.03, 0.01);
  return mix(moonl * (1.0 - mull * win * 0.6), 0.02, sat(body + head + ears + tail + sill * 0.0)) + sill * 0.3;
}
float rocket(vec2 p, float t) {
  float rise = mod(t * 0.08, 1.6) - 0.3; vec2 q = p - vec2(0.0, rise);
  float body = fill(sdB(q, vec2(0.12, 0.42)), 0.01) + fill(sdTri(q, vec2(-0.12, 0.42), vec2(0.12, 0.42), vec2(0.0, 0.7)), 0.01);
  float fins = fill(sdTri(q, vec2(-0.12, -0.42), vec2(-0.3, -0.5), vec2(-0.12, -0.15)), 0.01) + fill(sdTri(q, vec2(0.12, -0.42), vec2(0.3, -0.5), vec2(0.12, -0.15)), 0.01);
  float smoke = sat(fbm(vec2(p.x * 3.0, p.y * 2.0 - t * 0.6)) * 1.4 - 0.3) * step(p.y, rise - 0.45) * sat(1.0 - abs(p.x) / (0.12 + (rise - 0.45 - p.y) * 0.5));
  float flame = fill(length((q - vec2(0.0, -0.55)) * vec2(2.5, 1.0)) - 0.15, 0.02);
  return sky(p) + stars(p, 18.0, t) * 0.4 + sat(body + fins) * 0.75 + smoke * 0.5 + flame * 0.95;
}
float ferris(vec2 p, float t) {
  vec2 c = p - vec2(0.0, 0.15); float r = length(c); float a = atan(c.y, c.x) + t * 0.15;
  float rim = fill(abs(r - 0.7) - 0.02, 0.01); float spokes = step(0.94, fract(a / (2.0 * PI) * 12.0)) * step(r, 0.7);
  float b = sky(p) + rim * 0.6 + spokes * 0.4;
  for (int i = 0; i < 12; i++) { float aa = float(i) / 12.0 * 2.0 * PI - t * 0.15; vec2 g = vec2(cos(aa), sin(aa)) * 0.7 - vec2(0.0, 0.08);
    b = max(b, fill(sdB(c - g, vec2(0.06, 0.05)), 0.01) * (0.6 + 0.35 * step(0.5, fract(float(i) * 0.37 + floor(t * 0.5) * 0.1)))); }
  float legs = fill(sdSeg(p, vec2(0.0, 0.15), vec2(-0.45, -0.9)) - 0.02, 0.01) + fill(sdSeg(p, vec2(0.0, 0.15), vec2(0.45, -0.9)) - 0.02, 0.01);
  return b + sat(legs) * 0.35;
}
float paperPlane(vec2 p, float t) {
  vec2 q = rot(0.15 + 0.05 * sin(t * 0.7)) * (p - vec2(mod(t * 0.15, 3.0) - 1.5, 0.1 * sin(t * 0.6)));
  float w1 = fill(sdTri(q, vec2(0.35, 0.0), vec2(-0.3, 0.22), vec2(-0.15, 0.0)), 0.01);
  float w2 = fill(sdTri(q, vec2(0.35, 0.0), vec2(-0.3, -0.12), vec2(-0.15, 0.0)), 0.01);
  float trail = fill(abs(p.y - 0.1 * sin(t * 0.6) - 0.05 * sin(p.x * 4.0)) - 0.006, 0.006) * step(0.5, fract(p.x * 10.0)) * 0.3;
  return sky(p) + 0.2 * sat(0.3 - p.y * 0.4) + w1 * 0.9 + w2 * 0.55 + trail;
}
float balloon(vec2 p, float t) {
  vec2 c = p - vec2(0.1 * sin(t * 0.4), -0.2 + mod(t * 0.05, 1.2));
  float body = fill(length(c * vec2(1.0, 0.85)) - 0.32, 0.01); float shine = fill(length(c - vec2(-0.12, 0.14)) - 0.06, 0.02);
  float knot = fill(sdTri(c, vec2(-0.04, -0.4), vec2(0.04, -0.4), vec2(0.0, -0.36)), 0.01);
  float string = fill(abs(c.x - 0.04 * sin(c.y * 10.0)) - 0.006, 0.005) * step(c.y, -0.4) * step(-1.2, c.y);
  return sky(p) + clouds(p, t) * 0.25 + body * (0.5 + shine * 0.45) + knot * 0.5 + string * 0.45;
}
float mirror(vec2 p, float t) {
  float frame = fill(abs(sdB(p, vec2(0.65, 0.85)) - 0.04) - 0.04, 0.01);
  float glass = fill(sdB(p, vec2(0.62, 0.82)), 0.01);
  vec2 c = p - vec2(0.15, 0.2); float a = atan(c.y, c.x); float r = length(c);
  float crack = step(0.97, fract(a / (2.0 * PI) * 9.0 + 0.04 * sin(r * 12.0))) * step(r, 0.7 + 0.2 * hash(vec2(floor(a * 9.0 / (2.0 * PI)), 0.0)));
  float ring = fill(abs(r - 0.2) - 0.01, 0.006) + fill(abs(r - 0.42) - 0.01, 0.006) * step(0.5, fract(a * 2.0));
  float sheen = 0.25 + 0.2 * sat(1.0 - abs(p.x + p.y * 0.6 + 0.2) * 2.0) + 0.0 * t;
  return 0.04 + frame * 0.55 + glass * (sheen + sat(crack + ring) * 0.6);
}
float cup(vec2 p, float t) {
  float cupd = fill(sdB(p - vec2(-0.1, -0.35), vec2(0.36 - (p.y + 0.35) * 0.1, 0.3)) - 0.04, 0.01);
  float handle = fill(abs(length((p - vec2(0.32, -0.32)) * vec2(1.0, 0.85)) - 0.15) - 0.04, 0.01) * step(0.3, p.x);
  float saucer = fill(length((p - vec2(-0.1, -0.7)) * vec2(1.0, 5.0)) - 0.6, 0.02);
  float steam = 0.0;
  for (int i = 0; i < 3; i++) { float fi = float(i); float x = -0.25 + fi * 0.15 + 0.06 * sin(p.y * 6.0 - t * 1.4 + fi * 2.0);
    steam += fill(abs(p.x - x) - 0.025, 0.02) * step(0.05, p.y) * step(p.y, 0.85) * sat(1.0 - (p.y - 0.05) * 1.2) * step(0.35, fract(p.y * 2.0 - t * 0.5 + fi * 0.3)); }
  return 0.04 + max(sat(cupd + handle) * 0.75, saucer * 0.45) + steam * 0.5;
}

float subject(int i, vec2 p, float t) {
  switch (i) {
    case 0: return eye(p, t); case 1: return highway(p, t); case 2: return slowLights(p, t); case 3: return ocean(p, t);
    case 4: return fire(p, t); case 5: return skyline(p, t); case 6: return planet(p, t); case 7: return rain(p, t);
    case 8: return tunnel(p, t); case 9: return heart(p, t); case 10: return flower(p, t); case 11: return mountains(p, t);
    case 12: return globe(p, t); case 13: return helix(p, t); case 14: return butterfly(p, t); case 15: return moon(p, t);
    case 16: return comet(p, t); case 17: return constellation(p, t); case 18: return eclipse(p, t); case 19: return lighthouse(p, t);
    case 20: return sailboat(p, t); case 21: return rowboat(p, t); case 22: return whale(p, t); case 23: return viaduct(p, t);
    case 24: return stationClock(p, t); case 25: return planeWindow(p, t); case 26: return desertRoad(p, t); case 27: return lampSnow(p, t);
    case 28: return windowGrid(p, t); case 29: return bridge(p, t); case 30: return thunder(p, t); case 31: return snowForest(p, t);
    case 32: return fogValley(p, t); case 33: return treeHill(p, t); case 34: return rose(p, t); case 35: return sunflowers(p, t);
    case 36: return cactus(p, t); case 37: return waterfall(p, t); case 38: return candle(p, t); case 39: return match(p, t);
    case 40: return sunrise(p, t); case 41: return hands(p, t); case 42: return dancer(p, t); case 43: return crowd(p, t);
    case 44: return cassette(p, t); case 45: return vinyl(p, t); case 46: return telephone(p, t); case 47: return radio(p, t);
    case 48: return speaker(p, t); case 49: return hourglass(p, t); case 50: return keyLock(p, t); case 51: return crown(p, t);
    case 52: return diamond(p, t); case 53: return swallow(p, t); case 54: return birdsWire(p, t); case 55: return cat(p, t);
    case 56: return rocket(p, t); case 57: return ferris(p, t); case 58: return paperPlane(p, t); case 59: return balloon(p, t);
    case 60: return mirror(p, t); default: return cup(p, t);
  }
}

void main() {
  vec2 uv = v_uv; // from the top-left
  if (uv.x < u_rect.x || uv.y < u_rect.y || uv.x > u_rect.z || uv.y > u_rect.w) { o = vec4(u_bgc, 1.0); return; }
  vec2 rpx = (u_rect.zw - u_rect.xy) * u_res;
  vec2 local = (uv - u_rect.xy) / (u_rect.zw - u_rect.xy); // 0..1 in the picture
  float m = min(rpx.x, rpx.y);
  vec2 p = (local - 0.5) * rpx / m * 2.0; p.y = -p.y;
  p = p / u_zoom + u_pan;
  float b = sat(subject(u_subject, p, u_time));
  vec2 cell = floor(local * u_cells);
  if (u_subject2 >= 0) {
    float n = hash(cell + 3.7) * 0.35 + local.x * 0.65; // the front sweeps left to right, ragged by cell
    if (n < u_front) b = sat(subject(u_subject2, p, u_time));
  }
  if (u_develop < 0.999) {
    // develop (and decay): a cell shows once its brightness clears the threshold, brightest first, with a little noise
    float thr = 1.0 - u_develop;
    b *= step(thr, b + (hash(cell + 1.3) - 0.5) * 0.2);
  }
  vec3 col = b < 0.5 ? mix(u_c0, u_c1, b * 2.0) : mix(u_c1, u_c2, (b - 0.5) * 2.0);
  o = vec4(col, 1.0);
}`;
