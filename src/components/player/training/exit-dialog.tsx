'use client';

import { useRouter } from 'next/navigation';
import { abandonSessionAction } from '@/lib/actions/player';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/form';

/** Confirmación al salir del modo entrenamiento (§89). */
export function ExitDialog({
  open,
  onClose,
  sessionId,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
}) {
  const router = useRouter();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="¿Salir del entrenamiento?"
      description="Tu progreso está guardado. Puedes retomar la sesión donde la dejaste."
      size="sm"
    >
      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={onClose}>
          Seguir entrenando
        </Button>
        <Button variant="secondary" size="lg" className="w-full" onClick={() => router.push('/player')}>
          Continuar después
        </Button>
        <form action={abandonSessionAction}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <SubmitButton variant="danger" size="lg" className="w-full" pendingLabel="Descartando…">
            Marcar sesión como omitida
          </SubmitButton>
        </form>
      </div>
    </Modal>
  );
}
