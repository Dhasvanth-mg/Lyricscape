// Where the app's optional AI features (lyric theme reading, lyric translation) get their answers from.
//
// Three backends, all optional:
//   gateway      an OpenAI-compatible HTTP endpoint (OmniRoute by default), needs OMNIROUTE_API_KEY.
//   claude-code  the Claude Code CLI installed on this machine (`claude -p`), using whatever account it is signed in with.
//   codex        the OpenAI Codex CLI installed on this machine (`codex exec`), using whatever account it is signed in with.
// LYRICSCAPE_AI_PROVIDER picks one (auto | gateway | claude-code | codex | off). Auto prefers the gateway when a key is set, then
// Claude Code, then Codex, so a machine with either CLI signed in gets the AI features with no key at all.
//
// The CLIs are run as plain text-in, text-out models: no tools, no MCP servers, no saved session, in an empty temporary folder,
// with the prompt on stdin (never on the command line). The lyrics a listener plays are untrusted text; with no tools there is
// nothing a prompt hidden in them can make the CLI do except answer badly, and every answer is schema-checked by its caller.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type LlmProvider = 'gateway' | 'claude-code' | 'codex';
export const LLM_PROVIDERS: readonly LlmProvider[] = ['gateway', 'claude-code', 'codex'];

export type LlmRequest = { system: string; user: string; timeoutMs?: number };
export type LlmResult = { ok: true; text: string; provider: LlmProvider; model: string } | { ok: false; status: 501 | 502; code: 'ai_unconfigured' | 'upstream'; message: string };

const isWin = process.platform === 'win32';
/** Model names go on a command line; keep them to characters no shell treats specially. */
const SAFE_MODEL = /^[\w.:/\-[\]]{1,80}$/;

/** First executable called `name` on PATH (with Windows' PATHEXT), or null. Cached for the life of the server. */
const whichCache = new Map<string, string | null>();
export function findOnPath(name: string): string | null {
  const key = `${name}\0${process.env.PATH ?? ''}`;
  if (whichCache.has(key)) return whichCache.get(key)!;
  const exts = isWin ? ['.exe', ...(process.env.PATHEXT ?? '.COM;.BAT;.CMD').split(';').map((e) => e.toLowerCase()).filter((e) => e !== '.exe'), ''] : [''];
  let found: string | null = null;
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir.replace(/^"|"$/g, ''), name + ext);
      try {
        if (existsSync(p) && statSync(p).isFile()) {
          found = p;
          break;
        }
      } catch {
        // unreadable PATH entry: skip it
      }
    }
    if (found) break;
  }
  whichCache.set(key, found);
  return found;
}

function cliPath(provider: 'claude-code' | 'codex'): string | null {
  const override = provider === 'claude-code' ? process.env.LYRICSCAPE_CLAUDE_BIN : process.env.LYRICSCAPE_CODEX_BIN;
  if (override) return existsSync(override) ? override : null;
  return findOnPath(provider === 'claude-code' ? 'claude' : 'codex');
}

/** Which backends could answer right now, in the order auto mode tries them. */
export function availableProviders(): LlmProvider[] {
  const out: LlmProvider[] = [];
  if (process.env.OMNIROUTE_API_KEY) out.push('gateway');
  if (cliPath('claude-code')) out.push('claude-code');
  if (cliPath('codex')) out.push('codex');
  return out;
}

/** The backend this server will use, or null when AI is off or nothing is available. */
export function resolveProvider(): LlmProvider | null {
  const want = (process.env.LYRICSCAPE_AI_PROVIDER ?? 'auto').trim().toLowerCase();
  if (want === 'off') return null;
  const avail = availableProviders();
  if (want === 'auto' || want === '') return avail[0] ?? null;
  return (LLM_PROVIDERS as readonly string[]).includes(want) && avail.includes(want as LlmProvider) ? (want as LlmProvider) : null;
}

export function modelFor(provider: LlmProvider): string {
  if (provider === 'gateway') return process.env.LYRICSCAPE_AI_MODEL ?? 'auto';
  // A short structured answer needs no big model; the fast one keeps the subscription's usage low. Empty = the CLI's own default.
  const m = provider === 'claude-code' ? (process.env.LYRICSCAPE_CLAUDE_MODEL ?? 'haiku') : (process.env.LYRICSCAPE_CODEX_MODEL ?? '');
  return m && SAFE_MODEL.test(m) ? m : '';
}

export function unconfiguredMessage(): string {
  const want = (process.env.LYRICSCAPE_AI_PROVIDER ?? 'auto').trim().toLowerCase();
  if (want === 'off') return 'AI is switched off (LYRICSCAPE_AI_PROVIDER=off). The local analysis is used instead.';
  if (want !== 'auto' && want !== '') return `The AI provider "${want}" is not available on this machine. The local analysis is used instead.`;
  return 'No AI is available: set OMNIROUTE_API_KEY, or install and sign in to Claude Code (claude) or Codex (codex). The local analysis is used instead.';
}

/** Ask the configured backend for one answer. The caller validates the text; this only moves it. */
export async function completeLlm(req: LlmRequest): Promise<LlmResult> {
  const provider = resolveProvider();
  if (!provider) return { ok: false, status: 501, code: 'ai_unconfigured', message: unconfiguredMessage() };
  const model = modelFor(provider);
  try {
    const text = provider === 'gateway' ? await viaGateway(req, model) : await viaCli(provider, req, model);
    return { ok: true, text, provider, model: model || provider };
  } catch (e) {
    return { ok: false, status: 502, code: 'upstream', message: e instanceof Error ? e.message : 'AI request failed' };
  }
}

