import { handle } from '@/lib/server/http';
import { features } from '@/lib/server/config';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => ({
  ok: true,
  mode: 'local',
  storage: 'filesystem (.data)',
  realtime: 'sse',
  features,
  time: new Date().toISOString(),
}));
