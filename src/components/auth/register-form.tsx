'use client';

import { useActionState, useState } from 'react';
import { ClipboardList, Dumbbell } from 'lucide-react';
import { registerAction } from '@/lib/actions/auth';
import { idleState } from '@/lib/actions/state';
import { Input, SubmitButton } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { GoogleSignInButton } from './google-sign-in-button';

export function RegisterForm({
  initialRole,
  initialCoachCode,
}: {
  initialRole: 'coach' | 'athlete';
  initialCoachCode: string;
}) {
  const [state, formAction] = useActionState(registerAction, idleState);
  const [role, setRole] = useState<'coach' | 'athlete'>(initialRole);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { value: 'coach' as const, label: 'Entrenador', icon: <ClipboardList className="h-5 w-5" /> },
            { value: 'athlete' as const, label: 'Jugador', icon: <Dumbbell className="h-5 w-5" /> },
          ]
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setRole(option.value)}
            aria-pressed={role === option.value}
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl border p-4 transition-all active:scale-[0.98]',
              role === option.value
                ? 'border-volt-500 bg-volt-500/10 text-volt-500'
                : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600',
            )}
          >
            {option.icon}
            <span className="text-sm font-semibold">{option.label}</span>
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="role" value={role} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" name="firstName" required autoComplete="given-name" error={state.fieldErrors?.firstName} />
          <Input
            label="Apellidos"
            name="lastName"
            required
            autoComplete="family-name"
            error={state.fieldErrors?.lastName}
          />
        </div>

        <Input
          label="Fecha de nacimiento"
          name="birthDate"
          type="date"
          autoComplete="bday"
          error={state.fieldErrors?.birthDate}
        />

        <Input
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="tu@email.com"
          error={state.fieldErrors?.email}
        />

        <Input
          label="Contraseña"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          hint="Mínimo 8 caracteres."
          error={state.fieldErrors?.password}
        />

        <Input
          label="Foto de perfil (URL, opcional)"
          name="avatarUrl"
          type="url"
          placeholder="https://…"
          error={state.fieldErrors?.avatarUrl}
        />

        {role === 'athlete' ? (
          <Input
            label="Código de entrenador (opcional)"
            name="coachCode"
            defaultValue={initialCoachCode}
            placeholder="LORD-A7K29"
            hint="Si lo introduces, enviaremos la solicitud a tu entrenador al terminar."
            error={state.fieldErrors?.coachCode}
            className="uppercase"
          />
        ) : null}

        {state.status === 'error' ? <Alert>{state.message}</Alert> : null}

        <SubmitButton size="lg" className="w-full" pendingLabel="Creando cuenta…">
          Crear cuenta
        </SubmitButton>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-800" />
        <span className="text-xs uppercase tracking-wider text-ink-500">o</span>
        <span className="h-px flex-1 bg-ink-800" />
      </div>

      <GoogleSignInButton role={role} />
    </div>
  );
}
