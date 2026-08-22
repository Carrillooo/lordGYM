'use client';

import { useActionState, useState } from 'react';
import { Activity } from 'lucide-react';
import type { PainLogRow } from '@/types/db';
import { savePainAction } from '@/lib/actions/player';
import { idleState } from '@/lib/actions/state';
import { formatShortDate } from '@/lib/domain/datetime';
import { Alert, Badge, Card, CardHeader } from '@/components/ui/primitives';
import { OptionGroup, SubmitButton } from '@/components/ui/form';
import { BodyMap, BODY_ZONES, type BodyZone } from './body-map';

/** Mapa de dolor con registro de intensidad 1–10 (§25). */
export function PainForm({ today, history }: { today: string; history: PainLogRow[] }) {
  const [state, formAction] = useActionState(savePainAction, idleState);
  const [zone, setZone] = useState<BodyZone | null>(null);
  const [intensity, setIntensity] = useState<number>(4);

  // Última intensidad registrada por zona, para colorear la silueta.
  const marked = history.reduce<Record<string, number>>((acc, log) => {
    const match = BODY_ZONES.find((item) => item.label === log.body_part && item.side === log.side);
    if (match && acc[match.id] === undefined) acc[match.id] = log.intensity;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-danger-500" />
            Mapa de dolor
          </span>
        }
        subtitle="Toca la zona donde notes molestia y marca la intensidad."
      />

      <BodyMap selectedId={zone?.id ?? null} onSelect={setZone} marked={marked} />

      <form action={formAction} className="mt-5 space-y-4">
        <input type="hidden" name="date" value={today} />
        <input type="hidden" name="bodyPart" value={zone?.label ?? ''} />
        <input type="hidden" name="side" value={zone?.side ?? 'central'} />
        <input type="hidden" name="intensity" value={intensity} />

        <p className="text-sm text-ink-300">
          {zone ? (
            <>
              Zona seleccionada: <span className="font-medium text-ink-50">{zone.label}</span>
              {zone.side !== 'central' ? ` (${zone.side})` : ''}
            </>
          ) : (
            'Selecciona una zona en la silueta.'
          )}
        </p>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-400">Intensidad (1–10)</p>
          <OptionGroup
            options={Array.from({ length: 10 }, (_, index) => ({ value: index + 1, label: index + 1 }))}
            value={intensity}
            onChange={setIntensity}
            name="Intensidad del dolor"
            size="sm"
          />
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-400">Comentario</span>
          <input
            name="note"
            placeholder="Ej. molestia al frenar."
            className="h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3.5 text-ink-50 placeholder:text-ink-500 focus:border-volt-500 focus:outline-none"
          />
        </label>

        {state.status === 'error' ? <Alert>{state.message}</Alert> : null}
        {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

        <SubmitButton className="w-full" disabled={!zone} pendingLabel="Guardando…">
          Registrar molestia
        </SubmitButton>
      </form>

      {history.length > 0 ? (
        <ul className="mt-5 space-y-2">
          {history.slice(0, 5).map((log) => (
            <li
              key={log.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2 text-sm"
            >
              <span className="text-ink-200">
                {log.body_part}
                {log.side !== 'central' ? ` · ${log.side}` : ''}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-ink-500">{formatShortDate(log.date)}</span>
                <Badge tone={log.intensity >= 7 ? 'danger' : log.intensity >= 4 ? 'warning' : 'neutral'}>
                  {log.intensity}/10
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
