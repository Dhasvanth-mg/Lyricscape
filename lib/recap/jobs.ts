import { z } from 'zod';
import { ASPECTS, PRESETS, type RecapTimeline } from './timeline';

export const JOB_TYPES = ['plan', 'preview', 'final'] as const;
export type JobType = (typeof JOB_TYPES)[number];
export type JobStatus = 'queued' | 'analyzing' | 'planning' | 'preview' | 'rendering' | 'complete' | 'failed' | 'canceled';
export const ACTIVE_STATUSES: JobStatus[] = ['queued', 'analyzing', 'planning', 'preview', 'rendering'];

export const soundtrackRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('demo'), id: z.string().regex(/^[a-z0-9-]{1,48}$/) }),
  z.object({ kind: z.literal('upload'), mediaId: z.string().uuid(), rightsAttested: z.literal(true, { error: 'Confirm you have the rights to use this audio' }) }),
]);
export type SoundtrackRef = z.infer<typeof soundtrackRefSchema>;

export const createRecapSchema = z.object({
  preset: z.enum(PRESETS).default('quick'),
  aspect: z.enum(ASPECTS).default('9:16'),
  targetMs: z.number().int().min(10_000).max(600_000).optional(),
  soundtrack: soundtrackRefSchema,
});

/** What the worker receives when it claims a job. */
export type ClaimedJob = {
  job: { id: string; type: JobType; attempt: number; projectId: string; eventId: string };
  project: { id: string; preset: RecapTimeline['preset']; aspect: RecapTimeline['aspect']; targetMs?: number; title: string; soundtrack: SoundtrackRef };
  /** plan jobs: eligible media; render jobs: only media referenced by the timeline */
  assets: { id: string; mediaType: 'image' | 'video'; takenAt: string; uploaderId: string; uploaderName: string; pinned: boolean }[];
  timeline?: RecapTimeline;
  audio: { kind: 'demo'; path: string; title: string; license: string } | { kind: 'upload'; mediaId: string; title: string; license: string };
};

export type AssetAssessment = { id: string; usable: boolean; reason?: string; quality: number; sharpness?: number; durationMs?: number; width?: number; height?: number; duplicateOf?: string };

export type PlanResult = {
  timeline: RecapTimeline;
  assessments: AssetAssessment[];
  analysis: { bpm: number; tempoConfidence: number; durationMs: number; highlights: { startMs: number; endMs: number; score: number; reason: string }[]; sections: { startMs: number; endMs: number; label: string }[]; analysisVersion: string };
};
