// Fragment shaders for the reference scenes (all drawn with FULL_VS: v_uv has y DOWN, v_tc has y UP).

const HEAD = '#version 300 es\nprecision highp float;\n';
const NOISE = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(7.1, 3.7); a *= 0.5; } return s; }
vec3 hsv(float h, float s, float v) {
  vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}
`;

/** Apple-style gradient mesh: four soft colour blobs drifting over a base colour */
export const MESH_FS = `${HEAD}
in vec2 v_uv;
out vec4 o;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_c[4];
uniform float u_pulse;
${NOISE}
void main() {
  float aspect = u_res.x / u_res.y;
  vec2 uv = v_uv;
  float t = u_time;
  uv += 0.012 * vec2(sin(uv.y * 3.0 + t * 0.4), cos(uv.x * 3.0 - t * 0.33));
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 pos = vec2(0.5 + 0.5 * sin(t * (0.13 + fi * 0.03) + fi * 1.9), 0.5 + 0.55 * cos(t * (0.11 + fi * 0.025) + fi * 2.7));
    vec2 d = (uv - pos) * vec2(aspect, 1.0);
    float w = exp(-dot(d, d) * (1.5 + 0.3 * fi)) + 0.0001;
    acc += u_c[i] * w;
    wsum += w;
  }
  vec3 col = acc / wsum;
  col *= 0.96 + 0.06 * u_pulse;
  o = vec4(col, 1.0);
}`;

/** deep-space nebula: indigo ground, violet and magenta gas, a few bright wisps */
export const NEBULA_FS = `${HEAD}
in vec2 v_uv;
out vec4 o;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_c[4];
uniform float u_pulse;
${NOISE}
void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = v_uv * vec2(aspect, 1.0) * 1.6;
  float t = u_time * 0.035;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
  float n = fbm(p + 2.2 * q + vec2(t * 0.6, 0.0));
  float n2 = fbm(p * 1.7 - 1.6 * q + vec2(3.3, t));
  vec3 col = u_c[3];
  col = mix(col, u_c[0] * 0.8, smoothstep(0.22, 0.95, n));
  col = mix(col, u_c[1], smoothstep(0.4, 1.0, n2) * 0.6 * smoothstep(0.25, 0.95, n));
  col = mix(col, u_c[2], smoothstep(0.62, 0.95, n * n2 * 1.6) * 0.55);
  // bright filaments
  float ridge = 1.0 - abs(fbm(p * 2.4 + q * 2.0 + t) * 2.0 - 1.0);
  col += u_c[0] * pow(ridge, 6.0) * 0.35 * smoothstep(0.35, 0.8, n);
  col *= 0.9 + 0.1 * u_pulse;
  o = vec4(col, 1.0);
}`;

/** acid: big saturated colour blobs whose hues keep rolling */
export const ACID_FS = `${HEAD}
in vec2 v_uv;
out vec4 o;
uniform vec2 u_res;
uniform float u_time;
${NOISE}
void main() {
  float aspect = u_res.x / u_res.y;
  vec2 uv = v_uv;
  float t = u_time;
  uv += 0.06 * vec2(sin(uv.y * 4.0 + t * 0.9), cos(uv.x * 4.0 - t * 0.7));
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 pos = vec2(0.5 + 0.55 * sin(t * (0.34 + fi * 0.07) + fi * 2.1), 0.5 + 0.6 * cos(t * (0.29 + fi * 0.05) + fi * 1.3));
    vec2 d = (uv - pos) * vec2(aspect, 1.0);
    float w = exp(-dot(d, d) * (4.2 + fi * 0.5)) + 0.0002;
    float hue = fract(0.02 + fi * 0.21 + t * 0.075 + 0.06 * sin(t * 0.7 + fi));
    acc += hsv(hue, 0.7, 0.8) * w;
    wsum += w;
  }
  vec3 col = acc / wsum;
  col = mix(vec3(dot(col, vec3(0.333))), col, 0.95);
  col *= 0.88 + 0.24 * fbm(uv * vec2(aspect, 1.0) * 9.0 + t * 0.15);
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

/**
 * The picture that gets turned into characters: an amber eye with lids and a pupil, or a banded ringed planet, with a dissolve
 * between them. Brown skin round the eye, black round the planet.
 */
