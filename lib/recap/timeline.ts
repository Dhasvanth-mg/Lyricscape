import { z } from 'zod';

// Editable, non-destructive recap project state (README §G "edit planner").
// Original uploads are never modified; the timeline only *references* them.

export const ASPECTS = ['9:16', '1:1', '16:9'] as const;
export type Aspect = (typeof ASPECTS)[number];
export const PRESETS = ['quick', 'highlight', 'extended'] as const;
export type RecapPreset = (typeof PRESETS)[number];

export const ASPECT_SIZE: Record<Aspect, { w: number; h: number }> = {
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
};

export const PRESET_LENGTH_MS: Record<RecapPreset, { min: number; max: number; default: number }> = {
  quick: { min: 30_000, max: 60_000, default: 45_000 },
  highlight: { min: 60_000, max: 180_000, default: 120_000 },
  extended: { min: 20_000, max: 600_000, default: 240_000 },
};

export const clipSchema = z.object({
  id: z.string().min(1).max(64),
  assetId: z.string().min(1).max(64),
  mediaType: z.enum(['image', 'video']),
  sourceInMs: z.number().int().min(0),
  sourceOutMs: z.number().int().min(0),
  timelineStartMs: z.number().int().min(0),
  durationMs: z.number().int().min(300).max(60_000),
  transition: z.object({ type: z.enum(['cut', 'dip', 'flash']), durationMs: z.number().int().min(0).max(800) }).default({ type: 'cut', durationMs: 0 }),
  /** Ken Burns: direction and focal point (0..1) for stills; focal crop for video */
  crop: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), zoom: z.enum(['in', 'out', 'none']) }).default({ x: 0.5, y: 0.5, zoom: 'in' }),
  /** original audio of a video clip (0 = muted; the soundtrack is the audio bed) */
  volume: z.number().min(0).max(1).default(0),
  priority: z.number().min(0).max(1).default(0.5),
  pinned: z.boolean().default(false),
  /** shown in the editor so the host sees who contributed it */
  contributor: z.string().max(60).optional(),
});
export type Clip = z.infer<typeof clipSchema>;

export const audioSchema = z.object({
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('demo'), id: z.string().max(64) }),
    z.object({ kind: z.literal('upload'), mediaId: z.string().max(64), rightsAttested: z.literal(true) }),
  ]),
  title: z.string().max(160).optional(),
  license: z.string().max(200),
  sourceInMs: z.number().int().min(0),
  sourceOutMs: z.number().int().min(1),
  fadeInMs: z.number().int().min(0).max(5000).default(120),
  fadeOutMs: z.number().int().min(0).max(8000).default(1200),
  volume: z.number().min(0).max(1.5).default(1),
  bpm: z.number().min(0).max(300),
  /** beat positions relative to the start of the timeline */
  beatTimesMs: z.array(z.number().int()),
  analysisVersion: z.string().max(16),
});
export type TimelineAudio = z.infer<typeof audioSchema>;

export const captionSchema = z.object({
  text: z.string().trim().min(1).max(80),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(1),
  position: z.enum(['top', 'center', 'bottom']).default('bottom'),
});

export const recapTimelineSchema = z.object({
  version: z.literal(1),
  preset: z.enum(PRESETS),
  aspect: z.enum(ASPECTS),
  fps: z.literal(30),
  durationMs: z.number().int().min(5_000).max(600_000),
  seed: z.number().int(),
  audio: audioSchema,
  clips: z.array(clipSchema).min(1).max(400),
  captions: z.array(captionSchema).max(40).default([]),
  /** planner notes shown in the editor (what was dropped and why) */
  notes: z.array(z.string().max(240)).max(60).default([]),
});
export type RecapTimeline = z.infer<typeof recapTimelineSchema>;

export type AssetRef = { id: string; mediaType: 'image' | 'video'; durationMs?: number };

/** Semantic checks that a schema alone cannot express. Returns human-readable problems. */
export function validateTimeline(tl: RecapTimeline, assets: Map<string, AssetRef>): string[] {
  const problems: string[] = [];
  const sorted = [...tl.clips].sort((a, b) => a.timelineStartMs - b.timelineStartMs);
  let cursor = 0;
  const ids = new Set<string>();
  for (const c of sorted) {
    if (ids.has(c.id)) problems.push(`Clip id ${c.id} is used twice`);
    ids.add(c.id);
    const asset = assets.get(c.assetId);
    if (!asset) problems.push(`Clip ${c.id} uses a photo/video that is not available for the recap`);
    else {
      if (asset.mediaType !== c.mediaType) problems.push(`Clip ${c.id} type does not match its media`);
      if (asset.mediaType === 'video' && asset.durationMs !== undefined) {
        if (c.sourceInMs >= asset.durationMs) problems.push(`Clip ${c.id} starts after the video ends`);
        if (c.sourceOutMs > asset.durationMs + 100) problems.push(`Clip ${c.id} runs past the end of the video`);
      }
    }
    if (c.mediaType === 'video' && c.sourceOutMs <= c.sourceInMs) problems.push(`Clip ${c.id}: video out-point must be after the in-point`);
    if (c.timelineStartMs < cursor) problems.push(`Clip ${c.id} overlaps the previous clip`);
    cursor = Math.max(cursor, c.timelineStartMs + c.durationMs);
  }
  if (cursor > tl.durationMs + 50) problems.push('Clips run past the end of the recap');
  if (cursor < tl.durationMs - 2000) problems.push(`The last ${Math.round((tl.durationMs - cursor) / 1000)}s of the recap has no picture`);
  const audioLen = tl.audio.sourceOutMs - tl.audio.sourceInMs;
  if (audioLen < tl.durationMs - 250) problems.push('The soundtrack segment is shorter than the recap');
  for (const cap of tl.captions) if (cap.endMs <= cap.startMs || cap.endMs > tl.durationMs + 50) problems.push(`Caption “${cap.text}” has invalid timing`);
  return problems;
}

/** Re-pack clips back to back from t=0 in their current order (after durations were edited). */
export function normalizeTimeline(tl: RecapTimeline): RecapTimeline {
  const ordered = [...tl.clips].sort((a, b) => a.timelineStartMs - b.timelineStartMs);
  let t = 0;
  const clips = ordered.map((c) => {
    const out = { ...c, timelineStartMs: t };
    t += c.durationMs;
    return out;
  });
  const durationMs = Math.max(5000, t);
  return {
    ...tl,
    clips,
    durationMs,
    audio: { ...tl.audio, sourceOutMs: Math.max(tl.audio.sourceOutMs, tl.audio.sourceInMs + durationMs) },
  };
}

/** Snap a time to the nearest beat (timeline-relative). */
export function snapToBeat(tl: RecapTimeline, ms: number, maxSnapMs = 250): number {
  let best = ms;
  let bestD = maxSnapMs + 1;
  for (const b of tl.audio.beatTimesMs) {
    const d = Math.abs(b - ms);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return bestD <= maxSnapMs ? best : ms;
}
