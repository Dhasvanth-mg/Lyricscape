import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cliArgs, cliStdin, completeLlm, resolveProvider } from '@/lib/server/llm';
import { GET as aiStatus } from '@/app/api/ai/route';
import { POST as interpret } from '@/app/api/identity/interpret/route';

// Stand-in CLIs: small Node scripts named `claude` and `codex` on a private PATH, so no real model is called.
let bin: string;
const LOG = () => path.join(bin, 'log.json');
const script = (body: string) => `#!/usr/bin/env node\nconst fs = require('fs');\nlet stdin = '';\nprocess.stdin.on('data', (d) => (stdin += d)).on('end', () => {\n${body}\n});\n`;

beforeEach(() => {
  bin = mkdtempSync(path.join(tmpdir(), 'ls-llm-'));
  // claude: records how it was called, answers in --output-format json
  writeFileSync(
    path.join(bin, 'claude'),
    script(`fs.writeFileSync(${JSON.stringify(path.join(bin, 'log.json'))}, JSON.stringify({ argv: process.argv.slice(2), stdin, cwd: process.cwd(), system: fs.readFileSync(process.argv[process.argv.indexOf('--system-prompt-file') + 1], 'utf8') }));
  process.stdout.write(JSON.stringify({ type: 'result', is_error: false, result: '\`\`\`json\\n{"dims":{"warmth":{"v":0.8,"conf":0.95}},"summary":"letters on water"}\\n\`\`\`' }));`),
  );
  // codex: writes its last message to the --output-last-message file
  writeFileSync(
    path.join(bin, 'codex'),
    script(`fs.writeFileSync(${JSON.stringify(path.join(bin, 'log.json'))}, JSON.stringify({ argv: process.argv.slice(2), stdin }));
  fs.writeFileSync(process.argv[process.argv.indexOf('--output-last-message') + 1], '{"ok": true}');
  process.stdout.write('progress noise');`),
  );
  chmodSync(path.join(bin, 'claude'), 0o755);
  chmodSync(path.join(bin, 'codex'), 0o755);
  vi.stubEnv('OMNIROUTE_API_KEY', '');
  vi.stubEnv('LYRICSCAPE_AI_PROVIDER', '');
  vi.stubEnv('PATH', `${bin}${path.delimiter}${path.dirname(process.execPath)}`);
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(bin, { recursive: true, force: true });
});

const LYRICS = 'I fold the letter small like a paper boat and I set it on the water by your name. '.repeat(3);

describe('AI source selection', () => {
  it('auto prefers a gateway key, then Claude Code, then Codex; off and missing choices give none', () => {
    expect(resolveProvider()).toBe('claude-code');
    vi.stubEnv('OMNIROUTE_API_KEY', 'k');
    expect(resolveProvider()).toBe('gateway');
    vi.stubEnv('LYRICSCAPE_AI_PROVIDER', 'codex');
    expect(resolveProvider()).toBe('codex');
    vi.stubEnv('LYRICSCAPE_AI_PROVIDER', 'off');
    expect(resolveProvider()).toBeNull();
    vi.stubEnv('LYRICSCAPE_AI_PROVIDER', 'claude-code');
    vi.stubEnv('PATH', '');
    expect(resolveProvider()).toBeNull();
  });

  it('reports the chosen source without running it', async () => {
    const s = await aiStatus().json();
    expect(s).toMatchObject({ provider: 'claude-code', model: 'haiku', setting: 'auto' });
    expect(s.available).toEqual(['claude-code', 'codex']);
  });
});

describe('local CLI backends', () => {
  it('runs Claude Code with no tools, no MCP, no saved session, the system prompt in a file and the lyrics on stdin only', async () => {
    const res = await interpret(new Request('http://x/api/identity/interpret', { method: 'POST', body: JSON.stringify({ title: 'Paper Boats', artist: 'June Ellery', tags: [], lyrics: LYRICS }) }));
    expect(res.status).toBe(200);
    const { profile } = await res.json();
    expect(profile.dims.warmth).toEqual({ v: 0.8, conf: 0.7 });
    expect(profile.model).toBe('claude-code:haiku');
    const log = JSON.parse(readFileSync(LOG(), 'utf8'));
    expect(log.argv).toEqual(expect.arrayContaining(['-p', '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--model', 'haiku']));
    expect(log.argv.join(' ')).not.toContain('paper boat');
    expect(log.stdin).toContain('paper boat');
    expect(log.system).toMatch(/Do NOT state facts about the artist/);
    expect(path.basename(log.cwd)).toMatch(/^lyricscape-ai-/);
  });

  it('runs Codex read-only and reads its answer from the last-message file, ignoring progress output', async () => {
    vi.stubEnv('LYRICSCAPE_AI_PROVIDER', 'codex');
    const out = await completeLlm({ system: 'Answer only JSON.', user: 'Reply with {"ok": true}' });
    expect(out).toMatchObject({ ok: true, provider: 'codex', text: '{"ok": true}' });
    const log = JSON.parse(readFileSync(LOG(), 'utf8'));
    expect(log.argv.slice(0, 4)).toEqual(['exec', '--skip-git-repo-check', '--sandbox', 'read-only']);
    expect(log.argv.at(-1)).toBe('-');
    expect(log.stdin.startsWith('Answer only JSON.')).toBe(true);
  });

  it('turns a CLI failure into a 502 the app survives', async () => {
    writeFileSync(path.join(bin, 'claude'), script(`process.stdout.write(JSON.stringify({ is_error: true, result: 'Not logged in' })); process.exit(1);`));
    const out = await completeLlm({ system: 's', user: 'u' });
    expect(out).toMatchObject({ ok: false, status: 502 });
    expect(!out.ok && out.message).toMatch(/Not logged in/);
  });

  it('never puts an unsafe model name on the command line', () => {
    vi.stubEnv('LYRICSCAPE_CLAUDE_MODEL', 'haiku & del /q *');
    expect(resolveProvider()).toBe('claude-code');
    expect(cliArgs('claude-code', '', '/tmp/x')).not.toContain('--model');
    expect(cliStdin('codex', { system: 'S', user: 'U' })).toBe('S\n\n---\n\nU');
  });
});
