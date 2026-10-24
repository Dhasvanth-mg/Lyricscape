import type { LyricDocument } from '../types';
import { hashString, rngFor } from './util';
import { STYLES } from './styles';
import type { Mood, MoodAnalysis } from './emotion';
import {
  type EffectId,
  type PresetId,
  type Scene,
  type StyleId,
  type VisualTimeline,
  type WordCue,
  visualTimelineSchema,
} from './types';

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
  /** Animate word by word on line-synced lyrics using ESTIMATED word times. Off by default: a guess is not sync. */
  estimateWords?: boolean;
};

/** Presentation only (not a timing claim): words of an untimed line enter a beat apart, then all stay until the line ends. */
const STAGGER_MS = 40;
const STAGGER_MAX_MS = 320;

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

/** Split a line's words into short phrases of 1 to 3 words (up to 4 when they are all tiny), at punctuation and at audible gaps. */
export function splitPhrases(words: WordCue[]): WordCue[][] {
  const tiny = (c: WordCue) => c.text.replace(/\W/g, '').length <= 3;
  const groups: WordCue[][] = [];
  let cur: WordCue[] = [];
  for (const c of words) {
    const prev = cur[cur.length - 1];
    const maxLen = cur.every(tiny) && tiny(c) ? 4 : 3;
    if (prev && (cur.length >= maxLen || c.startMs - prev.endMs > 450 || /[,.;:!?\u2014-]$/.test(prev.text))) {
      groups.push(cur);
      cur = [];
    }
    cur.push(c);
  }
  if (cur.length) groups.push(cur);
  // a lone trailing word joins the phrase before it when that stays small
  if (groups.length > 1 && groups[groups.length - 1]!.length === 1 && groups[groups.length - 2]!.length < 4) groups[groups.length - 2]!.push(...groups.pop()!);
  return groups;
}

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
    const wt = line.wordTiming ?? 'authored';
    // Real word times drive word-level motion. Without them the line is shown as a unit (see STAGGER_MS) unless the
    // user opted in to estimated word timing.
    const wordLevel = wt === 'authored' || (wt === 'estimated' && !!opts.estimateWords);
    // calm directions never turn a quick passage into single-word cuts (that is what makes fast singing unreadable)
    const fast = wordLevel && wps > 3.6 && line.words.length >= 4 && !style.presetPolicy;

    let preset: PresetId;
    if (hook) preset = style.hookPreset;
    else if (fast) preset = 'cut';
    else if (line.words.length <= 3 && style.presetPolicy !== 'calm') preset = 'stack';
    else {
      const calm = style.calmPresets;
      preset = calm[calmRotation++ % calm.length]!;
    }
    if (preset === prevPreset && !hook && style.calmPresets.length > 1) {
      const calm = style.calmPresets.filter((p) => p !== preset);
      preset = calm[(calmRotation++) % calm.length] ?? preset;
    }
    // "stack" gives every word or pair its own giant row: lovely for a short line, a wall of rows for a long one
    if (preset === 'stack' && line.words.length > (style.presetPolicy ? 5 : 8)) preset = style.presetPolicy ? 'ticker' : (style.calmPresets.find((p) => p !== 'stack') ?? 'ticker');
    prevPreset = preset;

    const rng = rngFor(seed, `scene:${li}`);
    const lineCues: WordCue[] = line.words.map((w, wi) => {
      const dur = wordLevel ? w.endMs - w.startMs : 0;
      const longWord = dur > 650;
      let effect: EffectId = 'pop';
      if (longWord) effect = 'stretch';
      else if (hook && wi === line.words.length - 1) effect = style.presetPolicy ? 'pop' : 'shake';
      else if (preset === 'cut') effect = 'pop';
      else if (preset === 'stack') effect = wi % 2 === 0 ? 'slide' : 'pop';
      else if (preset === 'wave') effect = 'float';
      else if (w.text.length >= 6 && rng() > 0.55 && style.maskWords !== false) effect = 'mask';
      const lengthBias = Math.min(1, w.text.replace(/\W/g, '').length / 9);
      const emphasis = Math.min(1, (hook ? 0.55 : 0.2) + (longWord ? 0.3 : 0) + lengthBias * 0.25 + rng() * 0.1);
      if (!wordLevel) {
        const startMs = Math.min(line.startMs + Math.min(wi * STAGGER_MS, STAGGER_MAX_MS), Math.max(line.startMs, line.endMs - 1));
        return { id: `${li}:${wi}`, text: w.text, startMs, endMs: Math.max(startMs, line.endMs), emphasis: round(emphasis), effect, timing: 'none' as const };
      }
      return { id: `${li}:${wi}`, text: w.text, startMs: w.startMs, endMs: w.endMs, emphasis: round(emphasis), effect, timing: wt as 'authored' | 'estimated' };
    });
    cues.push(...lineCues);

    // phrase mode: a line with real or estimated word times becomes a run of short scenes (1 to 3 big words each); a line with
    // no word times stays one unit, because splitting it would invent timing
    const groups = style.phrases && wordLevel && lineCues.length > 1 ? splitPhrases(lineCues) : [lineCues];
    groups.forEach((g, gi) => {
      const next = groups[gi + 1];
      const last = g[g.length - 1]!;
      const startMs = gi === 0 ? line.startMs : g[0]!.startMs;
      let endMs = next ? next[0]!.startMs : line.endMs;
      // a phrase hands the stage over BEFORE the next one lands (the next word appears 70 ms ahead of its cue), so two never share it
      if (groups.length > 1) endMs = Math.max(g[0]!.startMs + 300, Math.min(next ? endMs - 100 : endMs, last.endMs + 450));
      let groupPreset = preset;
      if (groups.length > 1) {
        groupPreset = hook ? style.hookPreset : g.length === 1 ? 'cut' : g.length <= 3 ? 'stack' : preset;
        g.forEach((c, i) => {
          if (c.effect !== 'stretch' && c.effect !== 'shake') c.effect = groupPreset === 'stack' ? (i % 2 === 0 ? 'slide' : 'pop') : 'pop';
        });
      }
      scenes.push({
        id: gi === 0 ? `scene-${li}` : `scene-${li}-${gi}`,
        lineIndex: li,
        startMs,
        endMs,
        seed: Math.floor(rng() * 2 ** 31),
        preset: groupPreset,
        hook,
        mood: opts.mood?.perLine[li] as Mood | undefined,
        intensity: round(Math.min(2, style.motion * (hook ? 1.25 : 1) * (fast ? 1.1 : 1))),
        words: g,
        effects: g
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
