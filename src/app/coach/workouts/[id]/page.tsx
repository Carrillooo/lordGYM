import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Copy, Download, Layers, Timer, Trash2 } from 'lucide-react';
import { requireCoach } from '@/lib/auth/guards';
import { getWorkoutDetail } from '@/lib/services/workouts';
import { listExercisesForCoach } from '@/lib/services/exercises';
import { getRoster } from '@/lib/services/roster';
import { deleteWorkoutAction, duplicateWorkoutAction } from '@/lib/actions/workouts';
import { todayKey } from '@/lib/domain/datetime';
import { fullName } from '@/lib/domain/labels';
import { Badge, Card, CardHeader } from '@/components/ui/primitives';
import { WorkoutBuilder } from '@/components/coach/builder/workout-builder';
import { WorkoutMetaForm } from '@/components/coach/builder/workout-meta-form';
import { AssignPanel } from '@/components/coach/assign-panel';

export const metadata = { title: 'Constructor de entrenamiento' };

export default async function WorkoutBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { coach } = await requireCoach();
  const { id } = await params;

  const detail = await getWorkoutDetail(id);
  if (!detail || detail.workout.coach_id !== coach.id) notFound();

  const [library, roster] = await Promise.all([listExercisesForCoach(coach.id), getRoster(coach.id)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/coach/workouts"
          className="inline-flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Entrenamientos
        </Link>

        <div className="flex gap-2">
          <a
            href={`/coach/workouts/${detail.workout.id}/pdf`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-700 px-3 text-xs font-medium text-ink-200 transition-colors hover:border-ink-600"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </a>
          <form action={duplicateWorkoutAction}>
            <input type="hidden" name="workoutId" value={detail.workout.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-700 px-3 text-xs font-medium text-ink-200 transition-colors hover:border-ink-600"
            >
              <Copy className="h-3.5 w-3.5" />
              Duplicar
            </button>
          </form>
          <form action={deleteWorkoutAction}>
            <input type="hidden" name="workoutId" value={detail.workout.id} />
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger-500/30 px-3 text-xs font-medium text-danger-500 transition-colors hover:bg-danger-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-3xl uppercase text-ink-50 sm:text-4xl">{detail.workout.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>
              <Layers className="h-3 w-3" />
              {detail.exercises.length} ejercicios
            </Badge>
            <Badge>{detail.totalSets} series</Badge>
            {detail.workout.estimated_minutes ? (
              <Badge>
                <Timer className="h-3 w-3" />
                {detail.workout.estimated_minutes} min
              </Badge>
            ) : null}
            {detail.workout.is_template ? <Badge tone="volt">Plantilla</Badge> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <WorkoutBuilder workoutId={detail.workout.id} rows={detail.exercises} library={library} />
        </div>

        <div className="space-y-4">
          <AssignPanel
            workoutId={detail.workout.id}
            workoutName={detail.workout.name}
            athletes={roster.map((entry) => ({
              id: entry.athlete.id,
              name: fullName(entry.profile.first_name, entry.profile.last_name),
              team: entry.teamNames[0] ?? null,
            }))}
            defaultDate={todayKey()}
          />

          <Card>
            <CardHeader title="Detalles de la sesión" subtitle="Se guardan al pulsar Actualizar." />
            <WorkoutMetaForm workout={detail.workout} />
          </Card>
        </div>
      </div>
    </div>
  );
}
