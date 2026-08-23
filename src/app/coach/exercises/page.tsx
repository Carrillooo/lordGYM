import { requireCoach } from '@/lib/auth/guards';
import { listExercisesForCoach } from '@/lib/services/exercises';
import { videoUrlsFor } from '@/lib/services/exercise-media';
import { mediaMode } from '@/lib/media';
import { PageHeader } from '@/components/ui/primitives';
import { ExerciseLibrary } from '@/components/coach/exercise-library';

export const metadata = { title: 'Ejercicios' };

export default async function CoachExercisesPage() {
  const { coach } = await requireCoach();
  const exercises = await listExercisesForCoach(coach.id);
  const videos = await videoUrlsFor(
    exercises.map((exercise) => exercise.id),
    coach.id,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Biblioteca"
        title="Ejercicios"
        description="La biblioteca LORDGYM más los ejercicios que crees tú. Gimnasio, velocidad, pliometría, cardio y prevención."
      />
      <ExerciseLibrary
        exercises={exercises}
        coachId={coach.id}
        videos={Object.fromEntries(videos)}
        mediaMode={mediaMode()}
      />
    </div>
  );
}
