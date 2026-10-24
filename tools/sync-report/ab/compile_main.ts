// VERBATIM copy of lib/kinetic/compile.ts from `main` (568127f), import paths adjusted. Used only as the "old" side of A/B comparisons.
import type { LyricDocument } from '../../../lib/types';
import { hashString, rngFor } from '../../../lib/kinetic/util';
import { STYLES } from '../../../lib/kinetic/styles';
import type { Mood, MoodAnalysis } from '../../../lib/kinetic/emotion';
import {
  type EffectId,
  type PresetId,
  type Scene,
  type StyleId,
  type VisualTimeline,
  type WordCue,
  visualTimelineSchema,
} from '../../../lib/kinetic/types';

export type CompileOptions = {
  trackId: string;
  durationMs: number;
  palette: string[];
  style?: StyleId;
  seed?: number;
  bpm?: number;
  beatTimesMs?: number[];
  artworkAssetId?: string;
  custom?: VisualTimeline['custom'];
  /** from analyzeEmotion(): colors/emoji/doodles follow it */
  mood?: MoodAnalysis;
  /** song title + artist for the interlude marquee */
  label?: string;
  /** cues from the cover art (see extractPalette) */
  cover?: VisualTimeline['cover'];
};

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

/** Fill in a regular beat grid from a BPM when no analysed grid is available. */
export function gridFromBpm(bpm: number, durationMs: number, offsetMs = 0): number[] {
  const beat = 60000 / bpm;
  const out: number[] = [];
  for (let t = offsetMs; t < durationMs; t += beat) out.push(Math.round(t));
  return out;
}

/**
 * The "motion director": rule-based, deterministic. Same lyrics + seed => same timeline.
 *  - fast syllabic passages  -> rapid single-word cuts
 *  - sustained words          -> elastic stretch
 *  - repeated hooks           -> burst layouts with larger hierarchy
 *  - instrumental gaps        -> artwork takes over (see `gaps`)
 */
export function compileTimeline(doc: LyricDocument, opts: CompileOptions): VisualTimeline {
  const styleId = opts.style ?? 'maximalist';
  const style = STYLES[styleId];
  const seed = opts.seed ?? hashString(opts.trackId);
  const palette = opts.palette.length >= 2 ? opts.palette : ['#ff2e63', '#14121f'];
  const beatTimesMs =
    opts.beatTimesMs && opts.beatTimesMs.length > 1
      ? [...opts.beatTimesMs].sort((a, b) => a - b)
      : opts.bpm
        ? gridFromBpm(opts.bpm, opts.durationMs)
        : [];

  // --- hook detection: a line (normalized) that appears 2+ times ---------------
  const counts = new Map<string, number>();
  for (const line of doc.lines) {
    const k = normalize(line.words.map((w) => w.text).join(' '));
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const cues: WordCue[] = [];
  const scenes: Scene[] = [];
  let prevPreset: PresetId | null = null;
  let calmRotation = hashString(String(seed)) % 7;

  doc.lines.forEach((line, li) => {
    const key = normalize(line.words.map((w) => w.text).join(' '));
    const hook = (counts.get(key) ?? 0) >= 2;
    const durSec = Math.max(0.2, (line.endMs - line.startMs) / 1000);
    const wps = line.words.length / durSec;
    const fast = wps > 3.6 && line.words.length >= 4;

    let preset: PresetId;
    if (hook) preset = style.hookPreset;
    else if (fast) preset = 'cut';
    else if (line.words.length <= 3) preset = 'stack';
    else {
      const calm = style.calmPresets;
      preset = calm[calmRotation++ % calm.length]!;
    }
    if (preset === prevPreset && !hook && style.calmPresets.length > 1) {
      const calm = style.calmPresets.filter((p) => p !== preset);
      preset = calm[(calmRotation++) % calm.length] ?? preset;
    }
    prevPreset = preset;

    const rng = rngFor(seed, `scene:${li}`);
    const lineCues: WordCue[] = line.words.map((w, wi) => {
      const dur = w.endMs - w.startMs;
      const longWord = dur > 650;
      let effect: EffectId = 'pop';
      if (longWord) effect = 'stretch';
      else if (hook && wi === line.words.length - 1) effect = 'shake';
      else if (preset === 'cut') effect = 'pop';
      else if (preset === 'stack') effect = wi % 2 === 0 ? 'slide' : 'pop';
      else if (preset === 'wave') effect = 'float';
      else if (w.text.length >= 6 && rng() > 0.55) effect = 'mask';
      const lengthBias = Math.min(1, w.text.replace(/\W/g, '').length / 9);
      const emphasis = Math.min(1, (hook ? 0.55 : 0.2) + (longWord ? 0.3 : 0) + lengthBias * 0.25 + rng() * 0.1);
      return { id: `${li}:${wi}`, text: w.text, startMs: w.startMs, endMs: w.endMs, emphasis: round(emphasis), effect };
    });
    cues.push(...lineCues);

    scenes.push({
      id: `scene-${li}`,
      lineIndex: li,
      startMs: line.startMs,
      endMs: line.endMs,
      seed: Math.floor(rng() * 2 ** 31),
      preset,
      hook,
      mood: opts.mood?.perLine[li] as Mood | undefined,
      intensity: round(Math.min(2, style.motion * (hook ? 1.25 : 1) * (fast ? 1.1 : 1))),
      words: lineCues,
      effects: lineCues
        .filter((c) => c.effect === 'shake' || c.effect === 'stretch')
        .map((c) => ({
          type: c.effect as string,
          startMs: c.startMs,
          durationMs: Math.max(180, c.endMs - c.startMs),
          targetWords: [Number(c.id.split(':')[1])],
          intensity: round(c.emphasis ?? 0.5),
          easing: c.effect === 'stretch' ? 'easeOutElastic' : 'easeOutBack',
        })),
      background: { type: hook ? 'gradient' : 'solid' },
    });
  });

  // --- instrumental gaps: intro, long pauses, outro -------------------------------
  const gaps: VisualTimeline['gaps'] = [];
  const MIN_GAP = 1800;
  let cursor = 0;
  for (const line of doc.lines) {
    if (line.startMs - cursor >= MIN_GAP) gaps.push({ startMs: cursor, endMs: line.startMs });
    cursor = Math.max(cursor, line.endMs);
  }
  if (opts.durationMs - cursor >= MIN_GAP) gaps.push({ startMs: cursor, endMs: opts.durationMs });

  const effects: VisualTimeline['effects'] = scenes
    .filter((s) => s.hook)
    .map((s) => ({ id: `chorus-${s.id}`, startMs: s.startMs, endMs: s.endMs, preset: 'chorusInvert', params: { strength: 1 } }));

  const timeline: VisualTimeline = {
    version: 1,
    trackId: opts.trackId,
    durationMs: opts.durationMs,
    artworkAssetId: opts.artworkAssetId,
    palette,
    style: styleId,
    seed,
    bpm: opts.bpm,
    beatTimesMs,
    cues,
    scenes,
    gaps,
    effects,
    cover: opts.cover,
    label: opts.label,
    emotion: opts.mood ? { overall: opts.mood.overall, basis: opts.mood.basis } : undefined,
    custom: opts.custom,
  };
  return visualTimelineSchema.parse(timeline);
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Find the scene that is "current" at time t (last scene whose start <= t, within its window). */
export function sceneAt(tl: VisualTimeline, tMs: number): Scene | null {
  let lo = 0;
  let hi = tl.scenes.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tl.scenes[mid]!.startMs <= tMs) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  const s = tl.scenes[found]!;
  return tMs <= s.endMs + 400 ? s : null;
}
