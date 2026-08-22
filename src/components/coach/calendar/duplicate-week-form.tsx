'use client';

import { useActionState } from 'react';
import { CopyPlus } from 'lucide-react';
import { duplicateWeekAction } from '@/lib/actions/workouts';
import { idleState } from '@/lib/actions/state';
import { SubmitButton } from '@/components/ui/form';

/** Duplica todas las asignaciones de la semana visible a la siguiente (§33). */
export function DuplicateWeekForm({ weekStart, targetWeekStart }: { weekStart: string; targetWeekStart: string }) {
  const [state, formAction] = useActionState(duplicateWeekAction, idleState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="weekStart" value={weekStart} />
      <input type="hidden" name="targetWeekStart" value={targetWeekStart} />
      <SubmitButton size="sm" variant="outline" pendingLabel="Duplicando…">
        <CopyPlus className="h-4 w-4" />
        Duplicar semana
      </SubmitButton>
      {state.status !== 'idle' && state.message ? (
        <span className={state.status === 'error' ? 'text-xs text-danger-500' : 'text-xs text-success-500'}>
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
