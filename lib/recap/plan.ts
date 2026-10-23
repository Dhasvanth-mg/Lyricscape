import { mulberry32 } from '../kinetic/util';
import type { Analysis } from './analyze';
import {
  ASPECTS,
  PRESET_LENGTH_MS,
  recapTimelineSchema,
  type Aspect,
  type Clip,
  type RecapPreset,
  type RecapTimeline,
  type TimelineAudio,
} from './timeline';

export type PlanAsset = {
  id: string;
  mediaType: 'image' | 'video';
  durationMs?: number;
  takenAtMs: number;
  uploaderId: string;
  uploaderName: string;
  /** 0..1 quality score from mediaScore.assessQuality */
  quality: number;
  pinned: boolean;
  hash?: string;
};

export type PlanInput = {
  assets: PlanAsset[];
  analysis: Analysis;
  audio: Pick<TimelineAudio, 'source' | 'title' | 'license'>;
  preset: RecapPreset;
  aspect: Aspect;
  targetMs?: number;
  seed?: number;
  /** caption shown at the start (usually the party name) */
  title?: string;
};

export class PlanError extends Error {
  constructor(
    public code: 'no_media' | 'no_audio' | 'bad_aspect',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Edit planner. Beat-aware and deterministic (same inputs + seed => same timeline):
 *  1. pick the soundtrack window (whole bars) with the most energy that fits the target length
 *  2. cut the window into clip slots on beat boundaries (faster cuts in louder bars)
 *  3. choose media: pinned first, then quality + contributor diversity, kept in chronological order
 *  4. add transitions only where the music changes (flash on a lift, dip on a drop)
 */
export function planRecap(input: PlanInput): RecapTimeline {
  const { analysis: a, assets } = input;
  if (!ASPECTS.includes(input.aspect)) throw new PlanError('bad_aspect', 'Unsupported aspect ratio');
  if (a.beatTimesMs.length < 8 || a.barStartsMs.length < 3) throw new PlanError('no_audio', 'The soundtrack has no detectable beat. Try a different song.');
  if (assets.length === 0) throw new PlanError('no_media', 'No eligible photos or videos. Media needs to be approved and its owner must allow recap use.');

  const seed = input.seed ?? 1;
  const rnd = mulberry32(seed);
  const notes: string[] = [];

  // ---- 1. soundtrack window ------------------------------------------------------------
  const bars = a.barStartsMs.length;
  const barMs = (a.barStartsMs[bars - 1]! - a.barStartsMs[0]!) / Math.max(1, bars - 1);
  const range = PRESET_LENGTH_MS[input.preset];
  let target = Math.min(Math.max(input.targetMs ?? range.default, input.preset === 'extended' ? 10_000 : range.min), range.max);
  const available = a.contentEndMs - (a.barStartsMs[0] ?? 0);
  if (target > available) {
    notes.push(`The soundtrack is only ${(available / 1000).toFixed(0)}s long, so the recap was shortened from ${(target / 1000).toFixed(0)}s.`);
    target = available;
  }
  const windowBars = Math.max(4, Math.min(bars - 1, Math.round(target / barMs)));
  let bestStart = 0;
  let bestScore = -Infinity;
  const sectionStarts = new Set(a.sections.map((s) => a.barStartsMs.indexOf(s.startMs)));
  for (let i = 0; i + windowBars <= bars - 0; i++) {
    const endBar = i + windowBars;
    if ((a.barStartsMs[endBar] ?? a.contentEndMs) > a.contentEndMs + 1) continue;
    let e = 0;
    for (let b = i; b < endBar; b++) e += a.barEnergy[b] ?? 0;
    const lead = i > 0 ? (a.barEnergy[i - 1] ?? 0) : 0;
    // prefer windows that begin at a section entry and don't open on the quiet intro bar
    const score = e / windowBars + (sectionStarts.has(i) ? 0.08 : 0) + (a.barEnergy[i] ?? 0) * 0.1 - lead * 0.02;
    if (score > bestScore) {
      bestScore = score;
      bestStart = i;
    }
  }
  const startMs = a.barStartsMs[bestStart]!;
  const endBarIdx = bestStart + windowBars;
  const endMs = a.barStartsMs[endBarIdx] ?? Math.min(a.contentEndMs, startMs + Math.round(windowBars * barMs));
  const durationMs = endMs - startMs;
  const beats = a.beatTimesMs.filter((t) => t >= startMs && t <= endMs).map((t) => t - startMs);
  if (beats[0] !== 0) beats.unshift(0);
  if (beats[beats.length - 1] !== durationMs) beats.push(durationMs);

  // ---- 2. slots on beat boundaries --------------------------------------------------------
  const beatMs = 60000 / a.bpm;
  const baseBeats = beatMs * 2 >= 2400 ? 2 : beatMs * 4 >= 2400 ? 4 : 8; // aim for ~2.4s cuts
  const preFactor = input.preset === 'quick' ? 1 : 1.25;
  const slots: { startIdx: number; endIdx: number; bar: number }[] = [];
  {
    let i = 0;
    while (i < beats.length - 1) {
      const barIdx = Math.min(a.barEnergy.length - 1, bestStart + Math.floor(beats[i]! / barMs));
      const energy = a.barEnergy[barIdx] ?? 0.5;
      let n = Math.round(baseBeats * preFactor);
      if (energy > 0.8) n = Math.max(2, Math.round(n / 2));
      n = n <= 2 ? 2 : n <= 4 ? 4 : 8;
      // stay on the bar grid: a 4/8 beat slot must start on a bar line, otherwise cut shorter
      const onBar = ((i % 4) + 4) % 4 === 0;
      if (!onBar) n = Math.min(n, 4 - (i % 4) || 2);
      const end = Math.min(beats.length - 1, i + n);
      slots.push({ startIdx: i, endIdx: end, bar: barIdx });
      i = end;
    }
    // avoid a tiny orphan slot at the end: merge it into the previous one
    const last = slots[slots.length - 1];
    const prev = slots[slots.length - 2];
    if (last && prev && beats[last.endIdx]! - beats[last.startIdx]! < 1200) {
      prev.endIdx = last.endIdx;
      slots.pop();
    }
  }

  // ---- 3. choose media ------------------------------------------------------------------------
  const chrono = [...assets].sort((a1, b1) => a1.takenAtMs - b1.takenAtMs || a1.id.localeCompare(b1.id));
  let chosen: PlanAsset[];
  if (chrono.length > slots.length) {
    const pinned = chrono.filter((x) => x.pinned);
    const rest = chrono.filter((x) => !x.pinned);
    const need = Math.max(0, slots.length - pinned.length);
    // diversify: round-robin across contributors, best quality first within each
    const by = new Map<string, PlanAsset[]>();
    for (const x of rest) by.set(x.uploaderId, [...(by.get(x.uploaderId) ?? []), x]);
    for (const l of by.values()) l.sort((p, q) => q.quality - p.quality || p.id.localeCompare(q.id));
    const picked: PlanAsset[] = [];
    for (let round = 0; picked.length < need; round++) {
      const layer = [...by.values()].map((l) => l[round]).filter((x): x is PlanAsset => !!x);
      if (!layer.length) break;
      layer.sort((p, q) => q.quality - p.quality);
      for (const x of layer) if (picked.length < need) picked.push(x);
    }
    chosen = [...pinned, ...picked].sort((p, q) => p.takenAtMs - q.takenAtMs || p.id.localeCompare(q.id));
    if (pinned.length > slots.length) notes.push(`${pinned.length - slots.length} pinned items did not fit; make the recap longer to include them.`);
    const skipped = chrono.length - chosen.length;
    if (skipped > 0) notes.push(`${skipped} of ${chrono.length} photos/videos were left out to fit ${(durationMs / 1000).toFixed(0)}s. Highest quality and every contributor first.`);
  } else {
    chosen = chrono;
  }
  // when pinned overflow, slots limit what we can place
  const sequence: { asset: PlanAsset; reuse: number }[] = [];
  for (let s = 0; s < slots.length; s++) {
    const idx = Math.floor((s * chosen.length) / slots.length);
    const cycle = Math.floor(s / chosen.length);
    const asset = chosen.length >= slots.length ? chosen[s]! : chosen[s % chosen.length]!;
    sequence.push({ asset, reuse: chosen.length >= slots.length ? 0 : cycle });
    void idx;
  }
  if (chosen.length < slots.length) notes.push(`Only ${chosen.length} photos/videos for ${slots.length} cuts, so some repeat (videos use a different moment each time).`);

  // ---- 4. clips + transitions ----------------------------------------------------------------------
  const clips: Clip[] = slots.map((slot, i) => {
    const start = beats[slot.startIdx]!;
    const end = beats[slot.endIdx]!;
    const dur = end - start;
    const { asset, reuse } = sequence[i]!;
    const prevE = i > 0 ? (a.barEnergy[slots[i - 1]!.bar] ?? 0) : 0;
    const curE = a.barEnergy[slot.bar] ?? 0;
    const onBarLine = slot.startIdx % 4 === 0;
    let transition: Clip['transition'] = { type: 'cut', durationMs: 0 };
    if (i > 0 && onBarLine) {
      if (curE - prevE > 0.18) transition = { type: 'flash', durationMs: 180 };
      else if (prevE - curE > 0.25) transition = { type: 'dip', durationMs: 240 };
    }
    let sourceIn = 0;
    let sourceOut = dur;
    if (asset.mediaType === 'video') {
      const vlen = asset.durationMs ?? dur;
      const usable = Math.max(0, vlen - 300);
      const len = Math.min(dur, Math.max(500, usable));
      // each reuse picks a later segment of the video
      const maxStart = Math.max(0, vlen - len);
      sourceIn = Math.min(maxStart, 300 + reuse * len);
      if (sourceIn > maxStart) sourceIn = Math.round(rnd() * maxStart);
      sourceOut = Math.min(vlen, sourceIn + len);
    }
    const dirs: ('in' | 'out')[] = ['in', 'out'];
    return {
      id: `c${i + 1}`,
      assetId: asset.id,
      mediaType: asset.mediaType,
      sourceInMs: Math.round(sourceIn),
      sourceOutMs: Math.round(sourceOut),
      timelineStartMs: start,
      durationMs: dur,
      transition,
      crop: { x: 0.35 + rnd() * 0.3, y: 0.35 + rnd() * 0.3, zoom: dirs[(i + reuse) % 2]! },
      volume: 0,
      priority: Math.round(asset.quality * 100) / 100,
      pinned: asset.pinned,
      contributor: asset.uploaderName,
    };
  });

  const audio: TimelineAudio = {
    source: input.audio.source,
    title: input.audio.title,
    license: input.audio.license,
    sourceInMs: startMs,
    sourceOutMs: endMs,
    fadeInMs: startMs === 0 ? 0 : 120,
    fadeOutMs: Math.min(1500, Math.round(durationMs * 0.05)),
    volume: 1,
    bpm: a.bpm,
    beatTimesMs: beats,
    analysisVersion: a.analysisVersion,
  };

  const timeline: RecapTimeline = {
    version: 1,
    preset: input.preset,
    aspect: input.aspect,
    fps: 30,
    durationMs,
    seed,
    audio,
    clips,
    captions: input.title ? [{ text: input.title.slice(0, 80), startMs: 300, endMs: Math.min(3200, durationMs), position: 'bottom' }] : [],
    notes,
  };
  return recapTimelineSchema.parse(timeline);
}

/**
 * Regenerate one section: re-pick media for clips inside [fromMs,toMs), preferring assets that are not
 * already on the timeline. Everything outside the range is left exactly as the host edited it.
 */
export function regenerateRange(tl: RecapTimeline, assets: PlanAsset[], fromMs: number, toMs: number, seed: number): RecapTimeline {
  const rnd = mulberry32(seed);
  const inRange = (c: Clip) => c.timelineStartMs >= fromMs && c.timelineStartMs < toMs && !c.pinned;
  const used = new Set(tl.clips.filter((c) => !inRange(c)).map((c) => c.assetId));
  const pool = assets.filter((x) => !used.has(x.id));
  const fallback = assets;
  const clips = tl.clips.map((c) => {
    if (!inRange(c)) return c;
    const candidates = pool.length ? pool : fallback;
    const pick = candidates[Math.floor(rnd() * candidates.length)]!;
    const idx = pool.indexOf(pick);
    if (idx >= 0) pool.splice(idx, 1);
    let sourceIn = 0;
    let sourceOut = c.durationMs;
    if (pick.mediaType === 'video') {
      const vlen = pick.durationMs ?? c.durationMs;
      const len = Math.min(c.durationMs, Math.max(500, vlen - 300));
      sourceIn = Math.min(Math.max(0, vlen - len), Math.round(rnd() * Math.max(0, vlen - len)));
      sourceOut = Math.min(vlen, sourceIn + len);
    }
    return { ...c, assetId: pick.id, mediaType: pick.mediaType, sourceInMs: sourceIn, sourceOutMs: sourceOut, contributor: pick.uploaderName, priority: pick.quality, crop: { ...c.crop, x: 0.35 + rnd() * 0.3, y: 0.35 + rnd() * 0.3 } };
  });
  return recapTimelineSchema.parse({ ...tl, clips });
}
