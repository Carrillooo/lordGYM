import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ClipboardList, Dumbbell } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { Wordmark } from '@/components/brand/wordmark';
import { RoleCard } from '@/components/landing/role-card';
import { DEMO_ATHLETE_EMAIL, DEMO_COACH_EMAIL, DEMO_PASSWORD } from '@/lib/seed';

/**
 * Pantalla de entrada (§3): sin landing larga. Dos opciones y dentro.
 * Si ya hay sesión se va directo al panel correspondiente.
 */
export default async function HomePage() {
  const current = await getCurrentUser();
  if (current) redirect(current.profile.role === 'coach' ? '/coach' : '/player');

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-4xl">
        <div className="animate-rise text-center">
          <Wordmark size="xl" />
          <p className="mt-4 text-base font-medium tracking-[0.22em] text-ink-300 uppercase sm:text-lg">
            Entrena. Progresa. Domina.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5">
          <RoleCard
            href="/login?role=coach"
            role="Entrenador"
            description="Gestiona jugadores, entrenamientos y rendimiento."
            cta="Entrar como entrenador"
            icon={<ClipboardList className="h-6 w-6" />}
            accent="volt"
            delay={80}
          />
          <RoleCard
            href="/login?role=athlete"
            role="Jugador"
            description="Consulta tus entrenamientos y registra tu progreso."
            cta="Entrar como jugador"
            icon={<Dumbbell className="h-6 w-6" />}
            accent="data"
            delay={160}
          />
        </div>

        <div className="animate-rise mt-10 flex flex-col items-center gap-3" style={{ animationDelay: '240ms' }}>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 text-sm font-medium text-ink-300 transition-colors hover:text-volt-500"
          >
            ¿Aún no tienes cuenta? Crear cuenta
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <p className="mt-4 max-w-md rounded-xl border border-ink-800 bg-ink-900/60 px-4 py-3 text-center text-xs leading-relaxed text-ink-400">
            <span className="font-semibold text-ink-200">Cuentas de demostración</span>
            <br />
            Entrenador: <span className="text-ink-200">{DEMO_COACH_EMAIL}</span>
            <br />
            Jugador: <span className="text-ink-200">{DEMO_ATHLETE_EMAIL}</span>
            <br />
            Contraseña: <span className="text-ink-200">{DEMO_PASSWORD}</span>
          </p>
        </div>
      </div>
    </main>
  );
}
