// GLSL ES 3.00 sources for the Turbo renderer.
// Convention: "stage px" are CSS pixels with the origin top-left and y down; every transform is computed on the CPU
// (see gpu.ts) and handed to the vertex shader as one mat3, so the shaders stay small.

const HEAD = '#version 300 es\nprecision highp float;\n';

/** a unit quad placed in local pixel space: local = (a_pos - 0.5) * u_size */
export const QUAD_VS = `${HEAD}
in vec2 a_pos;
uniform mat3 u_m;
uniform vec2 u_size;
out vec2 v_uv;
out vec2 v_local;
void main() {
  vec2 local = (a_pos - 0.5) * u_size;
  v_local = local;
  v_uv = a_pos;
  gl_Position = vec4((u_m * vec3(local, 1.0)).xy, 0.0, 1.0);
}`;

/** a screen-filling quad. v_uv has y DOWN (stage convention); v_tc has y UP (matches render-target textures). */
export const FULL_VS = `${HEAD}
in vec2 a_pos;
out vec2 v_uv;
out vec2 v_tc;
void main() {
  v_tc = a_pos;
  v_uv = vec2(a_pos.x, 1.0 - a_pos.y);
  gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
}`;

/** textured sprites: glyph masks, icons, doodles, artwork, marquee strips */
export const SPRITE_FS = `${HEAD}
in vec2 v_uv;
in vec2 v_local;
out vec4 o;
uniform sampler2D u_tex;
uniform sampler2D u_art;   // the cover, for words filled with the picture
uniform float u_maskScale;
uniform vec4 u_uvRect;     // crop of the texture: offset xy, scale zw
uniform int u_mode;        // 0 = premultiplied RGBA sprite, 1 = mask tinted with u_color, 2 = soft glow of a mask, 3 = mask filled with the cover
uniform vec4 u_color;
uniform float u_alpha;
uniform float u_lod;
uniform vec2 u_texel;      // 1 / texture size
uniform float u_glowR;     // glow radius in texels
uniform vec3 u_lit;        // colour of the part of a held word that has been sung
uniform float u_progress;  // < 0 = off, else 0..1 of the text span
uniform vec2 u_span;       // where the text starts and ends horizontally (uv)
uniform vec2 u_vspan;      // where the text starts and ends vertically (uv)
uniform int u_grad;        // 0 none, 1 = chrome bands, 2 = three-stop sunset
uniform vec3 u_g0; uniform vec3 u_g1; uniform vec3 u_g2; uniform vec3 u_g3;
uniform vec4 u_gpos;
uniform vec2 u_vclip;      // keep only this vertical uv range (split halves)
uniform vec4 u_fade;       // feather at left, right, top, bottom (fractions of the quad)
uniform float u_round;     // corner radius in px (cards), 0 = square
uniform vec2 u_size;
uniform float u_grey;      // 0..1 desaturate (tonal artwork)
uniform vec3 u_tone;       // colour laid over the picture
uniform float u_toneAmt;
uniform float u_boil;      // hand-drawn "line boil": the picture wobbles, re-rolled a few times a second
uniform float u_boilStep;
uniform float u_clipX;     // < 0 = off, else only the first fraction of the text span is drawn (typewriter)

float hsh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float nz(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y);
}

float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  if (v_uv.y < u_vclip.x || v_uv.y > u_vclip.y) discard;
  if (u_clipX >= 0.0 && (v_uv.x - u_span.x) / max(0.001, u_span.y - u_span.x) > u_clipX) discard;
  vec2 buv = v_uv;
  if (u_boil > 0.0) buv += (vec2(nz(v_uv * 9.0 + u_boilStep * 3.7), nz(v_uv * 9.0 + 7.3 + u_boilStep * 5.1)) - 0.5) * u_boil * 0.018;
  vec2 tuv = u_uvRect.xy + v_uv * u_uvRect.zw;
  vec4 c;
  if (u_mode == 0) {
    c = textureLod(u_tex, tuv, u_lod);
    if (u_grey > 0.0) {
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(c.rgb, vec3(l) * c.a, u_grey);
    }
    if (u_toneAmt > 0.0) c.rgb = mix(c.rgb, u_tone * c.a, u_toneAmt);
    c *= u_color.a;
    if (u_color.r + u_color.g + u_color.b < 2.99) c.rgb *= u_color.rgb; // optional tint (white = none)
  } else {
    float m;
    if (u_mode == 1 || u_mode == 3) {
      m = textureLod(u_tex, buv, u_lod).a;
    } else {
      m = 0.0;
      float tw = 0.0;
      for (int i = 0; i < 16; i++) {
        float a = float(i) * 0.3926991;
        float r = (i % 2 == 0) ? 0.5 : 1.0;
        vec2 off = vec2(cos(a), sin(a)) * r * u_glowR * u_texel;
        float w = 1.0 - 0.35 * r;
        m += textureLod(u_tex, v_uv + off, u_lod).a * w;
        tw += w;
      }
      m = m / tw;
      m += textureLod(u_tex, v_uv, u_lod + 1.0).a * 0.5;
      m = min(1.0, m * 1.4);
    }
    vec3 col = u_color.rgb;
    if (u_mode == 3) col = texture(u_art, fract(v_local / max(u_maskScale, 1.0) + 0.5)).rgb;
    if (u_grad == 1 || u_grad == 2) {
      float g = clamp((v_uv.y - u_vspan.x) / max(0.001, u_vspan.y - u_vspan.x), 0.0, 1.0);
      if (u_grad == 1) {
        col = g < u_gpos.y ? mix(u_g0, u_g1, g / u_gpos.y) : g < u_gpos.z ? mix(u_g1, u_g2, (g - u_gpos.y) / max(0.001, u_gpos.z - u_gpos.y)) : mix(u_g2, u_g3, (g - u_gpos.z) / max(0.001, 1.0 - u_gpos.z));
      } else {
        col = g < 0.5 ? mix(u_g0, u_g1, g * 2.0) : mix(u_g1, u_g2, (g - 0.5) * 2.0);
      }
    }
    if (u_progress >= 0.0) {
      float f = (v_uv.x - u_span.x) / max(0.001, u_span.y - u_span.x);
      col = mix(u_lit, col, smoothstep(u_progress - 0.012, u_progress + 0.012, f));
    }
    c = vec4(col * m, m) * u_color.a;
  }
  float fade = 1.0;
  if (u_fade.x > 0.0) fade *= smoothstep(0.0, u_fade.x, v_uv.x);
  if (u_fade.y > 0.0) fade *= smoothstep(0.0, u_fade.y, 1.0 - v_uv.x);
  if (u_fade.z > 0.0) fade *= smoothstep(0.0, u_fade.z, v_uv.y);
  if (u_fade.w > 0.0) fade *= smoothstep(0.0, u_fade.w, 1.0 - v_uv.y);
  if (u_round > 0.0) fade *= 1.0 - smoothstep(-1.0, 1.0, sdBox(v_local, u_size * 0.5, u_round));
  o = c * (u_alpha * fade);
}`;

