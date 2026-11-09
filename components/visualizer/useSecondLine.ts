'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LyricDocument, Track } from '@/lib/types';
import { useUi } from '@/lib/ui-store';
import { canRomanize, romanize } from '@/lib/lyrics/romanize';
import { defaultTarget, languageLabel, translateLines } from '@/lib/lyrics/translate';

export type SecondLine = {
  kind: 'off' | 'roman' | 'translate';
  /** one entry per lyric line (null: nothing under that line), or null while there is nothing to show */
  lines: (string | null)[] | null;
  /** why nothing shows, or where it came from */
  note: string | null;
  busy: boolean;
  /** 0..1 while translating */
  progress: number;
  /** the lyrics have Devanagari or Tamil in them */
  romanizable: boolean;
  target: string;
};

/** The second line under each lyric (romanisation or translation) for the current song, following the person's choice. */
export function useSecondLine(track: Track | null, doc: LyricDocument | null): SecondLine {
  const kind = useUi((s) => s.secondLine);
  const pick = useUi((s) => s.translateTo);
  const allowAi = useUi((s) => s.aiTranslate);
  const target = pick || defaultTarget();
  const texts = useMemo(() => doc?.lines.map((l) => l.words.map((w) => w.text).join(' ')) ?? null, [doc]);
  const romanizable = useMemo(() => !!texts?.some(canRomanize), [texts]);
  const roman = useMemo(() => (kind === 'roman' && texts && romanizable ? texts.map((t) => (canRomanize(t) ? romanize(t) : null)) : null), [kind, texts, romanizable]);
  const [tr, setTr] = useState<{ key: string; lines: string[] | null; note: string | null; busy: boolean; progress: number } | null>(null);
  const trackId = track?.id ?? null;
  const want = kind === 'translate' && !!texts && !!trackId;
  const key = want ? `${trackId}|${target}|${texts!.length}|${allowAi}` : '';

  useEffect(() => {
    if (!want || !texts || !trackId) return;
    let dead = false;
    setTr({ key, lines: null, note: null, busy: true, progress: 0 });
    void translateLines(trackId, texts, target, allowAi, (p) => !dead && setTr((s) => (s && s.key === key ? { ...s, progress: p } : s))).then((r) => {
      if (dead) return;
      if (r.status === 'done') setTr({ key, lines: r.lines, note: r.via === 'ai' ? `Translated to ${languageLabel(target)} by the AI gateway` : `Translated to ${languageLabel(target)} on this device`, busy: false, progress: 1 });
      else if (r.status === 'same') setTr({ key, lines: null, note: `These lyrics are already in ${languageLabel(target)}.`, busy: false, progress: 1 });
      else setTr({ key, lines: null, note: r.message, busy: false, progress: 1 });
    });
    return () => {
      dead = true;
    };
    // `texts` changes with `doc`; the key covers what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (kind === 'roman') return { kind, lines: roman, note: romanizable ? 'Romanised (a rule-based spelling)' : 'Nothing to romanise: these lyrics are not in Devanagari or Tamil.', busy: false, progress: 1, romanizable, target };
  if (kind === 'translate') {
    const cur = tr && tr.key === key ? tr : null;
    return { kind, lines: cur?.lines ?? null, note: cur?.note ?? null, busy: cur?.busy ?? want, progress: cur?.progress ?? 0, romanizable, target };
  }
  return { kind: 'off', lines: null, note: null, busy: false, progress: 0, romanizable, target };
}
