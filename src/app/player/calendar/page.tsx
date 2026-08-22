import Link from 'next/link';
import { requireAthlete } from '@/lib/auth/guards';
import { assignmentsForAthlete } from '@/lib/services/assignments';
import {
  addDays,
  endOfMonth,
  formatLongDate,
  monthGrid,
  MONTHS_LONG,
  startOfMonth,
  todayKey,
  WEEKDAYS_SHORT,
} from '@/lib/domain/datetime';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { StartSessionButton } from '@/components/player/start-session-button';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Calendario' };

/** Calendario del jugador (§47): ✓ completado, ● pendiente, ○ descanso. */
export default async function PlayerCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const { athlete } = await requireAthlete();
  const { month, day } = await searchParams;
  const today = todayKey();

  const anchor = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : startOfMonth(today);
  const grid = monthGrid(anchor);
  const assignments = await assignmentsForAthlete(athlete.id, grid[0], grid[41]);

  const selectedDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today;
  const daySessions = assignments.filter((view) => view.assignment.scheduled_date === selectedDay);

  const previousMonth = addDays(startOfMonth(anchor), -1).slice(0, 7);
  const nextMonth = addDays(endOfMonth(anchor), 1).slice(0, 7);

  return (
    <div className="space-y-5">
      <PageHeader title="Calendario" />

      <Card className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/player/calendar?month=${previousMonth}`}
            className="rounded-lg px-2.5 py-1.5 text-sm text-ink-300 hover:bg-ink-800"
          >
            ←
          </Link>
          <p className="text-sm font-medium capitalize text-ink-100">
            {MONTHS_LONG[Number(anchor.slice(5, 7)) - 1]} {anchor.slice(0, 4)}
          </p>
          <Link
            href={`/player/calendar?month=${nextMonth}`}
            className="rounded-lg px-2.5 py-1.5 text-sm text-ink-300 hover:bg-ink-800"
          >
            →
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wider text-ink-500">
          {WEEKDAYS_SHORT.map((label, index) => (
            <span key={index} className="py-1">
              {label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((date) => {
            const inMonth = date.slice(0, 7) === anchor.slice(0, 7);
            const items = assignments.filter((view) => view.assignment.scheduled_date === date);
            const completed = items.length > 0 && items.every((view) => view.assignment.status === 'completed');
            const hasPending = items.some((view) => view.assignment.status !== 'completed');

            return (
              <Link
                key={date}
                href={`/player/calendar?month=${anchor.slice(0, 7)}&day=${date}`}
                aria-label={formatLongDate(date)}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-sm transition-colors',
                  inMonth ? 'border-ink-800' : 'border-transparent opacity-35',
                  date === selectedDay && 'border-volt-500 bg-volt-500/10',
                  date === today && date !== selectedDay && 'ring-1 ring-inset ring-ink-600',
                )}
              >
                <span className={cn('tabular text-xs', date === today ? 'text-volt-500' : 'text-ink-300')}>
                  {Number(date.slice(8))}
                </span>
                <span aria-hidden className="text-[10px] leading-none">
                  {items.length === 0 ? (
                    <span className="text-ink-700">○</span>
                  ) : completed ? (
                    <span className="text-success-500">✓</span>
                  ) : hasPending ? (
                    <span className="text-volt-500">●</span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title={formatLongDate(selectedDay)} subtitle={`${daySessions.length} sesión(es)`} />
        {daySessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-800 py-8 text-center text-sm text-ink-500">
            Día de descanso.
          </p>
        ) : (
          <ul className="space-y-3">
            {daySessions.map((view) => (
              <li key={view.assignment.id} className="rounded-xl border border-ink-800 bg-ink-900/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-50">{view.workout.name}</p>
                    <p className="text-xs text-ink-500">
                      {view.assignment.scheduled_time ?? 'Sin hora'}
                      {view.workout.estimated_minutes ? ` · ${view.workout.estimated_minutes} min` : ''}
                    </p>
                  </div>
                  <Badge
                    tone={
                      view.assignment.status === 'completed'
                        ? 'success'
                        : view.assignment.status === 'skipped'
                          ? 'danger'
                          : view.assignment.status === 'started'
                            ? 'volt'
                            : 'neutral'
                    }
                  >
                    {view.assignment.status === 'completed'
                      ? 'Completado'
                      : view.assignment.status === 'skipped'
                        ? 'Omitido'
                        : view.assignment.status === 'started'
                          ? 'En curso'
                          : 'Pendiente'}
                  </Badge>
                </div>

                {view.assignment.notes ? <p className="mt-2 text-sm text-ink-400">{view.assignment.notes}</p> : null}

                <div className="mt-3">
                  {view.assignment.status === 'completed' ? (
                    <ButtonLink href="/player/progress" variant="secondary" size="sm" className="w-full">
                      Ver resultados
                    </ButtonLink>
                  ) : view.session ? (
                    <ButtonLink href={`/player/workout/${view.session.id}`} size="sm" className="w-full">
                      Continuar
                    </ButtonLink>
                  ) : (
                    <StartSessionButton assignmentId={view.assignment.id} label="Empezar" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
