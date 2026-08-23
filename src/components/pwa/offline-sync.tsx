'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloudOff, RefreshCw } from 'lucide-react';
import { pendingCount } from '@/lib/offline/outbox';
import { flushOutbox } from '@/lib/offline/sync';
import { useOnline } from '@/hooks/use-online';

/**
 * Envía lo que quedó pendiente en el gimnasio, desde cualquier pantalla.
 *
 * Se monta en el armazón del jugador, no en el modo entrenamiento: la cobertura
 * suele volver al salir a la calle, cuando la pantalla de entrenamiento ya está
 * cerrada. Mientras quede algo por enviar se ve un aviso, porque un entreno que
 * el jugador cree guardado y no lo está es de las peores cosas que pueden pasar
 * en esta app.
 */
export function OfflineSync() {
  const router = useRouter();
  const online = useOnline();
  const [remaining, setRemaining] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function sync(): Promise<void> {
      if (cancelled) return;
      setSending(true);
      const left = await flushOutbox();
      if (cancelled) return;
      setSending(false);
      setRemaining((previous) => {
        // Si se ha enviado algo, la pantalla se refresca: puede que ahora haya
        // una sesión cerrada o un récord nuevo que mostrar.
        if (previous > left) router.refresh();
        return left;
      });
    }

    function onOnline(): void {
      void sync();
    }

    // Fuera del render: se lee el almacenamiento y se pinta el aviso en el
    // siguiente ciclo, sin encadenar renders al montar el armazón.
    const timer = setTimeout(() => {
      setRemaining(pendingCount());
      void sync();
    }, 0);
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
    };
  }, [router, online]);

  if (remaining === 0) return null;

  return (
    <div
      role="status"
      className="mb-3 flex items-center gap-2 rounded-xl border border-amber-glow/30 bg-amber-glow/10 px-3 py-2 text-xs text-amber-glow"
    >
      {sending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
      {sending
        ? `Enviando ${remaining} cambio(s) guardado(s) en el móvil…`
        : online
          ? `${remaining} cambio(s) sin enviar. Se reintentará solo.`
          : `Sin conexión. ${remaining} cambio(s) guardado(s) en el móvil.`}
    </div>
  );
}
