import { z } from 'zod';
import { trackRefSchema } from '../party/schemas';

export const PRECISIONS = ['coarse', 'approx', 'precise'] as const;
export type Precision = (typeof PRECISIONS)[number];

/** Grid size in degrees and the nominal ground distance each level promises. */
export const PRECISION_GRID: Record<Precision, { deg: number; meters: number; label: string }> = {
  coarse: { deg: 0.05, meters: 5500, label: 'Neighbourhood-sized area (~5 km)' },
  approx: { deg: 0.01, meters: 1100, label: 'Around a kilometre' },
  precise: { deg: 0.002, meters: 220, label: 'About a city block (~200 m)' },
};

export const privacyZoneSchema = z.object({
  id: z.string().max(64).optional(),
  label: z.string().trim().max(60).default('Private place'),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusM: z.number().min(100).max(5000).default(500),
});
export type PrivacyZone = z.infer<typeof privacyZoneSchema>;

export const mapSettingsPatchSchema = z.object({
  enabled: z.boolean().optional(),
  paused: z.boolean().optional(),
  precision: z.enum(PRECISIONS).optional(),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  zones: z.array(privacyZoneSchema).max(20).optional(),
});

export const recordSessionSchema = z.object({
  track: trackRefSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().min(0).max(1_000_000).optional(),
  source: z.enum(['demo', 'licensed', 'spotify']).default('demo'),
});

export const memorySchema = z.object({
  track: trackRefSchema,
  caption: z.string().trim().min(1).max(1000),
  capturedAt: z.string().datetime().optional(),
  /** attach the *recorded* approximate place of an existing session */
  sessionId: z.string().max(64).optional(),
  /** a tiny resized JPEG data URL (<= ~200 KB) */
  photo: z
    .string()
    .max(300_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  /** time capsule: hidden until this moment */
  unlockAt: z.string().datetime().optional(),
});

export const tripSchema = z.object({
  name: z.string().trim().min(1).max(80),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
});

export type MapSettings = {
  enabled: boolean;
  paused: boolean;
  precision: Precision;
  retentionDays: number;
  zones: (PrivacyZone & { id: string })[];
};

export type PlaceDto = { id: string; lat: number; lng: number; precisionM: number; label?: string };
export type SessionDto = {
  id: string;
  track: z.infer<typeof trackRefSchema>;
  trackKey: string;
  startedAt: string;
  endedAt?: string;
  source: string;
  place?: PlaceDto;
};
export type MemoryDto = {
  id: string;
  track: z.infer<typeof trackRefSchema>;
  caption?: string;
  photo?: string;
  capturedAt: string;
  unlockAt?: string;
  locked: boolean;
  place?: PlaceDto;
};
export type TripDto = { id: string; name: string; startedAt: string; endedAt: string; tracks: z.infer<typeof trackRefSchema>[]; sessionCount: number };
