'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Eye, Gauge, Maximize, Minimize, PenTool, Search, Smile, Type, X } from 'lucide-react';
import type { Track } from '@/lib/types';
import { compileTimeline } from '@/lib/kinetic/compile';
import { KineticRenderer } from '@/lib/kinetic/render';
import { paletteForTrack } from '@/lib/kinetic/palette';
import { EMOTIONS, EMOTION_DEFS, analyzeEmotion, overrideMood, type ColorMode } from '@/lib/kinetic/emotion';
import { extractPaletteFromUrl } from '@/lib/kinetic/extractPalette';
import { FrameGovernor, type QualityLevel } from '@/lib/kinetic/governor';
import { useUi } from '@/lib/ui-store';
import { STYLES } from '@/lib/kinetic/styles';
import { STYLE_IDS, type StyleId } from '@/lib/kinetic/types';
import { player, usePlayer } from '@/lib/player/controller';
import { kvGet, kvSet } from '@/lib/library/db';
import { Button, IconButton, Spinner } from '@/components/ui/bits';
import { useLyrics } from './useLyrics';
import { LookControls } from './LookControls';

type Props = {
  track: Track | null;
  style: StyleId;
  onStyleChange?: (s: StyleId) => void;
  /** show built-in controls overlay (stage/fullscreen mode) */
  chrome?: boolean;
  onClose?: () => void;
  className?: string;
  /** called when the user asks to paste lyrics (opens editor elsewhere) */
  onEditLyrics?: () => void;
};

