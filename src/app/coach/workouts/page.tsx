import Link from 'next/link';
import { ClipboardList, Copy, Layers, Plus, Timer } from 'lucide-react';
import { requireCoach } from '@/lib/auth/guards';
import { listWorkouts } from '@/lib/services/workouts';
import { formatShortDate } from '@/lib/domain/datetime';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { duplicateWorkoutAction } from '@/lib/actions/workouts';

export const metadata = { title: 'Entrenamientos' };

export default async function CoachWorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { coach } = await requireCoach();
  const { q, type } = await searchParams;
  const workouts = await listWorkouts(coach.id);

  const query = (q ?? '').trim().toLowerCase();
  const filtered = workouts.filter((workout) => {
    if (query && !workout.name.toLowerCase().includes(query) && !(workout.category ?? '').toLowerCase().includes(query))
      return false;
    if (type === 'templates' && !workout.is_template) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Entrenamientos"
        description="Crea sesiones, guárdalas como plantilla y asígnalas en segundos."
        action={
          <ButtonLink href="/coach/workouts/new">
            <Plus className="h-4 w-4" />
            Crear entrenamiento
          </ButtonLink>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Link
          href="/coach/workouts"
          className={
            type !== 'templates'
              ? 'rounded-full border border-volt-500 bg-volt-500 px-3.5 py-1.5 text-xs font-medium text-ink-950'
              : 'rounded-full border border-ink-700 bg-ink-850 px-3.5 py-1.5 text-xs font-medium text-ink-300'
          }
        >
          Todas ({workouts.length})
        </Link>
        <Link
          href="/coach/workouts?type=templates"
          className={
            type === 'templates'
              ? 'rounded-full border border-volt-500 bg-volt-500 px-3.5 py-1.5 text-xs font-medium text-ink-950'
              : 'rounded-full border border-ink-700 bg-ink-850 px-3.5 py-1.5 text-xs font-medium text-ink-300'
          }
        >
          Plantillas ({workouts.filter((w) => w.is_template).length})
        </Link>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title={workouts.length === 0 ? 'Aún no has creado entrenamientos' : 'Ningún entrenamiento coincide'}
          description={
            workouts.length === 0
              ? 'Empieza por una sesión de fuerza y guárdala como plantilla para reutilizarla cada semana.'
              : 'Prueba con otro filtro.'
          }
          action={
            <ButtonLink href="/coach/workouts/new">
              <Plus className="h-4 w-4" />
              Crear entrenamiento
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((workout) => (
            <li key={workout.id}>
              <Card className="flex h-full flex-col">
                <Link href={`/coach/workouts/${workout.id}`} className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold leading-tight text-ink-50">{workout.name}</h2>
                    {workout.is_template ? <Badge tone="volt">Plantilla</Badge> : null}
                  </div>
                  {workout.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-ink-400">{workout.description}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <Badge>
                      <Layers className="h-3 w-3" />
                      {workout.exerciseCount} ejercicios
                    </Badge>
                    <Badge>{workout.setCount} series</Badge>
                    {workout.estimated_minutes ? (
                      <Badge>
                        <Timer className="h-3 w-3" />
                        {workout.estimated_minutes} min
                      </Badge>
                    ) : null}
                    {workout.category ? <Badge tone="data">{workout.category}</Badge> : null}
                  </div>
                </Link>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink-800 pt-3">
                  <span className="text-xs text-ink-500">
                    Actualizado {formatShortDate(workout.updated_at.slice(0, 10))}
                  </span>
                  <form action={duplicateWorkoutAction}>
                    <input type="hidden" name="workoutId" value={workout.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Duplicar
                    </button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
