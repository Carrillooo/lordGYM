import { Wordmark } from '@/components/brand/wordmark';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
      <Wordmark size="lg" />
      <div>
        <p className="metric text-5xl text-volt-500">404</p>
        <h1 className="mt-2 text-xl font-semibold text-ink-50">Esta página no existe</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-400">
          Puede que el enlace haya cambiado o que no tengas acceso a este contenido.
        </p>
      </div>
      <ButtonLink href="/">Volver al inicio</ButtonLink>
    </main>
  );
}
