import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireCoach } from '@/lib/auth/guards';
import { getRoster } from '@/lib/services/roster';
import { listExercisesForCoach } from '@/lib/services/exercises';
import { listWorkouts } from '@/lib/services/workouts';
import { listPrograms } from '@/lib/services/programs';
import { normalizeText } from '@/lib/text';
import { CATEGORY_LABELS, fullName } from '@/lib/domain/labels';
import { Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { SearchBox } from '@/components/coach/search-box';

export const metadata = { title: 'Buscar' };

/** Buscador global del entrenador (§53): jugadores, ejercicios, sesiones y programas. */
export default async function CoachSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { coach } = await requireCoach();
  const { q } = await searchParams;
  const needle = normalizeText(q ?? '');

  const [roster, exercises, workouts, programs] = await Promise.all([
    getRoster(coach.id),
    listExercisesForCoach(coach.id),
    listWorkouts(coach.id),
    listPrograms(coach.id),
  ]);

  const matches = (value: string) => needle.length > 0 && normalizeText(value).includes(needle);

  const players = roster.filter(
    (entry) =>
      matches(fullName(entry.profile.first_name, entry.profile.last_name)) ||
      matches(entry.athlete.position ?? '') ||
      matches(entry.athlete.team_name ?? ''),
  );
  const foundExercises = exercises.filter(
    (exercise) => matches(exercise.name) || exercise.muscles.some((muscle) => matches(muscle)),
  );
  const foundWorkouts = workouts.filter((workout) => matches(workout.name) || matches(workout.category ?? ''));
  const foundPrograms = programs.filter((program) => matches(program.name));

  const total = players.length + foundExercises.length + foundWorkouts.length + foundPrograms.length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Buscador" title="Buscar" description="Jugadores, ejercicios, entrenamientos y programas." />

      <SearchBox defaultValue={q ?? ''} />

      {needle.length === 0 ? (
        <Card className="flex items-center gap-3 text-sm text-ink-400">
          <Search className="h-4 w-4 text-ink-500" />
          Escribe para buscar en todo tu contenido.
        </Card>
      ) : total === 0 ? (
        <Card className="text-center text-sm text-ink-400">Sin resultados para «{q}».</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {players.length > 0 ? (
            <Card>
              <CardHeader title="Jugadores" subtitle={`${players.length} resultado(s)`} />
              <ul className="divide-y divide-ink-850">
                {players.map((entry) => (
                  <li key={entry.athlete.id}>
                    <Link
                      href={`/coach/players/${entry.athlete.id}`}
                      className="block py-2.5 text-sm text-ink-100 hover:text-volt-500"
                    >
                      {fullName(entry.profile.first_name, entry.profile.last_name)}
                      <span className="ml-2 text-xs text-ink-500">{entry.athlete.position}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {foundWorkouts.length > 0 ? (
            <Card>
              <CardHeader title="Entrenamientos" subtitle={`${foundWorkouts.length} resultado(s)`} />
              <ul className="divide-y divide-ink-850">
                {foundWorkouts.map((workout) => (
                  <li key={workout.id}>
                    <Link
                      href={`/coach/workouts/${workout.id}`}
                      className="block py-2.5 text-sm text-ink-100 hover:text-volt-500"
                    >
                      {workout.name}
                      <span className="ml-2 text-xs text-ink-500">{workout.exerciseCount} ejercicios</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {foundExercises.length > 0 ? (
            <Card>
              <CardHeader title="Ejercicios" subtitle={`${foundExercises.length} resultado(s)`} />
              <ul className="max-h-72 divide-y divide-ink-850 overflow-y-auto">
                {foundExercises.map((exercise) => (
                  <li key={exercise.id} className="py-2.5 text-sm text-ink-100">
                    {exercise.name}
                    <span className="ml-2 text-xs text-ink-500">{CATEGORY_LABELS[exercise.category]}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {foundPrograms.length > 0 ? (
            <Card>
              <CardHeader title="Programas" subtitle={`${foundPrograms.length} resultado(s)`} />
              <ul className="divide-y divide-ink-850">
                {foundPrograms.map((program) => (
                  <li key={program.id}>
                    <Link
                      href={`/coach/programs/${program.id}`}
                      className="block py-2.5 text-sm text-ink-100 hover:text-volt-500"
                    >
                      {program.name}
                      <span className="ml-2 text-xs text-ink-500">{program.weeks_count} semanas</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
