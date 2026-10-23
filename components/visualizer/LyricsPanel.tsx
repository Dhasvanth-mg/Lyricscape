'use client';

import { useEffect, useRef, useState } from 'react';
import { FileUp, Search, Trash2, Wand2 } from 'lucide-react';
import type { LyricDocument, Track } from '@/lib/types';
import { removeLyrics, saveUserLyrics } from '@/lib/lyrics/service';
import { alignWithLocalAligner, alignerStatus, hasReadableAudio, type AlignerStatus } from '@/lib/lyrics/autoalign';
import { kvSet } from '@/lib/library/db';
import { timingSummary } from '@/lib/lyrics/parse';
import { Button, Chip, Spinner } from '@/components/ui/bits';
import { TimingEditor } from './TimingEditor';
import type { useLyrics } from './useLyrics';

type L = ReturnType<typeof useLyrics>;

export function LyricsPanel({ track, lyrics }: { track: Track; lyrics: L }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<'add' | 'timing'>(lyrics.doc ? 'timing' : 'add');
  const fileRef = useRef<HTMLInputElement>(null);
  const [aligner, setAligner] = useState<AlignerStatus | null>(null);
  const [aligning, setAligning] = useState(false);
  const [reviewRev, setReviewRev] = useState(0);
  const canAlign = hasReadableAudio(track) && !!lyrics.doc;
  useEffect(() => {
    if (canAlign) void alignerStatus().then(setAligner);
  }, [canAlign, track.id]);

  /** Runs the local aligner, then opens the result in the timing editor as an UNSAVED draft to review. */
  const autoAlign = async () => {
    if (!lyrics.doc) return;
    setAligning(true);
    setMsg(null);
    try {
      const proposal = await alignWithLocalAligner(track, lyrics.doc, { separate: true });
      await kvSet(`draft:${track.id}`, proposal);
      setReviewRev((n) => n + 1);
      setTab('timing');
      const notes = proposal.timing?.notes ?? [];
      setMsg({ ok: notes.length === 0, text: `Aligned. Nothing is saved yet: words with an amber ring are low confidence, check them, then Save.${notes.length ? ' ' + notes.join(' ') : ''}` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setAligning(false);
    }
  };

  const save = async (raw: string, source: string) => {
    try {
      await saveUserLyrics(track, raw, source);
      setMsg({ ok: true, text: 'Lyrics saved on this device.' });
      setText('');
      setTab('timing');
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl tracking-wide uppercase">Lyrics</h2>
        {lyrics.source && <Chip tone="good">{lyrics.source}</Chip>}
        {lyrics.doc && <TimingChips doc={lyrics.doc} />}
        <div className="ml-auto flex gap-1 rounded-full bg-ink-800 p-1 text-sm">
          {(['add', 'timing'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              disabled={t === 'timing' && !lyrics.doc}
              className={`rounded-full px-3.5 py-1 font-semibold transition disabled:opacity-30 ${tab === t ? 'bg-bone text-ink-950' : 'text-ink-300'}`}
            >
              {t === 'add' ? 'Add / replace' : 'Edit timing'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'add' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => void lyrics.findOnline()} disabled={lyrics.searching}>
              {lyrics.searching ? <Spinner /> : <Search size={14} />} Find lyrics online
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp size={14} /> Import file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".lrc,.vtt,.txt,.json,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) await save(await f.text(), `user-supplied (${f.name})`);
              }}
            />
            {canAlign && (
              <Button size="sm" onClick={() => void autoAlign()} disabled={aligning || !aligner?.available} title={aligner?.available ? 'Align the lyric text to the audio with the local aligner (English). The result is a draft to review.' : aligner?.reason ?? 'Checking for the local aligner...'}>
                {aligning ? <Spinner /> : <Wand2 size={14} />} Auto-align from audio
              </Button>
            )}
            {lyrics.doc && (
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  await removeLyrics(track);
                  setMsg({ ok: true, text: 'Lyrics removed.' });
                }}
              >
                <Trash2 size={14} /> Remove
              </Button>
            )}
          </div>
          {lyrics.status === 'missing' && !lyrics.searching && <p className="text-sm text-ink-300">No lyrics found for this song yet. Try pasting them below.</p>}
          {lyrics.status === 'error' && <p className="text-sm text-red-300">{lyrics.message}</p>}
          <label className="block text-sm">
            <span className="mb-1 block text-ink-300">Paste synced lyrics (LRC / enhanced LRC / VTT) or plain text</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              spellCheck={false}
              placeholder={'[00:12.30] first line of the song\n[00:16.80] second line…'}
              className="w-full rounded-xl border border-ink-600 bg-ink-850 p-3 font-mono text-sm outline-none focus:border-aqua"
            />
          </label>
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={() => void save(text, 'user-supplied')} disabled={!text.trim()}>
              Save lyrics
            </Button>
            <p className="text-xs text-ink-400">Plain text is spread evenly over the song. Fix the timing in “Edit timing”.</p>
          </div>
          {msg && (
            <p role="status" className={msg.ok ? 'text-sm text-aqua' : 'text-sm text-red-300'}>
              {msg.text}
            </p>
          )}
          <p className="text-xs text-ink-400">
            Online lookup uses LRCLIB (open lyrics database) and only sends title, artist and length. Lyricscape never scrapes lyrics websites. You are responsible for the rights to any lyrics you add.
          </p>
        </div>
      )}

      {canAlign && aligner && !aligner.available && tab === 'add' && (
        <p className="mt-3 text-xs text-ink-400">Auto-align needs the optional local aligner ({aligner.reason}). It only works on audio files you have here, never on Spotify.</p>
      )}
      {msg && tab === 'timing' && (
        <p role="status" className={msg.ok ? 'mb-2 text-sm text-aqua' : 'mb-2 text-sm text-amber-300'}>
          {msg.text}
        </p>
      )}
      {tab === 'timing' && lyrics.doc && <TimingEditor key={reviewRev} track={track} doc={lyrics.doc} onSaved={() => void lyrics.reload()} />}
    </div>
  );
}

/** What the timing really is: nothing here says "accurate", only where the numbers came from. */
function TimingChips({ doc }: { doc: LyricDocument }) {
  const s = timingSummary(doc);
  const m = doc.timing?.match;
  const src = doc.timing?.source;
  return (
    <>
      <Chip tone={s.words === 'authored' ? 'good' : 'default'}>{s.label}</Chip>
      {src === 'edited' && <Chip>Timed by you</Chip>}
      {src === 'auto-aligned' && <Chip>Auto-aligned{doc.timing?.confidence !== undefined ? ` · confidence ${Math.round(doc.timing.confidence * 100)}%` : ''} · review</Chip>}
      {m && <Chip tone={m.verdict === 'exact' ? 'good' : 'default'}>{m.verdict === 'exact' ? 'Same length as your track' : m.verdict === 'close' ? `Length differs by ${m.durationDeltaSec}s` : 'Length not checked'}</Chip>}
    </>
  );
}
