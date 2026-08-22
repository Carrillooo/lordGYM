'use client';

import { useActionState, useState } from 'react';
import { Check, Users } from 'lucide-react';
import { createTeamAction, setTeamMembersAction } from '@/lib/actions/roster';
import { idleState } from '@/lib/actions/state';
import { Alert, Card, CardHeader } from '@/components/ui/primitives';
import { Input, SubmitButton } from '@/components/ui/form';
import { cn } from '@/lib/cn';

/** Gestión de equipos (§54): agrupa jugadores para asignar por bloque. */
export function TeamsPanel({
  teams,
  athletes,
}: {
  teams: { id: string; name: string; athleteIds: string[] }[];
  athletes: { id: string; name: string }[];
}) {
  const [createState, createAction] = useActionState(createTeamAction, idleState);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader title="Equipos" subtitle="Selecciona los jugadores de cada equipo y guarda." />
        {teams.length === 0 ? (
          <p className="text-sm text-ink-500">Todavía no hay equipos.</p>
        ) : (
          <ul className="space-y-4">
            {teams.map((team) => (
              <li key={team.id}>
                <TeamRow team={team} athletes={athletes} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-volt-500" />
              Nuevo equipo
            </span>
          }
        />
        <form action={createAction} className="space-y-3">
          <Input label="Nombre" name="name" required placeholder="Juvenil A" />
          <Input label="Deporte" name="sport" placeholder="Hockey patines" />
          <Input label="Categoría" name="category" placeholder="Juvenil" />
          {createState.status === 'error' ? <Alert>{createState.message}</Alert> : null}
          {createState.status === 'success' ? <Alert tone="success">{createState.message}</Alert> : null}
          <SubmitButton className="w-full" pendingLabel="Creando…">
            Crear equipo
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}

function TeamRow({
  team,
  athletes,
}: {
  team: { id: string; name: string; athleteIds: string[] };
  athletes: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(setTeamMembersAction, idleState);
  const [selected, setSelected] = useState<string[]>(team.athleteIds);

  return (
    <form action={formAction} className="rounded-xl border border-ink-800 bg-ink-900/40 p-3">
      <input type="hidden" name="teamId" value={team.id} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="athleteIds" value={id} />
      ))}

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-medium text-ink-50">{team.name}</p>
        <span className="text-xs text-ink-500">{selected.length} jugador(es)</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {athletes.map((athlete) => {
          const checked = selected.includes(athlete.id);
          return (
            <button
              key={athlete.id}
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
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                checked
                  ? 'border-volt-500 bg-volt-500/12 text-volt-500'
                  : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600',
              )}
            >
              {checked ? <Check className="h-3 w-3" /> : null}
              {athlete.name}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <SubmitButton size="sm" variant="secondary" pendingLabel="Guardando…">
          Guardar equipo
        </SubmitButton>
        {state.status !== 'idle' && state.message ? (
          <span className={state.status === 'error' ? 'text-xs text-danger-500' : 'text-xs text-success-500'}>
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
