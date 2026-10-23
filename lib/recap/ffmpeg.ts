import { ASPECT_SIZE, type RecapTimeline } from './timeline';

// Pure builder for the FFmpeg command line that renders a timeline to MP4.
// Kept separate from the worker so it can be unit-tested and inspected without running FFmpeg.

export type RenderInput = {
  /** local file path per asset id */
  files: Record<string, { path: string; mediaType: 'image' | 'video' }>;
  audioPath: string;
};

export type RenderOptions = {
  quality: 'preview' | 'final';
  outPath: string;
  /** TrueType font for captions; when absent captions are skipped (and reported) */
  fontFile?: string;
};

export type RenderPlan = { args: string[]; width: number; height: number; fps: number; expectedDurationMs: number; skipped: string[] };

const q = (n: number) => (Math.round(n * 1000) / 1000).toString();

/** Escape text for FFmpeg's drawtext filter inside a filtergraph. */
export function escapeDrawtext(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\u2019') // typographic apostrophe: avoids quoting hell
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/[\r\n]+/g, ' ');
}

export function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

export function outputSize(aspect: RecapTimeline['aspect'], quality: 'preview' | 'final') {
  const full = ASPECT_SIZE[aspect];
  if (quality === 'final') return full;
  const scale = 540 / Math.min(full.w, full.h);
  return { w: Math.round((full.w * scale) / 2) * 2, h: Math.round((full.h * scale) / 2) * 2 };
}

