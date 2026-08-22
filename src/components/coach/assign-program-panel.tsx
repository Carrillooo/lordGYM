'use client';

import { useActionState, useState } from 'react';
import { CalendarRange, Check } from 'lucide-react';
import { assignProgramAction } from '@/lib/actions/programs';
import { idleState } from '@/lib/actions/state';
import { Alert, Card, CardHeader } from '@/components/ui/primitives';
import { Input, SubmitButton } from '@/components/ui/form';
import { cn } from '@/lib/cn';

export function AssignProgramPanel({
  programId,
  programName,
  athletes,
  defaultStart,
}: {
  programId: string;
  programName: string;
  athletes: { id: string; name: string }[];
  defaultStart: string;
}) {
  const [state, formAction] = useActionState(assignProgramAction, idleState);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-volt-500" />
            Asignar programa
          </span>
        }
        subtitle={`${programName} · se vuelca al calendario desde el lunes elegido`}
      />

      {athletes.length === 0 ? (
        <p className="text-sm text-ink-500">Necesitas jugadores vinculados para asignar el programa.</p>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="programId" value={programId} />
          {selected.map((id) => (
            <input key={id} type="hidden" name="athleteIds" value={id} />
          ))}

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-400">Jugadores</span>
            <button
              type="button"
              onClick={() =>
                setSelected(selected.length === athletes.length ? [] : athletes.map((athlete) => athlete.id))
              }
              className="text-xs font-medium text-volt-500 hover:underline"
            >
              {selected.length === athletes.length ? 'Quitar todos' : 'Todo el equipo'}
            </button>
          </div>

          <ul className="max-h-52 space-y-1 overflow-y-auto">
            {athletes.map((athlete) => {
              const checked = selected.includes(athlete.id);
              return (
                <li key={athlete.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected((current) =>
                        current.includes(athlete.id)
                          ? current.filter((value) => value !== athlete.id)
                          : [...current, athlete.id],
                      )
                    }
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
                    {athlete.name}
                  </button>
                </li>
              );
            })}
          </ul>

          <Input label="Lunes de inicio" name="startDate" type="date" defaultValue={defaultStart} required />

          {state.status === 'error' ? <Alert>{state.message}</Alert> : null}
          {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

          <SubmitButton className="w-full" disabled={selected.length === 0} pendingLabel="Asignando…">
            Volcar al calendario
          </SubmitButton>
        </form>
      )}
    </Card>
  );
}
