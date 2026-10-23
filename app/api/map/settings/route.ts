import { handle, readJson, requireUser } from '@/lib/server/http';
import { getSettings, updateSettings } from '@/lib/server/map';
import { features } from '@/lib/server/config';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const u = await requireUser();
  return { available: features.locationHistory, settings: getSettings(u.id) };
});

export const PATCH = handle(async (req) => {
  const u = await requireUser();
  return { settings: updateSettings(u.id, await readJson(req)) };
});
