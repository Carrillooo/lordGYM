import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { requireCoach } from '@/lib/auth/guards';
import { getProgramDetail } from '@/lib/services/programs';
import { listWorkouts } from '@/lib/services/workouts';
import { getRoster } from '@/lib/services/roster';
import { addProgramWorkoutAction, deleteProgramAction, removeProgramWorkoutAction } from '@/lib/actions/programs';
import { WEEKDAYS_LONG, addDays, startOfWeek, todayKey } from '@/lib/domain/datetime';
import { fullName } from '@/lib/domain/labels';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { AssignProgramPanel } from '@/components/coach/assign-program-panel';

export const metadata = { title: 'Programa' };

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { coach } = await requireCoach();
  const { id } = await params;

  const detail = await getProgramDetail(id);
  if (!detail || detail.program.coach_id !== coach.id) notFound();

  const [workouts, roster] = await Promise.all([listWorkouts(coach.id), getRoster(coach.id)]);
  const nextMonday = addDays(startOfWeek(todayKey()), 7);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/coach/programs"
          className="inline-flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Programas
        </Link>
        <form action={deleteProgramAction}>
          <input type="hidden" name="programId" value={detail.program.id} />
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger-500/30 px-3 text-xs font-medium text-danger-500 transition-colors hover:bg-danger-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar programa
          </button>
        </form>
      </div>

      <PageHeader
        eyebrow={`${detail.program.weeks_count} semanas`}
        title={detail.program.name}
        description={detail.program.description ?? undefined}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {detail.weeks.map(({ week, entries }) => (
            <Card key={week.id}>
              <CardHeader
                title={week.title ?? `Semana ${week.week_index}`}
                subtitle={entries.length === 0 ? 'Sin sesiones asignadas' : `${entries.length} sesión(es)`}
              />

              {entries.length > 0 ? (
                <ul className="mb-4 space-y-2">
                  {entries.map(({ entry, workout }) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2"
                    >
                      <Badge tone="data">{WEEKDAYS_LONG[entry.day_of_week - 1].slice(0, 3)}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-100">{workout.name}</span>
                      <form action={removeProgramWorkoutAction}>
                        <input type="hidden" name="programId" value={detail.program.id} />
                        <input type="hidden" name="entryId" value={entry.id} />
                        <button
                          type="submit"
                          aria-label="Quitar sesión"
                          className="rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-ink-800 hover:text-danger-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : null}

              {workouts.length > 0 ? (
                <form action={addProgramWorkoutAction} className="flex flex-wrap gap-2">
                  <input type="hidden" name="programId" value={detail.program.id} />
                  <input type="hidden" name="programWeekId" value={week.id} />
                  <select
                    name="workoutId"
                    aria-label="Entrenamiento"
                    className="h-9 min-w-40 flex-1 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs text-ink-100 focus:border-volt-500 focus:outline-none"
                  >
                    {workouts.map((workout) => (
                      <option key={workout.id} value={workout.id}>
                        {workout.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="dayOfWeek"
                    aria-label="Día de la semana"
                    className="h-9 rounded-lg border border-ink-700 bg-ink-900 px-2.5 text-xs text-ink-100 focus:border-volt-500 focus:outline-none"
                  >
                    {WEEKDAYS_LONG.map((day, index) => (
                      <option key={day} value={index + 1}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="h-9 rounded-lg bg-ink-750 px-3 text-xs font-medium text-ink-100 transition-colors hover:bg-ink-700"
                  >
                    Añadir
                  </button>
                </form>
              ) : (
                <p className="text-sm text-ink-500">Crea primero un entrenamiento para poder añadirlo.</p>
              )}
            </Card>
          ))}
        </div>

        <AssignProgramPanel
          programId={detail.program.id}
          programName={detail.program.name}
          athletes={roster.map((entry) => ({
            id: entry.athlete.id,
            name: fullName(entry.profile.first_name, entry.profile.last_name),
          }))}
          defaultStart={nextMonday}
        />
      </div>
    </div>
  );
}
