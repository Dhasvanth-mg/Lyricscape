import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { documentFromAlignment, hasReadableAudio, LOW_CONFIDENCE, type AlignResponse } from '@/lib/lyrics/autoalign';
import { timingSummary, toEnhancedLrc, validateDocument } from '@/lib/lyrics/parse';

const resp = (over: Partial<AlignResponse> = {}): AlignResponse => ({
  model: { name: 'test', separated: true },
  seconds: 1,
  lines: [
    { text: 'hello big world', start_ms: 1000, end_ms: 2500, confidence: 0.6, words: [
      { text: 'hello', start_ms: 1000, end_ms: 1400, confidence: 0.8, flags: [] },
      { text: 'big', start_ms: 1500, end_ms: 1900, confidence: 0.2, flags: ['low_confidence'] },
      { text: 'world', start_ms: 1900, end_ms: 2500, confidence: 0.7, flags: [] },
    ] },
    { text: '', start_ms: null, end_ms: null, confidence: 0, words: [] },
    { text: 'again', start_ms: 4000, end_ms: 4500, confidence: 0.5, words: [{ text: 'again', start_ms: 4000, end_ms: 4500, confidence: 0.5, flags: [] }] },
  ],
  summary: { words: 4, median_confidence: 0.6, low_confidence_words: 1, warnings: ['1 of 4 words are low confidence.'] },
  ...over,
});

describe('documentFromAlignment', () => {
  it('keeps the aligner\'s times exactly, ordered, with per-word confidence', () => {
    const doc = documentFromAlignment(resp());
    expect(doc.lines).toHaveLength(2); // the empty line is dropped
    expect(doc.lines[0]!.words.map((w) => [w.startMs, w.endMs, w.confidence])).toEqual([
      [1000, 1400, 0.8],
      [1500, 1900, 0.2],
      [1900, 2500, 0.7],
    ]);
    expect(validateDocument(doc)).toEqual([]);
  });

  it('is labelled auto-aligned with the aligner\'s own uncertainty, never as measured fact', () => {
    const doc = documentFromAlignment(resp());
    expect(doc.timing).toMatchObject({ source: 'auto-aligned', confidence: 0.6 });
    expect(doc.timing?.notes?.join(' ')).toMatch(/low confidence/);
    expect(doc.lines.every((l) => l.endSource === 'estimated')).toBe(true);
    expect(timingSummary(doc).label).toBe('Word-synced');
  });

  it('repairs overlaps and missing times instead of emitting a broken document', () => {
    const doc = documentFromAlignment(
      resp({
        lines: [{ text: 'a b c', start_ms: 0, end_ms: 0, confidence: 0.3, words: [
          { text: 'a', start_ms: 1000, end_ms: 2200, confidence: 0.3, flags: [] },
          { text: 'b', start_ms: null, end_ms: null, confidence: 0, flags: ['not_alignable'] },
          { text: 'c', start_ms: 1900, end_ms: 1800, confidence: 0.3, flags: [] },
        ] }],
      }),
    );
    expect(validateDocument(doc)).toEqual([]);
    const w = doc.lines[0]!.words;
    expect(w[0]!.endMs).toBeLessThanOrEqual(w[1]!.startMs);
    expect(w[2]!.endMs).toBeGreaterThanOrEqual(w[2]!.startMs);
  });

  it('confidence is a review aid only: it is not written into the saved LRC', () => {
    const text = toEnhancedLrc(documentFromAlignment(resp()));
    expect(text).not.toMatch(/0\.8|confidence/);
    expect(text).toMatch(/<00:01\.00>hello/);
  });

  it('the review threshold is a documented constant', () => {
    expect(LOW_CONFIDENCE).toBe(0.35);
  });
});

describe('what audio the aligner may read', () => {
  it('local files and demo songs yes; Spotify never', () => {
    expect(hasReadableAudio({ id: 'a', provider: 'demo', title: 't', artists: [], durationMs: 1, audioUrl: '/demo/x.wav' })).toBe(true);
    expect(hasReadableAudio({ id: 'b', provider: 'licensed', title: 't', artists: [], durationMs: 1, audioUrl: 'idb:b' })).toBe(true);
    expect(hasReadableAudio({ id: 'c', provider: 'spotify', title: 't', artists: [], durationMs: 1 })).toBe(false);
    expect(hasReadableAudio({ id: 'd', provider: 'spotify', title: 't', artists: [], durationMs: 1, audioUrl: 'https://x/y.mp3' })).toBe(false);
  });
});

describe('/api/lyrics/align proxy', () => {
  let fake: Server;
  let port = 0;
  let lastBody = '';
  beforeAll(async () => {
    fake = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        lastBody = Buffer.concat(chunks).toString('latin1');
        res.setHeader('content-type', 'application/json');
        if (req.url === '/health') return void res.end(JSON.stringify({ ok: true, languages: ['en'], separation: true, device: 'cpu' }));
        if (req.url === '/align' && lastBody.includes('FAIL')) {
          res.statusCode = 422;
          return void res.end(JSON.stringify({ detail: 'wrong text' }));
        }
        res.end(JSON.stringify(resp()));
      });
    });
    await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
    port = (fake.address() as AddressInfo).port;
  });
  afterAll(() => void fake.close());
  beforeEach(() => {
    process.env.ALIGNER_URL = `http://127.0.0.1:${port}`;
  });

  const post = async (fields: Record<string, string | Blob>) => {
    const { POST } = await import('@/app/api/lyrics/align/route');
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return POST(new Request('http://x/api/lyrics/align', { method: 'POST', body: f }));
  };

  it('reports availability from the local aligner', async () => {
    const { GET } = await import('@/app/api/lyrics/align/route');
    expect(await (await GET()).json()).toMatchObject({ available: true, separation: true });
    process.env.ALIGNER_URL = 'http://127.0.0.1:9';
    expect(await (await GET()).json()).toMatchObject({ available: false });
  });

  it('refuses to talk to anything that is not on this machine', async () => {
    const { GET } = await import('@/app/api/lyrics/align/route');
    process.env.ALIGNER_URL = 'http://169.254.169.254/latest';
    expect(await (await GET()).json()).toMatchObject({ available: false });
    expect((await post({ audio: new Blob(['x']), lyrics: 'a b c' })).status).toBe(400);
    process.env.ALIGNER_URL = 'https://example.com';
    expect((await post({ audio: new Blob(['x']), lyrics: 'a b c' })).status).toBe(400);
  });

  it('passes audio and lyrics through and returns the aligner\'s answer', async () => {
    const res = await post({ audio: new Blob(['RIFFxxxx']), lyrics: 'hello big world\nagain', separate: 'true' });
    expect(res.status).toBe(200);
    expect((await res.json()).summary.words).toBe(4);
    expect(lastBody).toContain('hello big world');
    expect(lastBody).toContain('RIFFxxxx');
  });

  it('validates input and surfaces aligner errors plainly', async () => {
    expect((await post({ lyrics: 'a b c' })).status).toBe(400);
    expect((await post({ audio: new Blob(['x']), lyrics: '   ' })).status).toBe(400);
    const bad = await post({ audio: new Blob(['x']), lyrics: 'FAIL these words' });
    expect(bad.status).toBe(422);
    expect((await bad.json()).message).toBe('wrong text');
    process.env.ALIGNER_URL = 'http://127.0.0.1:9';
    const down = await post({ audio: new Blob(['x']), lyrics: 'a b c' });
    expect(down.status).toBe(502);
    expect((await down.json()).message).toMatch(/pnpm aligner/);
  });
});
