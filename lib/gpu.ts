// Which graphics processor is the browser really drawing on?
//
// A web page cannot choose its GPU: on a laptop with integrated + dedicated graphics the browser decides (Windows "Graphics settings",
// or the --force_high_performance_gpu launch flag). Measured here: even a WebGL context with powerPreference "high-performance" stays on
// the integrated GPU unless the browser itself was started on the dedicated one. So the app does the honest things: it ASKS (the hint
// is harmless), it TELLS the listener which GPU is in use, and it shows how to move the browser to the dedicated one.

export type GpuKind = 'dedicated' | 'integrated' | 'unified' | 'software' | 'unknown';
export type GpuInfo = { renderer: string; vendor: string; kind: GpuKind };

export function classifyGpu(renderer: string): GpuKind {
  const r = renderer.toLowerCase();
  if (!r) return 'unknown';
  if (/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(r)) return 'software';
  if (/nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|radeon vii|\barc\b.*\ba\d{3}|rx \d{3,4}/.test(r)) return 'dedicated';
  if (/apple m\d|apple gpu/.test(r)) return 'unified'; // Apple silicon: one GPU, nothing to switch
  if (/intel|uhd|iris|vega \d+ graphics|radeon\(tm\) graphics|radeon graphics|graphics \(0x/.test(r)) return 'integrated';
  return 'unknown';
}

let cached: GpuInfo | null = null;

/** Read the GPU the browser is using. Asks for high performance (it costs nothing and some browsers honour it). */
export function detectGpu(): GpuInfo {
  if (cached) return cached;
  let renderer = '';
  let vendor = '';
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2', { powerPreference: 'high-performance' }) ?? c.getContext('webgl', { powerPreference: 'high-performance' })) as WebGLRenderingContext | null;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && ext) {
      renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      vendor = String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL));
    }
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    /* no WebGL: unknown */
  }
  cached = { renderer: renderer.replace(/^ANGLE \((.*)\)$/, '$1').replace(/ Direct3D11.*$/, ''), vendor, kind: classifyGpu(renderer) };
  return cached;
}
