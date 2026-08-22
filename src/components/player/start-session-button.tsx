'use client';

import { PlayCircle } from 'lucide-react';
import { startSessionAction } from '@/lib/actions/player';
import { SubmitButton } from '@/components/ui/form';

/** Botón principal del jugador (§46): grande, único y sin fricción. */
export function StartSessionButton({ assignmentId, label = 'EMPEZAR ENTRENAMIENTO' }: { assignmentId: string; label?: string }) {
  return (
    <form action={startSessionAction}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <SubmitButton size="xl" className="w-full uppercase tracking-wide" pendingLabel="Preparando…">
        <PlayCircle className="h-5 w-5" />
        {label}
      </SubmitButton>
    </form>
  );
}
