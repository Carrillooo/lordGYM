import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ClipboardList, Dumbbell } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { deploymentIssue } from '@/lib/deployment';
import { Wordmark } from '@/components/brand/wordmark';
import { RoleCard } from '@/components/landing/role-card';
import { DEMO_ATHLETE_EMAIL, DEMO_COACH_EMAIL, DEMO_PASSWORD } from '@/lib/seed';

/**
 * Esta pantalla decide por petición: mira la cookie de sesión para redirigir y
 * lee la configuración del entorno para avisar de lo que falte. Sin esto, el
 * build la prerenderizaría con los valores del momento de compilar.
 */
export const dynamic = 'force-dynamic';

/**
 * Pantalla de entrada (§3): sin landing larga. Dos opciones y dentro.
 * Si ya hay sesión se va directo al panel correspondiente.
 */
export default async function HomePage() {
  const issue = deploymentIssue();
  // Con el despliegue mal configurado ni siquiera se puede leer la sesión: se
  // avisa antes de que el usuario choque con un error genérico al entrar.
  const current = issue ? null : await getCurrentUser();
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

        {issue ? (
          <div className="animate-rise mt-10 rounded-2xl border border-amber-glow/30 bg-amber-glow/[0.07] p-5 text-left">
            <p className="flex items-center gap-2 font-semibold text-amber-glow">
              <AlertTriangle className="h-4 w-4" />
              {issue.title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">{issue.detail}</p>
            <ul className="mt-3 space-y-1">
              {issue.variables.map((variable) => (
                <li key={variable} className="font-mono text-xs text-ink-100">
                  {variable}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-400">
              Guía completa en <span className="text-ink-200">supabase/README.md</span> y{' '}
              <span className="text-ink-200">docs/DEPLOY.md</span> del repositorio.
            </p>
          </div>
        ) : null}

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
