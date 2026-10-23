// Small, dependency-free DSP helpers used by the (server-side) music analysis.

/** In-place iterative radix-2 FFT. `re.length` must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlr = Math.cos(ang);
    const wli = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1;
      let wi = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]!;
        const ui = im[i + k]!;
        const xr = re[i + k + len / 2]!;
        const xi = im[i + k + len / 2]!;
        const vr = xr * wr - xi * wi;
        const vi = xr * wi + xi * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nwr = wr * wlr - wi * wli;
        wi = wr * wli + wi * wlr;
        wr = nwr;
      }
    }
  }
}

export const hann = (n: number): Float64Array => {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
};

export function mean(a: ArrayLike<number>, from = 0, to = a.length): number {
  let s = 0;
  const n = Math.max(0, to - from);
  for (let i = from; i < to; i++) s += a[i]!;
  return n ? s / n : 0;
}

export function stddev(a: ArrayLike<number>): number {
  const m = mean(a);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i]! - m) ** 2;
  return Math.sqrt(s / Math.max(1, a.length));
}

export const median = (a: number[]): number => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Centered moving average (same length). */
export function movingAverage(a: ArrayLike<number>, radius: number): Float64Array {
  const out = new Float64Array(a.length);
  const prefix = new Float64Array(a.length + 1);
  for (let i = 0; i < a.length; i++) prefix[i + 1] = prefix[i]! + a[i]!;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - radius);
    const hi = Math.min(a.length, i + radius + 1);
    out[i] = (prefix[hi]! - prefix[lo]!) / (hi - lo);
  }
  return out;
}

/** Linear-interpolating downmix/resample of mono float PCM. */
export function resample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x;
  const n = Math.floor((x.length * to) / from);
  const out = new Float32Array(n);
  const ratio = from / to;
  for (let i = 0; i < n; i++) {
    const p = i * ratio;
    const i0 = Math.floor(p);
    const f = p - i0;
    out[i] = (x[i0] ?? 0) * (1 - f) + (x[i0 + 1] ?? x[i0] ?? 0) * f;
  }
  return out;
}

export const dbfs = (rms: number) => 20 * Math.log10(Math.max(1e-9, rms));
