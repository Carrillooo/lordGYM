import { notFound, redirect } from 'next/navigation';
import { requireAthlete } from '@/lib/auth/guards';
import { getSessionDetail } from '@/lib/services/sessions';
import { TrainingSession } from '@/components/player/training/training-session';
import type { TrainingExercise } from '@/components/player/training/training-session';

export const metadata = { title: 'Entrenando' };

export default async function PlayerWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { athlete } = await requireAthlete();
  const { id } = await params;

  const detail = await getSessionDetail(id);
  if (!detail || detail.session.athlete_id !== athlete.id) notFound();
  if (detail.session.status === 'completed') redirect('/player');

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
