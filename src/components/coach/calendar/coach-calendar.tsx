'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  addDays,
  dateRange,
  formatLongDate,
  isoWeekday,
  monthGrid,
  MONTHS_LONG,
  startOfWeek,
  WEEKDAYS_SHORT,
} from '@/lib/domain/datetime';
import { deleteAssignmentAction, moveAssignmentAction } from '@/lib/actions/workouts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { AssignPanel } from '@/components/coach/assign-panel';
import { DuplicateWeekForm } from './duplicate-week-form';

export interface CalendarEvent {
  assignmentId: string;
  date: string;
  time: string | null;
  status: 'assigned' | 'started' | 'completed' | 'skipped';
  workoutName: string;
  athleteId: string;
  athleteName: string;
}

const STATUS_STYLE: Record<CalendarEvent['status'], string> = {
  assigned: 'border-ink-700 bg-ink-800/80 text-ink-100',
  started: 'border-volt-500/40 bg-volt-500/12 text-volt-500',
  completed: 'border-success-500/35 bg-success-500/10 text-success-500',
  skipped: 'border-danger-500/30 bg-danger-500/8 text-danger-500',
};

/** Calendario del entrenador con vistas día/semana/mes y drag & drop (§12). */
export function CoachCalendar({
  mode,
  anchor,
  today,
  monthStart,
  monthEnd,
  athletes,
  workouts,
  events,
  selectedAthleteId,
}: {
  mode: 'day' | 'week' | 'month';
  anchor: string;
  today: string;
  monthStart: string;
  monthEnd: string;
  athletes: { id: string; name: string; team: string | null }[];
  workouts: { id: string; name: string }[];
  events: CalendarEvent[];
  selectedAthleteId: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [dragging, setDragging] = useState<string | null>(null);
  const [assignDate, setAssignDate] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function navigate(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`/coach/calendar?${next.toString()}`, { scroll: false });
  }

  function shift(direction: -1 | 1) {
    const step = mode === 'day' ? 1 : mode === 'week' ? 7 : 30;
    const next = addDays(anchor, direction * step);
    navigate({ date: mode === 'month' ? `${next.slice(0, 7)}-01` : next });
  }

  function onDrop(date: string) {
    if (!dragging) return;
    const assignmentId = dragging;
    setDragging(null);
    startTransition(async () => {
      await moveAssignmentAction(assignmentId, date);
      router.refresh();
    });
  }

  const days =
    mode === 'day'
      ? [anchor]
      : mode === 'week'
        ? dateRange(startOfWeek(anchor), addDays(startOfWeek(anchor), 6))
        : monthGrid(anchor);

  const title =
    mode === 'day'
      ? formatLongDate(anchor)
      : mode === 'week'
        ? `Semana del ${startOfWeek(anchor).slice(8)} al ${addDays(startOfWeek(anchor), 6).slice(8)} de ${
            MONTHS_LONG[Number(anchor.slice(5, 7)) - 1]
          }`
        : `${MONTHS_LONG[Number(anchor.slice(5, 7)) - 1]} ${anchor.slice(0, 4)}`;

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label="Anterior"
              className="rounded-lg border border-ink-700 p-2 text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate({ date: today })}
              className="rounded-lg border border-ink-700 px-3 py-2 text-xs font-medium text-ink-200 transition-colors hover:border-ink-600"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label="Siguiente"
              className="rounded-lg border border-ink-700 p-2 text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <p className="min-w-0 flex-1 truncate text-sm font-medium capitalize text-ink-100">{title}</p>

          <div className="flex gap-1">
            {(['day', 'week', 'month'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => navigate({ view: value })}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === value ? 'bg-volt-500 text-ink-950' : 'bg-ink-850 text-ink-300 hover:bg-ink-800',
                )}
              >
                {value === 'day' ? 'Día' : value === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            aria-label="Filtrar por jugador"
            value={selectedAthleteId ?? ''}
            onChange={(event) => navigate({ athlete: event.target.value || null })}
            className="h-9 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs text-ink-100 focus:border-volt-500 focus:outline-none"
          >
            <option value="">Todos los jugadores</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.name}
              </option>
            ))}
          </select>

          {mode === 'week' ? (
            <DuplicateWeekForm weekStart={startOfWeek(anchor)} targetWeekStart={addDays(startOfWeek(anchor), 7)} />
          ) : null}

          <Button size="sm" variant="secondary" onClick={() => setAssignDate(anchor)}>
            <Plus className="h-4 w-4" />
            Asignar sesión
          </Button>
        </div>
      </Card>

      {mode === 'month' ? (
        <Card className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wider text-ink-500">
            {WEEKDAYS_SHORT.map((day, index) => (
              <span key={index} className="py-1">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const inMonth = day >= monthStart && day <= monthEnd;
              const dayEvents = events.filter((event) => event.date === day);
              return (
                <div
                  key={day}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => onDrop(day)}
                  className={cn(
                    'min-h-20 rounded-lg border p-1 transition-colors',
                    inMonth ? 'border-ink-800 bg-ink-900/40' : 'border-transparent bg-transparent opacity-40',
                    day === today && 'ring-1 ring-volt-500',
                  )}
                >
                  <div className="flex items-center justify-between px-1">
                    <span className={cn('tabular text-[11px]', day === today ? 'text-volt-500' : 'text-ink-500')}>
                      {Number(day.slice(8))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssignDate(day)}
                      aria-label={`Asignar sesión el ${day}`}
                      className="rounded p-0.5 text-ink-600 hover:text-volt-500"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <ul className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <li key={event.assignmentId}>
                        <div
                          draggable={event.status === 'assigned'}
                          onDragStart={() => setDragging(event.assignmentId)}
                          onDragEnd={() => setDragging(null)}
                          className={cn(
                            'truncate rounded border px-1 py-0.5 text-[10px] leading-tight',
                            STATUS_STYLE[event.status],
                            event.status === 'assigned' && 'cursor-grab',
                          )}
                          title={`${event.athleteName} · ${event.workoutName}`}
                        >
                          {event.workoutName}
                        </div>
                      </li>
                    ))}
                    {dayEvents.length > 3 ? (
                      <li className="px-1 text-[10px] text-ink-500">+{dayEvents.length - 3}</li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <div
          className={cn(
            'grid gap-3',
            mode === 'day' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7',
          )}
        >
          {days.map((day) => {
            const dayEvents = events.filter((event) => event.date === day);
            return (
              <Card
                key={day}
                className={cn('p-3 transition-colors', day === today && 'border-volt-500/40')}
              >
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => onDrop(day)}
                  className="min-h-24"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-ink-400">
                      {WEEKDAYS_SHORT[isoWeekday(day) - 1]} {Number(day.slice(8))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssignDate(day)}
                      aria-label={`Asignar sesión el ${day}`}
                      className="rounded p-1 text-ink-500 transition-colors hover:bg-ink-800 hover:text-volt-500"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {dayEvents.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-ink-800 py-4 text-center text-[11px] text-ink-600">
                      Descanso
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {dayEvents.map((event) => (
                        <li key={event.assignmentId}>
                          <div
                            draggable={event.status === 'assigned'}
                            onDragStart={() => setDragging(event.assignmentId)}
                            onDragEnd={() => setDragging(null)}
                            className={cn(
                              'group rounded-lg border px-2 py-1.5',
                              STATUS_STYLE[event.status],
                              event.status === 'assigned' && 'cursor-grab',
                            )}
                          >
                            <p className="truncate text-xs font-medium">{event.workoutName}</p>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <span className="truncate text-[10px] opacity-80">
                                {event.athleteName}
                                {event.time ? ` · ${event.time}` : ''}
                              </span>
                              {event.status === 'assigned' ? (
                                <form action={deleteAssignmentAction}>
                                  <input type="hidden" name="assignmentId" value={event.assignmentId} />
                                  <button
                                    type="submit"
                                    aria-label="Eliminar asignación"
                                    className="opacity-0 transition-opacity group-hover:opacity-100"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {assignDate ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAssignDate(null)}
                className="rounded-lg bg-ink-800 px-3 py-1.5 text-xs text-ink-200"
              >
                Cerrar
              </button>
            </div>
            <div className="max-h-[80dvh] overflow-y-auto">
              <AssignFromCalendar athletes={athletes} workouts={workouts} date={assignDate} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssignFromCalendar({
  athletes,
  workouts,
  date,
}: {
  athletes: { id: string; name: string; team: string | null }[];
  workouts: { id: string; name: string }[];
  date: string;
}) {
  const [workoutId, setWorkoutId] = useState(workouts[0]?.id ?? '');

  if (workouts.length === 0) {
    return (
      <Card>
        <p className="text-sm text-ink-400">
          Todavía no tienes entrenamientos. Créalos desde <span className="text-ink-100">Entrenamientos</span>.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-400">Entrenamiento</span>
          <select
            value={workoutId}
            onChange={(event) => setWorkoutId(event.target.value)}
            className="h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-50 focus:border-volt-500 focus:outline-none"
          >
            {workouts.map((workout) => (
              <option key={workout.id} value={workout.id}>
                {workout.name}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <AssignPanel
        key={workoutId}
        workoutId={workoutId}
        workoutName={workouts.find((workout) => workout.id === workoutId)?.name ?? ''}
        athletes={athletes}
        defaultDate={date}
      />
    </div>
  );
}
