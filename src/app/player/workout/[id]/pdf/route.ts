import { requireAthlete } from '@/lib/auth/guards';
import { getSessionDetail } from '@/lib/services/sessions';
import { coachOfAthlete } from '@/lib/services/roster';
import { sessionPdf } from '@/lib/pdf/build';
import { fullName } from '@/lib/domain/labels';

/**
 * Descarga la sesión del jugador en PDF.
 *
 * Si aún no la ha hecho, sale con casillas en blanco para llevarla al gimnasio
 * en papel; si ya está cerrada, con lo que registró de verdad.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { athlete, profile } = await requireAthlete();
  const { id } = await params;

  const detail = await getSessionDetail(id);
  if (!detail || detail.session.athlete_id !== athlete.id) {
    return new Response('No encontrado', { status: 404 });
  }

  const coach = await coachOfAthlete(athlete.id);
  const pdf = await sessionPdf(id, {
    athleteName: fullName(profile.first_name, profile.last_name),
    coachName: coach ? fullName(coach.profile.first_name, coach.profile.last_name) : null,
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
