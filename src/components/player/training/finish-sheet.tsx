'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trophy } from 'lucide-react';
import { finishSessionAction } from '@/lib/actions/player';
import type { FinishSummary } from '@/lib/services/sessions';
import { FEELING_LABELS, formatNumber } from '@/lib/domain/labels';
import { formatDuration } from '@/lib/domain/datetime';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { OptionGroup } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';

/**
 * Cierre de la sesión (§23): resumen, RPE de sesión, sensaciones y comentario.
 * Sólo se muestra «Entrenamiento completado» cuando el servidor confirma.
 */
export function FinishSheet({
  open,
  onClose,
  sessionId,
  elapsedSeconds,
  onFinished,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  elapsedSeconds: number;
  onFinished: () => void;
}) {
  const router = useRouter();
  const [rpe, setRpe] = useState<number | null>(7);
  const [feeling, setFeeling] = useState<number | null>(4);
  const [fatigue, setFatigue] = useState<number | null>(5);
  const [soreness, setSoreness] = useState<number | null>(3);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinishSummary | null>(null);

  async function submit() {
    if (rpe === null || feeling === null || fatigue === null || soreness === null) {
      setError('Completa el RPE y las sensaciones.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await finishSessionAction({
      sessionId,
      durationSeconds: elapsedSeconds,
      sessionRpe: rpe,
      feeling,
      fatigue,
      soreness,
      comment: comment.trim() || undefined,
    });
    setSaving(false);
    if (result.status !== 'success' || !result.summary) {
      setError(result.message ?? 'No se ha podido cerrar la sesión.');
      return;
    }
    setSummary(result.summary);
    onFinished();
  }

  if (summary) {
    return (
      <Modal open={open} onClose={() => router.push('/player')} title="Entrenamiento completado">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryTile label="Tiempo" value={formatDuration(summary.durationSeconds)} />
            <SummaryTile label="Volumen" value={`${formatNumber(summary.volumeKg)} kg`} />
            <SummaryTile label="Ejercicios" value={String(summary.exerciseCount)} />
            <SummaryTile label="Series" value={String(summary.setCount)} />
            <SummaryTile label="Carga" value={summary.loadAu === null ? '—' : `${summary.loadAu} AU`} />
            <SummaryTile label="PR" value={String(summary.newRecords.length)} highlight={summary.newRecords.length > 0} />
          </div>

          {summary.newRecords.length > 0 ? (
            <div className="rounded-2xl border border-volt-500/35 bg-volt-500/[0.07] p-4 text-center">
              <Trophy className="mx-auto h-8 w-8 text-volt-500" />
              <p className="display mt-2 text-xl uppercase text-volt-500">
                {summary.newRecords.length === 1 ? 'Nuevo récord' : `${summary.newRecords.length} récords`}
              </p>
              <ul className="mt-2 space-y-1">
                {summary.newRecords.map((record, index) => (
                  <li key={index} className="text-sm text-ink-100">
                    {record.exerciseName} ·{' '}
                    <span className="metric text-ink-50">
                      {record.recordType === 'weight'
                        ? `${record.value} kg${record.reps ? ` × ${record.reps}` : ''}`
                        : record.recordType === 'reps'
                          ? `${record.value} reps`
                          : `${record.value}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button size="lg" className="w-full" onClick={() => router.push('/player')}>
            Volver al inicio
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Terminar entrenamiento"
      description="Cuéntanos cómo ha ido: esto ajusta la carga de las próximas sesiones."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Seguir entrenando
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              'Finalizar'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Field label="RPE de la sesión" hint="1 = muy suave · 10 = máximo esfuerzo">
          <OptionGroup
            options={Array.from({ length: 10 }, (_, index) => ({ value: index + 1, label: index + 1 }))}
            value={rpe}
            onChange={setRpe}
            name="RPE de la sesión"
            size="sm"
          />
        </Field>

        <Field label="¿Cómo te has sentido?">
          <OptionGroup
            options={FEELING_LABELS.map((label, index) => ({ value: index + 1, label }))}
            value={feeling}
            onChange={setFeeling}
            name="Sensaciones"
            size="sm"
          />
        </Field>

        <Field label="Fatiga" hint="1 = fresco · 10 = agotado">
          <OptionGroup
            options={Array.from({ length: 10 }, (_, index) => ({ value: index + 1, label: index + 1 }))}
            value={fatigue}
            onChange={setFatigue}
            name="Fatiga"
            size="sm"
          />
        </Field>

        <Field label="Dolor muscular" hint="1 = ninguno · 10 = muy alto">
          <OptionGroup
            options={Array.from({ length: 10 }, (_, index) => ({ value: index + 1, label: index + 1 }))}
            value={soreness}
            onChange={setSoreness}
            name="Dolor muscular"
            size="sm"
          />
        </Field>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-400">Comentario</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder="Ej. la última serie de press me ha costado mucho."
            className="w-full rounded-xl border border-ink-700 bg-ink-900 px-3.5 py-2.5 text-ink-50 placeholder:text-ink-500 focus:border-volt-500 focus:outline-none"
          />
        </label>

        {error ? <Alert>{error}</Alert> : null}
      </div>
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</p>
      {hint ? <p className="mb-2 text-xs text-ink-500">{hint}</p> : <div className="mb-2" />}
      {children}
    </div>
  );
}

function SummaryTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/60 p-3 text-center">
      <p className={highlight ? 'metric text-2xl text-volt-500' : 'metric text-2xl text-ink-50'}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
    </div>
  );
}
