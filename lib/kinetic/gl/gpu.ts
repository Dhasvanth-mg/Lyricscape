// Thin WebGL2 helpers for the Turbo renderer: programs, textures, render targets and 2D affine maths.
// Nothing here knows about lyrics. Browser-only.

export type Affine = [number, number, number, number, number, number]; // x' = a x + c y + e ; y' = b x + d y + f

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/** a ∘ b: apply `b` first, then `a`. */
export function mul(a: Affine, b: Affine): Affine {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export const translate = (x: number, y: number): Affine => [1, 0, 0, 1, x, y];
export const scale = (sx: number, sy: number): Affine => [sx, 0, 0, sy, 0, 0];
export const rotate = (rad: number): Affine => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
};
export const skewX = (k: number): Affine => [1, 0, k, 1, 0, 0];

/** the camera of a frame: translate(W/2+x, H/2+y) · rotate · scale · translate(-W/2, -H/2), exactly as the canvas renderer does it */
export function cameraMatrix(W: number, H: number, cam: { zoom: number; rotationDeg: number; x: number; y: number }): Affine {
  return mul(mul(mul(translate(W / 2 + cam.x, H / 2 + cam.y), rotate((cam.rotationDeg * Math.PI) / 180)), scale(cam.zoom, cam.zoom)), translate(-W / 2, -H / 2));
}

/** stage pixels (origin top-left, y down) -> clip space */
export const toClip = (W: number, H: number): Affine => [2 / W, 0, 0, -2 / H, -1, 1];

/** hex or rgb()/rgba() colour -> [r,g,b,a] in 0..1 */
export function parseColor(c: string): [number, number, number, number] {
  if (c.startsWith('#')) {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7);
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  }
  const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/i.exec(c);
  if (m) return [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, m[4] === undefined ? 1 : Number(m[4])];
  return [1, 1, 1, 1];
}

export class Program {
  readonly prog: WebGLProgram;
  private uni = new Map<string, WebGLUniformLocation | null>();
  constructor(private gl: WebGL2RenderingContext, vs: string, fs: string, name: string) {
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`${name}: ${gl.getShaderInfoLog(s) ?? 'shader failed to compile'}`);
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.bindAttribLocation(p, 1, 'a_p1');
    gl.bindAttribLocation(p, 2, 'a_p2');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${name}: ${gl.getProgramInfoLog(p) ?? 'program failed to link'}`);
    this.prog = p;
  }
  use() {
    this.gl.useProgram(this.prog);
  }
  loc(name: string) {
    let l = this.uni.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.prog, name);
      this.uni.set(name, l);
    }
    return l;
  }
  f(name: string, v: number) {
    const l = this.loc(name);
    if (l) this.gl.uniform1f(l, v);
  }
  i(name: string, v: number) {
    const l = this.loc(name);
    if (l) this.gl.uniform1i(l, v);
  }
  v2(name: string, a: number, b: number) {
    const l = this.loc(name);
    if (l) this.gl.uniform2f(l, a, b);
  }
  v3(name: string, a: number, b: number, c: number) {
    const l = this.loc(name);
    if (l) this.gl.uniform3f(l, a, b, c);
  }
  v4(name: string, a: number, b: number, c: number, d: number) {
    const l = this.loc(name);
    if (l) this.gl.uniform4f(l, a, b, c, d);
  }
  col(name: string, c: [number, number, number, number]) {
    this.v4(name, c[0], c[1], c[2], c[3]);
  }
  col3(name: string, c: [number, number, number, number]) {
    this.v3(name, c[0], c[1], c[2]);
  }
  v3arr(name: string, data: Float32Array) {
    const l = this.loc(name);
    if (l) this.gl.uniform3fv(l, data);
  }
  m(name: string, a: Affine) {
    const l = this.loc(name);
    if (l) this.gl.uniformMatrix3fv(l, false, [a[0], a[1], 0, a[2], a[3], 0, a[4], a[5], 1]);
  }
}

export type Tex = { tex: WebGLTexture; w: number; h: number };

/** Upload a canvas/image as a premultiplied, mip-mapped texture. */
export function textureFrom(gl: WebGL2RenderingContext, src: TexImageSource, w: number, h: number, opts: { mips?: boolean; repeat?: boolean } = {}): Tex {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  const mips = opts.mips !== false;
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const wrap = opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return { tex, w, h };
}

export type Target = { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

export function createTarget(gl: WebGL2RenderingContext, w: number, h: number): Target {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, w, h };
}

export function freeTarget(gl: WebGL2RenderingContext, t: Target | null) {
  if (!t) return;
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}
