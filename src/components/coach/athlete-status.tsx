import type { AthleteStatus } from '@/types/db';
import { ATHLETE_STATUS_LABELS } from '@/lib/domain/labels';
import { cn } from '@/lib/cn';

const STATUS_STYLES: Record<AthleteStatus, { dot: string; text: string; emoji: string }> = {
  active: { dot: 'bg-success-500', text: 'text-success-500', emoji: '🟢' },
  fatigue: { dot: 'bg-amber-glow', text: 'text-amber-glow', emoji: '🟡' },
  attention: { dot: 'bg-danger-500', text: 'text-danger-500', emoji: '🔴' },
  inactive: { dot: 'bg-ink-500', text: 'text-ink-400', emoji: '⚪️' },
};

export function AthleteStatusDot({ status, className }: { status: AthleteStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={ATHLETE_STATUS_LABELS[status]}>
      <span className={cn('h-2.5 w-2.5 rounded-full', style.dot)} />
      <span className="sr-only">{ATHLETE_STATUS_LABELS[status]}</span>
    </span>
  );
}

export function AthleteStatusBadge({ status, className }: { status: AthleteStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850 px-2.5 py-1 text-xs font-medium',
        style.text,
        className,
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', style.dot)} />
      {ATHLETE_STATUS_LABELS[status]}
    </span>
  );
}
