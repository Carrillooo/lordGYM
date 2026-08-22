'use client';

import { useActionState } from 'react';
import { saveBodyweightAction } from '@/lib/actions/player';
import { idleState } from '@/lib/actions/state';
import { SubmitButton } from '@/components/ui/form';

export function BodyweightForm({ today, defaultValue }: { today: string; defaultValue: number | null }) {
  const [state, formAction] = useActionState(saveBodyweightAction, idleState);

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Peso corporal en kilos</span>
          <input
            name="weightKg"
            type="text"
            inputMode="decimal"
            required
            defaultValue={defaultValue ?? ''}
            placeholder="72,4"
            className="tabular h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3.5 text-center text-ink-50 focus:border-volt-500 focus:outline-none"
          />
        </label>
        <input type="hidden" name="date" value={today} />
        <SubmitButton pendingLabel="…">Registrar peso</SubmitButton>
      </div>
      {state.status !== 'idle' && state.message ? (
        <p className={state.status === 'error' ? 'text-xs text-danger-500' : 'text-xs text-success-500'}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
