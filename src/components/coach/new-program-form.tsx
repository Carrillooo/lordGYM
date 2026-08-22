'use client';

import { useActionState } from 'react';
import { createProgramAction } from '@/lib/actions/programs';
import { idleState } from '@/lib/actions/state';
import { CardHeader, Alert } from '@/components/ui/primitives';
import { Input, SubmitButton, Textarea } from '@/components/ui/form';

export function NewProgramForm() {
  const [state, formAction] = useActionState(createProgramAction, idleState);

  return (
    <>
      <CardHeader title="Nuevo programa" subtitle="Se crean las semanas vacías y luego colocas las sesiones." />
      <form action={formAction} className="space-y-3">
        <Input label="Nombre" name="name" required placeholder="PRETEMPORADA 2026" className="uppercase" />
        <Textarea label="Descripción" name="description" rows={2} placeholder="Acumulación, intensificación, puesta a punto." />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Semanas" name="weeksCount" type="number" inputMode="numeric" min={1} max={52} defaultValue={8} />
          <Input label="Inicio previsto" name="startDate" type="date" />
        </div>
        {state.status === 'error' ? <Alert>{state.message}</Alert> : null}
        <SubmitButton className="w-full" pendingLabel="Creando…">
          Crear programa
        </SubmitButton>
      </form>
    </>
  );
}
