import { requireCoach } from '@/lib/auth/guards';
import { getWorkoutDetail } from '@/lib/services/workouts';
import { workoutTemplatePdf } from '@/lib/pdf/build';
import { fullName } from '@/lib/domain/labels';

/**
 * Descarga la plantilla del entrenador en PDF, lista para imprimir.
 *
 * La comprobación de propiedad va antes de generar nada: un entrenador sólo
 * puede descargar sus propios entrenamientos.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { coach, profile } = await requireCoach();
  const { id } = await params;

  const detail = await getWorkoutDetail(id);
  if (!detail || detail.workout.coach_id !== coach.id) {
    return new Response('No encontrado', { status: 404 });
  }

  const pdf = await workoutTemplatePdf(id, { coachName: fullName(profile.first_name, profile.last_name) });
  if (!pdf) return new Response('No encontrado', { status: 404 });

  return new Response(pdf.bytes as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdf.filename}"`,
      // Un entrenamiento se edita: que no se quede una versión vieja en caché.
      'Cache-Control': 'no-store',
    },
  });
}
