'use client';

// Look gallery: original sample songs pushed through the REAL pipeline (identity -> art direction -> look -> renderer) in Auto.
// A QA and review page, not part of the player. Everything on it is invented (see lib/theme/fixtures.ts); the tags are stand-ins.
//
//   /looks                         every fixture, frozen at its own moment
//   /looks?song=amber-hours&w=1280&h=720&t=13.2        one song, any size / time
//   &dir=nocturne                  force an art direction instead of Auto
//   &tw=<json>                     adjustments (the same Tweaks the Studio makes)
//   &anim=1                        play instead of freezing
//   &quality=low|medium|high       renderer quality (for measuring)
//   &bench=1                       measure ms per frame (GPU flush included) into the canvas's data-bench attribute

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { coverDataUrl } from '@/lib/artwork/generate';
import { extractPaletteFromUrl } from '@/lib/kinetic/extractPalette';
import { KineticRenderer } from '@/lib/kinetic/render';
import { parseLrc } from '@/lib/lyrics/parse';
import { paletteWarmth } from '@/lib/theme/color';
import { FIXTURE, FIXTURES, tagsOf, type Fixture } from '@/lib/theme/fixtures';
import { songVisual, type SongVisual } from '@/lib/theme/pipeline';
import type { CoverInfo, Tweaks } from '@/lib/theme/types';
import type { StyleId } from '@/lib/kinetic/types';
import type { Track } from '@/lib/types';
import { DIRECTIONS } from '@/lib/theme/directions';

type Opts = { w: number; h: number; t?: number; dir?: StyleId; tweaks?: Tweaks; anim: boolean; quality: 'low' | 'medium' | 'high'; bench: boolean };

