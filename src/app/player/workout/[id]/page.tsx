import { notFound, redirect } from 'next/navigation';
import { requireAthlete } from '@/lib/auth/guards';
import { getSessionDetail } from '@/lib/services/sessions';
import { db } from '@/lib/db';
import { TrainingSession } from '@/components/player/training/training-session';
import type { TrainingExercise } from '@/components/player/training/training-session';
import { SessionSummary } from '@/components/player/training/session-summary';

export const metadata = { title: 'Entrenando' };

export default async function PlayerWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { athlete } = await requireAthlete();
  const { id } = await params;

  const detail = await getSessionDetail(id);
  if (!detail || detail.session.athlete_id !== athlete.id) notFound();

  // Una sesión cerrada no desaparece: se convierte en su propio resumen (§23),
  // así el jugador siempre lo ve al terminar y puede volver a consultarlo.
  if (detail.session.status === 'completed') {
    const records = await db().select('personal_records', { athlete_id: athlete.id, session_id: id });
    const exerciseNames = new Map(
      detail.exercises.map((row) => [row.exercise.id, row.exercise.name] as const),
    );
    return (
      <SessionSummary
        detail={detail}
        records={records
          .filter((record) => record.record_type !== 'e1rm')
          .map((record) => ({ ...record, exerciseName: exerciseNames.get(record.exercise_id) ?? 'Ejercicio' }))}
      />
    );
  }

  if (detail.session.status === 'skipped') redirect('/player');

  const exercises: TrainingExercise[] = detail.exercises.map((row) => ({
    sessionExerciseId: row.sessionExercise.id,
    name: row.exercise.name,
    metricType: row.exercise.metric_type,
    restSeconds: row.sessionExercise.rest_seconds,
    notes: row.sessionExercise.notes,
    technique: row.exercise.technique,
    videoUrl: row.exercise.video_url,
    supersetGroup: row.sessionExercise.superset_group,
    lastTime: row.lastTime,
    bestWeightKg: row.bestWeightKg,
    athleteComment: row.sessionExercise.athlete_comment,
    videoNote: row.sessionExercise.video_url,
    sets: row.sets.map((set) => ({
      id: set.id,
      index: set.set_index,
      setType: set.set_type,
      targetReps: set.target_reps,
      targetWeightKg: set.target_weight_kg,
      actualReps: set.actual_reps,
      actualWeightKg: set.actual_weight_kg,
      actualDurationSeconds: set.actual_duration_seconds,
      actualDistanceM: set.actual_distance_m,
      rpe: set.rpe,
      status: set.status,
    })),
  }));

  if (exercises.length === 0) redirect('/player');

  return (
    <TrainingSession
      sessionId={detail.session.id}
      workoutName={detail.workoutName}
      startedAt={detail.session.started_at}
      exercises={exercises}
    />
  );
}
