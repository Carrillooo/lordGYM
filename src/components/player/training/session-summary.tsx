import Link from 'next/link';
import { ArrowLeft, Download, Trophy } from 'lucide-react';
import type { SessionDetail } from '@/lib/services/sessions';
import type { PersonalRecordRow } from '@/types/db';
import { formatDuration, formatLongDate } from '@/lib/domain/datetime';
import { FEELING_LABELS, formatKg, formatNumber } from '@/lib/domain/labels';
import { Badge, Card, CardHeader } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

/**
 * Resumen de una sesión ya cerrada (§23).
 *
 * Es una pantalla, no un modal: así el jugador la ve siempre al terminar
 * —pase lo que pase con la revalidación de la ruta— y puede volver a
 * consultarla más tarde desde el calendario.
 */
export function SessionSummary({
  detail,
  records,
}: {
  detail: SessionDetail;
  records: (PersonalRecordRow & { exerciseName: string })[];
}) {
  const { session } = detail;
  const completedSets = detail.exercises.flatMap((row) => row.sets.filter((set) => set.status === 'completed'));

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-6">
      <Link
        href="/player"
        className="inline-flex items-center gap-2 text-sm text-ink-400 transition-colors hover:text-ink-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Inicio
      </Link>

      <header className="mt-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-volt-500">
          Entrenamiento completado
        </p>
        <h1 className="display mt-2 text-3xl uppercase text-ink-50">{detail.workoutName}</h1>
        <p className="mt-1 text-sm text-ink-400">
          {formatLongDate((session.completed_at ?? session.started_at).slice(0, 10))}
        </p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Tiempo" value={session.duration_seconds ? formatDuration(session.duration_seconds) : '—'} />
        <Tile label="Volumen" value={`${formatNumber(session.total_volume_kg)} kg`} />
        <Tile label="Ejercicios" value={String(detail.exercises.length)} />
        <Tile label="Series" value={String(completedSets.length)} />
        <Tile label="Carga" value={session.training_load_au ? `${session.training_load_au} AU` : '—'} />
        <Tile label="PR" value={String(records.length)} highlight={records.length > 0} />
      </div>

      {records.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-volt-500/35 bg-volt-500/[0.07] p-5 text-center">
          <Trophy className="mx-auto h-9 w-9 text-volt-500" />
          <p className="display mt-2 text-2xl uppercase text-volt-500">
            {records.length === 1 ? 'Nuevo récord' : `${records.length} récords`}
          </p>
          <ul className="mt-3 space-y-1">
            {records.map((record) => (
              <li key={record.id} className="text-sm text-ink-100">
                {record.exerciseName} ·{' '}
                <span className="metric text-ink-50">
                  {record.record_type === 'weight'
                    ? `${formatKg(record.value)}${record.reps ? ` × ${record.reps}` : ''}`
                    : record.record_type === 'reps'
                      ? `${formatNumber(record.value)} reps`
                      : record.record_type === 'distance'
                        ? `${formatNumber(record.value)} m`
                        : formatNumber(record.value, 1)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Card className="mt-4">
        <CardHeader
          title="Cómo ha ido"
          subtitle={
            session.feeling
              ? `Sensación: ${FEELING_LABELS[session.feeling - 1]}`
              : 'Sin valoración registrada'
          }
        />
        <div className="flex flex-wrap gap-2">
          <Badge tone={(session.session_rpe ?? 0) >= 8.5 ? 'warning' : 'neutral'}>
            RPE {session.session_rpe?.toString().replace('.', ',') ?? '—'}
          </Badge>
          <Badge>Fatiga {session.fatigue ?? '—'}/10</Badge>
          <Badge>Dolor muscular {session.soreness ?? '—'}/10</Badge>
        </div>
        {session.comment ? (
          <p className="mt-3 rounded-xl border border-ink-800 bg-ink-900/50 px-3 py-2 text-sm text-ink-300">
            «{session.comment}»
          </p>
        ) : null}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Lo que has hecho" />
        <ul className="divide-y divide-ink-850">
          {detail.exercises.map((row) => {
            const done = row.sets.filter((set) => set.status === 'completed');
            return (
              <li key={row.sessionExercise.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink-100">{row.exercise.name}</span>
                    <span className="tabular block text-xs text-ink-500">
                      {done.length === 0
                        ? 'Sin series completadas'
                        : done
                            .map((set) =>
                              set.actual_weight_kg
                                ? `${set.actual_weight_kg} kg × ${set.actual_reps ?? '—'}`
                                : set.actual_reps
                                  ? `${set.actual_reps} ${set.actual_reps === 1 ? 'rep' : 'reps'}`
                                  : set.actual_duration_seconds
                                    ? `${set.actual_duration_seconds}s`
                                    : set.actual_distance_m
                                      ? `${set.actual_distance_m} m`
                                      : '—',
                            )
                            .join(' · ')}
                    </span>
                  </span>
                  <Badge tone={done.length === row.sets.length ? 'success' : 'neutral'}>
                    {done.length}/{row.sets.length}
                  </Badge>
                </div>
                {row.sessionExercise.athlete_comment ? (
                  <p className="mt-1.5 text-xs text-ink-400">«{row.sessionExercise.athlete_comment}»</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <ButtonLink href="/player" size="lg" className="w-full">
          Volver al inicio
        </ButtonLink>
        <ButtonLink href="/player/progress" variant="secondary" size="lg" className="w-full">
          Ver mi progreso
        </ButtonLink>
        <a
          href={`/player/workout/${detail.session.id}/pdf`}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-ink-700 text-sm font-medium text-ink-300 transition-colors active:bg-ink-800 sm:col-span-2"
        >
          <Download className="h-4 w-4" />
          Descargar esta sesión en PDF
        </a>
      </div>
    </div>
  );
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="card p-3 text-center">
      <p className={highlight ? 'metric text-2xl text-volt-500' : 'metric text-2xl text-ink-50'}>{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-500">{label}</p>
    </div>
  );
}
