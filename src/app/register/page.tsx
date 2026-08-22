import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { Wordmark } from '@/components/brand/wordmark';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata = { title: 'Crear cuenta' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; code?: string }>;
}) {
  const current = await getCurrentUser();
  if (current) redirect(current.profile.role === 'coach' ? '/coach' : '/player');

  const { role, code } = await searchParams;
  const initialRole = role === 'coach' ? 'coach' : 'athlete';

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <div className="mb-8">
          <Wordmark size="lg" />
          <p className="mt-3 text-sm text-ink-400">Crea tu cuenta en menos de un minuto.</p>
        </div>

        <RegisterForm initialRole={initialRole} initialCoachCode={code ?? ''} />

        <p className="mt-8 text-center text-sm text-ink-400">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-medium text-volt-500 hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
