import clsx from 'clsx';
import type { Track } from '@/lib/types';

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Album art with a deterministic typographic fallback (no generated imagery). */
export function Cover({ track, className, rounded = 'rounded-lg' }: { track: Pick<Track, 'id' | 'title' | 'artworkUrl' | 'palette'> | null; className?: string; rounded?: string }) {
  if (!track) return <div className={clsx('bg-ink-800', rounded, className)} />;
  if (track.artworkUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={track.artworkUrl} alt="" className={clsx('object-cover bg-ink-800', rounded, className)} draggable={false} />;
  }
  const h = hash(track.id);
  const hue = h % 360;
  const letter = track.title.trim().charAt(0).toUpperCase() || '♪';
  return (
    <div
      className={clsx('relative flex items-center justify-center overflow-hidden font-display text-white/90 select-none', rounded, className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 50) % 360} 70% 22%))` }}
      aria-hidden
    >
      <span className="text-[2.2em] leading-none">{letter}</span>
    </div>
  );
}
