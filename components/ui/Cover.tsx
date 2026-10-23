import clsx from 'clsx';
import type { Track } from '@/lib/types';
import { artworkFor } from '@/lib/artwork/forTrack';

/** Album art, or an original generated cover (deterministic per track) when the track has none. */
export function Cover({ track, className, rounded = 'rounded-lg' }: { track: Pick<Track, 'id' | 'title' | 'artworkUrl' | 'palette'> | null; className?: string; rounded?: string }) {
  if (!track) return <div className={clsx('bg-ink-800', rounded, className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artworkFor(track)} alt="" className={clsx('object-cover bg-ink-800', rounded, className)} draggable={false} />;
}
