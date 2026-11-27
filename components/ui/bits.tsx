import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'spotify'; size?: 'sm' | 'md' | 'lg' };

/** Class list for a link styled as a button, so links and buttons share one look. */
export function buttonClass(variant: BtnProps['variant'] = 'outline', size: BtnProps['size'] = 'md', className?: string) {
  return clsx(
    'inline-flex items-center justify-center gap-2 rounded font-medium transition-colors duration-150 select-none disabled:opacity-40',
    size === 'sm' && 'h-7 px-2.5 text-[12px]',
    size === 'md' && 'h-9 px-3.5 text-[13px]',
    size === 'lg' && 'h-10 px-4 text-sm',
    variant === 'primary' && 'bg-bone text-ink-950 hover:bg-white',
    variant === 'spotify' && 'bg-spotify text-black hover:bg-[#3be477]',
    variant === 'outline' && 'border border-ink-600 text-bone hover:border-ink-400 hover:bg-ink-850',
    variant === 'ghost' && 'text-ink-200 hover:bg-ink-800 hover:text-bone',
    variant === 'danger' && 'border border-red-500/40 text-red-300 hover:bg-red-500/10',
    className,
  );
}

export function Button({ variant = 'outline', size = 'md', className, ...rest }: BtnProps) {
  return <button {...rest} className={buttonClass(variant, size, className)} />;
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
        'inline-flex h-8 w-8 items-center justify-center rounded transition-colors duration-150 disabled:opacity-30',
        active ? 'text-signal' : 'text-ink-300 hover:bg-ink-800 hover:text-bone',
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
        'inline-flex items-center gap-1 rounded-[3px] border px-1.5 text-[11px] leading-[18px] font-medium',
        tone === 'default' && 'border-ink-700 text-ink-300',
        tone === 'good' && 'border-aqua/30 text-aqua',
        tone === 'warn' && 'border-sun/30 text-sun',
        tone === 'bad' && 'border-red-500/30 text-red-300',
        tone === 'spotify' && 'border-spotify/30 text-spotify',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Underlined tabs: one row, a 2px bar under the selected item. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  items: readonly (readonly [T, ReactNode])[];
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={clsx('flex gap-5 overflow-x-auto border-b border-line', className)}>
      {items.map(([id, text]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={clsx(
            '-mb-px shrink-0 border-b-2 pt-1 pb-2.5 text-[13px] font-medium transition-colors duration-150',
            value === id ? 'border-bone text-bone' : 'border-transparent text-ink-400 hover:text-bone',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** A toggle in a set of options (styles, presets, filters). */
export function optionClass(on: boolean, className?: string) {
  return clsx(
    'h-8 rounded border px-3 text-[13px] font-medium transition-colors duration-150',
    on ? 'border-bone bg-bone text-ink-950' : 'border-ink-700 text-ink-200 hover:border-ink-500 hover:text-bone',
    className,
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-500 border-t-bone', className)} role="status" aria-label="Loading" />;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1.5 border-y border-line py-8">
      <p className="text-[15px] font-semibold text-bone">{title}</p>
      {children && <div className="max-w-lg text-[13px] text-ink-400">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex min-h-10 flex-wrap items-center justify-between gap-3">
      <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h1>
      {children}
    </header>
  );
}

/** Section heading used inside pages. */
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={clsx('mb-3 text-[15px] font-semibold', className)}>{children}</h2>;
}
