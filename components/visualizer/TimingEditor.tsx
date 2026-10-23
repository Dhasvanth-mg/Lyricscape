'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Redo2, Save, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import type { LyricDocument, Track } from '@/lib/types';
import { formatTimestamp, validateDocument, toEnhancedLrc } from '@/lib/lyrics/parse';
import { saveEditedDocument } from '@/lib/lyrics/service';
import { player } from '@/lib/player/controller';
import { kvGet, kvSet } from '@/lib/library/db';
import { Button, IconButton } from '@/components/ui/bits';

type Sel = { line: number; word: number } | null;

const clone = (d: LyricDocument): LyricDocument => JSON.parse(JSON.stringify(d));

/** Re-establish ordering after an edit: words stay monotonic and line bounds follow their words. */
function normalize(doc: LyricDocument): LyricDocument {
  let cursor = 0;
  for (const line of doc.lines) {
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i]!;
      w.startMs = Math.max(cursor, Math.max(0, Math.round(w.startMs)));
      const next = line.words[i + 1];
      w.endMs = Math.max(w.startMs, next ? Math.min(Math.max(w.endMs, w.startMs), Math.max(next.startMs, w.startMs)) : Math.round(w.endMs));
      cursor = w.startMs;
    }
    line.startMs = line.words[0]?.startMs ?? line.startMs;
    line.endMs = Math.max(line.words[line.words.length - 1]?.endMs ?? line.endMs, line.startMs);
  }
  return doc;
}

