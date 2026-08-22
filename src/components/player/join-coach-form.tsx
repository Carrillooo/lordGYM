'use client';

import { useActionState } from 'react';
import { UserPlus } from 'lucide-react';
import { joinCoachAction } from '@/lib/actions/roster';
import { idleState } from '@/lib/actions/state';
import { Alert, Card, CardHeader } from '@/components/ui/primitives';
import { Input, SubmitButton } from '@/components/ui/form';

/** Vinculación por código de entrenador (§5). */
export function JoinCoachForm({ defaultCode = '' }: { defaultCode?: string }) {
  const [state, formAction] = useActionState(joinCoachAction, idleState);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-volt-500" />
            Unirte a un entrenador
          </span>
        }
        subtitle="Introduce el código que te haya facilitado."
      />
      <form action={formAction} className="space-y-3">
        <Input
          name="coachCode"
          required
          defaultValue={defaultCode}
          placeholder="LORD-A7K29"
          className="text-center text-lg uppercase tracking-widest"
          autoComplete="off"
        />
        {state.status === 'error' ? <Alert>{state.message}</Alert> : null}
        {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}
        <SubmitButton size="lg" className="w-full" pendingLabel="Enviando…">
          Enviar solicitud
        </SubmitButton>
      </form>
    </Card>
  );
}
