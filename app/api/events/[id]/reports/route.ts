import { ctxFor, readJson, withParams } from '@/lib/server/http';
import { listAudit, listReports, reportContent } from '@/lib/server/party';

export const dynamic = 'force-dynamic';

export const GET = withParams<{ id: string }>(async (req, { id }) => {
  const ctx = await ctxFor(req, id);
  const wantAudit = new URL(req.url).searchParams.get('audit') === '1';
  return wantAudit ? { audit: listAudit(id, ctx) } : { reports: listReports(id, ctx) };
});

export const POST = withParams<{ id: string }>(async (req, { id }) => {
  reportContent(id, await ctxFor(req, id), await readJson(req));
  return Response.json({ ok: true }, { status: 201 });
});
