'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Wordmark } from '@/components/brand/wordmark';
import { Alert } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Retorno del OAuth de Google.
 *
 * El intercambio del código (PKCE) ocurre en el navegador porque el verificador
 * vive aquí. El access token resultante se envía al servidor, que lo valida
 * contra Supabase antes de crear la sesión de LORDGYM: el cliente nunca decide
 * quién es el usuario.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const code = params.get('code');
      const oauthError = params.get('error_description') ?? params.get('error');
      if (oauthError) {
        setError(oauthError);
        return;
      }
      if (!code) {
        setError('No se ha recibido el código de autorización de Google.');
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error('Supabase no ha devuelto una sesión válida.');

        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ accessToken, role: params.get('role') ?? 'athlete' }),
        });
        const payload = (await response.json()) as { redirectTo?: string; error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'No se ha podido crear la sesión.');
        if (cancelled) return;
        router.replace(payload.redirectTo ?? '/');
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Error al iniciar sesión.');
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-5 text-center">
      <Wordmark size="lg" />
      {error ? (
        <div className="w-full max-w-sm space-y-4">
          <Alert>{error}</Alert>
          <ButtonLink href="/login" variant="secondary" className="w-full">
            Volver al inicio de sesión
          </ButtonLink>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Conectando con Google…
        </p>
      )}
    </main>
  );
}
