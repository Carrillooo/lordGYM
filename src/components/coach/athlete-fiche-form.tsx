'use client';

import { useActionState } from 'react';
import type { AthleteRow } from '@/types/db';
import { updateAthleteProfileAction } from '@/lib/actions/roster';
import { idleState } from '@/lib/actions/state';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Input, Select, SubmitButton, Textarea } from '@/components/ui/form';

/** Ficha deportiva (§9). La usan tanto el entrenador como el propio jugador. */
export function AthleteFicheForm({ athlete, coachId }: { athlete: AthleteRow; coachId?: string }) {
  const [state, formAction] = useActionState(updateAthleteProfileAction, idleState);

  return (
    <Card>
      <CardHeader title="Ficha deportiva" subtitle="Datos usados en informes y comparativas." />
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="athleteId" value={athlete.id} />
        {coachId ? <input type="hidden" name="coachId" value={coachId} /> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Deporte" name="sport" defaultValue={athlete.sport ?? ''} placeholder="Hockey patines" />
          <Input label="Posición" name="position" defaultValue={athlete.position ?? ''} placeholder="Jugador" />
          <Input label="Equipo" name="teamName" defaultValue={athlete.team_name ?? ''} placeholder="Juvenil A" />
          <Select label="Lateralidad" name="laterality" defaultValue={athlete.laterality ?? ''}>
            <option value="">Sin especificar</option>
            <option value="diestro">Diestro</option>
            <option value="zurdo">Zurdo</option>
            <option value="ambidiestro">Ambidiestro</option>
          </Select>
          <Input
            label="Altura (cm)"
            name="heightCm"
            type="number"
            inputMode="numeric"
            step="0.5"
            defaultValue={athlete.height_cm ?? ''}
          />
          <Input
            label="Peso (kg)"
            name="weightKg"
            type="number"
            inputMode="decimal"
            step="0.1"
            defaultValue={athlete.weight_kg ?? ''}
          />
        </div>

        <Textarea label="Objetivos" name="goals" defaultValue={athlete.goals ?? ''} />
        <Textarea label="Lesiones" name="injuries" defaultValue={athlete.injuries ?? ''} />
        <Textarea label="Observaciones" name="notes" defaultValue={athlete.notes ?? ''} />

        {state.status !== 'idle' && state.message ? (
          <p className={state.status === 'error' ? 'text-sm text-danger-500' : 'text-sm text-success-500'}>
            {state.message}
          </p>
        ) : null}

        <SubmitButton size="sm" pendingLabel="Guardando…">
          Guardar ficha
        </SubmitButton>
      </form>
    </Card>
  );
}
