import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as interpret } from '@/app/api/identity/interpret/route';
import { GET as genres } from '@/app/api/meta/genres/route';

const LYRICS = 'I fold the letter small like a paper boat and I set it on the water by your name. '.repeat(3);
const post = (body: unknown) => new Request('http://x/api/identity/interpret', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('POST /api/identity/interpret', () => {
  it('is off unless a gateway key is configured (501), so the app falls back to its local analysis', async () => {
    vi.stubEnv('OMNIROUTE_API_KEY', '');
    const res = await interpret(post({ title: 't', artist: 'a', tags: [], lyrics: LYRICS }));
    expect(res.status).toBe(501);
    expect((await res.json()).code).toBe('ai_unconfigured');
  });

  it('sends a bounded prompt to the OpenAI-compatible gateway and returns only a validated, confidence-capped profile', async () => {
    vi.stubEnv('OMNIROUTE_API_KEY', 'k');
    vi.stubEnv('OMNIROUTE_BASE_URL', 'http://gateway.test/v1/');
    const calls: { url: string; body: { messages: { content: string }[]; model: string }; auth: string }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).Authorization! });
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"dims":{"intimacy":{"v":0.9,"conf":0.99}},"influences":["X"],"subjects":["letters"]}' } }] }), { status: 200 });
    });
    const res = await interpret(post({ title: 'Paper Boats', artist: 'June Ellery', tags: ['singer-songwriter'], lyrics: LYRICS.repeat(5) }));
    expect(res.status).toBe(200);
    const { profile } = await res.json();
    expect(profile.dims.intimacy.conf).toBe(0.7);
    expect(profile).not.toHaveProperty('influences');
    expect(calls[0]!.url).toBe('http://gateway.test/v1/chat/completions');
    expect(calls[0]!.auth).toBe('Bearer k');
    expect(calls[0]!.body.messages[1]!.content.length).toBeLessThan(2700);
    expect(calls[0]!.body.messages[0]!.content).toMatch(/Do NOT state facts about the artist/);
  });

  it('discards a reply that does not match the schema, and survives an upstream failure', async () => {
    vi.stubEnv('OMNIROUTE_API_KEY', 'k');
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: 'sure! here is some prose' } }] }), { status: 200 }));
    expect((await interpret(post({ title: 't', artist: 'a', tags: [], lyrics: LYRICS }))).status).toBe(502);
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }));
    expect((await interpret(post({ title: 't', artist: 'a', tags: [], lyrics: LYRICS }))).status).toBe(502);
  });

  it('rejects bad input', async () => {
    vi.stubEnv('OMNIROUTE_API_KEY', 'k');
    expect((await interpret(post({ title: '', artist: 'a', lyrics: 'short' }))).status).toBe(400);
  });
});

describe('GET /api/meta/genres', () => {
  beforeEach(() => vi.useRealTimers());

  it('returns the artist\'s community tags with their vote counts, asking MusicBrainz for the name only', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: URL) => {
      urls.push(String(url));
      return new Response(JSON.stringify({ artists: [{ name: 'Test Artist Alpha', score: 100, tags: [{ name: 'indie rock', count: 3 }, { name: 'british', count: 9 }] }] }), { status: 200 });
    });
    const res = await genres(new Request('http://x/api/meta/genres?artist=Test%20Artist%20Alpha'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tags[0]).toEqual({ name: 'british', count: 9 });
    expect(urls[0]).toContain('musicbrainz.org');
    expect(urls[0]).not.toMatch(/lyrics|spotify/i);
    // cached: a second ask does not go out again
    await genres(new Request('http://x/api/meta/genres?artist=Test%20Artist%20Alpha'));
    expect(urls.length).toBe(1);
  }, 15000);

  it('returns no tags for an artist it cannot identify with confidence, and 400 without a name', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ artists: [{ name: 'Someone Else', score: 60, tags: [{ name: 'pop', count: 1 }] }] }), { status: 200 }));
    const res = await genres(new Request('http://x/api/meta/genres?artist=Unknown%20Zed'));
    expect((await res.json()).tags).toEqual([]);
    expect((await genres(new Request('http://x/api/meta/genres'))).status).toBe(400);
  }, 15000);
});