/** flat shapes: rounded rectangles (chips, highlights, shadows, slices), rings, radial pools */
export const SHAPE_FS = `${HEAD}
in vec2 v_uv;
in vec2 v_local;
out vec4 o;
uniform int u_kind;      // 0 rounded rect, 1 ring, 2 radial pool, 3 horizontal fade c1 -> clear -> c2
uniform vec4 u_color;
uniform vec4 u_color2;
uniform float u_alpha;
uniform vec2 u_size;
uniform float u_radius;  // corner radius / ring radius / pool radius
uniform float u_width;   // ring width
uniform float u_soft;    // edge softness in px
float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  float a;
  if (u_kind == 0) {
    float d = sdBox(v_local, u_size * 0.5, min(u_radius, min(u_size.x, u_size.y) * 0.5));
    a = 1.0 - smoothstep(-max(u_soft, 0.75), max(u_soft, 0.75), d);
  } else if (u_kind == 1) {
    float d = abs(length(v_local) - u_radius) - u_width * 0.5;
    a = 1.0 - smoothstep(-max(u_soft, 0.75), max(u_soft, 0.75), d);
  } else if (u_kind == 2) {
    float t = clamp(length(v_local) / max(u_radius, 1.0), 0.0, 1.0);
    a = 1.0 - t;
    a *= a * (3.0 - 2.0 * a);
  } else if (u_kind == 4) {
    // a marker swipe: a rounded bar whose edges wander (u_width = wobble in px, u_radius = seed)
    vec2 q = v_local;
    q.x += sin(q.y * 0.11 + u_radius) * u_width + sin(q.y * 0.27 + u_radius * 2.3) * u_width * 0.5;
    q.y += sin(q.x * 0.09 + u_radius * 1.7) * u_width * 0.8 + sin(q.x * 0.23 + u_radius) * u_width * 0.4;
    float d = sdBox(q, u_size * 0.5, u_size.y * 0.42);
    a = 1.0 - smoothstep(-1.2, 1.2, d);
  } else if (u_kind == 5) {
    // a light streak: bright core, soft sides, fading in and out along its length, colour u_color -> u_color2 toward the head
    float t = v_uv.x;
    float core = exp(-pow((v_uv.y - 0.5) * 14.0, 2.0));
    float k = core * smoothstep(0.0, 0.25, t) * smoothstep(1.0, 0.7, t) * u_alpha;
    vec3 rgb = mix(u_color.rgb, u_color2.rgb, t);
    o = vec4(rgb * k, k);
    return;
  } else {
    float x = v_uv.x;
    vec3 rgb = x < 0.55 ? u_color.rgb : u_color2.rgb;
    float k3 = x < 0.55 ? 1.0 - x / 0.55 : (x - 0.55) / 0.45;
    float k4 = k3 * u_alpha;
    o = vec4(rgb * k4, k4);
    return;
  }
  float k = a * u_color.a * u_alpha;
  o = vec4(u_color.rgb * k, k);
}`;

