import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'spotify'; size?: 'sm' | 'md' | 'lg' };

export function Button({ variant = 'outline', size = 'md', className, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-bold transition select-none hover:scale-[1.04] active:scale-100 disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' && 'h-8 px-4 text-[13px]',
        size === 'md' && 'h-10 px-6 text-sm',
        size === 'lg' && 'h-12 px-8 text-base',
        variant === 'primary' && 'bg-signal text-white hover:bg-[#ff5a87]',
        variant === 'spotify' && 'bg-spotify text-black hover:brightness-110',
        variant === 'outline' && 'border border-ink-400 bg-transparent text-bone hover:border-bone',
        variant === 'ghost' && 'text-ink-300 hover:scale-100 hover:bg-ink-800 hover:text-bone',
        variant === 'danger' && 'border border-danger/60 text-danger hover:border-danger',
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
        'inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-30',
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
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        tone === 'default' && 'bg-ink-800 text-bone',
        tone === 'good' && 'bg-aqua/15 text-aqua',
        tone === 'warn' && 'bg-sun/15 text-sun',
        tone === 'bad' && 'bg-danger/15 text-danger',
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
    <div className="flex flex-col items-center gap-2 rounded-xl bg-ink-850/60 px-6 py-12 text-center">
      <p className="text-xl font-bold tracking-tight text-bone">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-300">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-semibold text-ink-300">{eyebrow}</p>}
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}
