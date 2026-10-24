'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Download, Film, ImageDown, Pause, Play, Wand2, X } from 'lucide-react';
import type { LyricDocument, Track } from '@/lib/types';
import { EMOTIONS, EMOTION_DEFS, type ColorMode, type EmotionId } from '@/lib/kinetic/emotion';
import { compileForTrack, moodFor, type CoverCues } from '@/lib/kinetic/forTrack';
import { KineticRenderer } from '@/lib/kinetic/render';
import { createStageRenderer, turboSupported, type StageRenderer } from '@/lib/kinetic/stageRenderer';
import { MODES, STAGE_MODES, type StageMode } from '@/lib/kinetic/modes';
import { STYLES } from '@/lib/kinetic/styles';
import { STYLE_IDS, type StyleId } from '@/lib/kinetic/types';
import type { Look } from '@/lib/kinetic/look';
import type { SongIdentity } from '@/lib/identity/types';
import { composeLook } from '@/lib/theme/compose';
import { directionOf } from '@/lib/theme/directions';
import type { CoverInfo } from '@/lib/theme/types';
import { EXPORT_SIZES, downloadBlob, exportStill, exportVideo, frameCount, loadCorsImage, safeFilename, supportedFormats, webCodecsSupported, type ExportContent, type ExportFormat, type ExportJob, type ExportQuality, type ExportSizeId } from '@/lib/export/video';
import { useUi } from '@/lib/ui-store';
import { Button, Spinner } from '@/components/ui/bits';
import { SyncStepper } from './SyncStepper';
import { useLyricClock } from './useLyricClock';

const PREFS_KEY = 'lyricscape.export.v1';
type SavedPrefs = { size: ExportSizeId; fps: 30 | 60; format: ExportFormat; quality: ExportQuality };
const DEFAULT_SAVED: SavedPrefs = { size: '1080p', fps: 30, format: 'mp4', quality: 'high' };

function readSaved(): SavedPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return { ...DEFAULT_SAVED, ...(raw ? (JSON.parse(raw) as Partial<SavedPrefs>) : {}) };
  } catch {
    return DEFAULT_SAVED;
  }
}

const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const fmtBytes = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

type Props = {
  track: Track;
  doc: LyricDocument | null;
  /** the art direction and Look the stage shows this song in: the video defaults to exactly that */
  direction: StyleId;
  look: Look;
  identity: SongIdentity | null;
  coverInfo: CoverInfo | null;
  albumPalette: string[] | null;
  cover: CoverCues | null;
  onClose: () => void;
};

