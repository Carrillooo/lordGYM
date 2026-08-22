import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

/* --- Card ---------------------------------------------------------------- */

export function Card({
  children,
  className,
  as: Component = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return <Component className={cn('card p-5', className)}>{children}</Component>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-ink-50">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* --- Section ------------------------------------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-volt-500">{eyebrow}</p>
        ) : null}
        <h1 className="display text-3xl text-ink-50 sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-ink-300">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/* --- Badge --------------------------------------------------------------- */

export type BadgeTone = 'neutral' | 'volt' | 'success' | 'warning' | 'danger' | 'data' | 'violet';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-750 text-ink-200 border-ink-700',
  volt: 'bg-volt-500/12 text-volt-500 border-volt-500/25',
  success: 'bg-success-500/12 text-success-500 border-success-500/25',
  warning: 'bg-amber-glow/12 text-amber-glow border-amber-glow/25',
  danger: 'bg-danger-500/12 text-danger-500 border-danger-500/25',
  data: 'bg-data-500/12 text-data-500 border-data-500/25',
  violet: 'bg-violet-glow/12 text-violet-glow border-violet-glow/25',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --- Stat ---------------------------------------------------------------- */

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = 'neutral',
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
}) {
  const valueTone =
    tone === 'volt'
      ? 'text-volt-500'
      : tone === 'danger'
        ? 'text-danger-500'
        : tone === 'success'
          ? 'text-success-500'
          : tone === 'warning'
            ? 'text-amber-glow'
            : 'text-ink-50';

  return (
    <div className={cn('card p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</p>
        {icon ? <span className="text-ink-500">{icon}</span> : null}
      </div>
      <p className={cn('metric mt-2 text-3xl sm:text-4xl', valueTone)}>
        {value}
        {unit ? <span className="ml-1 text-base font-medium text-ink-400">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

/* --- Progress ------------------------------------------------------------ */

export function ProgressBar({
  value,
  tone = 'volt',
  className,
  showLabel = false,
}: {
  value: number;
  tone?: 'volt' | 'data' | 'success' | 'danger';
  className?: string;
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const fill = {
    volt: 'bg-volt-500',
    data: 'bg-data-500',
    success: 'bg-success-500',
    danger: 'bg-danger-500',
  }[tone];

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-ink-750"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${clamped}%` }} />
      </div>
      {showLabel ? <span className="tabular text-xs font-medium text-ink-300">{clamped}%</span> : null}
    </div>
  );
}

/* --- Empty state --------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon ? (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-800 text-ink-400">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-semibold text-ink-50">{title}</h3>
      {description ? <div className="mt-2 max-w-md text-sm text-ink-400">{description}</div> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/* --- Avatar -------------------------------------------------------------- */

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const letters = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-750 font-semibold text-ink-200 ring-1 ring-ink-700',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        letters
      )}
    </span>
  );
}

/* --- Alert --------------------------------------------------------------- */

export function Alert({
  tone = 'danger',
  children,
  className,
}: {
  tone?: 'danger' | 'success' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    danger: 'border-danger-500/30 bg-danger-500/10 text-danger-500',
    success: 'border-success-500/30 bg-success-500/10 text-success-500',
    warning: 'border-amber-glow/30 bg-amber-glow/10 text-amber-glow',
    info: 'border-data-500/30 bg-data-500/10 text-data-500',
  }[tone];

  return (
    <div role="status" className={cn('rounded-xl border px-4 py-3 text-sm', tones, className)}>
      {children}
    </div>
  );
}

/* --- Divider / list row -------------------------------------------------- */

export function ListRow({
  href,
  children,
  className,
}: {
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const classes = cn(
    'flex items-center gap-3 rounded-xl px-3 py-3 transition-colors',
    href && 'hover:bg-ink-800',
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {children}
    </Link>
  ) : (
    <div className={classes}>{children}</div>
  );
}
