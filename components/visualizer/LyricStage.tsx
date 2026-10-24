'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Download, Gauge, Maximize, Minimize, Palette, Pause, Play, Search, X, Zap } from 'lucide-react';
import type { Track } from '@/lib/types';
import { sceneAt } from '@/lib/kinetic/compile';
import { compileForTrack, moodFor } from '@/lib/kinetic/forTrack';
import { syncDiag } from '@/lib/player/syncDiag';
import { createStageRenderer, type StageRenderer } from '@/lib/kinetic/stageRenderer';
import { extractPaletteFromUrl } from '@/lib/kinetic/extractPalette';
import { FrameGovernor, type QualityLevel } from '@/lib/kinetic/governor';
import { useUi } from '@/lib/ui-store';
import { paletteWarmth } from '@/lib/theme/color';
import { directionOf } from '@/lib/theme/directions';
import type { CoverInfo } from '@/lib/theme/types';
import { useSongLook } from './useSongLook';
import { artworkFor } from '@/lib/artwork/forTrack';
import type { StyleId, VisualTimeline } from '@/lib/kinetic/types';
import { usePlayer, player } from '@/lib/player/controller';
import { useLyricClock } from './useLyricClock';
import { Button, IconButton, Spinner } from '@/components/ui/bits';
import { useLyrics } from './useLyrics';
import { timingSummary } from '@/lib/lyrics/parse';
import { detectDocLanguage } from '@/lib/lyrics/script';
import { Cover } from '@/components/ui/Cover';
import { StagePanel, type PanelTab } from './StagePanel';
import { ExportDialog } from './ExportDialog';

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
  const rendererRef = useRef<StageRenderer | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const status = usePlayer((s) => s.status);

  const lyrics = useLyrics(track);
  // the track's cover, or an original generated one: always something to take colors from and wash the background with
  const artSrc = track ? artworkFor(track) : null;
  const ui = useUi();
  // Turbo needs WebGL2; if the GPU path fails the stage drops back to Clean (on a fresh canvas) and says so
  const [turboFailed, setTurboFailed] = useState<string | null>(null);
  const mode = ui.mode === 'turbo' && !turboFailed ? 'turbo' : 'clean';
  const [albumPalette, setAlbumPalette] = useState<string[] | null>(null);
  const [coverCues, setCoverCues] = useState<{ light: number; focal: { x: number; y: number }; vibrance: number } | null>(null);
  const [coverInfo, setCoverInfo] = useState<CoverInfo | null>(null);
  const governorRef = useRef(new FrameGovernor('high'));
  const [osReduced, setOsReduced] = useState(false);
  const [forceCalm, setForceCalm] = useState(false);
  const [readable, setReadable] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  // side panel (Look / Sync); the ref lets the auto-hide timer know not to hide the controls while it is open
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<PanelTab>('look');
  const [toast, setToast] = useState<string | null>(null);
  const panelOpenRef = useRef(false);
  useEffect(() => {
    panelOpenRef.current = panelOpen;
    if (panelOpen) setControlsVisible(true);
  }, [panelOpen]);
  const [isFs, setIsFs] = useState(false);
  const [ready, setReady] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [exportShown, setExportShown] = useState(false);
  const barHover = useRef(false);
  // while this stage's export dialog is open, the live stage stops drawing so the exporter has the machine to itself
  useEffect(() => {
    if (!exportShown) return;
    useUi.getState().setExportOpen(true);
    return () => useUi.getState().setExportOpen(false);
  }, [exportShown]);

  const reduced = osReduced || forceCalm;

  // OS-level reduced motion
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setOsReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Two separate corrections (lib/player/lyricTime.ts): the device delay is the same for every song; the song offset
  // belongs to this lyric version. Neither is written into the stored lyrics.
  const clock = useLyricClock(track);
  const clockRef = useRef(clock.now);
  useEffect(() => {
    clockRef.current = clock.now;
  }, [clock.now]);
  // what the opt-in diagnostics (lib/player/syncDiag.ts) need from this render, read by the frame loop below
  const diagRef = useRef<{ clock: ReturnType<typeof useLyricClock>; timeline: VisualTimeline | null; lyrics: ReturnType<typeof useLyrics> } | null>(null);

  // album colors: read a few dominant colors from the cover (the cover itself is never altered)
  useEffect(() => {
    let cancelled = false;
    setAlbumPalette(null);
    setCoverCues(null);
    setCoverInfo(null);
    if (!artSrc) return;
    void extractPaletteFromUrl(artSrc).then((r) => {
      if (cancelled || !r) return;
      if (r.vibrance > 0.12) setAlbumPalette(r.palette);
      setCoverCues({ light: r.light, focal: r.focal, vibrance: r.vibrance });
      setCoverInfo({ palette: r.palette, light: r.light, vibrance: r.vibrance, warmth: paletteWarmth(r.palette) });
    });
    return () => {
      cancelled = true;
    };
  }, [artSrc]);

  // mood from lyrics + tempo (a transparent heuristic), or the one the user picked
  const mood = useMemo(() => (track ? moodFor(track, lyrics.doc, ui.mood) : null), [track, lyrics.doc, ui.mood]);

  // ---- the song's look: identity -> art direction -> one resolved Look (see useSongLook) ----
  const sl = useSongLook({ track, doc: lyrics.doc, cover: coverInfo, fallbackStyle: style });
  const { resolved } = sl;

  const timeline = useMemo(() => {
    if (!track || !sl.ready) return null;
    return compileForTrack({ track, doc: lyrics.doc, style: resolved.direction, albumPalette, cover: coverCues, mood, estimateWords: ui.estimatedWords });
  }, [track, sl.ready, lyrics.doc, resolved.direction, albumPalette, mood, coverCues, ui.estimatedWords]);

  useEffect(() => {
    diagRef.current = { clock, timeline, lyrics };
  });

  // renderer lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let r: StageRenderer;
    try {
      r = createStageRenderer(mode, canvas);
    } catch (e) {
      setTurboFailed(e instanceof Error ? e.message : 'WebGL2 is not available');
      return;
    }
    rendererRef.current = r;
    // if the GPU takes the context away and does not give it back, drop to Clean instead of freezing on a dead canvas
    let lostTimer: ReturnType<typeof setTimeout> | null = null;
    if (r.kind === 'webgl2') {
      (r as unknown as { onContextChange?: (lost: boolean) => void }).onContextChange = (lost) => {
        if (lostTimer) clearTimeout(lostTimer);
        lostTimer = lost ? setTimeout(() => setTurboFailed('the GPU context was lost'), 2500) : null;
      };
    }
    setReady(false);
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
      if (lostTimer) clearTimeout(lostTimer);
      r.dispose?.();
      rendererRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    rendererRef.current?.setTimeline(timeline);
  }, [timeline, ready, mode]);

  // the art direction: colours, type, artwork treatment and motion for this song
  useEffect(() => {
    rendererRef.current?.setLook(resolved.look);
  }, [resolved.look, ready, mode]);

  // artwork
  useEffect(() => {
    const r = rendererRef.current;
    imgRef.current = null;
    r?.setArtwork(null);
    if (!artSrc) return;
    // CORS first: it lets the renderer read the cover to choose each word's colour. Without it the cover still draws, words just
    // fall back to white with an edge.
    let dead = false;
    const load = (cors: boolean) => {
      const img = new Image();
      img.decoding = 'async';
      if (cors) img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (dead) return;
        imgRef.current = img;
        rendererRef.current?.setArtwork(img);
      };
      img.onerror = () => {
        if (cors && !dead) load(false);
      };
      img.src = artSrc;
    };
    load(true);
    return () => {
      dead = true;
    };
  }, [artSrc, ready, mode]);

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
      interlude: ui.interlude,
      texture: true,
      turboStyle: ui.turboStyle,
    };
  }, [reduced, readable, track?.provider, ready, mode, ui.colorMode, ui.emojis, ui.doodles, ui.artwork, ui.interlude, ui.turboStyle]);

  // quality: pinned by the user, or adapted live from real frame intervals
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    const start: QualityLevel = ui.quality === 'auto' ? 'high' : ui.quality;
    governorRef.current.reset(start, performance.now());
    r.setQuality(start);
  }, [ui.quality, ready, mode]);

  // render loop (driven by the playback clock, never by its own wall clock)
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let lastDiag = 0;
    const loop = (now: number) => {
      const r = rendererRef.current;
      if (r && document.visibilityState === 'visible' && !useUi.getState().exportOpen) {
        const lyricTime = Math.max(0, clockRef.current());
        r.render(lyricTime);
        if (syncDiag.enabled() && now - lastDiag > 500 && diagRef.current) {
          lastDiag = now;
          const d = diagRef.current;
          const sc = d.timeline ? sceneAt(d.timeline, lyricTime) : null;
          const line = sc && d.lyrics.doc ? d.lyrics.doc.lines[sc.lineIndex] : null;
          const active = sc?.words.find((w) => lyricTime >= w.startMs && lyricTime < w.endMs) ?? null;
          syncDiag.frame({
            wall: Date.now(),
            positionMs: Math.round(player.getPositionMs()),
            lyricTimeMs: Math.round(lyricTime),
            deviceAdvanceMs: d.clock.device,
            trackOffsetMs: d.clock.trackOffset,
            outputLatencyMs: Math.round(player.getOutputLatencyMs()),
            lyricSource: d.lyrics.source,
            lyricVersionId: d.lyrics.versionId,
            timingSource: d.lyrics.doc?.timing?.source ?? null,
            lineIndex: sc?.lineIndex ?? -1,
            lineStartMs: line?.startMs ?? null,
            lineEndMs: line?.endMs ?? null,
            wordTiming: line?.wordTiming ?? (line ? 'authored' : null),
            activeWordStartMs: active?.startMs ?? null,
            intoLineMs: line ? Math.round(lyricTime - line.startMs) : null,
          });
        }
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
      hideTimer.current = setTimeout(() => {
        if (barHover.current) return show(); // keep the controls up while the pointer is on them
        if (!panelOpenRef.current) setControlsVisible(false);
      }, 3200);
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

  const language = useMemo(() => (lyrics.doc ? detectDocLanguage(lyrics.doc) : null), [lyrics.doc]);
  const canExport = !!track && !!lyrics.doc && lyrics.doc.lines.length > 0;
  const noLyrics = track && (lyrics.status === 'missing' || lyrics.status === 'error');

  // ---- side panel (Look / Sync) -------------------------------------------------------------------------------
  const openPanel = (t: PanelTab) => {
    if (panelOpen && panelTab === t) setPanelOpen(false);
    else {
      setPanelTab(t);
      setPanelOpen(true);
    }
  };
  const say = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((cur) => (cur === m ? null : cur)), 4500);
  };

  /**
   * Tap to anchor: the line you are hearing begin is NOW. Sets this song's offset so that line's start lands on this
   * moment (never edits the lyrics). 'this' = the line on screen; 'next' = the one after it (for lyrics that are late).
   */
  const anchor = (which: 'this' | 'next') => {
    const doc = lyrics.doc;
    if (!doc || !timeline) return say('No lyrics to anchor yet.');
    const now = clock.now();
    const sc = sceneAt(timeline, now) ?? timeline.scenes.find((x) => x.startMs > now) ?? null;
    if (!sc) return say('No line to anchor to here.');
    const target = doc.lines[sc.lineIndex + (which === 'next' ? 1 : 0)];
    if (!target) return say('There is no next line.');
    const next = Math.round(clock.trackOffset + (target.startMs - now));
    clock.setTrackOffset(next);
    say(`Song offset set to ${next > 0 ? '+' : ''}${next} ms. Fine-tune with the nudge buttons.`);
  };

  // keys: [ ] nudge this song by 100 ms (shift: 500), \ resets. Only while the stage is the chrome view.
  useEffect(() => {
    if (!chrome) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const step = e.shiftKey ? 500 : 100;
      if (e.key === '[' || e.key === '{') clock.setTrackOffset(clock.trackOffset - step);
      else if (e.key === ']' || e.key === '}') clock.setTrackOffset(clock.trackOffset + step);
      else if (e.key === '\\') clock.setTrackOffset(0);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chrome, clock]);

  const pill = (on: boolean) => clsx('inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold backdrop-blur transition', on ? 'border-signal bg-signal text-white' : 'border-white/15 bg-black/40 text-bone hover:border-white/40');

  return (
    <div
      ref={wrapRef}
      className={clsx('relative isolate overflow-hidden bg-ink-950', chrome && !controlsVisible && 'cursor-none', className)}
      data-testid="lyric-stage"
    >
      <canvas key={mode} ref={canvasRef} data-renderer={mode === 'turbo' ? 'webgl2' : 'canvas2d'} className="absolute inset-0 h-full w-full" aria-label={track ? `Lyrics for ${track.title}` : 'Lyrics'} role="img" />

      {ui.mode === 'turbo' && turboFailed && (
        <p role="status" className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs text-amber-200 backdrop-blur">
          Turbo needs WebGL2 ({turboFailed}). Showing Clean instead.
        </p>
      )}

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

      {chrome && (
        <>
          {/* top: what is playing, the look, sync, window controls */}
          <div onPointerEnter={() => (barHover.current = true)} onPointerLeave={() => (barHover.current = false)} className={clsx('absolute inset-x-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-black/75 via-black/30 to-transparent p-3 transition-opacity duration-300 sm:p-4', controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0')}>
            {track && <Cover track={track} className="h-10 w-10 shrink-0 shadow-lg ring-1 ring-white/15" rounded="rounded-md" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{track?.title ?? '—'}</p>
              <p className="truncate text-xs text-ink-300">{track?.artists.join(', ')}</p>
            </div>
            {track && (
              <>
                <button onClick={() => openPanel('look')} className={pill(panelOpen && panelTab === 'look')} title={sl.described?.headline ?? 'Look'} data-testid="theme-pill">
                  <Palette size={14} aria-hidden />
                  <span className="hidden sm:inline">{sl.ready ? directionOf(resolved.direction).label : 'Look'}</span>
                  <span className="text-[10px] text-ink-300 uppercase">{!sl.ready ? '' : resolved.basis === 'auto' ? 'auto' : resolved.basis === 'fixed' ? 'fixed' : 'pinned'}</span>
                </button>
                <button onClick={() => ui.set({ mode: ui.mode === 'turbo' ? 'clean' : 'turbo' })} className={pill(mode === 'turbo')} title={mode === 'turbo' ? 'Turbo: everything on the GPU. Click for Clean.' : 'Clean. Click for Turbo (GPU, full intensity).'} aria-pressed={mode === 'turbo'} data-testid="mode-pill">
                  <Zap size={14} aria-hidden />
                  <span className="hidden sm:inline">{mode === 'turbo' ? 'Turbo' : 'Clean'}</span>
                </button>
                <button onClick={() => openPanel('sync')} className={pill(panelOpen && panelTab === 'sync')} title="Sync: nudge, anchor, try another version" data-testid="sync-pill">
                  <Gauge size={14} aria-hidden />
                  <span className="hidden sm:inline">Sync</span>
                  {clock.trackOffset + clock.device !== 0 && <span className="font-mono text-[11px] text-signal tabular-nums">{clock.trackOffset + clock.device > 0 ? '+' : ''}{clock.trackOffset + clock.device}</span>}
                </button>
              </>
            )}
            <IconButton label="Export lyric video" onClick={() => setExportShown(true)} disabled={!canExport}>
              <Download size={18} />
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

          {/* bottom: transport only. Everything else lives in the panel so the lyrics stay the show. */}
          <div onPointerEnter={() => (barHover.current = true)} onPointerLeave={() => (barHover.current = false)} className={clsx('absolute inset-x-0 bottom-0 z-10 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-3 transition-opacity duration-300 sm:p-4', controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0')}>
            <button onClick={() => void player.toggle()} className="grid h-11 w-11 place-items-center rounded-full bg-bone text-ink-950 shadow-lg transition hover:scale-105 active:scale-95" aria-label={status === 'playing' ? 'Pause' : 'Play'}>
              {status === 'playing' ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            {lyrics.doc && (
              <span className="hidden font-mono text-[10px] tracking-wide text-white/60 uppercase sm:inline" data-testid="mood-chip">
                {timingSummary(lyrics.doc).label}
                {language && language.id !== 'en' && language.id !== 'unknown' ? ` · ${language.label}` : ''}
                {sl.described && sl.described.words.length ? ` · ${sl.described.headline}` : ''}
              </span>
            )}
          </div>

          {panelOpen && track && (
            <StagePanel
              tab={panelTab}
              onTab={setPanelTab}
              onClose={() => setPanelOpen(false)}
              track={track}
              lyrics={lyrics}
              clock={clock}
              sl={sl}
              readable={readable}
              onReadable={setReadable}
              reduced={reduced}
              osReduced={osReduced}
              onForceCalm={setForceCalm}
              onAnchor={anchor}
              toast={toast}
              onEditLyrics={onEditLyrics}
            />
          )}
        </>
      )}

      {!chrome && canExport && (
        <button
          onClick={() => setExportShown(true)}
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white opacity-70 backdrop-blur transition hover:opacity-100 focus-visible:opacity-100"
          title="Export this as a lyric video (no audio)"
        >
          <Download size={14} /> Export
        </button>
      )}

      {exportShown && track && (
        <ExportDialog track={track} doc={lyrics.doc} direction={resolved.direction} look={resolved.look} identity={sl.identity} coverInfo={coverInfo} albumPalette={albumPalette} cover={coverCues} onClose={() => setExportShown(false)} />
      )}
    </div>
  );
}