async function viaGateway(req: LlmRequest, model: string): Promise<string> {
  const base = (process.env.OMNIROUTE_BASE_URL ?? 'http://127.0.0.1:20128/v1').replace(/\/$/, '');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), req.timeoutMs ?? 30000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OMNIROUTE_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
      }),
      signal: ctl.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`The AI gateway answered ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timer);
  }
}

// A CLI run starts a whole program (a few seconds each), so only a couple run at once; the rest wait their turn.
const MAX_CLI_RUNS = 2;
let running = 0;
const waiting: (() => void)[] = [];
async function withCliSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CLI_RUNS) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** The command line for one run. Exported for tests. `dir` is the empty working folder holding `system.txt`. */
export function cliArgs(provider: 'claude-code' | 'codex', model: string, dir: string): string[] {
  if (provider === 'claude-code') {
    // --tools "" = no built-in tools; --strict-mcp-config with no config = no MCP servers; the system prompt replaces Claude Code's own.
    return ['-p', '--output-format', 'json', '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--system-prompt-file', path.join(dir, 'system.txt'), ...(model ? ['--model', model] : [])];
  }
  // Read-only sandbox, no git check (the folder is empty), last message written to a file so progress output can be ignored.
  return ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--color', 'never', '--output-last-message', path.join(dir, 'answer.txt'), ...(model ? ['--model', model] : []), '-'];
}

/** What goes on stdin. Codex has no system-prompt option, so its instructions lead the prompt. */
export function cliStdin(provider: 'claude-code' | 'codex', req: LlmRequest): string {
  return provider === 'claude-code' ? req.user : `${req.system}\n\n---\n\n${req.user}`;
}

/** Turn a finished run's output into the model's answer text. Exported for tests. */
export function cliAnswer(provider: 'claude-code' | 'codex', stdout: string, dir: string): string {
  if (provider === 'claude-code') {
    let out: { result?: unknown; is_error?: boolean } | null = null;
    try {
      out = JSON.parse(stdout.trim());
    } catch {
      throw new Error('Claude Code did not print a JSON result (is it signed in? try running `claude` once).');
    }
    if (!out || out.is_error || typeof out.result !== 'string') throw new Error(`Claude Code reported an error: ${String(out?.result ?? 'no result').slice(0, 200)}`);
    return out.result;
  }
  const file = path.join(dir, 'answer.txt');
  if (existsSync(file)) return readFileSync(file, 'utf8');
  if (stdout.trim()) return stdout;
  throw new Error('Codex finished without an answer (is it signed in? try running `codex` once).');
}

// Windows runs npm-installed CLIs through a .cmd shim, which needs cmd.exe; every argument is then quoted for it.
// Arguments here are fixed flags, a validated model name and temp paths, never lyric text (that goes on stdin).
const winQuote = (a: string) => `"${a.replace(/"/g, '""')}"`;

function viaCli(provider: 'claude-code' | 'codex', req: LlmRequest, model: string): Promise<string> {
  const bin = cliPath(provider);
  if (!bin) return Promise.reject(new Error(`${provider === 'claude-code' ? 'claude' : 'codex'} is not installed on this machine`));
  return withCliSlot(
    () =>
      new Promise<string>((resolve, reject) => {
        const dir = mkdtempSync(path.join(tmpdir(), 'lyricscape-ai-'));
        writeFileSync(path.join(dir, 'system.txt'), req.system);
        const args = cliArgs(provider, model, dir);
        const shim = isWin && /\.(cmd|bat)$/i.test(bin);
        const child = shim
          ? spawn(winQuote(bin), args.map(winQuote), { cwd: dir, shell: true, windowsHide: true, env: process.env })
          : spawn(bin, args, { cwd: dir, windowsHide: true, env: process.env });
        let stdout = '';
        let stderr = '';
        let done = false;
        const finish = (err: Error | null, text?: string) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try {
            rmSync(dir, { recursive: true, force: true });
          } catch {
            // Windows can hold the folder for a moment after a kill; it is in the temp dir and will be cleaned up later
          }
          if (err) reject(err);
          else resolve(text!);
        };
        const timer = setTimeout(() => {
          child.kill();
          finish(new Error(`${provider} took longer than ${Math.round((req.timeoutMs ?? 90000) / 1000)} s`));
        }, req.timeoutMs ?? 90000);
        child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
        child.stderr.setEncoding('utf8').on('data', (d: string) => (stderr = (stderr + d).slice(-2000)));
        child.on('error', (e) => finish(new Error(`Could not start ${provider}: ${e.message}`)));
        child.on('close', (code) => {
          if (code !== 0 && provider === 'codex') return finish(new Error(`codex exited with ${code}: ${stderr.trim().slice(-300) || 'no output'}`));
          try {
            finish(null, cliAnswer(provider, stdout, dir));
          } catch (e) {
            finish(e instanceof Error ? e : new Error(String(e)));
          }
        });
        child.stdin.on('error', () => {}); // a CLI that exits early closes its stdin; the close handler reports why
        child.stdin.end(cliStdin(provider, req), 'utf8');
      }),
  );
}
