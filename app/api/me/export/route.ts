import { handle, requireUser } from '@/lib/server/http';
import { exportUserData } from '@/lib/server/map';

export const dynamic = 'force-dynamic';

/** Personal data export (map history, memories, trips, settings, party memberships). */
export const POST = handle(async () => {
  const u = await requireUser();
  const data = exportUserData(u);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="lyricscape-export-${u.handle}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
