import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCoach } from '@/lib/auth/guards';
import { Card, PageHeader } from '@/components/ui/primitives';
import { NewWorkoutForm } from '@/components/coach/new-workout-form';

export const metadata = { title: 'Crear entrenamiento' };

export default async function NewWorkoutPage() {
  await requireCoach();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/coach/workouts"
        className="inline-flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Entrenamientos
      </Link>

      <PageHeader
        eyebrow="Paso 1 de 2"
        title="Nueva sesión"
        description="Ponle nombre y objetivo. En el siguiente paso añades los ejercicios y configuras las series."
      />

      <Card>
        <NewWorkoutForm />
      </Card>
    </div>
  );
}