export const POINT_VS = `${HEAD}
in vec2 a_pos;
in vec2 a_p1;   // size px, alpha
in vec3 a_p2;   // rgb
uniform mat3 u_m;
uniform float u_dpr;
out float v_a;
out vec3 v_rgb;
void main() {
  gl_Position = vec4((u_m * vec3(a_pos, 1.0)).xy, 0.0, 1.0);
  gl_PointSize = max(1.5, a_p1.x * 2.0 * u_dpr);
  v_a = a_p1.y;
  v_rgb = a_p2;
}`;
export const POINT_FS = `${HEAD}
in float v_a;
in vec3 v_rgb;
out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.55, 1.0, d)) * v_a;
  o = vec4(v_rgb * a, a);
}`;

export const STRIP_VS = `${HEAD}
in vec2 a_pos;
uniform mat3 u_m;
void main() { gl_Position = vec4((u_m * vec3(a_pos, 1.0)).xy, 0.0, 1.0); }`;
export const STRIP_FS = `${HEAD}
out vec4 o;
uniform vec4 u_color;
uniform float u_alpha;
void main() { float k = u_color.a * u_alpha; o = vec4(u_color.rgb * k, k); }`;

/**
 * The animated stage behind everything. Rendered at reduced resolution (it is all smooth light) and stretched.
 * Variants: 0 liquid light, 1 god rays, 2 bokeh, 3 horizon grid, 4 plain gradient only.
 */