function LookCanvas({ f, o, onInfo }: { f: Fixture; o: Opts; onInfo?: (v: SongVisual) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState<SongVisual | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let alive = true;
    let raf = 0;
    setReady(false);
    const cover = coverDataUrl({ seed: `fixture:${f.id}`, palette: f.cover.palette, style: f.cover.style });
    const track: Track = { id: `fixture:${f.id}`, provider: 'demo', title: f.title, artists: [f.artist], durationMs: 200000, releaseYear: f.year, artworkUrl: cover, palette: f.cover.palette };
    void (async () => {
      const px = await extractPaletteFromUrl(cover);
      const info: CoverInfo | null = px ? { palette: px.palette, light: px.light, vibrance: px.vibrance, warmth: paletteWarmth(px.palette) } : null;
      const v = songVisual({ track, doc: parseLrc(f.lrc), tags: tagsOf(f), cover: info, song: o.dir ? { pick: { kind: 'direction', id: o.dir }, tweaks: o.tweaks ?? {} } : o.tweaks ? { pick: { kind: 'auto' }, tweaks: o.tweaks } : null });
      if (!alive) return;
      setInfo(v);
      onInfo?.(v);
      const r = new KineticRenderer(canvas);
      r.options = { ...r.options, quality: o.quality, reducedMotion: false, motionScale: 1, artworkPolicy: 'full', colorMode: 'blend', emojis: true, doodles: true, artwork: 'background' };
      r.setQuality(o.quality);
      r.resize(o.w, o.h, 1);
      await r.loadFonts();
      r.setTimeline(v.timeline);
      r.setLook(v.resolved.look);
      const img = new Image();
      await new Promise<void>((res) => {
        img.onload = () => res();
        img.onerror = () => res();
        img.src = cover;
      });
      r.setArtwork(img);
      const t0 = performance.now();
      const draw = () => r.render(o.anim ? (o.t ?? f.at) * 1000 + (performance.now() - t0) : (o.t ?? f.at) * 1000);
      // the look's own faces load lazily: wait for them, then draw again so the frame shows the right type
      await document.fonts.ready;
      await new Promise((res) => setTimeout(res, 450));
      if (!alive) return;
      draw();
      if (o.bench) canvas.dataset.bench = r.bench((o.t ?? f.at) * 1000, 90).toFixed(2);
      setReady(true);
      if (o.anim) {
        const loop = () => {
          draw();
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.id, o.w, o.h, o.t, o.dir, o.anim, o.quality, o.bench, JSON.stringify(o.tweaks ?? null)]);

  return (
    <div>
      <canvas ref={ref} width={o.w} height={o.h} style={{ width: o.w, height: o.h, display: 'block', maxWidth: '100%' }} data-testid="look-canvas" data-ready={ready ? '1' : '0'} data-direction={info?.resolved.direction ?? ''} aria-label={`${f.title} rendered in ${info?.resolved.direction ?? '…'}`} role="img" />
    </div>
  );
}

function Caption({ f, v }: { f: Fixture; v: SongVisual | null }) {
  if (!v) return <p className="mt-2 text-xs text-ink-400">Reading the song…</p>;
  const d = DIRECTIONS[v.resolved.direction]!;
  return (
    <div className="mt-2 text-xs" data-testid="look-caption">
      <p className="text-sm font-semibold">
        {f.title} <span className="font-normal text-ink-300">· {f.artist}</span>
      </p>
      <p className="text-ink-200">
        Auto → <strong>{d.label}</strong> · {v.described.headline}
      </p>
      <p className="text-ink-400">
        Tags: {f.tags.join(', ') || 'none'} · why: {v.resolved.choice.reasons.join(', ') || '—'}
        {v.resolved.notes.length ? ` · ${v.resolved.notes.join(', ')}` : ''}
      </p>
    </div>
  );
}

function Card({ f, o }: { f: Fixture; o: Opts }) {
  const [v, setV] = useState<SongVisual | null>(null);
  return (
    <figure className="m-0">
      <LookCanvas f={f} o={o} onInfo={setV} />
      <Caption f={f} v={v} />
    </figure>
  );
}

function Gallery() {
  const q = useSearchParams();
  const num = (k: string, d: number) => (q.get(k) && Number.isFinite(Number(q.get(k))) ? Number(q.get(k)) : d);
  let tweaks: Tweaks | undefined;
  try {
    tweaks = q.get('tw') ? (JSON.parse(q.get('tw')!) as Tweaks) : undefined;
  } catch {
    tweaks = undefined;
  }
  const dir = q.get('dir') && DIRECTIONS[q.get('dir') as StyleId] ? (q.get('dir') as StyleId) : undefined;
  const quality = (['low', 'medium', 'high'] as const).find((x) => x === q.get('quality')) ?? 'high';
  const song = q.get('song');
  const single = song ? FIXTURE[song] : undefined;
  const base: Omit<Opts, 'w' | 'h'> = { t: q.get('t') ? num('t', 0) : undefined, dir, tweaks, anim: q.get('anim') === '1', quality, bench: q.get('bench') === '1' };
  if (single) {
    return (
      <div className="p-4">
        <LookCanvas f={single} o={{ ...base, w: num('w', 1280), h: num('h', 720) }} />
      </div>
    );
  }
  const w = num('w', 560);
  const h = num('h', Math.round((w * 9) / 16));
  return (
    <div className="p-4">
      <h1 className="font-display text-3xl uppercase">Look gallery</h1>
      <p className="mb-5 max-w-3xl text-sm text-ink-300">
        Original sample songs (invented titles, lyrics written for this page, generated covers, stand-in genre tags) run through the real pipeline in Auto. Each frame is frozen at one moment of the song. These are not real recordings.
      </p>
      <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.min(w, 560)}px, 1fr))` }}>
        {FIXTURES.map((f) => (
          <Card key={f.id} f={f} o={{ ...base, w, h }} />
        ))}
      </div>
    </div>
  );
}

export default function LooksPage() {
  return (
    <Suspense fallback={null}>
      <Gallery />
    </Suspense>
  );
}
