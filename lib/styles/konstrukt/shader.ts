// The Konstrukt print: paper, colour fields, grid rules and the shape choreographies as flat ink, drawn in one full-screen
// pass from a list of primitives (signed distances, antialiased in device pixels). Inks overprint by multiplying (light on a
// negative print), the second ink is offset by the misregistration, riso grain and ink drag thin the coverage, and nothing is
// ever inked inside an exclusion zone (the type slots). Layer order (scene-families.md): ground, fields, grid, forms.

export const MAX_PRIMS = 48;

export const KON_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform vec2 u_res;
uniform float u_dpr;
uniform vec4 u_p[${MAX_PRIMS * 3}];
uniform int u_n;
uniform vec3 u_inks[7];
uniform vec3 u_old[7];
uniform float u_wipe;
uniform int u_neg;
uniform vec4 u_grid;
uniform vec4 u_gdim;
uniform float u_gridA;
uniform float u_gridP;
uniform vec3 u_radial;
uniform vec4 u_ex[4];
uniform int u_nex;
uniform vec4 u_ann;
uniform vec4 u_field;
uniform int u_fieldKind;
uniform int u_fieldInk;
uniform vec4 u_tex;
uniform float u_drag;
uniform vec2 u_misreg;
uniform float u_seed;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float sdBox(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x + s * p.y, -s * p.x + c * p.y); }
float sdTri(vec2 p, float r) {
  const float k = sqrt(3.0);
  p.x = abs(p.x) - r * 0.866;
  p.y = p.y + r * 0.5;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -r * 1.732, 0.0);
  return -length(p) * sign(p.y);
}

// distance (css px) to primitive i at point q
float prim(int i, vec2 q) {
  vec4 A = u_p[i * 3];
  vec4 B = u_p[i * 3 + 1];
  vec4 C = u_p[i * 3 + 2];
  int k = int(A.x + 0.5);
  vec2 c = A.zw;
  vec2 p = q - c;
  if (k == 0) {
    if (B.x <= 0.0 || B.y <= 0.0) return 1e5;
    return sdBox(rot(p, B.z), B.xy);
  } else if (k == 1) {
    if (B.x <= 0.0) return 1e5;
    return length(p) - B.x;
  } else if (k == 2) {
    if (B.x <= 0.0 || B.y <= 0.0) return 1e5;
    return abs(length(p) - B.x) - B.y * 0.5;
  } else if (k == 3) {
    float sweep = B.w;
    if (B.x <= 0.0 || sweep <= 0.001) return 1e5;
    float d = B.y >= B.x * 2.0 ? length(p) - B.x : abs(length(p) - (B.x - B.y * 0.5)) - B.y * 0.5;
    // the wedge between the start angle and start + sweep (y down: angles turn clockwise on screen)
    vec2 n1 = vec2(sin(B.z), -cos(B.z));
    vec2 n2 = vec2(-sin(B.z + sweep), cos(B.z + sweep));
    float w = sweep <= 3.14159 ? max(dot(p, n1), dot(p, n2)) : min(dot(p, n1), dot(p, n2));
    return max(d, w);
  } else if (k == 4) {
    vec2 e = vec2(B.w, C.x) - c;
    float L = length(e);
    if (L < 0.5 || B.x <= 0.0) return 1e5;
    vec2 dir = e / L;
    vec2 lp = vec2(dot(p, dir), dot(p, vec2(-dir.y, dir.x)));
    return sdBox(lp - vec2(L * 0.5, 0.0), vec2(L * 0.5, B.x * 0.5));
  } else if (k == 5) {
    if (B.x <= 0.0) return 1e5;
    return sdTri(rot(p, B.z) * vec2(1.0, -1.0), B.x);
  } else if (k == 6) {
    // a sine line inside a rect: amplitude B.w, wavelength C.x, phase C.y, thickness C.z
    if (C.z <= 0.0) return 1e5;
    float y0 = B.w * sin(6.28318 * p.x / max(1.0, C.x) + C.y);
    float slope = B.w * 6.28318 / max(1.0, C.x) * cos(6.28318 * p.x / max(1.0, C.x) + C.y);
    float d = abs(p.y - y0) / sqrt(1.0 + slope * slope) - C.z * 0.5;
    return max(d, abs(p.x) - B.x);
  } else {
    // dot matrix: B.xy half size, B.zw cols rows, C.xy on-masks (24 cells each)
    vec2 size = B.xy * 2.0;
    vec2 cell = size / max(vec2(1.0), B.zw);
    vec2 lp = p + B.xy;
    if (lp.x < 0.0 || lp.y < 0.0 || lp.x >= size.x || lp.y >= size.y) return 1e5;
    vec2 ij = floor(lp / cell);
    int idx = int(ij.y * B.z + ij.x);
    int mask = idx < 24 ? int(C.x + 0.5) : int(C.y + 0.5);
    int bit = idx < 24 ? idx : idx - 24;
    if (((mask >> bit) & 1) == 0) return 1e5;
    return length((fract(lp / cell) - 0.5) * cell) - min(cell.x, cell.y) * 0.36;
  }
}

vec3 inkAt(int i, vec2 q) {
  // module wipe: modules flip to the new colours in row order
  float total = max(1.0, u_gdim.x * u_gdim.y);
  vec2 ij = clamp(floor((q - u_grid.xy) / max(vec2(1.0), u_grid.zw / u_gdim.xy)), vec2(0.0), u_gdim.xy - 1.0);
  float order = (ij.y * u_gdim.x + ij.x + 0.5) / total;
  return order <= u_wipe ? u_inks[i] : u_old[i];
}

