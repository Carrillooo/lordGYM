import { CalendarCheck, Clock, Layers } from 'lucide-react';
import { requireAthlete } from '@/lib/auth/guards';
import { assignmentsForAthlete, nextAssignment } from '@/lib/services/assignments';
import { getWorkoutDetail, describeSets } from '@/lib/services/workouts';
import { addDays, relativeDayLabel, todayKey } from '@/lib/domain/datetime';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { StartSessionButton } from '@/components/player/start-session-button';

export const metadata = { title: 'Hoy' };

/** Página «Hoy» (§87): sólo lo necesario para empezar. */
export default async function PlayerTodayPage() {
  const { athlete } = await requireAthlete();
  const today = todayKey();

  const next = await nextAssignment(athlete.id, today);
  const upcoming = await assignmentsForAthlete(athlete.id, addDays(today, 1), addDays(today, 7));

  if (!next) {
    return (
      <div className="space-y-6">
        <PageHeader title="Hoy" />
        <EmptyState
          icon={<CalendarCheck className="h-6 w-6" />}
          title="Sin entrenamiento pendiente"
          description="No tienes ninguna sesión asignada. Aprovecha para recuperar."
          action={
            <ButtonLink href="/player/calendar" variant="secondary">
              Ver calendario
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const detail = await getWorkoutDetail(next.workout.id);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={relativeDayLabel(next.assignment.scheduled_date, today)} title={next.workout.name} />

      <div className="flex flex-wrap gap-2">
        {next.workout.estimated_minutes ? (
          <Badge>
            <Clock className="h-3 w-3" />
            {next.workout.estimated_minutes} min
          </Badge>
        ) : null}
        <Badge>
          <Layers className="h-3 w-3" />
          {detail?.exercises.length ?? 0} ejercicios
        </Badge>
        <Badge>{detail?.totalSets ?? 0} series</Badge>
        {next.assignment.scheduled_time ? <Badge tone="volt">{next.assignment.scheduled_time}</Badge> : null}
      </div>

      {next.workout.description ? <p className="text-sm text-ink-400">{next.workout.description}</p> : null}

      <Card>
        <CardHeader title="Ejercicios" />
        <ol className="divide-y divide-ink-850">
          {(detail?.exercises ?? []).map((row, index) => (
            <li key={row.workoutExercise.id} className="flex items-center gap-3 py-3">
              <span className="metric flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-xs text-ink-300">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink-50">{row.exercise.name}</span>
                <span className="block truncate text-xs text-ink-400">
                  {describeSets(row.sets)}
                  {row.workoutExercise.superset_group ? ` · superserie ${row.workoutExercise.superset_group}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20">
        {next.session ? (
          <ButtonLink href={`/player/workout/${next.session.id}`} size="xl" className="w-full uppercase tracking-wide">
            Continuar entrenamiento
          </ButtonLink>
        ) : (
          <StartSessionButton assignmentId={next.assignment.id} />
        )}
      </div>

      {upcoming.length > 0 ? (
        <Card>
          <CardHeader title="Próximos días" />
          <ul className="divide-y divide-ink-850">
            {upcoming.map((view) => (
              <li key={view.assignment.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink-100">{view.workout.name}</span>
                  <span className="block text-xs text-ink-500">
                    {relativeDayLabel(view.assignment.scheduled_date, today)}
                  </span>
                </span>
                <Badge tone={view.assignment.status === 'completed' ? 'success' : 'neutral'}>
                  {view.assignment.status === 'completed' ? 'Hecho' : 'Pendiente'}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
