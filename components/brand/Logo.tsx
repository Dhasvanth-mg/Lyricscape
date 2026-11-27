import { useId } from 'react';
import clsx from 'clsx';

/** Brand name as written in sentences and titles. The wordmark below is the drawn version. */
export const BRAND = 'whohasaux';
export const BRAND_DOMAIN = 'whohasaux.com';

/**
 * The whohasaux mark: a black jukebox with red paint poured over its crown, running down the front in fat drips.
 * Drawn from scratch; the same artwork is the favicon (app/icon.svg), so change both together. The thin warm-grey
 * outline is what keeps the black body visible on the black app background.
 */
export function JukeboxMark({ size = 40, className, title }: { size?: number; className?: string; title?: string }) {
  const clip = useId();
  return (
    <svg viewBox="0 0 64 72" width={size} height={Math.round((size * 72) / 64)} className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs><clipPath id={clip}><path d="M10 62V28a22 22 0 0 1 44 0v34z"/></clipPath></defs>
      <path d="M10 62V28a22 22 0 0 1 44 0v34z" fill="#0d0a0b"/>
      <path d="M15 30v28M49 30v28" stroke="#3b2e30" strokeWidth="1.6" strokeLinecap="round"/>
      <rect x="17.5" y="25" width="29" height="7" rx="2" fill="#171112" stroke="#4a3a3d"/>
      <path d="M21 28.5h1M24.5 28.5h1M28 28.5h1M35 28.5h1M38.5 28.5h1M42 28.5h1" stroke="#937f82" strokeLinecap="round"/>
      <path d="M32.5 26.2v4.6" stroke="#ff2b3a" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="32" cy="46.5" r="9.5" fill="#141012" stroke="#4a3a3d" strokeWidth="1.1"/>
      <circle cx="32" cy="46.5" r="6.4" fill="none" stroke="#2e2325" strokeWidth="1.1"/>
      <circle cx="32" cy="46.5" r="3.3" fill="none" stroke="#2e2325" strokeWidth="1.1"/>
      <circle cx="32" cy="46.5" r="1.2" fill="#3b2e30"/>
      <rect x="7" y="61" width="50" height="6" rx="2" fill="#0d0a0b" stroke="#4a3a3d" strokeWidth="1.2"/>
      <path d="M12 67v2.5M52 67v2.5" stroke="#4a3a3d" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M10 62V28a22 22 0 0 1 44 0v34" fill="none" stroke="#4a3a3d" strokeWidth="1.2"/>
      <g clipPath={`url(#${clip})`}>
      <g fill="#8f0f19" transform="translate(0 1.2)"><path d="M0 0h64v19H0z"/><circle cx="11" cy="19" r="5"/><circle cx="23.5" cy="20.5" r="3.6"/><circle cx="32.5" cy="19.8" r="3.4"/><circle cx="41.5" cy="20.3" r="3.8"/><circle cx="54" cy="20" r="5"/><path d="M16.1 18L17.6 40.4h3.8L22.9 18z"/><circle cx="19.5" cy="40.4" r="4.6"/><path d="M25.8 19L26.9 27h2.2L30.2 19z"/><circle cx="28" cy="27" r="2.6"/><path d="M34.4 19L35.5 33h3.0L39.6 19z"/><circle cx="37" cy="33" r="3.4"/><path d="M42.9 18L44.4 47.6h4.2L50.1 18z"/><circle cx="46.5" cy="47.6" r="5.2"/></g>
      <g fill="#ff2b3a"><path d="M0 0h64v19H0z"/><circle cx="11" cy="19" r="5"/><circle cx="23.5" cy="20.5" r="3.6"/><circle cx="32.5" cy="19.8" r="3.4"/><circle cx="41.5" cy="20.3" r="3.8"/><circle cx="54" cy="20" r="5"/><path d="M16.1 18L17.6 40.4h3.8L22.9 18z"/><circle cx="19.5" cy="40.4" r="4.6"/><path d="M25.8 19L26.9 27h2.2L30.2 19z"/><circle cx="28" cy="27" r="2.6"/><path d="M34.4 19L35.5 33h3.0L39.6 19z"/><circle cx="37" cy="33" r="3.4"/><path d="M42.9 18L44.4 47.6h4.2L50.1 18z"/><circle cx="46.5" cy="47.6" r="5.2"/></g>
      </g>
      <path d="M52.6 16.5c1.6 1.9 2.4 4 2.4 6.6v12" stroke="#ff2b3a" strokeWidth="2.6" strokeLinecap="round" fill="none"/>
      <circle cx="55" cy="37.6" r="3.4" fill="#ff2b3a"/>
      <path d="M58 46c1.7 2.4 2.7 4 2.7 5.3a2.7 2.7 0 0 1-5.4 0c0-1.3 1-2.9 2.7-5.3z" fill="#ff2b3a"/>
      <path d="M17 13a17 17 0 0 1 12-6" stroke="#fff" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      <circle cx="18" cy="39" r="1.3" fill="#fff" fillOpacity=".55"/>
      <circle cx="44.8" cy="45.8" r="1.5" fill="#fff" fillOpacity=".55"/>
      <circle cx="53.8" cy="36.4" r="1" fill="#fff" fillOpacity=".55"/>
    </svg>
  );
}

/** Mark plus the drawn name: WHOHAS in bone, AUX in the brand red, .com small. */
export function Wordmark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const mark = size === 'lg' ? 56 : size === 'md' ? 34 : 26;
  return (
    <span className={clsx('inline-flex items-end gap-2.5', className)}>
      <JukeboxMark size={mark} className="shrink-0" />
      <span className={clsx('font-display leading-none tracking-wide uppercase', size === 'lg' ? 'text-5xl' : size === 'md' ? 'text-[26px]' : 'text-xl')}>
        whohas<span className="text-signal">aux</span>
        <span className="ml-0.5 font-mono text-[0.38em] tracking-normal text-ink-400 normal-case">.com</span>
      </span>
    </span>
  );
}