export const STAGE_FS = `${HEAD}
in vec2 v_uv;
out vec4 o;
uniform vec2 u_res;
uniform float u_time;
uniform float u_beat;
uniform float u_age;      // seconds since the last beat
uniform float u_lift;
uniform float u_amount;   // how much of the show to draw, 0..1
uniform float u_arousal;
uniform float u_angle;
uniform float u_coverMix;
uniform int u_variant;
uniform vec3 u_pal[4];
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform sampler2D u_cover;
uniform float u_hasCover;
uniform float u_guard;    // 0..1: how much the effects back off where the words are

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + vec2(7.1, 3.7); a *= 0.5; } return s; }

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 g = 0.5 * vec2(cos(u_angle), sin(u_angle));
  vec2 start = vec2(0.5) - g;
  vec2 dir = 2.0 * g;
  float t = clamp(dot(v_uv - start, dir) / max(dot(dir, dir), 1e-4), 0.0, 1.0);
  vec3 col = mix(u_c0, u_c1, t);
  vec2 p = (v_uv - 0.5) * vec2(aspect, 1.0);
  float a = u_amount * mix(1.0 - u_guard, 1.0, smoothstep(0.1, 0.72, length(p * vec2(0.78, 1.0))));
  float tm = u_time;
  float shock = exp(-u_age * 2.6);

  if (u_variant == 0) {
    vec2 q = vec2(fbm(p * 1.6 + vec2(0.0, tm * 0.07)), fbm(p * 1.6 + vec2(5.2, 1.3) - tm * 0.06));
    vec2 r = vec2(fbm(p * 1.6 + 3.0 * q + vec2(1.7, 9.2) + 0.15 * tm), fbm(p * 1.6 + 3.0 * q + vec2(8.3, 2.8) + 0.126 * tm));
    float f = fbm(p * 1.6 + 3.0 * r);
    col = mix(col, u_pal[1], clamp(f * f * 2.0, 0.0, 1.0) * 0.5 * a);
    col = mix(col, u_pal[0], clamp(length(q), 0.0, 1.0) * 0.4 * a);
    col += u_pal[2] * pow(clamp(r.x, 0.0, 1.0), 3.0) * (0.3 + 0.25 * u_arousal) * a;
    if (u_hasCover > 0.5) {
      vec3 cv = texture(u_cover, clamp(v_uv + (q - 0.5) * 0.18, 0.0, 1.0)).rgb;
      col = mix(col, cv, u_coverMix);
    }
  } else if (u_variant == 1) {
    float r = length(p);
    float ang = atan(p.y, p.x);
    float warp = fbm(vec2(ang * 3.0 + tm * 0.08, r * 0.6 - tm * 0.05));
    float beams = pow(abs(sin(ang * 7.0 + tm * 0.14 + warp * 4.0)), 7.0);
    col += u_pal[0] * beams * smoothstep(1.3, 0.0, r) * (0.22 + 0.5 * u_beat) * a;
    col += u_pal[1] * pow(max(0.0, 1.0 - r * 1.35), 3.0) * (0.28 + 0.4 * u_beat) * a;
    if (u_hasCover > 0.5) col = mix(col, texture(u_cover, v_uv).rgb, u_coverMix);
  } else if (u_variant == 2) {
    for (int i = 0; i < 20; i++) {
      float fi = float(i);
      vec2 h = vec2(hash(vec2(fi, 1.0)), hash(vec2(fi, 2.0)));
      vec2 pos = vec2(h.x, fract(h.y - tm * (0.012 + 0.025 * hash(vec2(fi, 3.0)))));
      float rad = 0.035 + 0.085 * hash(vec2(fi, 4.0));
      float d = length((v_uv - pos) * vec2(aspect, 1.0));
      float disc = smoothstep(rad, rad * 0.8, d) * 0.45 + smoothstep(rad * 1.04, rad * 0.94, d) * smoothstep(rad * 0.82, rad, d) * 0.8;
      col += u_pal[int(mod(fi, 3.0))] * disc * (0.07 + 0.12 * u_beat) * a;
    }
    if (u_hasCover > 0.5) col = mix(col, texture(u_cover, v_uv).rgb, u_coverMix);
  } else if (u_variant == 5) {
    // sketchbook page: warm paper with fibres, a wobbling hand-drawn frame, darker outside it
    float fibre = fbm(v_uv * vec2(aspect, 1.0) * 70.0) * 0.07 + noise(v_uv * vec2(aspect, 1.0) * 420.0) * 0.035;
    col = mix(u_c0, u_c1, t) + (fibre - 0.06);
    float inset = 0.032;
    vec2 e = min(v_uv, 1.0 - v_uv) * vec2(aspect, 1.0);
    float wob = (noise(v_uv * vec2(aspect, 1.0) * 14.0 + floor(u_time * 6.0) * 1.7) - 0.5) * 0.008;
    float dist = min(e.x, e.y) - inset + wob;
    float line = smoothstep(0.0075, 0.0, abs(dist));
    col = mix(col, u_pal[3], line * 0.92);
    if (dist < -0.003) col *= 0.88;
  } else if (u_variant == 3) {
    float horizon = 0.56;
    if (v_uv.y > horizon) {
      float y = (v_uv.y - horizon) / (1.0 - horizon);
      float z = 1.0 / (y + 0.03);
      float gx = abs(fract((v_uv.x - 0.5) * z * aspect * 0.7 + 0.5) - 0.5);
      float gz = abs(fract(z * 0.45 - tm * 0.4) - 0.5);
      float line = smoothstep(0.018 * z + 0.002, 0.0, min(gx, gz));
      col += u_pal[0] * line * (0.3 + 0.45 * u_beat) * smoothstep(0.0, 0.3, y) * a;
    }
    col += u_pal[1] * exp(-abs(v_uv.y - horizon) * 16.0) * 0.5 * a;
    if (u_hasCover > 0.5) col = mix(col, texture(u_cover, v_uv).rgb, u_coverMix * 0.6);
  } else {
    if (u_hasCover > 0.5) col = mix(col, texture(u_cover, v_uv).rgb, u_coverMix);
  }

  // every beat sends a soft shockwave out from the middle
  float d = length(p);
  float ring = exp(-pow((d - u_age * 0.85) * 14.0, 2.0)) * shock;
  col += u_pal[1] * ring * 0.32 * a;
  col += u_pal[0] * u_beat * 0.07 * a;
  col = mix(col, col * 1.18 + 0.05, u_lift * 0.5);
  o = vec4(col, 1.0);
}`;

