import { z } from 'zod';

// Shared (client + server) contracts for Party mode.

export const ROLES = ['host', 'cohost', 'member', 'guest'] as const;
export type Role = (typeof ROLES)[number];

export const EVENT_STATUSES = ['draft', 'scheduled', 'live', 'ended', 'archived'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const displayName = z
  .string()
  .trim()
  .min(1, 'Pick a display name')
  .max(40)
  .transform((s) => s.replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim());

export const eventSettingsSchema = z.object({
  /** who may upload photos/videos */
  guestUploads: z.enum(['off', 'approval', 'open']).default('approval'),
  maxFilesPerGuest: z.number().int().min(1).max(200).default(30),
  /** song requests need host approval before joining the queue */
  songApproval: z.boolean().default(true),
  songVoting: z.enum(['open', 'host-only']).default('open'),
  queueOrder: z.enum(['fair', 'manual']).default('fair'),
  /** only moderator-approved photos ever reach the big screen */
  retentionDays: z.number().int().min(1).max(365).default(60),
});
export type EventSettings = z.infer<typeof eventSettingsSchema>;

export const createEventSchema = z.object({
  title: z.string().trim().min(2, 'Give it a name').max(80),
  description: z.string().trim().max(500).optional(),
  timezone: z.string().trim().max(64).default('UTC'),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  place: z.string().trim().max(120).optional(),
  passcode: z.string().trim().min(4, 'Passcode must be at least 4 characters').max(64).optional(),
  settings: eventSettingsSchema.partial().optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const patchEventSchema = z.object({
  title: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  place: z.string().trim().max(120).nullable().optional(),
  status: z.enum(EVENT_STATUSES).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  passcode: z.string().trim().min(4).max(64).nullable().optional(),
  settings: eventSettingsSchema.partial().optional(),
});

export const trackRefSchema = z.object({
  provider: z.enum(['spotify', 'licensed', 'demo']),
  providerTrackId: z.string().trim().max(64).optional(),
  title: z.string().trim().min(1).max(160),
  artists: z.array(z.string().trim().min(1).max(120)).min(1).max(6),
  album: z.string().trim().max(160).optional(),
  artworkUrl: z
    .string()
    .max(500)
    .refine((u) => /^(https:\/\/[^\s]+|\/demo\/[\w.-]+)$/.test(u), 'Artwork must be an https URL or a bundled demo asset')
    .optional(),
  durationMs: z.number().int().min(0).max(36_000_000).optional(),
  externalUrl: z
    .string()
    .max(300)
    .refine((u) => /^https:\/\/open\.spotify\.com\/[\w/?=&.-]+$/.test(u), 'Only open.spotify.com links are accepted')
    .optional(),
});
export type TrackRef = z.infer<typeof trackRefSchema>;

export const joinSchema = z.object({
  token: z.string().min(16).max(200),
  displayName,
  passcode: z.string().max(64).optional(),
});

export const createInviteSchema = z.object({
  label: z.string().trim().max(60).optional(),
  ttlHours: z.number().min(0.25).max(24 * 30).default(72),
  maxUses: z.number().int().min(1).max(5000).optional(),
});

export const requestPatchSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'playing', 'played']).optional(),
  pinned: z.boolean().optional(),
  moveTo: z.number().int().min(0).max(999).optional(),
  track: trackRefSchema.optional(),
});

export const voteSchema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

export const MEDIA_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/avif', 'video/mp4', 'video/quicktime', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4'] as const;

export const uploadIntentSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  mime: z.enum(MEDIA_MIME),
  size: z.number().int().min(1),
  takenAt: z.string().datetime().optional(),
  recapConsent: z.boolean().default(false),
  /** soundtrack uploads only (host): the uploader attests they hold the rights to use this audio in a recap */
  rightsAttested: z.boolean().optional(),
});

export const mediaPatchSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']).optional(),
  mustInclude: z.boolean().optional(),
  recapConsent: z.boolean().optional(),
});

export const reportSchema = z.object({
  targetType: z.enum(['media', 'song', 'member']),
  targetId: z.string().max(64),
  reason: z.string().trim().min(2).max(300),
});

// ---- DTOs returned to clients -----------------------------------------------------

export type MemberDto = { id: string; displayName: string; role: Role; joinedAt: string; online?: boolean };
export type SongRequestDto = {
  id: string;
  track: TrackRef;
  requesterId: string;
  requesterName: string;
  status: 'pending' | 'approved' | 'rejected' | 'playing' | 'played';
  pinned: boolean;
  score: number;
  up: number;
  down: number;
  myVote: -1 | 0 | 1;
  createdAt: string;
};
export type MediaDto = {
  id: string;
  mediaType: 'image' | 'video';
  mime: string;
  size: number;
  status: 'uploading' | 'pending' | 'approved' | 'rejected';
  uploaderId: string;
  uploaderName: string;
  takenAt?: string;
  createdAt: string;
  recapConsent: boolean;
  mustInclude: boolean;
  url?: string; // short-lived signed URL
};
export type EventDto = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  place?: string;
  timezone: string;
  startsAt?: string;
  endsAt?: string;
  status: EventStatus;
  hasPasscode: boolean;
  settings: EventSettings;
  hostName: string;
};
export type PlaybackDto = { id: string; track: TrackRef; startedAt: string; endedAt?: string };

export type PartySnapshot = {
  seq: number;
  event: EventDto;
  me: { memberId: string; role: Role; displayName: string };
  members: MemberDto[];
  queue: string[]; // ordered ids of approved/playing requests
  requests: SongRequestDto[];
  media: MediaDto[];
  nowPlaying: PlaybackDto | null;
  history: PlaybackDto[];
};

export type DisplaySnapshot = Omit<PartySnapshot, 'me'> & { joinUrl?: string };

export type PartyEventType =
  | 'event.updated'
  | 'event.member.joined'
  | 'event.song.updated'
  | 'event.media.approved'
  | 'event.media.removed'
  | 'event.playback.changed'
  | 'event.reaction'
  | 'event.deleted'
  | 'render.progress';

export type PartyMessage = { seq: number; type: PartyEventType; at: string; data?: Record<string, unknown> };
