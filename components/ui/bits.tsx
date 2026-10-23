import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'spotify'; size?: 'sm' | 'md' | 'lg' };

export function Button({ variant = 'outline', size = 'md', className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition select-none disabled:opacity-40 active:scale-[0.97]',
        size === 'sm' && 'h-8 px-3.5 text-[13px]',
        size === 'md' && 'h-10 px-5 text-sm',
        size === 'lg' && 'h-12 px-7 text-base',
        variant === 'primary' && 'bg-signal text-white hover:bg-[#ff5a87]',
        variant === 'spotify' && 'bg-spotify text-black hover:brightness-110',
        variant === 'outline' && 'border border-ink-600 bg-ink-850 text-bone hover:border-ink-400 hover:bg-ink-800',
        variant === 'ghost' && 'text-ink-200 hover:bg-ink-800 hover:text-bone',
        variant === 'danger' && 'border border-red-500/40 text-red-300 hover:bg-red-500/10',
        className,
      )}
    />
  );
}

export function IconButton({
  label,
  active,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; children: ReactNode }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-30 active:scale-90',
        active ? 'text-signal' : 'text-ink-300 hover:text-bone',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' | 'spotify'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase',
        tone === 'default' && 'bg-ink-800 text-ink-300',
        tone === 'good' && 'bg-aqua/15 text-aqua',
        tone === 'warn' && 'bg-sun/15 text-sun',
        tone === 'bad' && 'bg-red-500/15 text-red-300',
        tone === 'spotify' && 'bg-spotify/15 text-spotify',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-500 border-t-bone', className)} role="status" aria-label="Loading" />;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink-700 px-6 py-12 text-center">
      <p className="font-display text-2xl tracking-wide text-ink-200 uppercase">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-400">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 font-mono text-[11px] tracking-[0.18em] text-signal uppercase">{eyebrow}</p>}
        <h1 className="font-display text-5xl leading-none tracking-wide uppercase sm:text-6xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}
