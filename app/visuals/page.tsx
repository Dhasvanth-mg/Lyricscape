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
import { useLyrics } from '@/components/visualizer/useLyrics';
import { Button, Chip, Empty, PageHeader } from '@/components/ui/bits';

export default function VisualsPage() {
  const track = usePlayer((s) => s.track);
  const style = useUi((s) => s.style);
  const setStyle = useUi((s) => s.setStyle);
  const openStage = useUi((s) => s.openStage);
  const lyrics = useLyrics(track);

  return (
    <div>
      <PageHeader eyebrow="Kinetic lyrics" title="Visuals">
        <Button variant="primary" onClick={openStage} disabled={!track}>
          <Maximize2 size={16} /> Chill mode
        </Button>
      </PageHeader>

      {!track && (
        <Empty
          title="Play something first"
          action={
            <Link href="/listen" className="inline-flex h-10 items-center rounded-full bg-bone px-5 text-sm font-semibold text-ink-950">
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
            {track.provider === 'spotify' && <span className="text-xs text-ink-400">Artwork shown unmodified per Spotify policy; no audio analysis.</span>}
          </div>

          <LyricStage track={track} style={style} className="mb-5 aspect-video max-h-[62vh] w-full rounded-2xl border border-ink-700" />

          <div className="mb-8 flex flex-wrap gap-2" role="radiogroup" aria-label="Visual style">
            {STYLE_IDS.map((id) => (
              <button
                key={id}
                role="radio"
                aria-checked={style === id}
                onClick={() => setStyle(id)}
                title={STYLES[id].description}
                className={clsx(
                  'rounded-full border px-4 py-2 text-sm font-semibold transition',
                  style === id ? 'border-signal bg-signal text-white' : 'border-ink-600 text-ink-200 hover:border-ink-400',
                )}
              >
                {STYLES[id].label}
              </button>
            ))}
          </div>

          <LyricsPanel track={track} lyrics={lyrics} />
        </>
      )}
    </div>
  );
}
