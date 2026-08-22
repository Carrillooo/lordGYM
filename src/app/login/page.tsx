import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { Wordmark } from '@/components/brand/wordmark';
import { LoginForm } from '@/components/auth/login-form';
import { DEMO_ATHLETE_EMAIL, DEMO_COACH_EMAIL, DEMO_PASSWORD } from '@/lib/seed';

export const metadata = { title: 'Iniciar sesión' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const current = await getCurrentUser();
  if (current) redirect(current.profile.role === 'coach' ? '/coach' : '/player');

  const { role } = await searchParams;
  const isCoach = role === 'coach';
  const isAthlete = role === 'athlete';

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <div className="mb-8">
          <Wordmark size="lg" />
          <p className="mt-3 text-sm text-ink-400">
            {isCoach
              ? 'Accede a tu panel de entrenador.'
              : isAthlete
                ? 'Accede a tus entrenamientos.'
                : 'Introduce tus credenciales para continuar.'}
          </p>
        </div>

        <LoginForm
          demoEmail={isAthlete ? DEMO_ATHLETE_EMAIL : DEMO_COACH_EMAIL}
          demoPassword={DEMO_PASSWORD}
          demoLabel={isAthlete ? 'Entrar con la cuenta demo de jugador' : 'Entrar con la cuenta demo de entrenador'}
        />

        <p className="mt-8 text-center text-sm text-ink-400">
          ¿No tienes cuenta?{' '}
          <Link
            href={role ? `/register?role=${role}` : '/register'}
            className="font-medium text-volt-500 hover:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </div>
    </main>
  );
}
