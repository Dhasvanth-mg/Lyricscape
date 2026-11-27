'use client';

import Link from 'next/link';
import { Maximize2 } from 'lucide-react';
import clsx from 'clsx';
import { usePlayer } from '@/lib/player/controller';
import { useUi } from '@/lib/ui-store';
import { STYLES } from '@/lib/kinetic/styles';
import { STYLE_IDS } from '@/lib/kinetic/types';
import { LyricStage } from '@/components/visualizer/LyricStage';
import { LyricsPanel } from '@/components/visualizer/LyricsPanel';
import { LookControls } from '@/components/visualizer/LookControls';
import { useLyrics } from '@/components/visualizer/useLyrics';
import { Button, Chip, Empty, PageHeader } from '@/components/ui/bits';

export default function VisualsPage() {
  const track = usePlayer((s) => s.track);
  const style = useUi((s) => s.style);
  const autoTheme = useUi((s) => s.autoTheme);
  const setUi = useUi((s) => s.set);
  const setStyle = useUi((s) => s.setStyle);
  const openStage = useUi((s) => s.openStage);
  const lyrics = useLyrics(track);

  return (
    <div>
      <PageHeader title="Visuals">
        <Button variant="primary" onClick={openStage} disabled={!track}>
          <Maximize2 size={16} /> Chill mode
        </Button>
      </PageHeader>

      {!track && (
        <Empty
          title="Play something first"
          action={
            <Link href="/listen" className="inline-flex h-9 items-center rounded bg-bone px-3.5 text-[13px] font-medium text-ink-950 hover:bg-white">
              Choose a song
            </Link>
          }
        >
          Lyrics animate to whatever is playing: the demo songs, a file you import, or anything on Spotify.
        </Empty>
      )}

      {track && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Chip tone={track.provider === 'spotify' ? 'spotify' : 'default'}>{track.provider === 'spotify' ? 'Spotify' : track.provider === 'demo' ? 'Demo' : 'My file'}</Chip>
            <span className="text-sm text-ink-200">
              {track.title} · {track.artists.join(', ')}
            </span>
            {track.provider === 'spotify' && <span className="text-xs text-ink-400">Spotify gives no audio analysis, so mood comes from the lyrics alone.</span>}
          </div>

          <LyricStage track={track} style={style} className="mb-5 aspect-video max-h-[62vh] w-full rounded-md border border-ink-700" />

          <div className="mb-8 flex flex-wrap gap-2" role="radiogroup" aria-label="Visual style">
            <button
              role="radio"
              aria-checked={autoTheme}
              onClick={() => setUi({ autoTheme: true })}
              title="Pick the look from the song: genre, delivery speed, mood and cover"
              className={clsx('h-8 rounded border px-3 text-[13px] font-medium transition', autoTheme ? 'border-bone bg-bone text-ink-950' : 'border-ink-600 text-ink-200 hover:border-ink-400')}
            >
              Auto
            </button>
            {STYLE_IDS.filter((id) => id !== 'custom').map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={!autoTheme && style === id}
                onClick={() => {
                  setStyle(id);
                  setUi({ autoTheme: false });
                }}
                title={STYLES[id].description}
                className={clsx(
                  'h-8 rounded border px-3 text-[13px] font-medium transition',
                  !autoTheme && style === id ? 'border-bone bg-bone text-ink-950' : 'border-ink-600 text-ink-200 hover:border-ink-400',
                )}
              >
                {STYLES[id].label}
              </button>
            ))}
          </div>

          <LookControls className="mb-8" />

          <LyricsPanel track={track} lyrics={lyrics} />
        </>
      )}
    </div>
  );
}
