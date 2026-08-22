'use client';

import { useActionState } from 'react';
import type { ProfileRow } from '@/types/db';
import { updateAccountAction } from '@/lib/actions/roster';
import { idleState } from '@/lib/actions/state';
import { Input, SubmitButton } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';

export function AccountForm({ profile }: { profile: ProfileRow }) {
  const [state, formAction] = useActionState(updateAccountAction, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="profileId" value={profile.id} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Nombre" name="firstName" defaultValue={profile.first_name} required />
        <Input label="Apellidos" name="lastName" defaultValue={profile.last_name} required />
      </div>
      <Input label="Fecha de nacimiento" name="birthDate" type="date" defaultValue={profile.birth_date ?? ''} />
      <Input
        label="Foto de perfil (URL)"
        name="avatarUrl"
        type="url"
        defaultValue={profile.avatar_url ?? ''}
        placeholder="https://…"
      />
      {state.status === 'error' ? <Alert>{state.message}</Alert> : null}
      {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}
      <SubmitButton size="sm" pendingLabel="Guardando…">
        Guardar cambios
      </SubmitButton>
    </form>
  );
}