vec3 lay(vec3 col, vec3 ink, float cov) {
  if (u_neg == 1) return mix(col, max(col, ink), cov);
  return mix(col, col * ink, cov);
}

void main() {
  vec2 q = v_uv * u_res;
  float px = 1.0 / u_dpr;
  float aa = 0.75 * px;
  bool excl = false;
  for (int i = 0; i < 4; i++) {
    if (i >= u_nex) break;
    vec4 r = u_ex[i];
    if (q.x >= r.x && q.y >= r.y && q.x <= r.z && q.y <= r.w) excl = true;
  }
  if (u_ann.w > 0.0) {
    float d = length(q - u_ann.xy);
    if (d >= u_ann.z && d <= u_ann.w && q.y <= u_ann.y) excl = true;
  }

  vec3 paper = inkAt(4, q);
  vec3 col = paper;

  // paper: tooth (uncoated), faint sheen (coated), newsprint fibre
  if (u_neg == 0) {
    col *= 1.0 - u_tex.x * (vnoise(q * 0.9) * 0.6 + hash(floor(q * u_dpr)) * 0.4);
    col *= 1.0 - u_tex.z * (vnoise(q * 0.35) * 0.7 + vnoise(q * vec2(2.4, 0.3)) * 0.3);
    col += u_tex.y * (q.x + q.y) / (u_res.x + u_res.y) * 0.02;
  }

  // colour fields (split layouts, the rotated-edge field)
  if (u_fieldKind == 1) {
    vec2 c = (u_field.xy + u_field.zw) * 0.5;
    float d = sdBox(q - c, (u_field.zw - u_field.xy) * 0.5);
    col = lay(col, inkAt(u_fieldInk, q), clamp(0.5 - d / aa * 0.5, 0.0, 1.0));
  } else if (u_fieldKind == 2) {
    float d = (q.x / u_res.x + q.y / u_res.y - 1.15) * min(u_res.x, u_res.y) * 0.7071;
    col = lay(col, inkAt(u_fieldInk, q), clamp(0.5 + d / aa * 0.5, 0.0, 1.0));
  }

  // grid rules: drawn module by module during the grid draw (u_gridP), thin, in the type ink at low strength
  if (u_gridA > 0.0 && !excl) {
    vec2 g0 = u_grid.xy;
    vec2 gs = u_grid.zw;
    vec2 m = gs / u_gdim.xy;
    vec2 lp = q - g0;
    float cov = 0.0;
    float reachY = floor(u_gridP * u_gdim.y + 0.999) * m.y;
    float reachX = floor(u_gridP * u_gdim.x + 0.999) * m.x;
    if (u_gdim.w > 0.0) {
      float a = radians(u_gdim.w);
      float s = lp.x * sin(a) + lp.y * cos(a);
      float dd = abs(mod(s + m.x * 0.5, m.x) - m.x * 0.5);
      if (lp.x >= 0.0 && lp.y >= 0.0 && lp.x <= gs.x && lp.y <= reachY) cov = max(cov, clamp(1.0 - (dd - 0.5 * px) / aa, 0.0, 1.0));
    } else if (u_radial.z > 0.5) {
      vec2 d = q - u_radial.xy;
      float ang = atan(d.y, d.x);
      float seg = 6.28318 / 12.0;
      float da = abs(mod(ang + seg * 0.5, seg) - seg * 0.5) * length(d);
      if (lp.x >= 0.0 && lp.y >= 0.0 && lp.x <= gs.x && lp.y <= gs.y && length(d) <= max(gs.x, gs.y) * u_gridP) cov = max(cov, clamp(1.0 - (da - 0.5 * px) / aa, 0.0, 1.0));
    }
    if (u_radial.z < 0.5 && u_gdim.w <= 0.0) {
      float dx = abs(mod(lp.x + m.x * 0.5, m.x) - m.x * 0.5);
      float dy = abs(mod(lp.y + m.y * 0.5, m.y) - m.y * 0.5);
      float wB = abs(lp.x - u_gdim.z * m.x) < 1.5 ? 1.0 : 0.0;
      if (lp.x >= -0.5 && lp.x <= gs.x + 0.5 && lp.y >= -0.5 && lp.y <= reachY + 0.5) cov = max(cov, clamp(1.0 - (dx - (0.5 + wB) * px) / aa, 0.0, 1.0));
      if (lp.y >= -0.5 && lp.y <= gs.y + 0.5 && lp.x >= -0.5 && lp.x <= reachX + 0.5) cov = max(cov, clamp(1.0 - (dy - 0.5 * px) / aa, 0.0, 1.0));
    }
    col = lay(col, inkAt(0, q), cov * u_gridA);
  }

  if (!excl) {
    for (int i = 0; i < ${MAX_PRIMS}; i++) {
      if (i >= u_n) break;
      int ink = int(u_p[i * 3].y + 0.5);
      vec2 qq = ink == 1 ? q - u_misreg : q;
      float d = prim(i, qq);
      if (d > 4.0) continue;
      float cov = clamp(0.5 - d / aa * 0.5, 0.0, 1.0);
      if (cov <= 0.0) continue;
      if (ink == 1 || ink == 2) {
        // riso grain on the second and third inks, ink drag streaks along the rows
        cov *= 1.0 - u_tex.w * smoothstep(0.55, 0.95, vnoise(q * 1.7 + float(ink) * 13.0));
        cov *= 1.0 - u_drag * smoothstep(0.6, 1.0, vnoise(vec2(q.x * 0.01, q.y * 0.9)));
      }
      if (ink == 4) col = mix(col, paper, cov);
      else col = lay(col, inkAt(ink, q), cov);
    }
  }
  o = vec4(col, 1.0);
}`;