export function LyricStage({ track, style, onStyleChange, chrome = false, onClose, className, onEditLyrics }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<KineticRenderer | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const offsetRef = useRef(0);
  const status = usePlayer((s) => s.status);

  const lyrics = useLyrics(track);
  const ui = useUi();
  const [albumPalette, setAlbumPalette] = useState<string[] | null>(null);
  const [coverCues, setCoverCues] = useState<{ light: number; focal: { x: number; y: number }; vibrance: number } | null>(null);
  const governorRef = useRef(new FrameGovernor('high'));
  const [osReduced, setOsReduced] = useState(false);
  const [forceCalm, setForceCalm] = useState(false);
  const [readable, setReadable] = useState(false);
  const [trackOffset, setTrackOffset] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [ready, setReady] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reduced = osReduced || forceCalm;

  // OS-level reduced motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setOsReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Sync delay. By default ONE delay is shared by every song (kept separately for Spotify, whose position is
  // polled, and for local audio, which is exact), so it doesn't reset each track. Turn sharing off for per-song values.
  const family = track?.provider === 'spotify' ? 'spotify' : 'local';
  const offsetMs = ui.syncShared ? ui.syncGlobal[family] : trackOffset;
  useEffect(() => {
    let cancelled = false;
    setTrackOffset(0);
    if (!track || ui.syncShared) return;
    void kvGet<number>(`offset:${track.id}`).then((v) => {
      if (!cancelled && typeof v === 'number') setTrackOffset(v);
    });
    return () => {
      cancelled = true;
    };
  }, [track, ui.syncShared]);
  useEffect(() => {
    offsetRef.current = offsetMs;
  }, [offsetMs]);

  // album colors: read a few dominant colors from the cover (the cover itself is never altered)
  useEffect(() => {
    let cancelled = false;
    setAlbumPalette(null);
    setCoverCues(null);
    if (!track?.artworkUrl) return;
    void extractPaletteFromUrl(track.artworkUrl).then((r) => {
      if (cancelled || !r) return;
      if (r.vibrance > 0.12) setAlbumPalette(r.palette);
      setCoverCues({ light: r.light, focal: r.focal, vibrance: r.vibrance });
    });
    return () => {
      cancelled = true;
    };
  }, [track?.artworkUrl]);

  // mood from lyrics + tempo (a transparent heuristic), or the one the user picked
  const mood = useMemo(() => {
    if (!track) return null;
    const detected = analyzeEmotion(lyrics.doc, { bpm: track.bpm });
    return ui.mood === 'auto' ? detected : overrideMood(detected, ui.mood);
  }, [track, lyrics.doc, ui.mood]);

  const timeline = useMemo(() => {
    if (!track) return null;
    const doc = lyrics.doc ?? { source: 'manual' as const, licenseSource: 'none', lines: [] };
    return compileTimeline(doc, {
      trackId: track.id,
      durationMs: track.durationMs || 180000,
      palette: albumPalette ?? paletteForTrack(track),
      style,
      bpm: track.bpm,
      beatTimesMs: track.beatTimesMs,
      mood: mood ?? undefined,
      cover: coverCues ?? undefined,
      label: `${track.title} • ${track.artists.join(', ')}`,
    });
  }, [track, lyrics.doc, style, albumPalette, mood, coverCues]);

  // renderer lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const r = new KineticRenderer(canvas);
    rendererRef.current = r;
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __ls?: unknown }).__ls = { r, ui: useUi };
    let alive = true;
    void r.loadFonts().then(() => alive && setReady(true));
    const ro = new ResizeObserver(() => {
      const b = wrap.getBoundingClientRect();
      r.resize(b.width, b.height);
    });
    ro.observe(wrap);
    const b = wrap.getBoundingClientRect();
    r.resize(b.width, b.height);
    return () => {
      alive = false;
      ro.disconnect();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setTimeline(timeline);
  }, [timeline, ready]);

  // artwork
  useEffect(() => {
    const r = rendererRef.current;
    imgRef.current = null;
    r?.setArtwork(null);
    if (!track?.artworkUrl) return;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      imgRef.current = img;
      rendererRef.current?.setArtwork(img);
    };
    img.src = track.artworkUrl;
  }, [track?.artworkUrl, ready]);

  // options
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.options = {
      reducedMotion: reduced,
      motionScale: readable ? 0.35 : 1,
      quality: r.options.quality,
      artworkPolicy: 'full', // personal-use build: the cover is used freely as a backdrop for every source
      colorMode: ui.colorMode,
      emojis: ui.emojis,
      doodles: ui.doodles,
      artwork: ui.artwork,
    };
  }, [reduced, readable, track?.provider, ready, ui.colorMode, ui.emojis, ui.doodles, ui.artwork]);

  // quality: pinned by the user, or adapted live from real frame intervals
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    const start: QualityLevel = ui.quality === 'auto' ? 'high' : ui.quality;
    governorRef.current.reset(start, performance.now());
    r.setQuality(start);
  }, [ui.quality, ready]);

  // render loop (driven by the playback clock, never by its own wall clock)
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      const r = rendererRef.current;
      if (r && document.visibilityState === 'visible') {
        r.render(Math.max(0, player.getPositionMs() + offsetRef.current));
        if (last && useUi.getState().quality === 'auto') {
          const next = governorRef.current.push(now - last, now);
          if (next) r.setQuality(next);
        }
      }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // auto-hiding controls in chrome mode
  useEffect(() => {
    if (!chrome) return;
    const show = () => {
      setControlsVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3200);
    };
    show();
    window.addEventListener('mousemove', show);
    window.addEventListener('keydown', show);
    window.addEventListener('touchstart', show);
    return () => {
      window.removeEventListener('mousemove', show);
      window.removeEventListener('keydown', show);
      window.removeEventListener('touchstart', show);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [chrome]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const changeOffset = (v: number) => {
    if (ui.syncShared) ui.setSyncGlobal(family, v);
    else {
      setTrackOffset(v);
      if (track) void kvSet(`offset:${track.id}`, v);
    }
  };

  const noLyrics = track && (lyrics.status === 'missing' || lyrics.status === 'error');

  return (
    <div
      ref={wrapRef}
      className={clsx('relative isolate overflow-hidden bg-ink-950', chrome && !controlsVisible && 'cursor-none', className)}
      data-testid="lyric-stage"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={track ? `Lyrics for ${track.title}` : 'Lyrics'} role="img" />

      {!track && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="font-display text-4xl uppercase">Nothing playing</p>
          <p className="max-w-sm text-sm text-ink-300">Play a demo song, import a file, or connect Spotify and play anything. The lyrics will appear here.</p>
        </div>
      )}

      {track && lyrics.status === 'loading' && (
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs backdrop-blur">
          <Spinner /> Loading lyrics…
        </div>
      )}
      {track && lyrics.searching && (
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs backdrop-blur">
          <Spinner /> Searching LRCLIB…
        </div>
      )}

      {noLyrics && !lyrics.searching && (
        <div className="absolute inset-x-4 bottom-24 mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/70 p-5 text-center backdrop-blur-md sm:bottom-28">
          <p className="font-display text-2xl uppercase">No lyrics for this song yet</p>
          <p className="text-sm text-ink-200">
            {lyrics.status === 'error' ? lyrics.message : track?.provider === 'spotify' ? 'Spotify does not provide lyrics. Find timed lyrics online or paste your own (LRC, VTT or plain text).' : 'Add timed lyrics to see them come alive.'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="primary" size="sm" onClick={() => void lyrics.findOnline()}>
              <Search size={14} /> Find lyrics online
            </Button>
            {onEditLyrics ? (
              <Button size="sm" onClick={onEditLyrics}>
                Paste lyrics
              </Button>
            ) : (
              <Link href="/visuals" onClick={onClose} className="inline-flex h-8 items-center rounded-full border border-ink-600 bg-ink-850 px-3.5 text-[13px] font-semibold hover:border-ink-400">
                Paste lyrics
              </Link>
            )}
          </div>
          <p className="text-[11px] text-ink-400">Find online sends only title, artist and length to LRCLIB (an open lyrics database).</p>
        </div>
      )}

      {/* corner badge: detected mood + lyric source */}
      {track && mood && (
        <div className="pointer-events-none absolute bottom-3 left-4 hidden items-center gap-2 font-mono text-[10px] tracking-wide text-white/60 uppercase sm:flex" data-testid="mood-chip">
          <span className="rounded-full bg-black/50 px-2 py-1 text-xs normal-case backdrop-blur">
            {EMOTION_DEFS[mood.overall.emotion].emoji} {EMOTION_DEFS[mood.overall.emotion].label}
            <span className="ml-1 opacity-60">· {ui.mood === 'auto' ? mood.basis === 'none' ? 'guess' : mood.basis : 'your pick'}</span>
          </span>
          {lyrics.doc && <span>Lyrics: {lyrics.source}</span>}
        </div>
      )}

      {chrome && (
        <div
          className={clsx(
            'absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 bg-gradient-to-b from-black/80 to-transparent p-3 transition-opacity duration-300 sm:p-4',
            controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{track?.title ?? '—'}</p>
            <p className="truncate text-xs text-ink-300">{track?.artists.join(', ')}</p>
          </div>
          <label className="sr-only" htmlFor="style-select">
            Visual style
          </label>
          <select
            id="style-select"
            value={style}
            onChange={(e) => onStyleChange?.(e.target.value as StyleId)}
            className="h-9 rounded-full border border-ink-600 bg-ink-900/80 px-3 text-sm"
          >
            {STYLE_IDS.map((s) => (
              <option key={s} value={s}>
                {STYLES[s].label}
              </option>
            ))}
          </select>
          <LookControls compact />
          <IconButton label={readable ? 'Readable lyrics: on' : 'Readable lyrics: off'} active={readable} onClick={() => setReadable((v) => !v)}>
            <Type size={18} />
          </IconButton>
          <IconButton label={forceCalm || osReduced ? 'Reduced motion: on' : 'Reduced motion: off'} active={reduced} onClick={() => setForceCalm((v) => !v)} disabled={osReduced}>
            <Eye size={18} />
          </IconButton>
          <IconButton label={isFs ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFs}>
            {isFs ? <Minimize size={18} /> : <Maximize size={18} />}
          </IconButton>
          {onClose && (
            <IconButton label="Close" onClick={onClose}>
              <X size={20} />
            </IconButton>
          )}
        </div>
      )}

      {chrome && (
        <div
          className={clsx(
            'absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/85 to-transparent p-3 sm:p-4 transition-opacity duration-300',
            controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <button
            onClick={() => void player.toggle()}
            className="rounded-full bg-bone px-5 py-2 text-sm font-bold text-ink-950"
            aria-label={status === 'playing' ? 'Pause' : 'Play'}
          >
            {status === 'playing' ? 'Pause' : 'Play'}
          </button>
          <div className="ml-auto flex items-center gap-2 text-xs text-ink-200">
            <Gauge size={14} aria-hidden />
            <label htmlFor="sync-offset" className="whitespace-nowrap">
              Sync {offsetMs > 0 ? '+' : ''}
              {offsetMs} ms
            </label>
            <input
              id="sync-offset"
              type="range"
              className="seek w-32"
              min={-3000}
              max={3000}
              step={50}
              value={offsetMs}
              style={{ ['--pct' as string]: `${((offsetMs + 3000) / 6000) * 100}%` }}
              onChange={(e) => changeOffset(Number(e.target.value))}
            />
            <button className="underline" onClick={() => changeOffset(0)}>
              reset
            </button>
            <label className="ml-2 inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap" title="Keep one delay for every song instead of resetting per track">
              <input type="checkbox" checked={ui.syncShared} onChange={(e) => ui.set({ syncShared: e.target.checked })} className="accent-[var(--color-signal)]" />
              same for all {family === 'spotify' ? 'Spotify ' : ''}songs
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