export function buildRenderPlan(tl: RecapTimeline, input: RenderInput, opts: RenderOptions): RenderPlan {
  const { w: W, h: H } = outputSize(tl.aspect, opts.quality);
  const fps = tl.fps;
  const skipped: string[] = [];
  const clips = [...tl.clips].sort((a, b) => a.timelineStartMs - b.timelineStartMs);
  const args: string[] = ['-hide_banner', '-nostdin', '-y', '-progress', 'pipe:1', '-nostats'];

  // ---- inputs: one per clip (assets may repeat; FFmpeg decodes each input independently) ----
  const filters: string[] = [];
  clips.forEach((c, i) => {
    const file = input.files[c.assetId];
    if (!file) throw new Error(`Missing input file for asset ${c.assetId}`);
    const dur = c.durationMs / 1000;
    const frames = Math.max(1, Math.round(dur * fps));
    if (file.mediaType === 'video') {
      const ss = c.sourceInMs / 1000;
      const take = Math.max(0.1, (c.sourceOutMs - c.sourceInMs) / 1000);
      args.push('-ss', q(ss), '-t', q(take + 0.2), '-i', file.path);
      // trim to the in/out, hold the last frame if the source is shorter than the slot, force exact length
      filters.push(
        `[${i}:v]fps=${fps},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-${W})*${q(c.crop.x)}:(ih-${H})*${q(c.crop.y)},setsar=1,` +
          `tpad=stop_mode=clone:stop_duration=${q(Math.max(0, dur - take) + 0.5)},trim=duration=${q(dur)},setpts=PTS-STARTPTS`,
      );
      // translate the filter chain output label below
    } else {
      args.push('-i', file.path);
      // upscale 1.5x before zoompan so the zoom doesn't look soft; zoompan emits exactly `frames` frames
      const zoomExpr =
        c.crop.zoom === 'in' ? `min(1+0.18*on/${frames},1.18)` : c.crop.zoom === 'out' ? `max(1.18-0.18*on/${frames},1)` : '1';
      const bw = Math.round((W * 1.5) / 2) * 2;
      const bh = Math.round((H * 1.5) / 2) * 2;
      filters.push(
        `[${i}:v]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},` +
          `zoompan=z='${zoomExpr}':x='(iw-iw/zoom)*${q(c.crop.x)}':y='(ih-ih/zoom)*${q(c.crop.y)}':d=${frames}:s=${W}x${H}:fps=${fps},setsar=1,setpts=PTS-STARTPTS`,
      );
    }
    // transitions are "fade through colour" inside the clip itself, so timing stays frame-exact
    const f = filters[filters.length - 1]!;
    let chain = f;
    if (c.transition.type !== 'cut' && c.transition.durationMs > 0) {
      const color = c.transition.type === 'flash' ? 'white' : 'black';
      chain += `,fade=t=in:st=0:d=${q(c.transition.durationMs / 1000)}:color=${color}`;
    }
    chain += `,format=yuv420p[v${i}]`;
    filters[filters.length - 1] = chain;
  });

  const labels = clips.map((_, i) => `[v${i}]`).join('');
  let videoLabel = '[vcat]';
  filters.push(`${labels}concat=n=${clips.length}:v=1:a=0${videoLabel}`);

  // ---- captions -------------------------------------------------------------------------------
  if (tl.captions.length) {
    if (!opts.fontFile) skipped.push('Captions were skipped: no font file found (set RECAP_FONT to a .ttf path).');
    else {
      let prev = videoLabel;
      tl.captions.forEach((cap, i) => {
        const y = cap.position === 'top' ? 'h*0.1' : cap.position === 'center' ? '(h-text_h)/2' : 'h*0.82';
        const out = `[vcap${i}]`;
        filters.push(
          `${prev}drawtext=fontfile='${escapeFilterPath(opts.fontFile!)}':text='${escapeDrawtext(cap.text)}':fontsize=${Math.round(H * 0.045)}:fontcolor=white:` +
            `x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.45:boxborderw=${Math.round(H * 0.012)}:enable='between(t,${q(cap.startMs / 1000)},${q(cap.endMs / 1000)})'${out}`,
        );
        prev = out;
      });
      videoLabel = prev;
    }
  }

  // ---- audio ------------------------------------------------------------------------------------
  const audioIndex = clips.length;
  const durSec = tl.durationMs / 1000;
  args.push('-ss', q(tl.audio.sourceInMs / 1000), '-t', q(durSec), '-i', input.audioPath);
  const fadeOut = Math.min(tl.audio.fadeOutMs, tl.durationMs) / 1000;
  const aFilters = [
    tl.audio.fadeInMs > 0 ? `afade=t=in:st=0:d=${q(tl.audio.fadeInMs / 1000)}` : null,
    fadeOut > 0 ? `afade=t=out:st=${q(Math.max(0, durSec - fadeOut))}:d=${q(fadeOut)}` : null,
    `volume=${q(tl.audio.volume)}`,
    // single-pass EBU R128 normalisation to streaming-friendly loudness
    'loudnorm=I=-14:TP=-1.5:LRA=11',
    'aresample=48000',
    `atrim=duration=${q(durSec)}`,
  ].filter(Boolean);
  filters.push(`[${audioIndex}:a]${aFilters.join(',')}[aout]`);

  args.push('-filter_complex', filters.join(';'));
  args.push('-map', videoLabel, '-map', '[aout]');
  args.push(
    '-c:v', 'libx264',
    '-preset', opts.quality === 'preview' ? 'veryfast' : 'medium',
    '-crf', opts.quality === 'preview' ? '28' : '20',
    '-pix_fmt', 'yuv420p',
    '-r', String(fps),
    '-c:a', 'aac',
    '-b:a', opts.quality === 'preview' ? '128k' : '192k',
    '-movflags', '+faststart',
    '-map_metadata', '-1', // strip EXIF/GPS and other source metadata from the shared copy
    '-t', q(durSec),
    opts.outPath,
  );
  return { args, width: W, height: H, fps, expectedDurationMs: tl.durationMs, skipped };
}

/** Parse `-progress pipe:1` key=value output; returns the current output time in ms if present. */
export function parseProgressMs(chunk: string): number | null {
  let last: number | null = null;
  for (const line of chunk.split(/\r?\n/)) {
    const m = /^out_time_(?:us|ms)=(\d+)/.exec(line);
    if (m) last = Math.round(Number(m[1]) / 1000);
  }
  return last;
}
