'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import { EXERCISE_METRIC_LABELS, type ExerciseMetric } from '@/lib/services/progress';

function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

export function ExercisePicker({
  exercises,
  selectedId,
  paramKey = 'exercise',
}: {
  exercises: { id: string; name: string }[];
  selectedId: string | null;
  paramKey?: string;
}) {
  const update = useParamUpdater();

  return (
    <label className="block">
      <span className="sr-only">Ejercicio</span>
      <select
        value={selectedId ?? ''}
        onChange={(event) => update(paramKey, event.target.value)}
        className="h-10 w-full max-w-xs rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-50 focus:border-volt-500 focus:outline-none"
      >
        {exercises.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
      </select>
    </label>
  );
}

const METRICS: ExerciseMetric[] = ['max_weight', 'volume', 'e1rm', 'reps', 'rpe'];

export function MetricTabs({ selected, paramKey = 'metric' }: { selected: ExerciseMetric; paramKey?: string }) {
  const update = useParamUpdater();

  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="tablist">
      {METRICS.map((metric) => (
        <button
          key={metric}
          type="button"
          role="tab"
          aria-selected={metric === selected}
          onClick={() => update(paramKey, metric)}
          className={cn(
            'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            metric === selected ? 'bg-volt-500 text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-750',
          )}
        >
          {EXERCISE_METRIC_LABELS[metric]}
        </button>
      ))}
    </div>
  );
}

export function RangeTabs({
  selected,
  options,
  paramKey = 'range',
}: {
  selected: string;
  options: { value: string; label: string }[];
  paramKey?: string;
}) {
  const update = useParamUpdater();

  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => update(paramKey, option.value)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            option.value === selected ? 'bg-ink-700 text-ink-50' : 'bg-ink-850 text-ink-400 hover:bg-ink-800',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
