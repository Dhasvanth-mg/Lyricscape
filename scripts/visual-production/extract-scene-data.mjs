// Turns the Phase 2 planning files (docs/visual-production/styles/<slug>/compatibility.json and asset-manifest.json) into the
// compact runtime scene data the planner reads (lib/styles/data/<slug>.json). Run after the planning data changes:
//   node scripts/visual-production/extract-scene-data.mjs
// The planning documents stay the specification; this file only copies the parts the runtime needs, so the two cannot drift
// (tests/style-scene-data.test.ts checks that every runtime id still exists in the planning manifest).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = join(root, 'docs', 'visual-production', 'styles');
const out = join(root, 'lib', 'styles', 'data');
mkdirSync(out, { recursive: true });

const LIVE = new Set(['approved', 'revised', 'deferred']);
const STOP = new Set(['default', 'for', 'songs', 'song', 'and', 'the', 'a', 'of', 'with', 'or', 'subjects', 'words', 'mood', 'lyrics', 'identity', 'chosen', 'by', 'any', 'when', 'in', 'on', 'to']);

/** "default for calm and night songs; grief, anger" -> ['calm', 'night', 'grief', 'anger'] */
function keywords(text) {
  const words = text
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[^a-z0-9-]+/)
    .filter((w) => w && !STOP.has(w) && w.length > 1);
  return [...new Set(words)];
}
const durationOf = (anim) => {
  const m = /(\d{2,5})\s*ms/.exec(anim ?? '');
  return m ? Number(m[1]) : null;
};
function responsive(text) {
  const r = {};
  for (const part of String(text ?? '').split(/;\s*/)) {
    const m = /^(landscape|portrait|square|small):\s*(.*)$/.exec(part.trim());
    if (m) r[m[1]] = m[2].replace(/\.$/, '').trim();
  }
  return r;
}

let total = 0;
for (const slug of readdirSync(src).sort()) {
  if (slug.startsWith('_')) continue;
  const cpath = join(src, slug, 'compatibility.json');
  const mpath = join(src, slug, 'asset-manifest.json');
  if (!existsSync(cpath) || !existsSync(mpath)) continue;
  const compat = JSON.parse(readFileSync(cpath, 'utf8'));
  const manifest = JSON.parse(readFileSync(mpath, 'utf8'));
  const byId = new Map(manifest.assets.map((a) => [a.id, a]));
  const code = manifest.assets[0].id.split('-')[0];
  const scenes = Object.entries(compat.scene_families).map(([id, s]) => {
    const m = byId.get(id);
    const chosen = /Chosen by:\s*(.*)$/.exec(m?.purpose ?? '')?.[1] ?? '';
    return {
      id,
      name: s.name,
      status: m?.status ?? 'approved',
      roles: s.roles,
      signalsText: chosen.replace(/\.$/, ''),
      signals: keywords(chosen),
      isDefault: /\bdefault\b/i.test(chosen),
      compositions: s.compositions,
      required: s.required,
      optional: s.optional,
      attributes: s.attributes,
    };
  });
  const compositions = Object.entries(compat.composition_families).map(([id, c]) => ({
    id,
    name: c.name,
    status: byId.get(id)?.status ?? 'approved',
    layers: String(c.layers).split(/,\s*/),
    safe: c.safe_area,
    responsive: responsive(byId.get(id)?.responsive_behaviour),
  }));
  const transitions = manifest.assets
    .filter((a) => a.category === 'TRN' && LIVE.has(a.status))
    .map((a) => ({ id: a.id, name: a.name, status: a.status, durationMs: durationOf(a.animation), use: a.purpose, reducedMotion: a.reduced_motion ?? 'Cut.' }));
  const families = Object.entries(compat.asset_families).map(([id, f]) => ({
    id,
    name: f.name,
    kind: f.kind,
    members: manifest.assets.filter((a) => a.family.startsWith(id + ' ') && LIVE.has(a.status)).map((a) => a.id),
    scenes: f.scenes,
  }));
  const data = { schema: 'lyricscape.scene-data/1', style: compat.style, slug, code, layerOrder: compat.layer_order, limits: compat.limits, invalid: compat.invalid, scenes, compositions, transitions, families };
  writeFileSync(join(out, `${slug}.json`), JSON.stringify(data, null, 1) + '\n');
  total++;
  console.log(`${slug}: ${scenes.length} scene families, ${compositions.length} compositions, ${transitions.length} transitions, ${families.length} asset families`);
}
console.log(`${total} styles written to lib/styles/data`);
