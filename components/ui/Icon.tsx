import { ICONS, iconColors, type IconId } from '@/lib/kinetic/icons';

/** The custom vector icon set (see lib/kinetic/icons.ts) as inline SVG: the same artwork the lyric stage draws. */
export function Icon({ id, size = 20, accent = '#ff3d6e', pull = 0.18, edge = false, title, className }: { id: IconId; size?: number; accent?: string; pull?: number; edge?: boolean; title?: string; className?: string }) {
  const def = ICONS[id];
  const c = iconColors(id, accent, pull);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} strokeLinejoin="round" strokeLinecap="round">
      {edge &&
        def.parts
          .filter((p) => !(p.o !== undefined && p.o < 0.5 && !p.s))
          .map((p, i) => <path key={'e' + i} d={p.d} fill={p.s ? 'none' : '#fff'} stroke="#fff" strokeWidth={p.s ? p.s + 2.6 : 2.6} />)}
      {def.parts.map((p, i) => (p.s ? <path key={i} d={p.d} fill="none" stroke={c[p.r]} strokeWidth={p.s} opacity={p.o} /> : <path key={i} d={p.d} fill={c[p.r]} opacity={p.o} />))}
    </svg>
  );
}