export const EYE_FS = `${HEAD}
in vec2 v_uv;
out vec4 o;
uniform vec2 u_res;
uniform float u_time;
uniform float u_open;     // 0 shut .. 1 open
uniform vec2 u_look;      // where the eye looks, -1..1
uniform float u_dil;      // pupil size multiplier
uniform float u_zoom;     // 1 = the whole eye
uniform float u_morph;    // 0 eye .. 1 planet (through a dissolve)
uniform float u_win;      // 1 inside the window the picture lives in (set by the vertex of the scene: window rect in uv)
uniform vec4 u_rect;      // window in uv: x0, y0, x1, y1
uniform int u_subject;    // 0 eye (and planet), 1 highway, 2 flashing lights, 3 ocean, 4 fire, 5 city, 6 space, 7 rain
uniform float u_beat;     // 0..1 pulse on the beat
uniform float u_energy;   // 0..1 how lively the song is
${NOISE}
vec3 eye(vec2 p) {
  // p: -1..1 in the window, x across
  p /= u_zoom;
  float ax = abs(p.x);
  float lid = u_open * 0.46 * pow(max(0.0, 1.0 - pow(ax / 0.98, 2.0)), 0.72);
  // skin
  float sk = fbm(p * 7.0) * 0.55 + fbm(p * 22.0) * 0.25;
  vec3 skin = mix(vec3(0.42, 0.25, 0.14), vec3(0.78, 0.5, 0.3), sk);
  skin *= 0.75 + 0.35 * smoothstep(0.9, 0.0, length(p * vec2(0.7, 1.1)));
  // brow crease and the lid fold
  float crease = exp(-pow((p.y + lid * 1.35 + 0.1) * 9.0, 2.0)) * smoothstep(1.0, 0.2, ax);
  skin *= 1.0 - 0.45 * crease;
  float inside = 1.0 - smoothstep(-0.012, 0.012, abs(p.y) - lid);
  if (u_open < 0.03) { return skin * 0.85; }
  // the eyeball
  vec2 ic = u_look * vec2(0.2, 0.09);
  vec2 d = p - ic;
  float r = length(d);
  float ang = atan(d.y, d.x);
  float irisR = 0.34;
  float pupilR = 0.125 * u_dil;
  vec3 scl = mix(vec3(0.62, 0.6, 0.62), vec3(0.93, 0.92, 0.94), smoothstep(1.0, 0.1, ax));
  scl *= 0.65 + 0.35 * smoothstep(lid, 0.0, abs(p.y)) ; // shaded toward the lids
  scl -= vec3(0.0, 0.1, 0.1) * noise(p * 14.0) * smoothstep(0.35, 0.95, ax);
  float fib = noise(vec2(ang * 11.0, r * 14.0)) * 0.6 + noise(vec2(ang * 29.0, r * 6.0)) * 0.4;
  vec3 irisC = mix(vec3(0.34, 0.17, 0.04), vec3(0.86, 0.55, 0.16), smoothstep(pupilR, irisR * 0.9, r) * (0.55 + 0.55 * fib));
  irisC = mix(irisC, vec3(0.95, 0.75, 0.3), smoothstep(0.6, 0.9, fib) * smoothstep(pupilR * 1.3, irisR, r) * 0.5);
  irisC *= mix(1.0, 0.25, smoothstep(irisR * 0.78, irisR, r)); // limbal ring
  vec3 ball = scl;
  ball = mix(ball, irisC, 1.0 - smoothstep(irisR - 0.012, irisR + 0.012, r));
  ball = mix(ball, vec3(0.015), 1.0 - smoothstep(pupilR - 0.008, pupilR + 0.008, r));
  // glints
  float gl = 1.0 - smoothstep(0.0, 0.05, length((d - vec2(0.09, 0.08)) * vec2(1.0, 1.2)));
  ball += vec3(1.0) * gl * 0.9;
  // lid shadow and the dark line where lid meets ball
  ball *= 0.55 + 0.45 * smoothstep(0.0, 0.1, lid - abs(p.y));
  float edge = 1.0 - smoothstep(0.0, 0.03, abs(abs(p.y) - lid));
  ball = mix(ball, vec3(0.05, 0.03, 0.02), edge * 0.8);
  return mix(skin, ball, inside);
}

float box(vec2 q, vec2 b) { vec2 d = abs(q) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }

vec3 highway(vec2 p) {
  float t = u_time;
  float hy = -0.2;
  vec3 col;
  if (p.y < hy) {
    float g = clamp((p.y + 1.0) / (hy + 1.0), 0.0, 1.0);
    col = mix(vec3(0.02, 0.02, 0.08), vec3(1.0, 0.5, 0.22), pow(g, 3.2));
    col += vec3(0.8, 0.75, 0.6) * step(0.997, hash(floor(p * 80.0))) * (1.0 - g);
    float sx = floor(p.x * 16.0);
    float top = hy - 0.03 - 0.12 * hash(vec2(sx, 3.0));
    if (p.y > top) {
      col = vec3(0.03, 0.025, 0.06);
      col += vec3(1.0, 0.8, 0.35) * step(0.82, hash(floor(p * vec2(90.0, 80.0)) + 7.0)) * 0.7;
    }
    return col;
  }
  float u = p.y - hy;
  float xr = p.x / u;
  float z = 1.0 / u;
  float road = 1.0 - smoothstep(1.1, 1.14, abs(xr));
  col = mix(vec3(0.02, 0.04, 0.02), vec3(0.07, 0.07, 0.09), road);
  float dash = step(0.5, fract(z * 1.6 - t * (1.2 + 2.2 * u_energy)));
  float lane = (1.0 - smoothstep(0.012, 0.03, abs(abs(xr) - 0.36))) * dash;
  float edge = 1.0 - smoothstep(0.02, 0.045, abs(abs(xr) - 1.05));
  float centre = 1.0 - smoothstep(0.01, 0.025, abs(xr));
  col += vec3(0.9, 0.9, 0.8) * (lane + edge * 0.9) * road;
  col += vec3(1.0, 0.8, 0.2) * centre * step(0.4, fract(z * 0.9 - t * 0.9)) * 0.0;
  // posts with lamps on both sides
  float post = step(0.5, fract(z * 0.7 - t * (0.6 + 1.1 * u_energy)));
  float lampx = abs(abs(xr) - 1.35);
  col += vec3(1.0, 0.85, 0.5) * exp(-lampx * 14.0) * post * 0.55 * smoothstep(0.0, 0.5, u);
  // road glow toward the horizon
  col += vec3(0.9, 0.45, 0.2) * exp(-u * 5.0) * 0.4 * road;
  // cars: rear lights ahead, and oncoming headlights on the left
  float bestN = -1.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float ln = mod(fi, 3.0) - 1.0;
    float k = fract(t * (0.05 + 0.03 * hash(vec2(fi, 1.0)) + 0.05 * u_energy) + hash(vec2(fi, 9.0)));
    float n = i < 3 ? 1.0 - k : k;
    float yc = hy + (1.0 - hy) * pow(n, 1.8);
    float sc = 0.018 + 0.27 * pow(n, 1.8);
    float xc = ln * 0.55 * (yc - hy) * (i < 3 ? 1.0 : 0.0) + (i >= 3 ? -0.75 * (yc - hy) : 0.0);
    vec2 q = (p - vec2(xc, yc)) / sc;
    if (i < 3) {
      float body = box(q - vec2(0.0, 0.0), vec2(1.0, 0.55));
      float cab = box(q - vec2(0.0, -0.62), vec2(0.72, 0.32));
      if ((body < 0.0 || cab < 0.0) && n > bestN) {
        bestN = n;
        col = vec3(0.2, 0.2, 0.28) + vec3(0.35) * smoothstep(0.1, -0.5, q.y) * 0.4;
        if (cab < 0.0 && body > 0.0) col = vec3(0.04, 0.05, 0.1);
      }
      float tl = min(length(q - vec2(-0.72, 0.12)), length(q - vec2(0.72, 0.12)));
      col += vec3(1.0, 0.1, 0.08) * exp(-max(0.0, tl - 0.16) * 2.2) * 1.2;
      if (tl < 0.2) col = vec3(1.0, 0.35, 0.25);
    } else {
      float hl = min(length(q - vec2(-0.72, 0.1)), length(q - vec2(0.72, 0.1)));
      col += vec3(1.0, 0.95, 0.8) * exp(-max(0.0, hl - 0.15) * 2.6) * 0.9;
    }
  }
  return col;
}

vec3 lights(vec2 p) {
  float t = u_time;
  float pulse = max(u_beat, step(0.55, fract(t * (1.2 + 3.0 * u_energy))) * step(0.5, u_energy) * 0.8);
  vec3 col = vec3(0.02, 0.0, 0.05);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float ang = sin(t * (0.8 + fi * 0.37) + fi * 2.0) * 0.9;
    vec2 d = p - vec2((fi - 1.0) * 0.9, 1.3);
    float a = atan(d.x, -d.y);
    col += hsv(fract(fi * 0.31 + t * 0.12), 0.75, 1.0) * exp(-pow((a - ang) * 4.5, 2.0)) * 0.6 * (0.4 + 0.6 * smoothstep(0.0, 2.0, length(d)));
  }
  vec2 gp = p * vec2(2.2, 2.2) + vec2(0.0, 0.0);
  vec2 cell = floor(gp + 0.5);
  vec2 f = fract(gp + 0.5) - 0.5;
  float step_ = floor(t * (2.0 + 5.0 * u_energy));
  float on = step(0.42, hash(cell * 1.7 + step_));
  float r = length(f);
  float lamp = smoothstep(0.3, 0.24, r) * on;
  float glow = exp(-r * 5.5) * on * 0.7;
  col += hsv(fract(hash(cell) + t * 0.05), 0.8, 1.0) * (lamp * 1.3 + glow);
  col += vec3(1.0) * pulse * 0.55 * smoothstep(1.6, 0.0, length(p));
  col += vec3(1.0) * step(0.9, pulse) * 0.45;
  return col;
}

vec3 ocean(vec2 p) {
  float t = u_time;
  float hy = -0.05;
  vec3 col;
  if (p.y < hy) {
    col = mix(vec3(0.03, 0.05, 0.16), vec3(0.95, 0.55, 0.35), pow(clamp((p.y + 1.0) / (hy + 1.0), 0.0, 1.0), 3.0));
    col += vec3(1.0, 0.9, 0.7) * smoothstep(0.2, 0.17, length(p - vec2(0.25, -0.38)));
    return col;
  }
  float d = p.y - hy;
  float w = sin(p.x * (5.0 + 14.0 * d) + t * 1.6 + sin(d * 30.0 - t) * 2.0) * 0.5 + 0.5;
  col = mix(vec3(0.02, 0.1, 0.22), vec3(0.1, 0.45, 0.6), w * (0.35 + d));
  float refl = exp(-pow((p.x - 0.25) * 3.0, 2.0)) * (0.5 + 0.5 * sin(d * 90.0 - t * 4.0 + noise(vec2(p.x * 20.0, d * 5.0)) * 4.0));
  col += vec3(1.0, 0.75, 0.45) * refl * (1.0 - d) * 0.9;
  col += vec3(0.8) * step(0.93, w) * d * 0.4 * step(0.6, hash(floor(vec2(p.x * 30.0, d * 40.0 + t))));
  return col;
}

vec3 fire(vec2 p) {
  vec2 q = vec2(p.x * 1.1, p.y + 0.95);
  float n = fbm(vec2(q.x * 3.2, q.y * 2.2 - u_time * (1.4 + u_energy)));
  float f = n * 1.5 - q.y * 0.85 - abs(p.x) * 0.55 + u_beat * 0.25;
  f = clamp(f * 1.7, 0.0, 1.0);
  vec3 col = mix(vec3(0.5, 0.04, 0.0), mix(vec3(1.0, 0.4, 0.04), vec3(1.0, 0.96, 0.62), f * f), f);
  return col * smoothstep(0.0, 0.18, f);
}

vec3 city(vec2 p) {
  float t = u_time;
  vec3 col = mix(vec3(0.01, 0.01, 0.06), vec3(0.28, 0.12, 0.3), smoothstep(-1.0, 0.7, p.y));
  col += vec3(0.95, 0.9, 0.8) * smoothstep(0.16, 0.13, length(p - vec2(0.5, -0.55)));
  col += vec3(0.8, 0.75, 0.6) * step(0.997, hash(floor(p * 90.0))) * smoothstep(0.1, -0.7, p.y);
  float bx = floor((p.x + 1.0) * 7.0);
  float h = 0.15 + 0.7 * hash(vec2(bx, 5.0)) - 0.0;
  float top = 0.9 - h * 1.3;
  if (p.y > top) {
    col = vec3(0.02, 0.02, 0.05) * (0.6 + 0.4 * hash(vec2(bx, 8.0)));
    vec2 wc = floor(vec2(p.x * 7.0 * 5.0, p.y * 22.0));
    float on = step(0.55, hash(wc + 3.0)) * (0.5 + 0.5 * step(0.5, hash(wc + floor(t * 0.6 + hash(wc) * 5.0))));
    vec2 wf = fract(vec2(p.x * 7.0 * 5.0, p.y * 22.0));
    col += vec3(1.0, 0.8, 0.4) * on * step(0.2, wf.x) * step(wf.x, 0.8) * step(0.25, wf.y) * step(wf.y, 0.75) * 0.9;
  }
  return col;
}

vec3 rain(vec2 p) {
  float t = u_time;
  vec3 col = vec3(0.02, 0.03, 0.07) + vec3(0.04, 0.05, 0.1) * fbm(p * 2.0 + vec2(t * 0.05, 0.0));
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 g = vec2(p.x * (30.0 + fi * 14.0) + fi * 7.0, p.y * (3.0 + fi) + t * (5.0 + fi * 2.5 + 3.0 * u_energy));
    vec2 c = floor(g);
    float xs = fract(g.x);
    float on = step(0.7, hash(vec2(c.x, 1.0 + fi)));
    float ln = smoothstep(0.35, 0.0, abs(xs - 0.5)) * smoothstep(0.0, 0.3, fract(g.y + hash(vec2(c.x, 2.0)) * 9.0)) * on;
    col += vec3(0.6, 0.75, 1.0) * ln * (0.45 - fi * 0.1);
  }
  float flash = step(0.97, hash(vec2(floor(t * 2.0), 4.0))) * exp(-fract(t * 2.0) * 8.0) + u_beat * 0.15;
  col += vec3(0.8, 0.85, 1.0) * flash * 0.8;
  return col;
}

vec3 planet(vec2 p) {
  float t = u_time;
  p *= 1.18;
  vec3 col = vec3(0.0);
  // sparse stars
  col += vec3(0.75, 0.7, 0.6) * step(0.9975, hash(floor(p * 90.0))) * 0.5;
  // ring (behind then in front)
  vec2 rp = vec2(p.x, p.y / 0.28);
  float rr = length(rp);
  vec2 rpr = mat2(0.94, 0.34, -0.34, 0.94) * vec2(p.x, p.y);
  rr = length(vec2(rpr.x, rpr.y / 0.3));
  float ring = smoothstep(0.52, 0.55, rr) * (1.0 - smoothstep(0.88, 0.92, rr));
  ring *= 0.6 + 0.4 * sin(rr * 70.0) * sin(rr * 23.0 + 1.0);
  ring *= 1.0 - smoothstep(0.7, 0.76, rr) * step(0.7, rr) * 0.8;
  vec3 ringC = mix(vec3(0.55, 0.42, 0.28), vec3(0.78, 0.66, 0.46), noise(vec2(rr * 40.0, 0.0)));
  float r = length(p);
  float sph = 1.0 - smoothstep(0.43, 0.445, r);
  vec2 n = p / 0.44;
  float z = sqrt(max(0.0, 1.0 - dot(n, n)));
  float band = sin((p.y * 18.0 + fbm(p * 5.0 + t * 0.03) * 3.0)) * 0.5 + 0.5;
  vec3 pc = mix(vec3(0.42, 0.26, 0.14), vec3(0.88, 0.7, 0.45), band);
  pc = mix(pc, vec3(0.97, 0.88, 0.7), smoothstep(0.78, 1.0, band) * 0.6);
  float lit = clamp(dot(normalize(vec3(n, z)), normalize(vec3(-0.55, 0.45, 0.7))), 0.0, 1.0);
  pc *= 0.12 + 1.0 * lit;
  bool front = rpr.y > 0.0;
  if (!front) col = mix(col, ringC * 0.8, ring);
  col = mix(col, pc, sph);
  if (front) col = mix(col, ringC, ring * (1.0 - 0.0));
  return col;
}
void main() {
  vec2 uv = v_uv;
  vec2 wsz = u_rect.zw - u_rect.xy;
  vec2 q = (uv - u_rect.xy) / wsz;
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec2 p = (q - 0.5) * 2.0;
  p.x *= (wsz.x * u_res.x) / (wsz.y * u_res.y);
  p *= 0.62;
  if (u_subject != 0) {
    vec3 sc;
    if (u_subject == 1) sc = highway(p);
    else if (u_subject == 2) sc = lights(p);
    else if (u_subject == 3) sc = ocean(p);
    else if (u_subject == 4) sc = fire(p);
    else if (u_subject == 5) sc = city(p);
    else if (u_subject == 6) sc = planet(p * 1.3);
    else sc = rain(p);
    float rim2 = smoothstep(0.0, 0.03, min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)));
    o = vec4(clamp(sc, 0.0, 1.0) * rim2, 1.0);
    return;
  }
  vec3 e = eye(p);
  vec3 pl = planet(p * 1.3);
  float nz = fbm(q * 14.0 + 3.0);
  float m = u_morph;
  float edge = m * 1.5 - 0.25;
  float show = smoothstep(edge - 0.12, edge + 0.0, nz);       // 1 = still the eye
  float grit = smoothstep(0.1, 0.0, abs(nz - edge)) ;          // the crumbling front
  vec3 col = mix(pl, e, show);
  // the dissolve: flecks fall away and flicker
  float fleck = step(0.55, hash(floor(q * 90.0) + floor(u_time * 8.0)));
  col = mix(col, col * fleck, grit * 0.95);
  // dark rim of the window
  float rim = smoothstep(0.0, 0.03, min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y)));
  o = vec4(col * rim, 1.0);
}`;
