// Lyric-video export: renders the kinetic visuals frame by frame (no audio) and encodes them in the browser.
//
// The renderer is deterministic: computeFrame(timeline, t) depends only on t, so we step t at a fixed
// frame rate instead of recording in real time. That makes the export frame-accurate, independent of how
// fast this machine can draw, and identical to what the live stage shows at the same moment.
// Encoding uses WebCodecs (via mediabunny), so it needs a Chromium-based browser (Chrome, Edge, Brave...).

import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, QUALITY_MEDIUM, QUALITY_VERY_HIGH, WebMOutputFormat, getFirstEncodableVideoCodec } from 'mediabunny';
import { KineticRenderer, type RendererOptions } from '../kinetic/render';
import { createStageRenderer, type StageRenderer } from '../kinetic/stageRenderer';
import type { StageMode } from '../kinetic/modes';
import type { Look } from '../kinetic/look';
import type { VisualTimeline } from '../kinetic/types';

export const EXPORT_SIZES = [
  { id: '1080p', label: '1080p landscape (1920×1080)', width: 1920, height: 1080 },
  { id: '720p', label: '720p landscape (1280×720)', width: 1280, height: 720 },
  { id: 'vertical', label: 'Vertical 9:16 (1080×1920)', width: 1080, height: 1920 },
  { id: 'portrait', label: 'Portrait 4:5 (1080×1350)', width: 1080, height: 1350 },
  { id: 'square', label: 'Square 1:1 (1080×1080)', width: 1080, height: 1080 },
] as const;
export type ExportSizeId = (typeof EXPORT_SIZES)[number]['id'];

export type ExportFormat = 'mp4' | 'webm';
export type ExportQuality = 'standard' | 'high' | 'max';

/** Everything the renderer needs besides the timeline: what gets drawn. */
export type ExportContent = Pick<RendererOptions, 'colorMode' | 'emojis' | 'doodles' | 'artwork' | 'interlude' | 'texture' | 'reducedMotion'>;

export type ExportJob = {
  /** which renderer draws the file (default Clean). Turbo falls back to Clean where WebGL2 is missing. */
  mode?: StageMode;
  timeline: VisualTimeline;
  /** the art direction the song is shown in (palette, type, artwork treatment, motion); absent = the classic style table */
  look?: Look;
  /** the cover, loaded with CORS so the canvas stays readable (otherwise pass null) */
  artwork: CanvasImageSource | null;
  content: ExportContent;
  width: number;
  height: number;
  fps: number;
  startMs: number;
  endMs: number;
};

export function frameCount(startMs: number, endMs: number, fps: number): number {
  return Math.max(1, Math.round(((endMs - startMs) / 1000) * fps));
}

/** Yield to the event loop. MessageChannel is not throttled in background tabs (setTimeout is, to 1 s). */
const yieldToUi = () =>
  new Promise<void>((res) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      res();
    };
    ch.port2.postMessage(0);
  });

export const webCodecsSupported = (): boolean => typeof window !== 'undefined' && typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

/** Load the cover with CORS so it can be drawn into an exportable canvas. Resolves null if the host forbids it. */
export function loadCorsImage(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** A renderer on its own canvas at an exact pixel size. */
export async function makeExportRenderer(job: ExportJob): Promise<{ r: StageRenderer; canvas: HTMLCanvasElement }> {
  let canvas = document.createElement('canvas');
  let r: StageRenderer;
  try {
    // preserveDrawingBuffer: the encoder reads the canvas after drawing, so it must not be cleared by the compositor first
    r = createStageRenderer(job.mode ?? 'clean', canvas, { preserveDrawingBuffer: true });
  } catch {
    canvas = document.createElement('canvas'); // a canvas that was handed a WebGL context can never give a 2D one
    r = new KineticRenderer(canvas);
  }
  r.exact = true;
  r.options = { ...r.options, ...job.content, motionScale: 1, quality: 'high', artworkPolicy: 'full' };
  r.resize(job.width, job.height, 1);
  await r.loadFonts();
  r.setTimeline(job.timeline);
  if (job.look) {
    r.setLook(job.look);
    await r.loadLookFonts(); // never draw the first frame in a fallback face
  }
  r.setArtwork(job.artwork);
  return { r, canvas };
}

export async function exportStill(job: ExportJob, tMs: number): Promise<Blob> {
  const { r, canvas } = await makeExportRenderer(job);
  r.render(tMs);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), 'image/png'));
}

/** Which containers this browser can actually encode at the given size. */
export async function supportedFormats(width: number, height: number): Promise<Record<ExportFormat, boolean>> {
  if (!webCodecsSupported()) return { mp4: false, webm: false };
  const ok = async (f: ExportFormat) => !!(await getFirstEncodableVideoCodec((f === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat()).getSupportedVideoCodecs(), { width, height }).catch(() => null));
  const [mp4, webm] = await Promise.all([ok('mp4'), ok('webm')]);
  return { mp4, webm };
}

export type VideoResult = { blob: Blob; extension: string; codec: string; frames: number };

export async function exportVideo(job: ExportJob, opts: { format: ExportFormat; quality: ExportQuality; onProgress?: (done: number, total: number) => void; signal?: AbortSignal }): Promise<VideoResult> {
  if (!webCodecsSupported()) throw new Error('Video export needs a Chromium-based browser (Chrome, Edge or Brave).');
  const { format, quality, onProgress, signal } = opts;
  const total = frameCount(job.startMs, job.endMs, job.fps);
  const outFormat = format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat();
  const codec = await getFirstEncodableVideoCodec(outFormat.getSupportedVideoCodecs(), { width: job.width, height: job.height });
  if (!codec) throw new Error(`This browser cannot encode ${format.toUpperCase()} at ${job.width}×${job.height}. Try WebM, or a smaller size.`);

  const { r, canvas } = await makeExportRenderer(job);
  const target = new BufferTarget();
  const output = new Output({ format: outFormat, target });
  const source = new CanvasSource(canvas, { codec, quality: quality === 'max' ? QUALITY_VERY_HIGH : quality === 'high' ? QUALITY_HIGH : QUALITY_MEDIUM, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: job.fps });
  await output.start();

  try {
    for (let i = 0; i < total; i++) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      r.render(job.startMs + (i * 1000) / job.fps);
      await source.add(i / job.fps, 1 / job.fps); // resolves when the encoder is ready for more (backpressure)
      if (i % 6 === 5) {
        onProgress?.(i + 1, total);
        await yieldToUi();
      }
    }
    onProgress?.(total, total);
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => undefined);
    throw e;
  }
  const buffer = target.buffer;
  if (!buffer) throw new Error('The encoder produced no data');
  return { blob: new Blob([buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' }), extension: format, codec, frames: total };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const safeFilename = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[^\w\s.-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'lyricscape';