/**
 * Turns the picture into characters: every cell of the screen becomes the glyph (from an atlas ordered dark to bright) that matches its
 * brightness, in its own colour. u_mix blends from the real picture to the characters; the dissolve edge wanders with noise.
 */
export const ASCII_FS = `${HEAD}
in vec2 v_tc;
out vec4 o;
uniform sampler2D u_scene;
uniform sampler2D u_atlas;
uniform vec2 u_res;
uniform float u_cell;
uniform float u_n;
uniform float u_mix;
uniform float u_time;
uniform float u_boost;
float h2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 cell = floor(gl_FragCoord.xy / u_cell);
  vec2 c0 = (cell + 0.5) * u_cell / u_res;
  vec2 px = vec2(u_cell * 0.3) / u_res;
  vec3 c = (texture(u_scene, c0).rgb * 2.0 + texture(u_scene, c0 + px).rgb + texture(u_scene, c0 - px).rgb + texture(u_scene, c0 + vec2(px.x, -px.y)).rgb + texture(u_scene, c0 - vec2(px.x, -px.y)).rgb) / 6.0;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float g = floor(clamp(lum * 1.25, 0.0, 0.999) * u_n);
  vec2 f = fract(gl_FragCoord.xy / u_cell);
  float m = texture(u_atlas, vec2((g + f.x) / u_n, 1.0 - f.y)).a;
  vec3 asc = c * u_boost * m + c * 0.05;
  vec3 base = texture(u_scene, v_tc).rgb;
  float edge = n2(v_tc * vec2(u_res.x / u_res.y, 1.0) * 6.0 + u_time * 0.25);
  float k = smoothstep(u_mix - 0.12, u_mix + 0.12, 1.0 - edge * (1.0 - u_mix) - (1.0 - u_mix) * 0.0);
  float amount = clamp(u_mix * 1.2 - edge * 0.2 + 0.1, 0.0, 1.0);
  o = vec4(mix(base, asc, amount), 1.0);
}`;

/** draws a render-target texture over the whole stage */
export const BLIT_FS = `${HEAD}
in vec2 v_tc;
out vec4 o;
uniform sampler2D u_tex;
uniform float u_alpha;
void main() { o = vec4(texture(u_tex, v_tc).rgb, 1.0) * u_alpha; }`;

export const BRIGHT_FS = `${HEAD}
in vec2 v_tc;
out vec4 o;
uniform sampler2D u_tex;
uniform float u_thr;
void main() {
  vec3 c = texture(u_tex, v_tc).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(u_thr, u_thr + 0.3, l);
  o = vec4(c * k, 1.0);
}`;

export const BLUR_FS = `${HEAD}
in vec2 v_tc;
out vec4 o;
uniform sampler2D u_tex;
uniform vec2 u_dir;   // one texel step along the blur axis
void main() {
  vec3 c = texture(u_tex, v_tc).rgb * 0.2270270270;
  c += (texture(u_tex, v_tc + u_dir * 1.3846153846).rgb + texture(u_tex, v_tc - u_dir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture(u_tex, v_tc + u_dir * 3.2307692308).rgb + texture(u_tex, v_tc - u_dir * 3.2307692308).rgb) * 0.0702702703;
  o = vec4(c, 1.0);
}`;

