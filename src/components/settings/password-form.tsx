'use client';

import { useActionState } from 'react';
import { changePasswordAction } from '@/lib/actions/auth';
import { idleState } from '@/lib/actions/state';
import { Input, SubmitButton } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <Input
        label="Contraseña actual"
        name="current"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.current}
      />
      <Input
        label="Nueva contraseña"
        name="next"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.next}
      />
      <Input
        label="Repite la nueva contraseña"
        name="repeat"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.repeat}
      />
      {state.status === 'error' && !state.fieldErrors ? <Alert>{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}
      <SubmitButton size="sm" pendingLabel="Cambiando…">
        Cambiar contraseña
      </SubmitButton>
    </form>
  );
}
