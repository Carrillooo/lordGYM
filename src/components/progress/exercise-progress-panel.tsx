import { Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import {
  compareLastTwo,
  exerciseHistory,
  pickMetric,
  progressionSuggestion,
  trainedExercises,
} from '@/lib/services/progress';
import {
  EXERCISE_METRICS,
  EXERCISE_METRIC_LABELS,
  EXERCISE_METRIC_UNITS,
  type ExerciseMetric,
} from '@/lib/domain/exercise-metrics';
import { formatShortDate } from '@/lib/domain/datetime';
import { formatNumber, formatSigned } from '@/lib/domain/labels';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';
import { TrendChart } from '@/components/charts/charts';
import { ExercisePicker, MetricTabs } from './selectors';

/**
 * Gráfica de progresión por ejercicio (§11, §71, §72).
 * El ejercicio y la métrica viajan en la URL para que la vista sea compartible
 * y funcione sin JavaScript.
 */
export async function ExerciseProgressPanel({
  athleteId,
  exerciseId,
  metric,
  title = 'Progresión por ejercicio',
  showSuggestion = false,
}: {
  athleteId: string;
  exerciseId?: string;
  metric?: string;
  title?: string;
  /** Sólo el entrenador ve la sugerencia de progresión (§69). */
  showSuggestion?: boolean;
}) {
  const exercises = await trainedExercises(athleteId);
  if (exercises.length === 0) {
    return (
      <EmptyState
        title="Sin histórico todavía"
        description="En cuanto complete su primera sesión aparecerá aquí la evolución de cada ejercicio."
      />
    );
  }

  const selected = exercises.find((exercise) => exercise.id === exerciseId) ?? exercises[0];
  const selectedMetric: ExerciseMetric = EXERCISE_METRICS.includes(metric as ExerciseMetric)
    ? (metric as ExerciseMetric)
    : 'max_weight';

  const history = await exerciseHistory(athleteId, selected.id);
  const comparison = compareLastTwo(history, selectedMetric);
  const suggestion = showSuggestion ? await progressionSuggestion(athleteId, selected.id) : null;
  const unit = EXERCISE_METRIC_UNITS[selectedMetric];
  const latest = history.length > 0 ? pickMetric(history[history.length - 1], selectedMetric) : null;

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={selected.name}
        action={<ExercisePicker exercises={exercises} selectedId={selected.id} />}
      />

      <MetricTabs selected={selectedMetric} />

      <div className="mt-4 flex flex-wrap items-end gap-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-400">{EXERCISE_METRIC_LABELS[selectedMetric]}</p>
          <p className="metric mt-1 text-4xl text-ink-50">
            {formatNumber(latest, 1)}
            {unit ? <span className="ml-1 text-lg font-medium text-ink-400">{unit}</span> : null}
          </p>
        </div>

        {comparison ? (
          <div className="pb-1.5">
            <p className="text-xs text-ink-400">
              Anterior {formatNumber(comparison.previous, 1)} {unit} → actual {formatNumber(comparison.current, 1)} {unit}
            </p>
            <p
              className={
                comparison.changePercent >= 0
                  ? 'mt-0.5 flex items-center gap-1 text-sm font-semibold text-success-500'
                  : 'mt-0.5 flex items-center gap-1 text-sm font-semibold text-danger-500'
              }
            >
              {comparison.changePercent >= 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {formatSigned(comparison.changePercent)}
            </p>
          </div>
        ) : null}
      </div>

      <TrendChart
        className="mt-4"
        data={history.map((point) => ({ date: point.date, value: pickMetric(point, selectedMetric) }))}
        unit={unit}
        color={selectedMetric === 'rpe' ? 'amber' : selectedMetric === 'volume' ? 'data' : 'volt'}
        height={230}
      />

      {suggestion ? (
        <div
          className={
            suggestion.shouldIncrease
              ? 'mt-4 flex items-start gap-2.5 rounded-xl border border-volt-500/30 bg-volt-500/[0.06] px-3 py-2.5'
              : 'mt-4 flex items-start gap-2.5 rounded-xl border border-ink-800 bg-ink-900/50 px-3 py-2.5'
          }
        >
          <Lightbulb
            className={suggestion.shouldIncrease ? 'mt-0.5 h-4 w-4 shrink-0 text-volt-500' : 'mt-0.5 h-4 w-4 shrink-0 text-ink-500'}
          />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-ink-100">
              {suggestion.shouldIncrease
                ? `Sugerencia: subir a ${formatNumber(suggestion.suggestedWeightKg, 1)} kg`
                : 'Sugerencia: mantener la carga'}
            </p>
            <p className="mt-0.5 text-xs text-ink-400">
              {suggestion.reason} Última carga registrada {formatNumber(suggestion.lastWeightKg, 1)} kg. La decisión
              final es tuya.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <caption className="sr-only">Historial de {selected.name}</caption>
          <thead>
            <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-500">
              <th scope="col" className="py-2 pr-3 font-medium">Fecha</th>
              <th scope="col" className="py-2 pr-3 font-medium">Mejor serie</th>
              <th scope="col" className="py-2 pr-3 font-medium">Volumen</th>
              <th scope="col" className="py-2 pr-3 font-medium">1RM est.</th>
              <th scope="col" className="py-2 font-medium">RPE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-850">
            {[...history].reverse().slice(0, 8).map((point) => (
              <tr key={point.sessionId}>
                <td className="py-2.5 pr-3 text-ink-300">{formatShortDate(point.date)}</td>
                <td className="tabular py-2.5 pr-3 text-ink-100">
                  {point.bestSet?.weightKg
                    ? `${formatNumber(point.bestSet.weightKg, 1)} kg × ${point.bestSet.reps ?? '—'}`
                    : point.totalReps > 0
                      ? `${point.totalReps} reps`
                      : '—'}
                </td>
                <td className="tabular py-2.5 pr-3 text-ink-300">{formatNumber(point.volumeKg)} kg</td>
                <td className="tabular py-2.5 pr-3 text-ink-300">{formatNumber(point.e1rm, 1)}</td>
                <td className="tabular py-2.5 text-ink-300">{formatNumber(point.avgRpe, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
