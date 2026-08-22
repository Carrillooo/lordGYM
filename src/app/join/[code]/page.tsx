import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { normalizeCoachCode } from '@/lib/domain/ids';
import { fullName } from '@/lib/domain/labels';
import { Wordmark } from '@/components/brand/wordmark';
import { Card, EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { JoinCoachForm } from '@/components/player/join-coach-form';

export const metadata = { title: 'Unirse a un equipo' };

/**
 * Enlace de invitación: `/join/A7K29` (§5).
 * Si el jugador ya tiene sesión abierta se le muestra el formulario con el
 * código relleno; si no, se le lleva al registro conservando el código.
 */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = normalizeCoachCode(decodeURIComponent(code));

  const [coach] = await db().select('coaches', { coach_code: normalized });
  const current = await getCurrentUser();

  if (current?.profile.role === 'coach') redirect('/coach');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Wordmark size="lg" />
          <p className="mt-3 text-sm text-ink-400">Invitación a un equipo</p>
        </div>

        {!coach ? (
          <EmptyState
            title="Código no válido"
            description={`No existe ningún entrenador con el código ${normalized}.`}
            action={
              <ButtonLink href="/" variant="secondary">
                Volver al inicio
              </ButtonLink>
            }
          />
        ) : (
          <>
            <Card className="text-center">
              <p className="text-xs uppercase tracking-wider text-ink-500">Te invita</p>
              <p className="mt-1 text-lg font-semibold text-ink-50">
                <CoachName userId={coach.user_id} />
              </p>
              <p className="metric mt-3 text-xl text-volt-500">{normalized}</p>
            </Card>

            {current ? (
              <JoinCoachForm defaultCode={normalized} />
            ) : (
              <div className="space-y-3">
                <ButtonLink
                  href={`/register?role=athlete&code=${normalized.replace('LORD-', '')}`}
                  size="lg"
                  className="w-full"
                >
                  Crear cuenta y unirme
                </ButtonLink>
                <p className="text-center text-sm text-ink-400">
                  ¿Ya tienes cuenta?{' '}
                  <Link href="/login?role=athlete" className="font-medium text-volt-500 hover:underline">
                    Inicia sesión
                  </Link>
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

async function CoachName({ userId }: { userId: string }) {
  const [profile] = await db().select('profiles', { user_id: userId });
  return <>{profile ? fullName(profile.first_name, profile.last_name) : 'Tu entrenador'}</>;
}
