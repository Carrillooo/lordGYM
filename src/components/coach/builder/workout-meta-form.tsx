'use client';

import { useActionState } from 'react';
import type { WorkoutRow } from '@/types/db';
import { updateWorkoutMetaAction } from '@/lib/actions/workouts';
import { idleState } from '@/lib/actions/state';
import { Input, Select, SubmitButton, Textarea } from '@/components/ui/form';

export function WorkoutMetaForm({ workout }: { workout: WorkoutRow }) {
  const [state, formAction] = useActionState(updateWorkoutMetaAction, idleState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="workoutId" value={workout.id} />
      <Input label="Nombre" name="name" defaultValue={workout.name} required className="uppercase" />
      <Textarea label="Descripción" name="description" defaultValue={workout.description ?? ''} rows={2} />
      <Input label="Objetivo" name="goal" defaultValue={workout.goal ?? ''} />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Duración (min)"
          name="estimatedMinutes"
          type="number"
          inputMode="numeric"
          defaultValue={workout.estimated_minutes ?? ''}
        />
        <Input label="Categoría" name="category" defaultValue={workout.category ?? ''} />
      </div>
      <Select label="Nivel" name="level" defaultValue={workout.level ?? 'intermedio'}>
        <option value="iniciacion">Iniciación</option>
        <option value="intermedio">Intermedio</option>
        <option value="avanzado">Avanzado</option>
      </Select>
      <label className="flex items-center gap-2 text-sm text-ink-300">
        <input
          type="checkbox"
          name="isTemplate"
          defaultChecked={workout.is_template}
          className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-[var(--color-volt-500)]"
        />
        Plantilla reutilizable
      </label>

      {state.status !== 'idle' && state.message ? (
        <p className={state.status === 'error' ? 'text-xs text-danger-500' : 'text-xs text-success-500'}>
          {state.status === 'success' ? '✓ Guardado' : state.message}
        </p>
      ) : null}

      <SubmitButton size="sm" variant="secondary" pendingLabel="Guardando…">
        Actualizar
      </SubmitButton>
    </form>
  );
}
