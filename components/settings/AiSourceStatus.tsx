'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/bits';

type Status = { provider: 'gateway' | 'claude-code' | 'codex' | null; model: string | null; available: string[]; setting: string; message: string | null };
type Test = { ok: boolean; ms: number; message: string | null };

const NAMES: Record<string, string> = { gateway: 'AI gateway (OMNIROUTE_API_KEY)', 'claude-code': 'Claude Code on this computer', codex: 'Codex on this computer' };

/** Settings line naming the AI backend the server found (gateway, local Claude Code or local Codex), with a test button. */
export function AiSourceStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/ai')
      .then((r) => r.json())
      .then((s: Status) => setStatus(s))
      .catch(() => setStatus(null));
  }, []);

  const run = async () => {
    setBusy(true);
    setTest(null);
    try {
      setTest((await (await fetch('/api/ai', { method: 'POST' })).json()) as Test);
    } catch {
      setTest({ ok: false, ms: 0, message: 'The app server did not answer.' });
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  return (
    <div className="mt-4 rounded-xl border border-ink-700 p-3 text-sm" data-testid="ai-source">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink-400">AI source:</span>
        <span className="font-semibold">{status.provider ? NAMES[status.provider] : 'none'}</span>
        {status.model && <span className="font-mono text-ink-400">{status.model}</span>}
        {status.provider && (
          <Button onClick={run} disabled={busy} size="sm" className="ml-auto">
            {busy ? 'Testing…' : 'Test'}
          </Button>
        )}
      </div>
      {status.message && <p className="mt-1 text-ink-300">{status.message}</p>}
      {test && <p className={`mt-1 ${test.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{test.ok ? `Answered in ${(test.ms / 1000).toFixed(1)} s.` : test.message}</p>}
      <p className="mt-1 text-ink-400">
        Uses a gateway key if one is set, otherwise the Claude Code (<code>claude</code>) or Codex (<code>codex</code>) command line signed in on this computer, so your own subscription answers. Choose one with <code>LYRICSCAPE_AI_PROVIDER</code> in <code>.env.local</code> (see <code>.env.example</code>). The CLI runs with no tools, in an empty folder.
      </p>
    </div>
  );
}
