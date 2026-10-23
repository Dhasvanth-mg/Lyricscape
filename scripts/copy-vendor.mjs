// MapLibre v6 runs tile/geojson work in an ES-module worker. Bundlers don't reliably emit it,
// so we serve the two worker files statically and point MapLibre at them (setWorkerUrl).
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
try {
  const dist = path.join(path.dirname(require.resolve('maplibre-gl/package.json')), 'dist');
  const out = path.join(process.cwd(), 'public', 'vendor', 'maplibre');
  mkdirSync(out, { recursive: true });
  for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
    if (existsSync(path.join(dist, f))) copyFileSync(path.join(dist, f), path.join(out, f));
  }
  console.log('[vendor] maplibre worker files copied to public/vendor/maplibre');
} catch (e) {
  console.warn('[vendor] skipped (maplibre-gl not installed yet):', e.message);
}
