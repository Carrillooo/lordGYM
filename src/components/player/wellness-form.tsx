'use client';

import { useActionState, useState } from 'react';
import { HeartPulse } from 'lucide-react';
import type { WellnessLogRow } from '@/types/db';
import { saveWellnessAction } from '@/lib/actions/player';
import { idleState } from '@/lib/actions/state';
import { Alert, Card, CardHeader } from '@/components/ui/primitives';
import { OptionGroup, SubmitButton } from '@/components/ui/form';

const SCALES: { name: string; label: string; hint: string }[] = [
  { name: 'sleep', label: 'Sueño', hint: '1 = muy mal · 5 = excelente' },
  { name: 'energy', label: 'Energía', hint: '1 = agotado · 5 = pletórico' },
  { name: 'stress', label: 'Estrés', hint: '1 = tranquilo · 5 = muy estresado' },
  { name: 'fatigue', label: 'Fatiga', hint: '1 = fresco · 5 = muy fatigado' },
  { name: 'soreness', label: 'Dolor muscular', hint: '1 = ninguno · 5 = mucho' },
  { name: 'motivation', label: 'Motivación', hint: '1 = baja · 5 = alta' },
];

/** Check-in diario de bienestar (§24). */
export function WellnessForm({ today, existing }: { today: string; existing: WellnessLogRow | null }) {
  const [state, formAction] = useActionState(saveWellnessAction, idleState);
  const [values, setValues] = useState<Record<string, number>>({
    sleep: existing?.sleep ?? 3,
    energy: existing?.energy ?? 3,
    stress: existing?.stress ?? 2,
    fatigue: existing?.fatigue ?? 2,
    soreness: existing?.soreness ?? 2,
    motivation: existing?.motivation ?? 4,
  });

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-teal-glow" />
            Check-in diario
          </span>
        }
        subtitle={existing ? 'Ya lo has enviado hoy. Puedes actualizarlo.' : 'Menos de un minuto.'}
      />

      <form action={formAction} className="space-y-5">
        <input type="hidden" name="date" value={today} />
        {SCALES.map((scale) => (
          <div key={scale.name}>
            <input type="hidden" name={scale.name} value={values[scale.name]} />
            <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{scale.label}</p>
            <p className="mb-2 text-xs text-ink-500">{scale.hint}</p>
            <OptionGroup
              options={[1, 2, 3, 4, 5].map((value) => ({ value, label: value }))}
              value={values[scale.name]}
              onChange={(value) => setValues((current) => ({ ...current, [scale.name]: value }))}
              name={scale.label}
            />
          </div>
        ))}

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-400">Comentario</span>
          <textarea
            name="note"
            rows={2}
            defaultValue={existing?.note ?? ''}
            placeholder="Algo que deba saber tu entrenador."
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-ink-50 placeholder:text-ink-500 focus:border-volt-500 focus:outline-none"
          />
        </label>

        {state.status === 'error' ? <Alert>{state.message}</Alert> : null}
        {state.status === 'success' ? <Alert tone="success">{state.message}</Alert> : null}

        <SubmitButton size="lg" className="w-full" pendingLabel="Guardando…">
          {existing ? 'Actualizar check-in' : 'Enviar check-in'}
        </SubmitButton>
      </form>
    </Card>
  );
}
