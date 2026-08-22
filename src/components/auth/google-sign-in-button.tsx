'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient, supabaseIsConfigured } from '@/lib/supabase/browser';

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.93l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.28 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.28a12 12 0 0 0 0 10.74l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.14 15.24 0 12 0A12 12 0 0 0 1.28 6.63l4 3.1C6.23 6.86 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
}

/**
 * Inicio de sesión con Google mediante Supabase Auth (§61).
 * Sin credenciales de Supabase el botón explica qué falta en lugar de fingir
 * que funciona.
 */
export function GoogleSignInButton({ role }: { role?: 'coach' | 'athlete' }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = supabaseIsConfigured();

  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = new URL('/auth/callback', window.location.origin);
      if (role) redirectTo.searchParams.set('role', role);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectTo.toString() },
      });
      if (oauthError) throw oauthError;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se ha podido conectar con Google.');
      setLoading(false);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-ink-800 bg-ink-900/50 px-4 py-3 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-ink-300">
          <GoogleGlyph />
          Continuar con Google
        </p>
        <p className="mt-1 text-xs text-ink-500">
          Disponible al configurar Supabase Auth. Ver <span className="text-ink-300">docs/SETUP.md</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" size="lg" className="w-full" onClick={signIn} disabled={loading}>
        <GoogleGlyph />
        {loading ? 'Conectando…' : 'Continuar con Google'}
      </Button>
      {error ? <p className="text-xs text-danger-500">{error}</p> : null}
    </div>
  );
}
