'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloudOff, Loader2, Trophy } from 'lucide-react';
import { finishSessionAction } from '@/lib/actions/player';
import { enqueueFinish } from '@/lib/offline/outbox';
import { flushOutbox } from '@/lib/offline/sync';
import type { FinishSummary } from '@/lib/services/sessions';
import { FEELING_LABELS, formatNumber } from '@/lib/domain/labels';
import { formatDuration } from '@/lib/domain/datetime';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { OptionGroup } from '@/components/ui/form';
import { Alert } from '@/components/ui/primitives';

/**
 * Cierre de la sesión (§23): resumen, RPE de sesión, sensaciones y comentario.
 *
 * Sólo se muestra «Entrenamiento completado» cuando el servidor confirma. Sin
 * cobertura, el cierre se guarda en el móvil y se dice exactamente eso: que
 * está guardado pero todavía no enviado. Lo que no puede pasar es que alguien
 * termine de entrenar en un sótano y pierda la sesión entera.
 */
export function FinishSheet({
  open,
  onClose,
  sessionId,
  elapsedSeconds,
  onFinished,
  onQueued,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  elapsedSeconds: number;
  onFinished: () => void;
  onQueued: () => void;
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
  const [queued, setQueued] = useState(false);

  async function submit() {
    if (rpe === null || feeling === null || fatigue === null || soreness === null) {
      setError('Completa el RPE y las sensaciones.');
      return;
    }
    const payload = {
      sessionId,
      durationSeconds: elapsedSeconds,
      sessionRpe: rpe,
      feeling,
      fatigue,
      soreness,
      comment: comment.trim() || undefined,
    };

    setSaving(true);
    setError(null);

    // Las series que quedaran pendientes van primero: el servidor calcula el
    // volumen de la sesión con lo que tiene guardado, así que cerrarla antes de
    // enviarlas daría un resumen corto.
    await flushOutbox();

    let result;
    try {
      result = await finishSessionAction(payload);
    } catch {
      // Sin red. Se guarda el cierre y se avisa sin adornos.
      enqueueFinish(payload);
      setSaving(false);
      setQueued(true);
      onQueued();
      return;
    }

    setSaving(false);
    if (result.status !== 'success' || !result.summary) {
      setError(result.message ?? 'No se ha podido cerrar la sesión.');
      return;
    }
    setSummary(result.summary);
    onFinished();
  }

  if (queued) {
    return (
      <Modal open={open} onClose={() => router.push('/player')} title="Entrenamiento guardado en el móvil">
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-amber-glow/30 bg-amber-glow/10 p-4">
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-glow" />
            <div className="text-sm text-ink-200">
              <p className="font-medium text-amber-glow">Todavía no ha llegado a tu entrenador.</p>
              <p className="mt-1 text-ink-300">
                No hay conexión. El entrenamiento está guardado en este móvil y se enviará solo en cuanto
                vuelva la cobertura. No cierres sesión hasta entonces.
              </p>
            </div>
          </div>
          <p className="text-sm text-ink-400">
            El resumen con el volumen y los récords se calcula al enviarlo, así que lo verás luego en tu
            historial.
          </p>
          <Button size="lg" className="w-full" onClick={() => router.push('/player')}>
            Volver al inicio
          </Button>
        </div>
      </Modal>
    );
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
