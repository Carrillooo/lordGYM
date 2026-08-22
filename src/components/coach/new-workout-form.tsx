'use client';

import { useActionState } from 'react';
import { ArrowRight } from 'lucide-react';
import { createWorkoutAction } from '@/lib/actions/workouts';
import { idleState } from '@/lib/actions/state';
import { Input, Select, SubmitButton, Textarea } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';

export function NewWorkoutForm() {
  const [state, formAction] = useActionState(createWorkoutAction, idleState);

  return (
    <form action={formAction} className="space-y-4">
      <Input
        label="Nombre de la sesión"
        name="name"
        required
        autoFocus
        placeholder="FUERZA TREN SUPERIOR A"
        error={state.fieldErrors?.name}
        className="uppercase"
      />
      <Textarea label="Descripción" name="description" placeholder="Qué se trabaja y con qué intención." />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Objetivo" name="goal" placeholder="Fuerza máxima" />
        <Input label="Categoría" name="category" placeholder="Fuerza" />
        <Input
          label="Duración estimada (min)"
          name="estimatedMinutes"
          type="number"
          inputMode="numeric"
          min={5}
          max={240}
          placeholder="60"
        />
        <Select label="Nivel" name="level" defaultValue="intermedio">
          <option value="iniciacion">Iniciación</option>
          <option value="intermedio">Intermedio</option>
          <option value="avanzado">Avanzado</option>
        </Select>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-300">
        <input
          type="checkbox"
          name="isTemplate"
          defaultChecked
          className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-[var(--color-volt-500)]"
        />
        Guardar como plantilla reutilizable
      </label>

      {state.status === 'error' ? <Alert>{state.message}</Alert> : null}

      <SubmitButton size="lg" className="w-full" pendingLabel="Creando…">
        Continuar y añadir ejercicios
        <ArrowRight className="h-4 w-4" />
      </SubmitButton>
    </form>
  );
}
