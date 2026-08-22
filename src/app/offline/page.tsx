import { WifiOff } from 'lucide-react';
import { Wordmark } from '@/components/brand/wordmark';
import { ButtonLink } from '@/components/ui/button';

export const metadata = { title: 'Sin conexión' };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
      <Wordmark size="lg" />
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-850 text-ink-400">
        <WifiOff className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-ink-50">Sin conexión</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-400">
          No hemos podido cargar esta pantalla. Si estabas entrenando, tus series siguen guardadas en el móvil y se
          sincronizarán en cuanto vuelva la cobertura.
        </p>
      </div>
      <ButtonLink href="/player" variant="secondary">
        Reintentar
      </ButtonLink>
    </main>
  );
}
