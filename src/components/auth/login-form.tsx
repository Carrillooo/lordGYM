'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/actions/auth';
import { idleState } from '@/lib/actions/state';
import { Input, SubmitButton } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';
import { GoogleSignInButton } from './google-sign-in-button';

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, idleState);

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="tu@email.com"
          error={state.fieldErrors?.email}
        />
        <Input
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          error={state.fieldErrors?.password}
        />

        {state.status === 'error' && !state.fieldErrors ? <Alert>{state.message}</Alert> : null}

        <SubmitButton size="lg" className="w-full" pendingLabel="Entrando…">
          Iniciar sesión
        </SubmitButton>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-800" />
        <span className="text-xs uppercase tracking-wider text-ink-500">o</span>
        <span className="h-px flex-1 bg-ink-800" />
      </div>

      <GoogleSignInButton />
    </div>
  );
}
