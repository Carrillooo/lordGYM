import { requireAthlete } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { coachOfAthlete } from '@/lib/services/roster';
import { assignmentPdf } from '@/lib/pdf/build';
import { fullName } from '@/lib/domain/labels';

/**
 * Descarga en PDF una rutina asignada que todavía no se ha empezado, con las
 * casillas en blanco para apuntar a mano. `id` es la asignación, no la sesión:
 * así se puede imprimir antes de pisar el gimnasio.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { athlete, profile } = await requireAthlete();
  const { id } = await params;

  const [assignment] = await db().select('assignments', { id, athlete_id: athlete.id });
  if (!assignment) return new Response('No encontrado', { status: 404 });

  const coach = await coachOfAthlete(athlete.id);
  const pdf = await assignmentPdf(assignment.workout_id, {
    athleteName: fullName(profile.first_name, profile.last_name),
    coachName: coach ? fullName(coach.profile.first_name, coach.profile.last_name) : null,
    date: assignment.scheduled_date,
    note: assignment.notes,
  });
  if (!pdf) return new Response('No encontrado', { status: 404 });

  return new Response(pdf.bytes as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdf.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