export function TimingEditor({ track, doc, onSaved }: { track: Track; doc: LyricDocument; onSaved: () => void }) {
  const [work, setWork] = useState<LyricDocument>(() => clone(doc));
  const [undo, setUndo] = useState<LyricDocument[]>([]);
  const [redo, setRedo] = useState<LyricDocument[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  // Only the *indices* of the active line/word live in state, so the (potentially hundreds of) word buttons
  // re-render when the singer moves on, not 10x a second.
  const [cursor, setCursor] = useState({ line: -1, word: -1 });
  const listRef = useRef<HTMLDivElement>(null);
  const draftKey = `draft:${track.id}`;

  useEffect(() => {
    setWork(clone(doc));
    setUndo([]);
    setRedo([]);
    setDirty(false);
    // restore an unsaved draft (autosave)
    void kvGet<LyricDocument>(draftKey).then((d) => {
      if (d && JSON.stringify(d) !== JSON.stringify(doc)) {
        setWork(d);
        setDirty(true);
      }
    });
  }, [doc, draftKey]);

  // autosave draft
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void kvSet(draftKey, work), 600);
    return () => clearTimeout(t);
  }, [work, dirty, draftKey]);

  const problems = useMemo(() => validateDocument(work), [work]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = player.getPositionMs();
      let li = -1;
      for (let i = 0; i < work.lines.length; i++) {
        if (p >= work.lines[i]!.startMs) li = i;
        else break;
      }
      let wi = -1;
      if (li >= 0) {
        const words = work.lines[li]!.words;
        for (let j = 0; j < words.length; j++) if (p >= words[j]!.startMs && p < words[j]!.endMs) wi = j;
      }
      setCursor((c) => (c.line === li && c.word === wi ? c : { line: li, word: wi }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [work]);
  const activeLine = cursor.line;

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-line="${activeLine}"]`);
    if (el && !sel) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeLine, sel]);

  const commit = (fn: (d: LyricDocument) => void) => {
    setUndo((u) => [...u.slice(-49), clone(work)]);
    setRedo([]);
    const next = clone(work);
    fn(next);
    setWork(normalize(next));
    setDirty(true);
    setSaved(null);
  };

  const nudge = (delta: number) => {
    if (!sel) return;
    commit((d) => {
      d.lines[sel.line]!.words[sel.word]!.startMs += delta;
    });
  };
  const shiftLine = (delta: number) => {
    if (!sel) return;
    commit((d) => {
      for (const w of d.lines[sel.line]!.words) {
        w.startMs += delta;
        w.endMs += delta;
      }
    });
  };
  const stampNow = () => {
    if (!sel) return;
    const now = Math.round(player.getPositionMs());
    commit((d) => {
      d.lines[sel.line]!.words[sel.word]!.startMs = now;
    });
    // advance selection to the next word for rapid tap-timing
    const line = work.lines[sel.line]!;
    if (sel.word + 1 < line.words.length) setSel({ line: sel.line, word: sel.word + 1 });
    else if (sel.line + 1 < work.lines.length) setSel({ line: sel.line + 1, word: 0 });
  };

  const doUndo = () => {
    const prev = undo[undo.length - 1];
    if (!prev) return;
    setRedo((r) => [...r, clone(work)]);
    setUndo((u) => u.slice(0, -1));
    setWork(prev);
    setDirty(true);
  };
  const doRedo = () => {
    const next = redo[redo.length - 1];
    if (!next) return;
    setUndo((u) => [...u, clone(work)]);
    setRedo((r) => r.slice(0, -1));
    setWork(next);
    setDirty(true);
  };

  const save = async () => {
    await saveEditedDocument(track, work);
    await kvSet(draftKey, null);
    setDirty(false);
    setSaved('Saved');
    onSaved();
  };

  const download = () => {
    const blob = new Blob([toEnhancedLrc(work, { ti: track.title, ar: track.artists.join(', ') })], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${track.artists[0] ?? 'artist'} - ${track.title}.lrc`.replace(/[\\/:*?"<>|]/g, '_');
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900">
      <div className="flex flex-wrap items-center gap-1 border-b border-ink-700 p-2">
        <IconButton label="Undo" onClick={doUndo} disabled={!undo.length}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Redo" onClick={doRedo} disabled={!redo.length}>
          <Redo2 size={16} />
        </IconButton>
        <span className="mx-1 h-5 w-px bg-ink-700" />
        <Button size="sm" variant="ghost" disabled={!sel} onClick={() => nudge(-50)}>
          −50
        </Button>
        <Button size="sm" variant="ghost" disabled={!sel} onClick={() => nudge(50)}>
          +50
        </Button>
        <Button size="sm" variant="ghost" disabled={!sel} onClick={() => shiftLine(-250)}>
          Line −250
        </Button>
        <Button size="sm" variant="ghost" disabled={!sel} onClick={() => shiftLine(250)}>
          Line +250
        </Button>
        <Button size="sm" variant="outline" disabled={!sel} onClick={stampNow} title="Set the selected word to the current playback time, then move to the next word">
          <Crosshair size={14} /> Stamp now
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {saved && <span className="text-xs text-aqua">{saved}</span>}
          {dirty && !saved && <span className="text-xs text-sun">Unsaved</span>}
          <Button size="sm" onClick={download}>
            Export .lrc
          </Button>
          <Button size="sm" variant="primary" onClick={() => void save()} disabled={!dirty || problems.length > 0}>
            <Save size={14} /> Save
          </Button>
        </div>
      </div>
      {problems.length > 0 && (
        <p role="alert" className="border-b border-ink-700 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {problems[0]} {problems.length > 1 && `(+${problems.length - 1} more)`}
        </p>
      )}
      <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2" role="listbox" aria-label="Lyric lines">
        {work.lines.map((line, li) => (
          <LineRow
            key={li}
            line={line}
            li={li}
            active={li === activeLine}
            sungWord={li === cursor.line ? cursor.word : -1}
            selWord={sel?.line === li ? sel.word : -1}
            onSelect={setSel}
          />
        ))}
      </div>
      {sel && (
        <p className="border-t border-ink-700 px-3 py-2 font-mono text-[11px] text-ink-300">
          “{work.lines[sel.line]?.words[sel.word]?.text}” starts at {formatTimestamp(work.lines[sel.line]?.words[sel.word]?.startMs ?? 0, 3)}
        </p>
      )}
    </div>
  );
}

type RowProps = { line: LyricDocument['lines'][number]; li: number; active: boolean; sungWord: number; selWord: number; onSelect: (s: { line: number; word: number }) => void };

/** One lyric line. Memoised: it only re-renders when its own line, highlight or selection changes. */
const LineRow = memo(function LineRow({ line, li, active, sungWord, selWord, onSelect }: RowProps) {
  return (
    <div data-line={li} className={clsx('flex items-start gap-2 rounded-lg px-2 py-1.5', active && 'bg-ink-800')}>
      <button className="mt-0.5 w-16 shrink-0 text-left font-mono text-[11px] text-ink-400 hover:text-bone" onClick={() => void player.seek(line.startMs)} title="Seek to this line">
        {formatTimestamp(line.startMs)}
      </button>
      <div className="flex flex-wrap gap-x-1 gap-y-1">
        {line.words.map((w, wi) => (
          <button
            key={wi}
            role="option"
            aria-selected={selWord === wi}
            onClick={() => onSelect({ line: li, word: wi })}
            title={formatTimestamp(w.startMs, 3)}
            className={clsx('rounded px-1.5 py-0.5 text-sm transition', selWord === wi ? 'bg-signal text-white' : sungWord === wi ? 'bg-aqua/25 text-aqua' : 'hover:bg-ink-700')}
          >
            {w.text}
          </button>
        ))}
      </div>
    </div>
  );
});