/** Pick what goes into a lyric video (no audio): size, range, style, and which decorations are drawn. */
export function ExportDialog({ track, doc, direction, look: stageLook, identity, coverInfo, albumPalette, cover, onClose }: Props) {
  const ui = useUi();
  const [saved] = useState(readSaved);
  const [size, setSize] = useState<ExportSizeId>(saved.size);
  const [fps, setFps] = useState<30 | 60>(saved.fps);
  const [format, setFormat] = useState<ExportFormat>(saved.format);
  const [quality, setQuality] = useState<ExportQuality>(saved.quality);
  // the song's own sync offset (the one tuned on the stage) is applied to the video: lyric time = song time + offset
  const clock = useLyricClock(track);
  const [syncPick, setSyncPick] = useState<number | null>(null);
  const syncMs = syncPick ?? clock.trackOffset;
  const [style, setStyle] = useState<StyleId>(direction);
  const [mode, setMode] = useState<StageMode>(ui.mode === 'turbo' && turboSupported() ? 'turbo' : 'clean');
  const canTurbo = turboSupported();
  const [colorMode, setColorMode] = useState<ColorMode>(ui.colorMode);
  const [moodPick, setMoodPick] = useState<EmotionId | 'auto'>(ui.mood);
  const [emojis, setEmojis] = useState(ui.emojis);
  const [doodles, setDoodles] = useState(ui.doodles);
  const [artwork, setArtwork] = useState<'off' | 'background'>(ui.artwork);
  const [interlude, setInterlude] = useState(ui.interlude);
  const [texture, setTexture] = useState(true);
  const [calm, setCalm] = useState(false);
  const durationSec = Math.max(1, Math.round((track.durationMs || 180000) / 1000));
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(durationSec);

  const [previewMs, setPreviewMs] = useState(() => {
    const first = doc?.lines[0]?.startMs;
    return typeof first === 'number' ? first + 600 : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [art, setArt] = useState<HTMLImageElement | null | undefined>(undefined); // undefined = still loading
  const [formats, setFormats] = useState<Record<ExportFormat, boolean> | null>(null);
  const [busy, setBusy] = useState<'video' | 'still' | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; eta: number | null } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sz = EXPORT_SIZES.find((s) => s.id === size) ?? EXPORT_SIZES[0];
  const startMs = Math.min(startSec, endSec - 1) * 1000;
  const endMs = Math.max(endSec, startSec + 1) * 1000;
  const frames = frameCount(startMs, endMs, fps);

  const timeline = useMemo(() => compileForTrack({ track, doc, style, albumPalette, cover, mood: moodFor(track, doc, moodPick), estimateWords: ui.estimatedWords }), [track, doc, style, albumPalette, cover, moodPick, ui.estimatedWords]);
  // the stage's own Look when the style is unchanged, otherwise the chosen direction composed for this song
  const look = useMemo(() => (style === direction ? stageLook : composeLook({ direction: directionOf(style), identity, cover: coverInfo }).look), [style, direction, stageLook, identity, coverInfo]);
  const content: ExportContent = useMemo(() => ({ colorMode, emojis, doodles, artwork, interlude, texture, reducedMotion: calm }), [colorMode, emojis, doodles, artwork, interlude, texture, calm]);

  // the cover must be loaded with CORS or the encoder would refuse the tainted canvas
  useEffect(() => {
    let live = true;
    void loadCorsImage(track.artworkUrl).then((img) => live && setArt(img));
    return () => {
      live = false;
    };
  }, [track.artworkUrl]);

  useEffect(() => {
    let live = true;
    void supportedFormats(sz.width, sz.height).then((f) => {
      if (!live) return;
      setFormats(f);
      setFormat((cur) => (f[cur] ? cur : f.mp4 ? 'mp4' : f.webm ? 'webm' : cur));
    });
    return () => {
      live = false;
    };
  }, [sz.width, sz.height]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ size, fps, format, quality } satisfies SavedPrefs));
    } catch {
      /* storage unavailable */
    }
  }, [size, fps, format, quality]);

  // ---- live preview: the same renderer and timeline the export uses, just smaller ---------------------------
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StageRenderer | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let r: StageRenderer;
    try {
      r = createStageRenderer(mode, canvas);
    } catch {
      setMode('clean'); // WebGL2 failed: the canvas is spoiled for 2D, the key below remounts it
      return;
    }
    rendererRef.current = r;
    let live = true;
    void r.loadFonts().then(() => live && setReady(true));
    const fit = () => {
      const b = wrap.getBoundingClientRect();
      r.resize(b.width, b.height);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    fit();
    return () => {
      live = false;
      ro.disconnect();
      r.dispose?.();
      rendererRef.current = null;
    };
  }, [mode]);
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    r.options = { ...r.options, ...content, motionScale: 1, artworkPolicy: 'full' };
    r.setTimeline(timeline);
    r.setLook(look);
    r.setArtwork(art ?? null);
    r.render(previewMs + syncMs);
    // the look's faces arrive a moment later: draw again once they are in
    void r.loadLookFonts().then(() => rendererRef.current === r && r.render(previewMs + syncMs));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewMs is drawn by the effect below
  }, [timeline, look, content, art, ready, mode]);
  useEffect(() => {
    rendererRef.current?.render(previewMs + syncMs);
  }, [previewMs, syncMs, sz.id]);

  // keep the preview time inside the chosen range
  useEffect(() => {
    setPreviewMs((t) => Math.min(Math.max(t, startMs), endMs));
  }, [startMs, endMs]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setPreviewMs((t) => {
        const n = t + dt;
        return n >= endMs ? startMs : n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, startMs, endMs]);

  // ---- actions -----------------------------------------------------------------------------------------------
  const job = (): ExportJob => ({ mode, offsetMs: syncMs, timeline, look, artwork: art ?? null, content, width: sz.width, height: sz.height, fps, startMs, endMs });
  const baseName = `${safeFilename(`${track.artists[0] ?? ''} ${track.title}`)}-lyrics`;

  const runVideo = async () => {
    setError(null);
    setResult(null);
    setPlaying(false);
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy('video');
    const startedAt = performance.now();
    setProgress({ done: 0, total: frames, eta: null });
    try {
      const out = await exportVideo(job(), {
        format,
        quality,
        signal: ac.signal,
        onProgress: (done, total) => setProgress({ done, total, eta: done > 12 ? ((performance.now() - startedAt) / 1000 / done) * (total - done) : null }),
      });
      downloadBlob(out.blob, `${baseName}-${sz.id}-${fps}fps.${out.extension}`);
      setResult(`Saved ${out.frames} frames (${fmtTime((endMs - startMs) / 1000)}) as ${out.extension.toUpperCase()}, ${fmtBytes(out.blob.size)}, encoded with ${out.codec}.`);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Export failed');
    } finally {
      abortRef.current = null;
      setBusy(null);
      setProgress(null);
    }
  };

  const runStill = async () => {
    setError(null);
    setResult(null);
    setBusy('still');
    try {
      const blob = await exportStill(job(), previewMs);
      downloadBlob(blob, `${baseName}-${sz.id}-${fmtTime(previewMs / 1000).replace(':', 'm')}s.png`);
      setResult(`Saved a ${sz.width}×${sz.height} PNG of ${fmtTime(previewMs / 1000)}.`);
    } catch (e) {
      setError((e as Error).message || 'Could not save the image');
    } finally {
      setBusy(null);
    }
  };

  const cancel = () => abortRef.current?.abort();
  const close = () => {
    cancel();
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        abortRef.current ? abortRef.current.abort() : onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const trimToLyrics = () => {
    const first = timeline.scenes[0];
    const last = timeline.scenes[timeline.scenes.length - 1];
    if (!first || !last) return;
    setStartSec(Math.max(0, Math.floor(first.startMs / 1000) - 1));
    setEndSec(Math.min(durationSec, Math.ceil(last.endMs / 1000) + 2));
  };
  const lyricsOnly = () => {
    setEmojis(false);
    setDoodles(false);
    setArtwork('off');
    setInterlude(false);
    setTexture(false);
  };
  const everything = () => {
    setEmojis(true);
    setDoodles(true);
    setArtwork('background');
    setInterlude(true);
    setTexture(true);
  };

  const supported = webCodecsSupported();
  const eta = progress?.eta ?? null;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  const field = 'h-9 rounded-full border border-ink-600 bg-ink-900 px-3 text-sm';
  const pill = (on: boolean) => clsx('rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:opacity-40', on ? 'border-signal bg-signal text-white' : 'border-ink-600 text-ink-200 hover:border-ink-400');
  const seg = (on: boolean) => clsx('rounded-full px-3 py-1 text-sm font-semibold transition disabled:opacity-40', on ? 'bg-bone text-ink-950' : 'text-ink-300 hover:text-bone');
  const lock = busy !== null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && !lock && close()}>
      <div role="dialog" aria-modal="true" aria-label="Export lyric video" className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-ink-700 bg-ink-900 text-bone shadow-2xl sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-ink-700 px-5 py-3">
          <Film size={18} aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl uppercase leading-none">Export lyric video</h2>
            <p className="truncate text-xs text-ink-300">
              {track.title} · {track.artists.join(', ')} · no audio, just the visuals
            </p>
          </div>
          <button onClick={close} aria-label="Close" className="rounded-full p-2 text-ink-300 hover:bg-ink-800 hover:text-bone">
            <X size={18} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* preview */}
          <section aria-label="Preview" className="flex flex-col gap-3">
            <div className="flex justify-center rounded-2xl border border-ink-700 bg-black/40 p-2">
              <div ref={wrapRef} className="relative max-h-[52vh] w-full overflow-hidden rounded-xl bg-ink-950" style={{ aspectRatio: `${sz.width} / ${sz.height}`, maxWidth: `min(100%, calc(52vh * ${sz.width / sz.height}))` }}>
                <canvas key={mode} ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Export preview" role="img" />
                {art === undefined && track.artworkUrl && (
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px]">
                    <Spinner /> cover
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setPlaying((p) => !p)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-bone text-ink-950" aria-label={playing ? 'Pause preview' : 'Play preview'}>
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <input
                type="range"
                className="seek min-w-0 flex-1"
                aria-label="Preview position"
                min={startMs}
                max={endMs}
                step={100}
                value={Math.min(Math.max(previewMs, startMs), endMs)}
                style={{ ['--pct' as string]: `${((previewMs - startMs) / Math.max(1, endMs - startMs)) * 100}%` }}
                onChange={(e) => {
                  setPlaying(false);
                  setPreviewMs(Number(e.target.value));
                }}
              />
              <span className="w-24 text-right font-mono text-xs tabular-nums text-ink-300">
                {fmtTime(previewMs / 1000)} / {fmtTime(endMs / 1000)}
              </span>
            </div>
            <p className="text-xs text-ink-400">The preview is drawn by the exact renderer the export uses. The file will be {sz.width}×{sz.height}, so text and shapes match, just sharper.</p>
          </section>

          {/* settings */}
          <section aria-label="Export settings" className="flex flex-col gap-4 text-sm">
            <fieldset className="grid gap-2">
              <legend className="mb-1 font-mono text-[11px] tracking-wide text-ink-400 uppercase">Mode</legend>
              <div className="flex gap-1 rounded-full bg-ink-800/80 p-1" role="radiogroup" aria-label="Stage mode">
                {STAGE_MODES.map((m) => (
                  <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} disabled={lock || (m === 'turbo' && !canTurbo)} title={m === 'turbo' && !canTurbo ? 'WebGL2 is not available in this browser' : MODES[m].tagline} className={seg(mode === m)} data-testid={`export-mode-${m}`}>
                    {MODES[m].label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-400">{MODES[mode].tagline}</p>
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="mb-1 font-mono text-[11px] tracking-wide text-ink-400 uppercase">Look</legend>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="exp-style">
                  Visual style
                </label>
                <select id="exp-style" value={style} onChange={(e) => setStyle(e.target.value as StyleId)} className={field} disabled={lock}>
                  {STYLE_IDS.filter((s) => s !== 'custom').map((s) => (
                    <option key={s} value={s}>
                      {STYLES[s].label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1 rounded-full bg-ink-800/80 p-1" role="radiogroup" aria-label="Color source">
                  {([['blend', 'Blend'], ['album', 'Album'], ['emotion', 'Mood']] as [ColorMode, string][]).map(([id, label]) => (
                    <button key={id} role="radio" aria-checked={colorMode === id} onClick={() => setColorMode(id)} className={seg(colorMode === id)} disabled={lock}>
                      {label}
                    </button>
                  ))}
                </div>
                <label className="sr-only" htmlFor="exp-mood">
                  Mood
                </label>
                <select id="exp-mood" value={moodPick} onChange={(e) => setMoodPick(e.target.value as EmotionId | 'auto')} className={field} disabled={lock}>
                  <option value="auto">Mood: auto-detect</option>
                  {EMOTIONS.map((e) => (
                    <option key={e} value={e}>
                      {EMOTION_DEFS[e].label}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="mb-1 flex w-full items-center font-mono text-[11px] tracking-wide text-ink-400 uppercase">
                What gets drawn
                <span className="ml-auto flex gap-3 normal-case">
                  <button onClick={lyricsOnly} className="underline" disabled={lock}>
                    lyrics only
                  </button>
                  <button onClick={everything} className="underline" disabled={lock}>
                    everything
                  </button>
                </span>
              </legend>
              <div className="flex flex-wrap gap-2">
                <button aria-pressed={emojis} onClick={() => setEmojis(!emojis)} className={pill(emojis)} disabled={lock}>
                  Icons
                </button>
                <button aria-pressed={doodles} onClick={() => setDoodles(!doodles)} className={pill(doodles)} disabled={lock}>
                  Vector doodles
                </button>
                <button aria-pressed={artwork === 'background'} onClick={() => setArtwork(artwork === 'off' ? 'background' : 'off')} className={pill(artwork === 'background')} disabled={lock} title={track.artworkUrl ? 'The album cover as a soft background' : 'This track has no cover'}>
                  Album background
                </button>
                <button aria-pressed={interlude} onClick={() => setInterlude(!interlude)} className={pill(interlude)} disabled={lock} title="The generative show during instrumental breaks">
                  Breaks show
                </button>
                <button aria-pressed={texture} onClick={() => setTexture(!texture)} className={pill(texture)} disabled={lock} title="Film grain, halftone dots and scanlines">
                  Grain & texture
                </button>
                <button aria-pressed={calm} onClick={() => setCalm(!calm)} className={pill(calm)} disabled={lock} title="No shake, rotation or flashes">
                  Calm motion
                </button>
              </div>
              {track.artworkUrl && art === null && <p className="text-xs text-amber-300">The cover host does not allow reading the image, so the album background is skipped in the file.</p>}
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="mb-1 font-mono text-[11px] tracking-wide text-ink-400 uppercase">Range</legend>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5">
                  From
                  <input type="number" min={0} max={endSec - 1} value={startSec} onChange={(e) => setStartSec(Math.max(0, Math.min(Number(e.target.value) || 0, endSec - 1)))} className={clsx(field, 'w-20 text-center')} disabled={lock} aria-label="Start second" />
                </label>
                <label className="flex items-center gap-1.5">
                  to
                  <input type="number" min={startSec + 1} max={durationSec} value={endSec} onChange={(e) => setEndSec(Math.min(durationSec, Math.max(Number(e.target.value) || 0, startSec + 1)))} className={clsx(field, 'w-20 text-center')} disabled={lock} aria-label="End second" />
                </label>
                <span className="text-xs text-ink-400">s of {durationSec}</span>
                <button onClick={trimToLyrics} className="underline" disabled={lock}>
                  trim to lyrics
                </button>
                <button
                  onClick={() => {
                    setStartSec(0);
                    setEndSec(durationSec);
                  }}
                  className="underline"
                  disabled={lock}
                >
                  whole song
                </button>
              </div>
              <p className="text-xs text-ink-400">Times are song time, so the file lines up with the track when you lay it over the audio in an editor.</p>
            </fieldset>

            <fieldset className="grid gap-2">
              <legend className="mb-1 font-mono text-[11px] tracking-wide text-ink-400 uppercase">File</legend>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="exp-size">
                  Size
                </label>
                <select id="exp-size" value={size} onChange={(e) => setSize(e.target.value as ExportSizeId)} className={field} disabled={lock}>
                  {EXPORT_SIZES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1 rounded-full bg-ink-800/80 p-1" role="radiogroup" aria-label="Frame rate">
                  {([30, 60] as const).map((f) => (
                    <button key={f} role="radio" aria-checked={fps === f} onClick={() => setFps(f)} className={seg(fps === f)} disabled={lock}>
                      {f} fps
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 rounded-full bg-ink-800/80 p-1" role="radiogroup" aria-label="Format">
                  {(['mp4', 'webm'] as const).map((f) => (
                    <button key={f} role="radio" aria-checked={format === f} onClick={() => setFormat(f)} className={seg(format === f)} disabled={lock || (formats !== null && !formats[f])} title={formats && !formats[f] ? 'Not supported by this browser at this size' : undefined}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <label className="sr-only" htmlFor="exp-quality">
                  Quality
                </label>
                <select id="exp-quality" value={quality} onChange={(e) => setQuality(e.target.value as ExportQuality)} className={field} disabled={lock}>
                  <option value="standard">Quality: standard</option>
                  <option value="high">Quality: high</option>
                  <option value="max">Quality: maximum</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="export-sync">
                <span className="text-ink-300">Sync</span>
                <SyncStepper id="export-sync-offset" label="" title="Lyric timing for this video" value={syncMs} onChange={setSyncPick} />
                {syncPick !== null && clock.trackOffset !== syncPick && (
                  <button type="button" className="text-xs underline" onClick={() => setSyncPick(null)} disabled={lock}>
                    use the stage&apos;s ({clock.trackOffset > 0 ? '+' : ''}{clock.trackOffset} ms)
                  </button>
                )}
              </div>
              <p className="text-xs text-ink-400">The video uses this song&apos;s own sync offset, so it lines up with the audio the way the stage did. Device delay is not included (it belongs to your speakers, not the song).</p>
              <p className="text-xs text-ink-400">
                {frames.toLocaleString()} frames · {fmtTime((endMs - startMs) / 1000)} of video. MP4 plays everywhere; WebM is smaller for the web.
              </p>
            </fieldset>

            {!supported && <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">Video export needs a Chromium-based browser (Chrome, Edge or Brave). PNG frames still work here.</p>}
          </section>
        </div>

        <footer className="flex flex-col gap-2 border-t border-ink-700 px-5 py-3">
          {progress && (
            <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Export progress" className="flex items-center gap-3 text-xs text-ink-200">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full rounded-full bg-signal transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-44 text-right font-mono tabular-nums">
                {pct}% · {progress.done}/{progress.total}
                {eta !== null && ` · ~${fmtTime(eta)} left`}
              </span>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          {result && !error && (
            <p role="status" className="text-sm text-emerald-300">
              {result}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="md" onClick={() => void runStill()} disabled={lock}>
              {busy === 'still' ? <Spinner /> : <ImageDown size={16} />} Save this frame (PNG)
            </Button>
            <Button
              size="md"
              variant="ghost"
              onClick={() => {
                lyricsOnly();
                setColorMode('album');
              }}
              disabled={lock}
              title="Plain lyrics on the album colors"
            >
              <Wand2 size={16} /> Clean preset
            </Button>
            <div className="ml-auto flex gap-2">
              {busy === 'video' ? (
                <Button variant="danger" onClick={cancel}>
                  Cancel export
                </Button>
              ) : (
                <Button variant="ghost" onClick={close}>
                  Close
                </Button>
              )}
              <Button variant="primary" onClick={() => void runVideo()} disabled={lock || !supported || (formats !== null && !formats.mp4 && !formats.webm)}>
                {busy === 'video' ? <Spinner /> : <Download size={16} />} Export video
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
