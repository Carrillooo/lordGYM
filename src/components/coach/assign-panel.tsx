'use client';

import { useActionState, useState } from 'react';
import { CalendarPlus, Check, Users } from 'lucide-react';
import { assignWorkoutAction } from '@/lib/actions/workouts';
import { idleState } from '@/lib/actions/state';
import { Card, CardHeader, Alert } from '@/components/ui/primitives';
import { Input, SubmitButton, Textarea } from '@/components/ui/form';
import { cn } from '@/lib/cn';

export interface AssignableAthlete {
  id: string;
  name: string;
  team: string | null;
}

/** Asignación de una sesión a uno, varios jugadores o todo el equipo (§32). */
export function AssignPanel({
  workoutId,
  workoutName,
  athletes,
  defaultDate,
}: {
  workoutId: string;
  workoutName: string;
  athletes: AssignableAthlete[];
  defaultDate: string;
}) {
  const [state, formAction] = useActionState(assignWorkoutAction, idleState);
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  const allSelected = selected.length === athletes.length && athletes.length > 0;

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-volt-500" />
            Asignar sesión
          </span>
        }
        subtitle={workoutName}
      />

      {athletes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-ink-500">
          Necesitas al menos un jugador vinculado para asignar entrenamientos.
        </p>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="workoutId" value={workoutId} />
          {selected.map((id) => (
            <input key={id} type="hidden" name="athleteIds" value={id} />
          ))}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-ink-400">Jugadores</span>
              <button
                type="button"
                onClick={() => setSelected(allSelected ? [] : athletes.map((athlete) => athlete.id))}
                className="inline-flex items-center gap-1 text-xs font-medium text-volt-500 hover:underline"
              >
                <Users className="h-3 w-3" />
                {allSelected ? 'Quitar todos' : 'Todo el equipo'}
              </button>
            </div>
            <ul className="max-h-52 space-y-1 overflow-y-auto">
              {athletes.map((athlete) => {
                const checked = selected.includes(athlete.id);
                return (
                  <li key={athlete.id}>
                    <button
                      type="button"
                      onClick={() => toggle(athlete.id)}
                      aria-pressed={checked}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        checked
                          ? 'border-volt-500/40 bg-volt-500/10 text-ink-50'
                          : 'border-ink-800 bg-ink-900/40 text-ink-300 hover:border-ink-600',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          checked ? 'border-volt-500 bg-volt-500 text-ink-950' : 'border-ink-600',
                        )}
                      >
                        {checked ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{athlete.name}</span>
                      {athlete.team ? <span className="shrink-0 text-xs text-ink-500">{athlete.team}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" name="scheduledDate" type="date" defaultValue={defaultDate} required />
            <Input label="Hora (opcional)" name="scheduledTime" type="time" />
          </div>

          <Textarea label="Nota para el jugador" name="notes" rows={2} placeholder="Ej. Calienta bien el hombro." />

          {state.status === 'error' ? <Alert>{state.message}</Alert> : null}
          {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

          <SubmitButton className="w-full" disabled={selected.length === 0} pendingLabel="Asignando…">
            Asignar a {selected.length || 'ningún'} jugador{selected.length === 1 ? '' : 'es'}
          </SubmitButton>
        </form>
      )}
    </Card>
  );
}
