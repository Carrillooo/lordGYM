'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Wordmark } from '@/components/brand/wordmark';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[lordgym] error de renderizado:', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
      <Wordmark size="lg" />
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-500/12 text-danger-500">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-ink-50">Algo ha fallado</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-400">
          No hemos podido cargar esta pantalla. No se ha perdido ningún dato ya guardado.
        </p>
        {error.digest ? <p className="mt-2 text-xs text-ink-600">Referencia: {error.digest}</p> : null}
      </div>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