/** the finishing pass: lens fringing, bloom, scrim, vignette, halftone, scanlines, grain, flash */
export const POST_FS = `${HEAD}
in vec2 v_uv;
in vec2 v_tc;
out vec4 o;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform vec2 u_res;      // device px
uniform float u_dpr;
uniform float u_time;
uniform float u_aber;    // chromatic fringing strength (uv units at the corners)
uniform float u_bloomAmt;
uniform float u_vignette;
uniform float u_scrim;
uniform float u_scrimDark;
uniform float u_grain;
uniform float u_scan;
uniform float u_halftone;
uniform vec3 u_dotColor;
uniform float u_flash;
uniform float u_pulse;
uniform float u_curve;      // CRT barrel curve
uniform float u_glitch;     // horizontal glitch slices
uniform float u_dither;     // colour levels for ordered dithering, 0 = off
uniform float u_grainCell;  // grain size in device px
uniform float u_aberMode;   // 0 = fringing only toward the edges, 1 = across the whole frame

float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p + 19.19); return fract(p.x * p.y); }

void main() {
  vec2 uv = v_tc;
  if (u_curve > 0.0) {
    vec2 cc = uv * 2.0 - 1.0;
    cc *= 1.0 + u_curve * dot(cc, cc) * 0.28;
    uv = cc * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }
  }
  if (u_glitch > 0.0) {
    float band = floor(uv.y * 30.0);
    float step_ = floor(u_time * 14.0);
    if (hash(vec2(band, step_)) > 1.0 - u_glitch * 0.3) uv.x += (hash(vec2(band, step_ + 3.0)) - 0.5) * 0.07 * u_glitch;
  }
  vec2 d = uv - 0.5;
  // lens fringing: none in the middle (where the words are, so they stay crisp), growing toward the edges (or everywhere, for acid)
  float ab = u_aber * mix(smoothstep(0.42, 0.72, length(d)) * 0.8, 0.4 + length(d) * 0.8, u_aberMode);
  vec3 col = vec3(texture(u_scene, uv + d * ab).r, texture(u_scene, uv).g, texture(u_scene, uv - d * ab).b);
  col += texture(u_bloom, uv).rgb * u_bloomAmt;

  float rr = length(d * vec2(u_res.x / u_res.y, 1.0));
  if (u_scrim > 0.0) {
    float s = u_scrim * (1.0 - smoothstep(0.1, 0.62, rr));
    col = mix(col, vec3(1.0 - u_scrimDark), s);
  }
  if (u_vignette > 0.0) col *= 1.0 - u_vignette * 0.6 * smoothstep(0.35, 0.78, length(d * vec2(u_res.x / u_res.y, 1.0)) * 1.05);
  if (u_halftone > 0.0) {
    float cell = max(14.0, min(u_res.x, u_res.y) / u_dpr / 38.0) * u_dpr;
    vec2 g = gl_FragCoord.xy / cell;
    g.x += mod(floor(g.y), 2.0) * 0.5;
    vec2 f = fract(g) - 0.5;
    float fall = clamp(rr * 1.5, 0.0, 1.0);
    float rad = 0.5 * fall * fall * 1.1;
    float dotA = 1.0 - smoothstep(rad - 0.04, rad + 0.04, length(f));
    col = mix(col, u_dotColor, dotA * u_halftone * 0.8);
  }
  if (u_scan > 0.0) col *= 1.0 - u_scan * step(mod(floor(gl_FragCoord.y / u_dpr), 3.0), 0.5);
  if (u_grain > 0.0) {
    float n = hash(floor(gl_FragCoord.xy / max(u_grainCell, 1.0)) + floor(u_time * 12.5) * 17.0);
    col += (n - 0.5) * u_grain * 0.9;
  }
  if (u_dither > 0.0) {
    // ordered dithering with interleaved gradient noise: the flat, printed look of low-colour art
    float t = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
    col = floor(col * u_dither + 0.5 + t * 0.9) / u_dither;
  }
  col += u_flash;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;
